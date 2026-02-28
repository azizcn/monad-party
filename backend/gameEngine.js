/**
 * gameEngine.js
 * Mini-game rotation engine — manages game flow, scoring, and timers server-side.
 */

const { generateQuestion, generateAnnouncement } = require("./aiAgent");

// ─── Mini Game Definitions ─────────────────────────────────────────────────────
const MINI_GAMES = [
    {
        id: "last-standing",
        name: "Last Standing",
        description: "Knock out all opponents! Last one alive wins.",
        duration: 90, // seconds
        icon: "⚔️",
    },
    {
        id: "coin-rush",
        name: "Coin Rush",
        description: "Collect as many coins as possible in 30 seconds!",
        duration: 30,
        icon: "💰",
    },
    {
        id: "bomb-dodge",
        name: "Bomb Dodge",
        description: "Dodge the falling bombs! Last survivor wins.",
        duration: 60,
        icon: "💣",
    },
    {
        id: "race",
        name: "Checkpoint Race",
        description: "First to reach the finish line wins!",
        duration: 60,
        icon: "🏁",
    },
    {
        id: "trivia",
        name: "Crypto Trivia",
        description: "Answer the AI's question first to win!",
        duration: 15,
        icon: "🧠",
    },
    {
        id: "platform-survival",
        name: "Platform Survival",
        description: "Survive as platforms disappear below you!",
        duration: 60,
        icon: "🏔️",
    },
];

const TOTAL_ROUNDS = 3;
const POINTS_PER_WIN = 100;
const POINTS_PER_PLACEMENT = [100, 70, 50, 35, 25, 15, 10, 5]; // 1st-8th

// ─── Game State ────────────────────────────────────────────────────────────────
// gameState shape per room:
// {
//   round: number,
//   currentGameIndex: number,
//   gameQueue: string[],        // shuffled game IDs
//   scores: { [address]: number },
//   currentGame: { id, name, duration, startedAt, timer, triviaQuestion? },
//   eliminatedPlayers: Set<string>,
//   roundWinners: [{ round, winner, game }],
// }

const gameStates = new Map(); // roomId → gameState

// ─── Helpers ──────────────────────────────────────────────────────────────────
function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function pickGameQueue() {
    const shuffled = shuffle(MINI_GAMES);
    // Ensure trivia is not the same every time; take first 3
    return shuffled.slice(0, TOTAL_ROUNDS).map((g) => g.id);
}

function getGameDef(id) {
    return MINI_GAMES.find((g) => g.id === id);
}

// ─── Exports ──────────────────────────────────────────────────────────────────

/**
 * Initialize game state for a room.
 */
function initGameState(roomId, players) {
    const scores = {};
    players.forEach((p) => {
        scores[p.address] = 0;
    });

    const state = {
        round: 0,
        gameQueue: pickGameQueue(),
        scores,
        currentGame: null,
        eliminatedPlayers: new Set(),
        roundWinners: [],
        players: players.map((p) => p.address),
    };

    gameStates.set(roomId, state);
    return state;
}

/**
 * Start a mini-game for a room.
 * @param {import('socket.io').Server} io
 * @param {string} roomId
 * @param {Map} rooms
 */
async function startNextMiniGame(io, roomId, rooms) {
    const state = gameStates.get(roomId);
    if (!state) return;

    const room = rooms.get(roomId);
    if (!room) return;

    if (state.round >= TOTAL_ROUNDS) {
        return endGame(io, roomId, rooms);
    }

    const gameId = state.gameQueue[state.round];
    const gameDef = getGameDef(gameId);
    state.round += 1;

    // Reset eliminations each round
    state.eliminatedPlayers = new Set();

    // Generate extra data for trivia
    let triviaQuestion = null;
    if (gameId === "trivia") {
        try {
            triviaQuestion = await generateQuestion("crypto", "medium");
        } catch {
            triviaQuestion = {
                question: "What is the consensus mechanism used by Monad?",
                options: ["Proof of Work", "Proof of Stake", "MonadBFT", "Delegated PoS"],
                answer: "MonadBFT",
            };
        }
    }

    state.currentGame = {
        id: gameId,
        name: gameDef.name,
        duration: gameDef.duration,
        icon: gameDef.icon,
        description: gameDef.description,
        startedAt: Date.now(),
        triviaQuestion,
    };

    // Generate AI announcement
    let announcement = `Round ${state.round}! Get ready for ${gameDef.name}!`;
    try {
        announcement = await generateAnnouncement(gameDef.name, room.players.length);
    } catch {
        // use default
    }

    // Broadcast mini-game start
    io.to(roomId).emit("mini-game-start", {
        round: state.round,
        totalRounds: TOTAL_ROUNDS,
        game: state.currentGame,
        scores: state.scores,
        announcement,
    });

    // Server-side auto-end timer
    state.currentGame.timer = setTimeout(() => {
        endMiniGame(io, roomId, rooms, null); // null = time-based ending
    }, (gameDef.duration + 2) * 1000); // +2s grace
}

