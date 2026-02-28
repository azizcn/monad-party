/**
 * socketHandlers.js v3 — Pummel Party Edition
 * Board game: initial roll phase, double dice, HP, horse race
 */
const { v4: uuidv4 } = require('uuid')
const {
    createBoardState, getBoardState, cleanupBoardState,
    initialRoll, rollDice, afterMinigame, getSafeBoardState, BOARD_TILES,
} = require('./boardEngine')
const { assignHorses, calculateSpeedModifier, generateHorseReply } = require('./horseAgent')

// ─── Rate limit ───────────────────────────────────────────────────────────────
const lastAction = new Map()
function rateLimit(id, ms = 500) {
    const now = Date.now()
    if (now - (lastAction.get(id) || 0) < ms) return false
    lastAction.set(id, now)
    return true
}

// ─── Horse Race ───────────────────────────────────────────────────────────────
const horseRaces = new Map()

function startHorseRace(io, roomId, players) {
    const horses = assignHorses(players.filter(p => !p.eliminated))
    const raceState = { horses, startTime: Date.now(), finished: false, winner: null, interval: null }
    horseRaces.set(roomId, raceState)
    io.to(roomId).emit('horse-race-start', { horses })

    raceState.interval = setInterval(() => {
        const race = horseRaces.get(roomId)
        if (!race || race.finished) return
        race.horses.forEach(horse => {
            if (horse.finished) return
            let speed = 1.2 + Math.random() * 0.6
            speed *= horse.speedModifier || 1.0
            if (horse.personality === 'stubborn' && Math.random() < 0.15) speed = -speed * 0.3
            if (horse.personality === 'lazy' && Math.random() < 0.12) speed *= 0.1
            horse.position = Math.min(100, Math.max(0, horse.position + speed))
            if (horse.position >= 100 && !horse.finished) {
                horse.finished = true
                if (!race.winner) {
                    race.winner = horse.playerAddress
                    io.to(roomId).emit('horse-finished', { address: horse.playerAddress, horseName: horse.name })
                }
            }
        })
        io.to(roomId).emit('horse-positions', {
            horses: race.horses.map(h => ({ playerAddress: h.playerAddress, position: h.position, emotion: h.emotion, finished: h.finished }))
        })
        const done = race.horses.every(h => h.finished) || (Date.now() - race.startTime > 30000)
        if (done) {
            clearInterval(race.interval)
            race.finished = true
            const w = race.winner || race.horses.sort((a, b) => b.position - a.position)[0]?.playerAddress
            io.to(roomId).emit('horse-race-end', { winner: w })
        }
    }, 120)
    return horses
}

