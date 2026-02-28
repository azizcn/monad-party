import { create } from 'zustand'
import { io } from 'socket.io-client'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

const useGameStore = create((set, get) => ({
    // ─── Core State ───────────────────────────────────────────────────────────────
    socket: null,
    connected: false,
    roomId: null,
    roomData: null,
    players: [],
    myAddress: null,
    gameStatus: 'idle', // 'idle' | 'waiting' | 'in_game' | 'game_over'
    isHost: false,
    chatMessages: [],
    error: null,

    // ─── Board Game State ─────────────────────────────────────────────────────────
    boardState: null,      // { players, turn, currentPlayer, phase, winner, lastDice, log, tiles }
    tiles: [],             // BOARD_TILES from server
    lastDice: null,
    tileLog: [],           // last tile effect messages
    boardGameOver: null,   // { winner, boardState }

    // ─── Horse Race State ─────────────────────────────────────────────────────────
    horseRaceActive: false,
    horses: [],            // [{ playerAddress, personality, name, color, position }]
    horsePositions: {},   // { [address]: { position, emotion, finished } }
    horseEmotions: {},    // { [address]: emotion string }
    horseReplies: [],     // [{ playerAddress, horseName, reply, emotion }]

    // ─── Socket Init ──────────────────────────────────────────────────────────────
    initSocket: (address) => {
        const existing = get().socket
        if (existing?.connected) {
            set({ myAddress: address })
            return
        }

        const socket = io(BACKEND_URL, {
            transports: ['websocket', 'polling'],
            reconnectionAttempts: 8,
            reconnectionDelay: 2000,
        })

        socket.on('connect', () => {
            console.log('[Socket] Connected:', socket.id)
            set({ connected: true, error: null })
        })
        socket.on('disconnect', () => set({ connected: false }))
        socket.on('connect_error', () => set({ error: 'Cannot connect to game server.' }))

        // ── Room Events ─────────────────────────────────────────────────────────────
        socket.on('room-created', ({ roomId, room }) => {
            set({ roomId, roomData: room, players: room.players, gameStatus: 'waiting', isHost: true })
        })
        socket.on('joined-room', ({ roomId, room }) => {
            set({ roomId, roomData: room, players: room.players, gameStatus: 'waiting', isHost: room.host === address })
        })
        socket.on('room-updated', (room) => {
            set({ roomData: room, players: room.players, isHost: room.host === address })
        })
        socket.on('room-list', (rooms) => set({ publicRooms: rooms }))
        socket.on('host-changed', ({ newHost }) => set({ isHost: newHost === address }))

        // ── Board Game Events ───────────────────────────────────────────────────────
        socket.on('game-starting', ({ players, boardState, tiles }) => {
            set({
                players,
                gameStatus: 'in_game',
                boardState,
                tiles: tiles || [],
                tileLog: [],
                boardGameOver: null,
                horseRaceActive: false,
                horsePositions: {},
                horseEmotions: {},
            })
        })

        socket.on('dice-rolled', ({ address: addr, dice, newPosition, tileEffect, boardState, message }) => {
            set(state => ({
                boardState,
                lastDice: dice,
                tileLog: [...(state.tileLog || []).slice(-9), message],
            }))
        })

        socket.on('board-updated', ({ boardState }) => {
            if (boardState) set({ boardState })
        })

        socket.on('board-game-over', ({ winner, boardState }) => {
            set({ boardGameOver: { winner, boardState }, horseRaceActive: false })
        })

        // ── Horse Race Events ───────────────────────────────────────────────────────
        socket.on('horse-race-start', ({ horses }) => {
            set({
                horseRaceActive: true,
                horses,
                horsePositions: {},
                horseEmotions: {},
                horseReplies: [],
            })
        })

        socket.on('horse-positions', ({ horses }) => {
            const positions = {}
            const emotions = {}
            horses.forEach(h => {
                positions[h.playerAddress] = { position: h.position, finished: h.finished }
                emotions[h.playerAddress] = h.emotion || 'neutral'
            })
            set({ horsePositions: positions, horseEmotions: emotions })
        })

        socket.on('horse-emotion-change', ({ playerAddress, emotion, modifier }) => {
            set(state => ({ horseEmotions: { ...state.horseEmotions, [playerAddress]: emotion } }))
        })

        socket.on('horse-reply', (replyData) => {
            set(state => ({ horseReplies: [...state.horseReplies.slice(-19), replyData] }))
        })

        socket.on('horse-chat-sent', (data) => {
            set(state => ({ horseReplies: [...state.horseReplies.slice(-19), data] }))
        })

        socket.on('horse-finished', ({ address: addr, horseName }) => {
            console.log(`[Horse] ${horseName} finished!`)
        })

        socket.on('horse-race-end', ({ winner }) => {
            // Report winner to server
            get().socket?.emit('horse-race-winner', { walletAddress: winner })
            setTimeout(() => set({ horseRaceActive: false }), 2000)
        })

        // ── Chat ────────────────────────────────────────────────────────────────────
        socket.on('chat-message', (msg) => {
            set(state => ({ chatMessages: [...state.chatMessages.slice(-99), msg] }))
        })

        socket.on('error', ({ message }) => {
            set({ error: message })
            setTimeout(() => set({ error: null }), 5000)
        })

        set({ socket, myAddress: address })
    },

    // ─── Actions ─────────────────────────────────────────────────────────────────
    createRoom: (walletAddress, roomName, isPrivate, txHash) => {
        get().socket?.emit('create-room', { walletAddress, roomName, isPrivate, txHash })
    },
    joinRoom: (roomId, walletAddress, txHash) => {
        get().socket?.emit('join-room', { roomId, walletAddress, txHash })
    },
    quickMatch: (walletAddress, txHash) => {
        get().socket?.emit('quick-match', { walletAddress, txHash })
    },
    setReady: (walletAddress, isReady) => {
        get().socket?.emit('player-ready', { walletAddress, isReady })
    },
    startGame: (walletAddress) => {
        get().socket?.emit('start-game', { walletAddress })
    },
    addBot: (walletAddress, difficulty = 'easy') => {
        get().socket?.emit('add-bot', { walletAddress, difficulty })
    },
    rollDice: (walletAddress) => {
        get().socket?.emit('roll-dice', { walletAddress })
    },
    sendChat: (walletAddress, message) => {
        get().socket?.emit('chat-message', { walletAddress, message })
    },
    sendHorseChat: (walletAddress, message) => {
        get().socket?.emit('horse-chat', { walletAddress, message })
    },
    encourageHorse: (walletAddress) => {
        get().socket?.emit('horse-encourage', { walletAddress })
    },
    requestRoomList: () => {
        get().socket?.emit('room-list')
    },
    leaveRoom: (walletAddress) => {
        get().socket?.emit('leave-room', { walletAddress })
        set({
            roomId: null, roomData: null, players: [], gameStatus: 'idle',
            boardState: null, tiles: [], lastDice: null, tileLog: [],
            boardGameOver: null, horseRaceActive: false, horses: [],
            horsePositions: {}, horseEmotions: {}, horseReplies: [],
            isHost: false, chatMessages: [], error: null,
        })
    },
    clearError: () => set({ error: null }),
}))

export default useGameStore
