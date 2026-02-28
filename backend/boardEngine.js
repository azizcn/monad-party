/**
 * boardEngine.js v2 — Pummel Party style
 * Double dice, HP system, turn-order sort, winding 28-tile path
 */

// ─── Board Tiles (28 tiles, winding path) ─────────────────────────────────────
const BOARD_TILES = [
    { id: 0, type: 'start', label: '🏁', name: 'Start' },
    { id: 1, type: 'normal', label: '🔵', name: 'Normal' },
    { id: 2, type: 'chest', label: '🎁', name: 'Chest' },
    { id: 3, type: 'normal', label: '🔵', name: 'Normal' },
    { id: 4, type: 'trap', label: '💀', name: 'Trap' },
    { id: 5, type: 'normal', label: '🔵', name: 'Normal' },
    { id: 6, type: 'minigame', label: '🎲', name: 'Horse Race' },
    { id: 7, type: 'normal', label: '🔵', name: 'Normal' },
    { id: 8, type: 'chest', label: '🎁', name: 'Chest' },
    { id: 9, type: 'trap', label: '💀', name: 'Trap' },
    { id: 10, type: 'normal', label: '🔵', name: 'Normal' },
    { id: 11, type: 'heal', label: '❤️', name: 'Heal' },
    { id: 12, type: 'normal', label: '🔵', name: 'Normal' },
    { id: 13, type: 'minigame', label: '🎲', name: 'Horse Race' },
    { id: 14, type: 'chest', label: '🎁', name: 'Chest' },
    { id: 15, type: 'trap', label: '💀', name: 'Trap' },
    { id: 16, type: 'normal', label: '🔵', name: 'Normal' },
    { id: 17, type: 'chest', label: '🎁', name: 'Chest' },
    { id: 18, type: 'normal', label: '🔵', name: 'Normal' },
    { id: 19, type: 'trap', label: '💀', name: 'Trap' },
    { id: 20, type: 'normal', label: '🔵', name: 'Normal' },
    { id: 21, type: 'minigame', label: '🎲', name: 'Horse Race' },
    { id: 22, type: 'heal', label: '❤️', name: 'Heal' },
    { id: 23, type: 'normal', label: '🔵', name: 'Normal' },
    { id: 24, type: 'chest', label: '🎁', name: 'Chest' },
    { id: 25, type: 'trap', label: '💀', name: 'Trap' },
    { id: 26, type: 'normal', label: '🔵', name: 'Normal' },
    { id: 27, type: 'chest', label: '🎁', name: 'Chest' },
]

const TOTAL_TILES = BOARD_TILES.length
const CHESTS_TO_WIN = 3
const MAX_HP = 3

// ─── In-memory state ──────────────────────────────────────────────────────────
const boardStates = new Map()

function createBoardState(roomId, players) {
    const state = {
        roomId,
        phase: 'initial_roll', // 'initial_roll' | 'rolling' | 'minigame' | 'finished'
        players: players.map((p, i) => ({
            address: p.address,
            name: p.name || p.address?.slice(0, 8),
            isBot: p.isBot || false,
            position: 0,
            chests: 0,
            hp: MAX_HP,
            eliminated: false,
            color: ['#7c3aed', '#06b6d4', '#fbbf24', '#ec4899', '#10b981', '#f97316', '#3b82f6', '#ef4444'][i % 8],
            initialRoll: null, // for turn-order sort
        })),
        turn: 0,          // current player index (sorted by initial roll)
        winner: null,
        lastDice: null,   // [d1, d2]
        log: [],
        initialRollsLeft: players.length, // how many still need to roll for order
    }
    boardStates.set(roomId, state)
    return state
}

function getBoardState(roomId) { return boardStates.get(roomId) }
function cleanupBoardState(roomId) { boardStates.delete(roomId) }

// ─── Initial Roll (determines turn order) ─────────────────────────────────────
function initialRoll(roomId, address) {
    const state = boardStates.get(roomId)
    if (!state) return { error: 'No board state' }
    if (state.phase !== 'initial_roll') return { error: 'Wrong phase' }

    const player = state.players.find(p => p.address === address)
    if (!player) return { error: 'Player not found' }
    if (player.initialRoll !== null) return { error: 'Already rolled' }

    const d1 = Math.floor(Math.random() * 6) + 1
    const d2 = Math.floor(Math.random() * 6) + 1
    player.initialRoll = d1 + d2

    state.log.push(`${player.name} rolled ${d1}+${d2}=${d1 + d2} for turn order`)

    // Check if everyone (including bots) has rolled
    const botsWithoutRoll = state.players.filter(p => p.isBot && p.initialRoll === null)
    botsWithoutRoll.forEach(bot => {
        const b1 = Math.floor(Math.random() * 6) + 1
        const b2 = Math.floor(Math.random() * 6) + 1
        bot.initialRoll = b1 + b2
        state.log.push(`${bot.name} rolled ${b1}+${b2}=${b1 + b2} for turn order`)
    })

    const allRolled = state.players.every(p => p.initialRoll !== null)
    if (allRolled) {
        // Sort players high→low by initial roll (= turn order)
        state.players.sort((a, b) => b.initialRoll - a.initialRoll)
        state.phase = 'rolling'
        state.turn = 0
        return {
            ok: true,
            orderDetermined: true,
            state: getSafeBoardState(state),
            message: `Turn order determined! ${state.players.map((p, i) => `${i + 1}. ${p.name} (${p.initialRoll})`).join(' → ')}`,
        }
    }

    return {
        ok: true,
        orderDetermined: false,
        state: getSafeBoardState(state),
        message: `${player.name} rolled ${d1 + d2}. Waiting for others...`,
    }
}

