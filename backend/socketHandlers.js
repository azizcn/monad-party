/**
 * socketHandlers.js - v2 (Board Game Edition)
 * Handles room management + board game + horse race + real bot players.
 */

const { v4: uuidv4 } = require('uuid')
const {
    createBoardState, getBoardState, cleanupBoardState,
    rollDice, afterMinigame, getSafeBoardState, BOARD_TILES,
} = require('./boardEngine')
const {
    assignHorses, calculateSpeedModifier, generateHorseReply,
} = require('./horseAgent')

// ─── Rate Limiting ─────────────────────────────────────────────────────────────
const moveRateLimits = new Map()
function checkRateLimit(socketId, limitMs = 200) {
    const now = Date.now()
    const last = moveRateLimits.get(socketId) || 0
    if (now - last < limitMs) return false
    moveRateLimits.set(socketId, now)
    return true
}

// ─── Horse Race State ──────────────────────────────────────────────────────────
// roomId → { horses: [], startTime, finished, interval }
const horseRaces = new Map()

function startHorseRace(io, roomId, players) {
    const horses = assignHorses(players)
    const RACE_DURATION = 30000 // 30 seconds max

    const raceState = {
        horses,
        startTime: Date.now(),
        finished: false,
        winner: null,
        interval: null,
    }
    horseRaces.set(roomId, raceState)

    io.to(roomId).emit('horse-race-start', { horses })

    // Simulate base horse movement (server-side authoritative positions)
    raceState.interval = setInterval(() => {
        const race = horseRaces.get(roomId)
        if (!race || race.finished) return

        race.horses.forEach(horse => {
            if (horse.finished) return
            // Base speed + personality variance
            let baseSpeed = 1.2 + Math.random() * 0.6
            baseSpeed *= horse.speedModifier || 1.0

            // Stubborn horses sometimes randomly do opposite
            if (horse.personality === 'stubborn' && Math.random() < 0.2) {
                baseSpeed = -baseSpeed * 0.3
            }
            // Lazy horses randomly slow
            if (horse.personality === 'lazy' && Math.random() < 0.15) {
                baseSpeed *= 0.1
            }

            horse.position = Math.min(100, Math.max(0, horse.position + baseSpeed))

            if (horse.position >= 100 && !horse.finished) {
                horse.finished = true
                if (!race.winner) {
                    race.winner = horse.playerAddress
                    io.to(roomId).emit('horse-finished', { address: horse.playerAddress, horseName: horse.name })
                }
            }
        })

        io.to(roomId).emit('horse-positions', {
            horses: race.horses.map(h => ({
                playerAddress: h.playerAddress,
                position: h.position,
                emotion: h.emotion,
                finished: h.finished,
            }))
        })

        // End race if winner or timeout
        const allFinished = race.horses.every(h => h.finished)
        const timedOut = Date.now() - race.startTime > RACE_DURATION
        if (allFinished || timedOut) {
            clearInterval(race.interval)
            race.finished = true
            const winner = race.winner || race.horses.sort((a, b) => b.position - a.position)[0]?.playerAddress
            io.to(roomId).emit('horse-race-end', { winner })
        }
    }, 100) // 10fps server tick

    return horses
}