function stopHorseRace(roomId) {
    const r = horseRaces.get(roomId)
    if (r?.interval) clearInterval(r.interval)
    horseRaces.delete(roomId)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getRoomSummary(room) {
    return {
        roomId: room.roomId, roomName: room.roomName, host: room.host,
        players: room.players.map(p => ({ address: p.address, name: p.name, isReady: p.isReady, isBot: p.isBot || false })),
        status: room.status, maxPlayers: room.maxPlayers, isPrivate: room.isPrivate,
    }
}
function broadcast(io, room) { io.to(room.roomId).emit('room-updated', getRoomSummary(room)) }

// ─── Main ─────────────────────────────────────────────────────────────────────
function setupSocketHandlers(io, rooms) {
    io.on('connection', (socket) => {
        let currentRoomId = null

        // ── Create Room ───────────────────────────────────────────────────────────
        socket.on('create-room', ({ walletAddress, roomName, isPrivate, txHash }) => {
            if (!walletAddress) return socket.emit('error', { message: 'Wallet required' })
            const roomId = uuidv4()
            const room = {
                roomId, roomName: roomName || `${walletAddress.slice(0, 6)}'s Room`,
                host: walletAddress,
                players: [{ address: walletAddress, name: walletAddress.slice(0, 8), socketId: socket.id, isReady: false, isBot: false }],
                status: 'waiting', maxPlayers: 8, isPrivate: !!isPrivate,
                createdAt: Date.now(), txHash: txHash || null, chatMessages: [],
            }
            rooms.set(roomId, room)
            socket.join(roomId); currentRoomId = roomId
            socket.emit('room-created', { roomId, room: getRoomSummary(room) })
            broadcast(io, room)
        })

        // ── Join Room ─────────────────────────────────────────────────────────────
        socket.on('join-room', ({ roomId, walletAddress, txHash }) => {
            const room = rooms.get(roomId)
            if (!room) return socket.emit('error', { message: 'Room not found' })
            if (room.status !== 'waiting') return socket.emit('error', { message: 'Game started' })
            if (room.players.length >= room.maxPlayers) return socket.emit('error', { message: 'Full' })
            const existing = room.players.find(p => p.address === walletAddress)
            if (existing) { existing.socketId = socket.id; socket.join(roomId); currentRoomId = roomId; return socket.emit('joined-room', { roomId, room: getRoomSummary(room) }) }
            room.players.push({ address: walletAddress, name: walletAddress.slice(0, 8), socketId: socket.id, isReady: false, isBot: false })
            socket.join(roomId); currentRoomId = roomId
            socket.emit('joined-room', { roomId, room: getRoomSummary(room) })
            broadcast(io, room)
        })

        // ── Quick Match ───────────────────────────────────────────────────────────
        socket.on('quick-match', ({ walletAddress }) => {
            let room = null
            for (const [, r] of rooms) { if (!r.isPrivate && r.status === 'waiting' && r.players.length < r.maxPlayers) { room = r; break } }
            if (!room) {
                const roomId = uuidv4()
                room = { roomId, host: walletAddress, roomName: `Quick #${roomId.slice(0, 4).toUpperCase()}`, players: [], status: 'waiting', maxPlayers: 8, isPrivate: false, createdAt: Date.now(), chatMessages: [] }
                rooms.set(roomId, room)
            }
            if (!room.players.find(p => p.address === walletAddress)) room.players.push({ address: walletAddress, name: walletAddress.slice(0, 8), socketId: socket.id, isReady: false, isBot: false })
            socket.join(room.roomId); currentRoomId = room.roomId
            socket.emit('joined-room', { roomId: room.roomId, room: getRoomSummary(room) })
            broadcast(io, room)
        })

        // ── Add Bot ───────────────────────────────────────────────────────────────
        socket.on('add-bot', ({ walletAddress }) => {
            if (!currentRoomId) return
            const room = rooms.get(currentRoomId)
            if (!room || room.host !== walletAddress || room.status !== 'waiting') return
            if (room.players.length >= room.maxPlayers) return
            const personalities = ['hothead', 'stubborn', 'lazy', 'gentle', 'competitive']
            const p = personalities[Math.floor(Math.random() * personalities.length)]
            const botAddr = `bot_${p.slice(0, 3)}_${uuidv4().slice(0, 4)}`
            const names = { hothead: 'Thunder', stubborn: 'Mule', lazy: 'Slumber', gentle: 'Daisy', competitive: 'Rocket' }
            room.players.push({ address: botAddr, name: `🤖${names[p]}`, socketId: null, isReady: true, isBot: true, botPersonality: p })
            broadcast(io, room)
            io.to(currentRoomId).emit('chat-message', { address: 'SYSTEM', message: `🤖 ${names[p]} Bot joined! (${p})`, timestamp: Date.now() })
        })

        // ── Player Ready ──────────────────────────────────────────────────────────
        socket.on('player-ready', ({ walletAddress, isReady }) => {
            if (!currentRoomId) return
            const room = rooms.get(currentRoomId)
            if (!room) return
            const p = room.players.find(p => p.address === walletAddress)
            if (p) { p.isReady = isReady; broadcast(io, room) }
        })

        // ── Start Game ────────────────────────────────────────────────────────────
        socket.on('start-game', ({ walletAddress }) => {
            if (!currentRoomId) return
            const room = rooms.get(currentRoomId)
            if (!room || room.host !== walletAddress || room.status !== 'waiting') return
            if (room.players.length < 1) return socket.emit('error', { message: 'Need at least 1 player' })

            room.status = 'in_game'
            const boardState = createBoardState(room.roomId, room.players)
            broadcast(io, room)

            io.to(room.roomId).emit('game-starting', {
                players: room.players,
                boardState: getSafeBoardState(boardState),
                tiles: BOARD_TILES,
                phase: 'initial_roll',
            })

            // Bots auto-roll for initial order after 1s
            setTimeout(() => autoInitialRoll(io, rooms, room.roomId), 1500)
        })

        // ── Initial Roll (turn order) ─────────────────────────────────────────────
        socket.on('initial-roll', ({ walletAddress }) => {
            if (!currentRoomId || !rateLimit(socket.id + 'init')) return
            const result = initialRoll(currentRoomId, walletAddress)
            if (result.error) return socket.emit('error', { message: result.error })

            io.to(currentRoomId).emit('initial-roll-result', {
                address: walletAddress,
                dice: result.state?.lastDice,
                orderDetermined: result.orderDetermined,
                boardState: result.state,
                message: result.message,
            })

            if (result.orderDetermined) {
                io.to(currentRoomId).emit('board-updated', { boardState: result.state })
                setTimeout(() => scheduleBotTurn(io, rooms, currentRoomId), 1500)
            }
        })

        // ── Roll Dice (main turn) ─────────────────────────────────────────────────
        socket.on('roll-dice', ({ walletAddress }) => {
            if (!currentRoomId || !rateLimit(socket.id + 'roll')) return
            const result = rollDice(currentRoomId, walletAddress)
            if (result.error) return socket.emit('error', { message: result.error })

            io.to(currentRoomId).emit('dice-rolled', {
                address: walletAddress,
                dice: result.effect.dice,
                total: result.effect.total,
                newPosition: result.effect.newPos,
                tileEffect: result.effect,
                boardState: result.state,
                message: result.effect.message,
            })

            if (result.effect.type === 'minigame') {
                const room = rooms.get(currentRoomId)
                if (room) setTimeout(() => startHorseRace(io, currentRoomId, room.players), 2500)
            }
            if (result.effect.winner) {
                setTimeout(() => { io.to(currentRoomId).emit('board-game-over', { winner: result.effect.winner, boardState: result.state }) }, 1500)
            } else {
                setTimeout(() => scheduleBotTurn(io, rooms, currentRoomId), 1800)
            }
        })

        // ── Horse Events ──────────────────────────────────────────────────────────
        socket.on('horse-encourage', ({ walletAddress }) => {
            const race = horseRaces.get(currentRoomId)
            if (!race) return
            const horse = race.horses.find(h => h.playerAddress === walletAddress)
            if (!horse || horse.finished) return
            const mod = calculateSpeedModifier(horse.personality, 'go run fast', {})
            horse.speedModifier = mod.modifier; horse.emotion = mod.emotion
            setTimeout(() => { if (horse) horse.speedModifier = 1.0 }, mod.duration || 2000)
            io.to(currentRoomId).emit('horse-emotion-change', { playerAddress: walletAddress, emotion: mod.emotion })
        })

        socket.on('horse-chat', async ({ walletAddress, message }) => {
            const race = horseRaces.get(currentRoomId)
            if (!race) return
            const horse = race.horses.find(h => h.playerAddress === walletAddress)
            if (!horse) return
            const sorted = [...race.horses].sort((a, b) => b.position - a.position)
            const rank = sorted.findIndex(h => h.playerAddress === walletAddress)
            const mod = calculateSpeedModifier(horse.personality, message, { isLeading: rank === 0, isLast: rank === race.horses.length - 1 })
            horse.speedModifier = mod.modifier; horse.emotion = mod.emotion
            setTimeout(() => { if (horse) horse.speedModifier = 1.0 }, mod.duration || 2000)
            // Only emit to the player's own socket (individual chat)
            socket.emit('horse-chat-sent', { playerAddress: walletAddress, message, horseName: horse.name, personality: horse.personality, emotion: mod.emotion })
            socket.emit('horse-emotion-change', { playerAddress: walletAddress, emotion: mod.emotion })
            const reply = await generateHorseReply(horse.personality, message)
            socket.emit('horse-reply', { playerAddress: walletAddress, horseName: horse.name, reply, emotion: mod.emotion })
            // Broadcast emotion change & position to everyone
            io.to(currentRoomId).emit('horse-emotion-change', { playerAddress: walletAddress, emotion: mod.emotion })
        })

        socket.on('horse-race-winner', ({ walletAddress }) => {
            if (!currentRoomId) return
            const race = horseRaces.get(currentRoomId)
            if (!race || race.finished) return
            race.finished = true
            clearInterval(race.interval)
            const result = afterMinigame(currentRoomId, walletAddress)
            io.to(currentRoomId).emit('horse-race-end', { winner: walletAddress })
            if (result?.winner) {
                setTimeout(() => { io.to(currentRoomId).emit('board-game-over', { winner: result.winner, boardState: result.state }) }, 1500)
            } else {
                io.to(currentRoomId).emit('board-updated', { boardState: result?.state })
                scheduleBotTurn(io, rooms, currentRoomId)
            }
            horseRaces.delete(currentRoomId)
        })

        // ── Chat / List / Leave / Disconnect ──────────────────────────────────────
        socket.on('chat-message', ({ walletAddress, message }) => {
            if (!currentRoomId) return
            io.to(currentRoomId).emit('chat-message', { address: walletAddress, message: String(message).slice(0, 200), timestamp: Date.now() })
        })
        socket.on('room-list', () => {
            const list = []
            for (const [, r] of rooms) { if (!r.isPrivate && r.status === 'waiting') list.push({ roomId: r.roomId, roomName: r.roomName, playerCount: r.players.length, maxPlayers: r.maxPlayers }) }
            socket.emit('room-list', list)
        })
        socket.on('leave-room', ({ walletAddress }) => leave(walletAddress))
        socket.on('disconnect', () => {
            lastAction.delete(socket.id)
            if (currentRoomId) {
                const room = rooms.get(currentRoomId)
                const p = room?.players.find(q => q.socketId === socket.id)
                if (p && !p.isBot) { p.disconnected = true; setTimeout(() => { if (p.disconnected) leave(p.address) }, 30000) }
            }
        })

        function leave(addr) {
            if (!currentRoomId) return
            const room = rooms.get(currentRoomId)
            if (!room) return
            room.players = room.players.filter(p => p.address !== addr)
            if (!room.players.length) { cleanupBoardState(currentRoomId); stopHorseRace(currentRoomId); rooms.delete(currentRoomId); currentRoomId = null; return }
            if (room.host === addr) { room.host = room.players[0].address; io.to(currentRoomId).emit('host-changed', { newHost: room.host }) }
            socket.leave(currentRoomId); broadcast(io, room); currentRoomId = null
        }
    })
}

// ─── Bot Auto-Play ─────────────────────────────────────────────────────────────
function autoInitialRoll(io, rooms, roomId) {
    const board = getBoardState(roomId)
    if (!board || board.phase !== 'initial_roll') return
    // Bots roll automatically — already handled in initialRoll() for bots
    // Just trigger the first human notification
    io.to(roomId).emit('chat-message', { address: 'SYSTEM', message: '🎲 Roll your die to determine turn order!', timestamp: Date.now() })
}

function scheduleBotTurn(io, rooms, roomId) {
    const board = getBoardState(roomId)
    if (!board || board.phase !== 'rolling') return
    const currentPlayer = board.players[board.turn]
    if (!currentPlayer?.isBot) return

    setTimeout(() => {
        const b = getBoardState(roomId)
        if (!b || b.phase !== 'rolling') return
        const cp = b.players[b.turn]
        if (!cp?.isBot) return
        const result = rollDice(roomId, cp.address)
        if (!result.ok) return
        io.to(roomId).emit('dice-rolled', {
            address: cp.address, dice: result.effect.dice, total: result.effect.total,
            newPosition: result.effect.newPos, tileEffect: result.effect,
            boardState: result.state, message: result.effect.message,
        })
        const botChats = ['Beep boop! 🤖', 'My calculations are perfect!', '🎲 Rolling!', 'Bot mode: ON']
        if (Math.random() < 0.4) io.to(roomId).emit('chat-message', { address: cp.address, message: botChats[Math.floor(Math.random() * botChats.length)], timestamp: Date.now() })
        if (result.effect.winner) {
            setTimeout(() => io.to(roomId).emit('board-game-over', { winner: result.effect.winner, boardState: result.state }), 1500)
        } else if (result.effect.type === 'minigame') {
            const rm = rooms.get(roomId)
            if (rm) setTimeout(() => startHorseRace(io, roomId, rm.players), 2500)
        } else {
            setTimeout(() => scheduleBotTurn(io, rooms, roomId), 1800)
        }
    }, 1500 + Math.random() * 1000)
}

module.exports = { setupSocketHandlers }