// ─── Main Dice Roll ───────────────────────────────────────────────────────────
function rollDice(roomId, address) {
    const state = boardStates.get(roomId)
    if (!state) return { error: 'No board state' }
    if (state.phase !== 'rolling') return { error: 'Wrong phase: ' + state.phase }

    const currentPlayer = state.players[state.turn]
    if (!currentPlayer) return { error: 'No current player' }
    if (currentPlayer.address !== address) {
        return { error: 'Not your turn', currentTurn: currentPlayer.address }
    }

    // Roll 2 dice
    const d1 = Math.floor(Math.random() * 6) + 1
    const d2 = Math.floor(Math.random() * 6) + 1
    const total = d1 + d2
    state.lastDice = [d1, d2]

    const oldPos = currentPlayer.position
    const newPos = (oldPos + total) % TOTAL_TILES
    currentPlayer.position = newPos

    const tile = BOARD_TILES[newPos]
    let effect = { type: tile.type, tile, dice: [d1, d2], total, oldPos, newPos }

    if (tile.type === 'chest') {
        currentPlayer.chests++
        effect.message = `🎁 ${currentPlayer.name} rolled ${d1}+${d2}=${total}, landed on CHEST! (${currentPlayer.chests}/${CHESTS_TO_WIN})`
        if (currentPlayer.chests >= CHESTS_TO_WIN) {
            state.phase = 'finished'
            state.winner = address
            effect.winner = address
            effect.message = `🏆 ${currentPlayer.name} collected 3 chests and WINS THE GAME!`
        }
    } else if (tile.type === 'trap') {
        currentPlayer.hp = Math.max(0, currentPlayer.hp - 1)
        effect.message = `💀 ${currentPlayer.name} rolled ${d1}+${d2}=${total}, hit a TRAP! -1 HP (${currentPlayer.hp}/${MAX_HP} ❤️)`
        if (currentPlayer.hp <= 0) {
            currentPlayer.eliminated = true
            effect.eliminated = address
            effect.message += ` — ${currentPlayer.name} is ELIMINATED!`
            // Check if only 1 alive
            const alive = state.players.filter(p => !p.eliminated)
            if (alive.length === 1) {
                state.phase = 'finished'
                state.winner = alive[0].address
                effect.winner = alive[0].address
            }
        }
    } else if (tile.type === 'heal') {
        if (currentPlayer.hp < MAX_HP) {
            currentPlayer.hp = Math.min(MAX_HP, currentPlayer.hp + 1)
            effect.message = `❤️ ${currentPlayer.name} rolled ${d1}+${d2}=${total}, healed! (${currentPlayer.hp}/${MAX_HP} ❤️)`
        } else {
            effect.message = `❤️ ${currentPlayer.name} rolled ${d1}+${d2}=${total}, already full HP!`
        }
    } else if (tile.type === 'minigame') {
        state.phase = 'minigame'
        effect.message = `🎲 ${currentPlayer.name} rolled ${d1}+${d2}=${total} — HORSE RACE!`
    } else {
        effect.message = `${currentPlayer.name} rolled ${d1}+${d2}=${total} → ${tile.name}`
    }

    state.log.push(effect.message)

    // Advance turn (skip eliminated players)
    if (tile.type !== 'minigame' && !effect.winner) {
        advanceTurn(state)
    }

    return { ok: true, state: getSafeBoardState(state), effect }
}

function advanceTurn(state) {
    let next = (state.turn + 1) % state.players.length
    let tries = 0
    while (state.players[next]?.eliminated && tries < state.players.length) {
        next = (next + 1) % state.players.length
        tries++
    }
    state.turn = next
}

function afterMinigame(roomId, winnerAddress) {
    const state = boardStates.get(roomId)
    if (!state) return null

    if (winnerAddress) {
        const winner = state.players.find(p => p.address === winnerAddress)
        if (winner) {
            winner.chests++
            state.log.push(`🐴 ${winner.name} won Horse Race! +1 chest (${winner.chests}/${CHESTS_TO_WIN})`)
            if (winner.chests >= CHESTS_TO_WIN) {
                state.phase = 'finished'
                state.winner = winnerAddress
                return { state: getSafeBoardState(state), winner: winnerAddress }
            }
        }
    }

    state.phase = 'rolling'
    advanceTurn(state)
    return { state: getSafeBoardState(state) }
}

function getSafeBoardState(state) {
    return {
        players: state.players,
        turn: state.turn,
        currentPlayer: state.players.filter(p => !p.eliminated)[state.turn]?.address || state.players[state.turn]?.address,
        phase: state.phase,
        winner: state.winner,
        lastDice: state.lastDice,
        log: state.log.slice(-12),
        tiles: BOARD_TILES,
    }
}

module.exports = {
    BOARD_TILES, CHESTS_TO_WIN, MAX_HP,
    createBoardState, getBoardState, cleanupBoardState,
    initialRoll, rollDice, afterMinigame, getSafeBoardState,
}