function stopHorseRace(roomId) {
    const race = horseRaces.get(roomId)
    if (race?.interval) clearInterval(race.interval)
    horseRaces.delete(roomId)
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function getRoomSummary(room) {
    return {
        roomId: room.roomId,
        roomName: room.roomName,
        host: room.host,
        players: room.players.map(p => ({
            address: p.address,
            name: p.name,
            isReady: p.isReady,
            isBot: p.isBot || false,
        })),
        status: room.status,
        maxPlayers: room.maxPlayers,
        isPrivate: room.isPrivate,
    }
}

function broadcastRoomUpdate(io, room) {
    io.to(room.roomId).emit('room-updated', getRoomSummary(room))
}

// ─── Main Handler ──────────────────────────────────────────────────────────────
function setupSocketHandlers(io, rooms) {
    io.on('connection', (socket) => {
        console.log(`[Socket] Connected: ${socket.id}`)
        let currentRoomId = null

        // ── Create Room ───────────────────────────────────────────────────────
        socket.on('create-room', ({ walletAddress, roomName, isPrivate, maxPlayers = 8, txHash }) => {
            if (!walletAddress) return socket.emit('error', { message: 'Wallet address required' })

            const roomId = uuidv4()
            const room = {
                roomId,
                roomName: roomName || `${walletAddress.slice(0, 6)}'s Room`,
                host: walletAddress,
                players: [{
                    address: walletAddress,
                    name: walletAddress.slice(0, 8),
                    socketId: socket.id,
                    isReady: false,
                    isBot: false,
                }],
                status: 'waiting',
                maxPlayers: Math.min(Math.max(maxPlayers, 2), 8),
                isPrivate: !!isPrivate,
                createdAt: Date.now(),
                txHash: txHash || null,
                chatMessages: [],
            }

            rooms.set(roomId, room)
            socket.join(roomId)
            currentRoomId = roomId
            socket.emit('room-created', { roomId, room: getRoomSummary(room) })
            broadcastRoomUpdate(io, room)
            console.log(`[Room] Created: ${roomId} by ${walletAddress}`)
        })

        // ── Join Room ─────────────────────────────────────────────────────────
        socket.on('join-room', ({ roomId, walletAddress, txHash }) => {
            const room = rooms.get(roomId)
            if (!room) return socket.emit('error', { message: 'Room not found' })
            if (room.status !== 'waiting') return socket.emit('error', { message: 'Game already started' })
            if (room.players.length >= room.maxPlayers) return socket.emit('error', { message: 'Room is full' })

            const existingPlayer = room.players.find(p => p.address === walletAddress)
            if (existingPlayer) {
                existingPlayer.socketId = socket.id
                socket.join(roomId)
                currentRoomId = roomId
                return socket.emit('joined-room', { roomId, room: getRoomSummary(room) })
            }

            room.players.push({
                address: walletAddress,
                name: walletAddress.slice(0, 8),
                socketId: socket.id,
                isReady: false,
                isBot: false,
                txHash: txHash || null,
            })

            socket.join(roomId)
            currentRoomId = roomId
            socket.emit('joined-room', { roomId, room: getRoomSummary(room) })
            broadcastRoomUpdate(io, room)
        })

        // ── Quick Match ───────────────────────────────────────────────────────
        socket.on('quick-match', ({ walletAddress, txHash }) => {
            if (!walletAddress) return socket.emit('error', { message: 'Wallet address required' })
            let room = null
            for (const [, r] of rooms) {
                if (!r.isPrivate && r.status === 'waiting' && r.players.length < r.maxPlayers) { room = r; break }
            }
            if (!room) {
                const roomId = uuidv4()
                room = {
                    roomId, host: walletAddress,
                    roomName: `Quick Match #${roomId.slice(0, 4).toUpperCase()}`,
                    players: [], status: 'waiting', maxPlayers: 8,
                    isPrivate: false, createdAt: Date.now(), txHash: null, chatMessages: [],
                }
                rooms.set(roomId, room)
            }
            if (!room.players.find(p => p.address === walletAddress)) {
                room.players.push({ address: walletAddress, name: walletAddress.slice(0, 8), socketId: socket.id, isReady: false, isBot: false })
            }
            socket.join(room.roomId)
            currentRoomId = room.roomId
            socket.emit('joined-room', { roomId: room.roomId, room: getRoomSummary(room) })
            broadcastRoomUpdate(io, room)
        })

        // ── Add Bot ───────────────────────────────────────────────────────────
        socket.on('add-bot', ({ walletAddress, difficulty = 'easy' }) => {
            if (!currentRoomId) return
            const room = rooms.get(currentRoomId)
            if (!room || room.host !== walletAddress) return
            if (room.status !== 'waiting') return
            if (room.players.length >= room.maxPlayers) return

            const personalities = ['hothead', 'stubborn', 'lazy', 'gentle', 'competitive']
            const p = personalities[Math.floor(Math.random() * personalities.length)]
            const botAddr = `Bot_${p.slice(0, 3).toUpperCase()}_${uuidv4().slice(0, 4)}`
            const bot = {
                address: botAddr,
                name: `🤖${p.charAt(0).toUpperCase() + p.slice(1)}Bot`,
                socketId: null,
                isReady: true,
                isBot: true,
                botPersonality: p,
            }
            room.players.push(bot)
            broadcastRoomUpdate(io, room)
            io.to(currentRoomId).emit('chat-message', {
                address: 'SYSTEM',
                message: `🤖 ${bot.name} joined! (${p} personality)`,
                timestamp: Date.now(),
            })
        })

        // ── Player Ready ──────────────────────────────────────────────────────
        socket.on('player-ready', ({ walletAddress, isReady }) => {
            if (!currentRoomId) return
            const room = rooms.get(currentRoomId)
            if (!room) return
            const player = room.players.find(p => p.address === walletAddress)
            if (player) {
                player.isReady = isReady
                broadcastRoomUpdate(io, room)
            }
        })

        // ── Start Game (Board Game) ───────────────────────────────────────────
        socket.on('start-game', ({ walletAddress }) => {
            if (!currentRoomId) return
            const room = rooms.get(currentRoomId)
            if (!room) return socket.emit('error', { message: 'Room not found' })
            if (room.host !== walletAddress) return socket.emit('error', { message: 'Only host can start' })
            if (room.players.length < 1) return socket.emit('error', { message: 'Need at least 1 player' })
            if (room.status !== 'waiting') return socket.emit('error', { message: 'Game already started' })

            room.status = 'in_game'
            const boardState = createBoardState(room.roomId, room.players)

            broadcastRoomUpdate(io, room)
            io.to(room.roomId).emit('game-starting', {
                players: room.players,
                boardState: getSafeBoardState(boardState),
                tiles: BOARD_TILES,
            })

            // Schedule bot turns
            scheduleBotTurn(io, rooms, room.roomId)
        })

        // ── Roll Dice ─────────────────────────────────────────────────────────
        socket.on('roll-dice', ({ walletAddress }) => {
            if (!currentRoomId) return
            if (!checkRateLimit(socket.id, 500)) return

            const result = rollDice(currentRoomId, walletAddress)
            if (result.error) return socket.emit('error', { message: result.error })

            io.to(currentRoomId).emit('dice-rolled', {
                address: walletAddress,
                dice: result.effect.dice,
                newPosition: result.effect.newPos,
                tileEffect: result.effect,
                boardState: result.state,
                message: result.effect.message,
            })

            // Trigger horse race if minigame tile
            if (result.effect.type === 'minigame') {
                const room = rooms.get(currentRoomId)
                if (room) {
                    setTimeout(() => {
                        const horses = startHorseRace(io, currentRoomId, room.players)
                    }, 2000)
                }
            }

            // Check for winner
            if (result.effect.winner) {
                setTimeout(() => {
                    io.to(currentRoomId).emit('board-game-over', {
                        winner: result.effect.winner,
                        boardState: result.state,
                    })
                    cleanupBoardState(currentRoomId)
                }, 1500)
            } else {
                // Schedule bot turn if needed
                setTimeout(() => scheduleBotTurn(io, rooms, currentRoomId), 1500)
            }
        })

        // ── Horse Race Events ─────────────────────────────────────────────────

        // Player encourages their horse (SPACE key)
        socket.on('horse-encourage', ({ walletAddress }) => {
            const race = horseRaces.get(currentRoomId)
            if (!race) return
            const horse = race.horses.find(h => h.playerAddress === walletAddress)
            if (!horse || horse.finished) return

            // Apply encouragement based on personality
            const mod = calculateSpeedModifier(horse.personality, 'go run fast', {
                isLeading: race.horses.indexOf(horse) === 0,
                isLast: race.horses.indexOf(horse) === race.horses.length - 1,
            })
            horse.speedModifier = mod.modifier
            horse.emotion = mod.emotion
            setTimeout(() => { if (horse) horse.speedModifier = 1.0 }, mod.duration || 2000)

            io.to(currentRoomId).emit('horse-emotion-change', {
                playerAddress: walletAddress,
                emotion: mod.emotion,
                modifier: mod.modifier,
            })
        })

        // Player chats with their horse
        socket.on('horse-chat', async ({ walletAddress, message }) => {
            const race = horseRaces.get(currentRoomId)
            if (!race) return
            const horse = race.horses.find(h => h.playerAddress === walletAddress)
            if (!horse) return

            // Calculate speed effect from message
            const sortedByPos = [...race.horses].sort((a, b) => b.position - a.position)
            const myRank = sortedByPos.findIndex(h => h.playerAddress === walletAddress)
            const mod = calculateSpeedModifier(horse.personality, message, {
                isLeading: myRank === 0,
                isLast: myRank === race.horses.length - 1,
            })

            horse.speedModifier = mod.modifier
            horse.emotion = mod.emotion
            setTimeout(() => { if (horse) horse.speedModifier = 1.0 }, mod.duration || 2000)

            // Broadcast chat + emotion change to room
            io.to(currentRoomId).emit('horse-chat-sent', {
                playerAddress: walletAddress,
                message,
                horseName: horse.name,
                personality: horse.personality,
                emotion: mod.emotion,
            })

            io.to(currentRoomId).emit('horse-emotion-change', {
                playerAddress: walletAddress,
                emotion: mod.emotion,
                modifier: mod.modifier,
            })

            // Generate horse reply (async, don't block)
            generateHorseReply(horse.personality, message).then(reply => {
                io.to(currentRoomId).emit('horse-reply', {
                    playerAddress: walletAddress,
                    horseName: horse.name,
                    reply,
                    emotion: mod.emotion,
                })
            })
        })

        // ── Horse Race End (client reports) ───────────────────────────────────
        socket.on('horse-race-winner', ({ walletAddress }) => {
            if (!currentRoomId) return
            const race = horseRaces.get(currentRoomId)
            if (!race || race.finished) return

            race.finished = true
            clearInterval(race.interval)

            const result = afterMinigame(currentRoomId, walletAddress)
            io.to(currentRoomId).emit('horse-race-end', { winner: walletAddress })

            if (result?.winner) {
                setTimeout(() => {
                    io.to(currentRoomId).emit('board-game-over', { winner: result.winner, boardState: result.state })
                    cleanupBoardState(currentRoomId)
                }, 1500)
            } else {
                io.to(currentRoomId).emit('board-updated', { boardState: result?.state })
                scheduleBotTurn(io, rooms, currentRoomId)
            }
            horseRaces.delete(currentRoomId)
        })

        // ── Room List ─────────────────────────────────────────────────────────
        socket.on('room-list', () => {
            const publicRooms = []
            for (const [, room] of rooms) {
                if (!room.isPrivate && room.status === 'waiting') {
                    publicRooms.push({
                        roomId: room.roomId, roomName: room.roomName,
                        host: room.host, playerCount: room.players.length,
                        maxPlayers: room.maxPlayers, createdAt: room.createdAt,
                    })
                }
            }
            socket.emit('room-list', publicRooms)
        })

        // ── Chat ──────────────────────────────────────────────────────────────
        socket.on('chat-message', ({ walletAddress, message }) => {
            if (!currentRoomId) return
            const msg = { address: walletAddress, message: String(message).slice(0, 200), timestamp: Date.now() }
            io.to(currentRoomId).emit('chat-message', msg)
        })

        // ── Leave / Disconnect ────────────────────────────────────────────────
        socket.on('leave-room', ({ walletAddress }) => handleLeave(walletAddress))

        socket.on('disconnect', () => {
            console.log(`[Socket] Disconnected: ${socket.id}`)
            moveRateLimits.delete(socket.id)
            if (currentRoomId) {
                const room = rooms.get(currentRoomId)
                if (room) {
                    const player = room.players.find(p => p.socketId === socket.id)
                    if (player && !player.isBot) {
                        player.disconnected = true
                        setTimeout(() => {
                            if (player.disconnected) handleLeave(player.address)
                        }, 30000)
                    }
                }
            }
        })

        function handleLeave(walletAddress) {
            if (!currentRoomId) return
            const room = rooms.get(currentRoomId)
            if (!room) return
            room.players = room.players.filter(p => p.address !== walletAddress)
            if (room.players.length === 0) {
                cleanupBoardState(currentRoomId)
                stopHorseRace(currentRoomId)
                rooms.delete(currentRoomId)
                currentRoomId = null
                return
            }
            if (room.host === walletAddress) {
                room.host = room.players[0].address
                io.to(currentRoomId).emit('host-changed', { newHost: room.host })
            }
            socket.leave(currentRoomId)
            broadcastRoomUpdate(io, room)
            currentRoomId = null
        }
    })
}

// ─── Bot Auto-Play ─────────────────────────────────────────────────────────────
function scheduleBotTurn(io, rooms, roomId) {
    const board = getBoardState(roomId)
    if (!board || board.phase !== 'rolling') return

    const room = rooms.get(roomId)
    if (!room) return

    const currentPlayer = board.players[board.turn]
    if (!currentPlayer?.isBot) return

    // Bot rolls dice after 2-3 second "thinking" delay
    const delay = 2000 + Math.random() * 1500
    setTimeout(() => {
        const b = getBoardState(roomId)
        if (!b || b.phase !== 'rolling') return

        const result = rollDice(roomId, currentPlayer.address)
        if (!result.ok) return

        io.to(roomId).emit('dice-rolled', {
            address: currentPlayer.address,
            dice: result.effect.dice,
            newPosition: result.effect.newPos,
            tileEffect: result.effect,
            boardState: result.state,
            message: result.effect.message,
        })

        // Bot sends a chat message occasionally
        if (Math.random() < 0.4) {
            const botChats = ['🤖 My turn!', 'Let\'s go! 🎲', 'Beep boop, rolling!', '📊 Calculating optimal move...', '⚡ Bot strikes again!']
            io.to(roomId).emit('chat-message', {
                address: currentPlayer.address,
                message: botChats[Math.floor(Math.random() * botChats.length)],
                timestamp: Date.now(),
            })
        }

        if (result.effect.winner) {
            setTimeout(() => {
                io.to(roomId).emit('board-game-over', { winner: result.effect.winner, boardState: result.state })
                cleanupBoardState(roomId)
            }, 1500)
        } else if (result.effect.type === 'minigame') {
            const rm = rooms.get(roomId)
            if (rm) setTimeout(() => startHorseRace(io, roomId, rm.players), 2000)
        } else {
            setTimeout(() => scheduleBotTurn(io, rooms, roomId), 1500)
        }
    }, delay)
}

module.exports = { setupSocketHandlers }
