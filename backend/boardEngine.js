/**
 * boardEngine.js
 * Pummel Party style 20-tile board game engine.
 * Win condition: collect 3 chests.
 */

// ─── Board Layout ──────────────────────────────────────────────────────────────
// Rectangular loop: top(0-5) → right(6-9) → bottom(10-15) → left(16-19)
const TILE_TYPES = {
    normal: 'normal',
    chest: 'chest',
    minigame: 'minigame',
    trap: 'trap',
    star: 'star',
}

const BOARD_TILES = [
    { id: 0, type: 'normal', label: '🏁', name: 'Start' },
    { id: 1, type: 'normal', label: '🟦', name: 'Normal' },
    { id: 2, type: 'chest', label: '🎁', name: 'Treasure' },
    { id: 3, type: 'minigame', label: '🎲', name: 'Mini-Game' },
    { id: 4, type: 'normal', label: '🟦', name: 'Normal' },
    { id: 5, type: 'trap', label: '💀', name: 'Trap' },
    { id: 6, type: 'chest', label: '🎁', name: 'Treasure' },
    { id: 7, type: 'normal', label: '🟦', name: 'Normal' },
    { id: 8, type: 'minigame', label: '🎲', name: 'Mini-Game' },
    { id: 9, type: 'trap', label: '💀', name: 'Trap' },
    { id: 10, type: 'chest', label: '🎁', name: 'Treasure' },
    { id: 11, type: 'normal', label: '🟦', name: 'Normal' },
    { id: 12, type: 'minigame', label: '🎲', name: 'Mini-Game' },
    { id: 13, type: 'trap', label: '💀', name: 'Trap' },
    { id: 14, type: 'normal', label: '🟦', name: 'Normal' },
    { id: 15, type: 'chest', label: '🎁', name: 'Treasure' },
    { id: 16, type: 'minigame', label: '🎲', name: 'Mini-Game' },
    { id: 17, type: 'normal', label: '🟦', name: 'Normal' },
    { id: 18, type: 'trap', label: '💀', name: 'Trap' },
    { id: 19, type: 'normal', label: '🟦', name: 'Normal' },
]

const TOTAL_TILES = BOARD_TILES.length // 20
const CHESTS_TO_WIN = 3

// ─── Game States ───────────────────────────────────────────────────────────────
const boardStates = new Map() // roomId → boardState

function createBoardState(roomId, players) {
    const state = {
        roomId,
        players: players.map((p, i) => ({
            address: p.address,
            name: p.name || p.address?.slice(0, 8),
            isBot: p.isBot || false,
            position: 0,
            chests: 0,
            color: ['#7c3aed', '#06b6d4', '#fbbf24', '#ec4899', '#10b981', '#f97316', '#3b82f6', '#ef4444'][i % 8],
        })),
        turn: 0, // index into players array
        phase: 'rolling', // 'rolling' | 'minigame' | 'finished'
        winner: null,
        lastDice: null,
        log: [],
    }
    boardStates.set(roomId, state)
    return state
}

function getBoardState(roomId) {
    return boardStates.get(roomId)
}

function cleanupBoardState(roomId) {
    boardStates.delete(roomId)
}

// ─── Dice Roll ─────────────────────────────────────────────────────────────────
function rollDice(roomId, address) {
    const state = boardStates.get(roomId)
    if (!state) return { error: 'No board state' }

    const currentPlayer = state.players[state.turn]
    if (currentPlayer.address !== address) {
        return { error: 'Not your turn', currentTurn: currentPlayer.address }
    }
    if (state.phase !== 'rolling') {
        return { error: 'Wrong phase: ' + state.phase }
    }

    const dice = Math.floor(Math.random() * 6) + 1
    state.lastDice = dice

    const oldPos = currentPlayer.position
    const newPos = (oldPos + dice) % TOTAL_TILES
    currentPlayer.position = newPos

    const tile = BOARD_TILES[newPos]
    let effect = { type: tile.type, tile, dice, oldPos, newPos }

    state.log.push(`${currentPlayer.name} rolled ${dice} → ${tile.name}`)

    if (tile.type === 'chest') {
        currentPlayer.chests++
        effect.message = `🎁 ${currentPlayer.name} opened a chest! (${currentPlayer.chests}/${CHESTS_TO_WIN})`

        if (currentPlayer.chests >= CHESTS_TO_WIN) {
            state.phase = 'finished'
            state.winner = address
            effect.winner = address
            effect.message = `🏆 ${currentPlayer.name} collected 3 chests and WINS!`
        }
    } else if (tile.type === 'trap') {
        effect.message = `💀 ${currentPlayer.name} hit a trap! -1 chest`
        if (currentPlayer.chests > 0) currentPlayer.chests--
    } else if (tile.type === 'minigame') {
        state.phase = 'minigame'
        effect.message = `🎲 Mini-game time! Horse Race begins!`
    } else {
        effect.message = `${currentPlayer.name} moved to ${tile.name}`
    }

    // Advance turn (only if not minigame — after minigame finishes, turn advances)
    if (tile.type !== 'minigame' && !effect.winner) {
        state.turn = (state.turn + 1) % state.players.length
    }

    return { ok: true, state: getSafeBoardState(state), effect }
}

// Called after a mini-game ends
function afterMinigame(roomId, winnerAddress) {
    const state = boardStates.get(roomId)
    if (!state) return null

    // Winner gets bonus chest
    if (winnerAddress) {
        const winner = state.players.find(p => p.address === winnerAddress)
        if (winner) {
            winner.chests++
            state.log.push(`🐴 ${winner.name} won the Horse Race! +1 chest (${winner.chests}/${CHESTS_TO_WIN})`)

            if (winner.chests >= CHESTS_TO_WIN) {
                state.phase = 'finished'
                state.winner = winnerAddress
                return { state: getSafeBoardState(state), winner: winnerAddress }
            }
        }
    }

    state.phase = 'rolling'
    state.turn = (state.turn + 1) % state.players.length
    return { state: getSafeBoardState(state) }
}

function getSafeBoardState(state) {
    return {
        players: state.players,
        turn: state.turn,
        currentPlayer: state.players[state.turn]?.address,
        phase: state.phase,
        winner: state.winner,
        lastDice: state.lastDice,
        log: state.log.slice(-10),
        tiles: BOARD_TILES,
    }
}

module.exports = {
    BOARD_TILES,
    CHESTS_TO_WIN,
    createBoardState,
    getBoardState,
    cleanupBoardState,
    rollDice,
    afterMinigame,
    getSafeBoardState,
}