/**
 * Handle a player action in the current mini-game.
 * Returns { valid, result } — result broadcasted by caller.
 */
function handlePlayerAction(roomId, playerId, action) {
    const state = gameStates.get(roomId);
    if (!state || !state.currentGame) return { valid: false };
    if (state.eliminatedPlayers.has(playerId)) return { valid: false, reason: "eliminated" };

    switch (state.currentGame.id) {
        case "coin-rush": {
            if (action.type === "collect-coin") {
                state.scores[playerId] = (state.scores[playerId] || 0) + 1;
                return { valid: true, result: { scores: state.scores } };
            }
            break;
        }
        case "trivia": {
            if (action.type === "answer") {
                const correct = action.answer === state.currentGame.triviaQuestion?.answer;
                return { valid: true, result: { correct, answer: action.answer } };
            }
            break;
        }
        case "bomb-dodge":
        case "platform-survival":
        case "last-standing": {
            if (action.type === "eliminated") {
                state.eliminatedPlayers.add(playerId);
                return { valid: true, result: { eliminated: playerId } };
            }
            break;
        }
    }

    return { valid: true, result: {} };
}

/**
 * End the current mini-game, assign points, and start next or end overall game.
 * @param {import('socket.io').Server} io
 * @param {string} roomId
 * @param {Map} rooms
 * @param {string | null} forcedWinner - if provided, this player wins; otherwise auto-detect
 */
function endMiniGame(io, roomId, rooms, forcedWinner) {
    const state = gameStates.get(roomId);
    if (!state || !state.currentGame) return;

    // Cancel auto-timer
    if (state.currentGame.timer) {
        clearTimeout(state.currentGame.timer);
        state.currentGame.timer = null;
    }

    const gameId = state.currentGame.id;
    const alive = state.players.filter((p) => !state.eliminatedPlayers.has(p));
    let winner = forcedWinner;

    if (!winner) {
        if (gameId === "coin-rush") {
            // Winner = highest coin score
            winner = alive.reduce((best, p) =>
                (state.scores[p] || 0) > (state.scores[best] || 0) ? p : best
            );
        } else {
            // Survival games: last alive wins
            winner = alive.length === 1 ? alive[0] : alive[0] ?? state.players[0];
        }
    }

    // Award placement points
    const placements = [winner, ...alive.filter((p) => p !== winner), ...Array.from(state.eliminatedPlayers)];
    placements.forEach((p, i) => {
        state.scores[p] = (state.scores[p] || 0) + (POINTS_PER_PLACEMENT[i] || 0);
    });

    state.roundWinners.push({ round: state.round, winner, game: gameId });
    state.currentGame = null;

    io.to(roomId).emit("mini-game-end", {
        winner,
        placements,
        scores: state.scores,
        roundWinners: state.roundWinners,
        nextRound: state.round < TOTAL_ROUNDS,
    });

    // Schedule next game after 5s
    if (state.round < TOTAL_ROUNDS) {
        setTimeout(() => startNextMiniGame(io, roomId, rooms), 5000);
    } else {
        setTimeout(() => endGame(io, roomId, rooms), 5000);
    }
}

/**
 * End the overall game and declare the champion.
 */
function endGame(io, roomId, rooms) {
    const state = gameStates.get(roomId);
    if (!state) return;

    const room = rooms.get(roomId);
    if (room) room.status = "finished";

    // Sort by score descending
    const sortedPlayers = Object.entries(state.scores)
        .sort(([, a], [, b]) => b - a)
        .map(([address, score], index) => ({ address, score, rank: index + 1 }));

    const champion = sortedPlayers[0]?.address;

    io.to(roomId).emit("game-over", {
        champion,
        leaderboard: sortedPlayers,
        roundWinners: state.roundWinners,
    });

    // Cleanup after 60s
    setTimeout(() => gameStates.delete(roomId), 60000);
}

/**
 * Get current game state for a room.
 */
function getGameState(roomId) {
    return gameStates.get(roomId) || null;
}

/**
 * Clean up game state.
 */
function cleanupGameState(roomId) {
    const state = gameStates.get(roomId);
    if (state?.currentGame?.timer) {
        clearTimeout(state.currentGame.timer);
    }
    gameStates.delete(roomId);
}

module.exports = {
    initGameState,
    startNextMiniGame,
    handlePlayerAction,
    endMiniGame,
    endGame,
    getGameState,
    cleanupGameState,
    MINI_GAMES,
    TOTAL_ROUNDS,
};
