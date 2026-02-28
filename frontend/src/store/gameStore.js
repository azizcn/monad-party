import { create } from 'zustand'
import { io } from 'socket.io-client'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

const useGameStore = create((set, get) => ({
    // ─── State ─────────────────────────────────────────────────────────────────
    socket: null,
    connected: false,
    roomId: null,
    roomData: null,
    players: [],
    myAddress: null,
    gameStatus: 'idle', // 'idle' | 'waiting' | 'in_game' | 'game_over'
    currentMiniGame: null,
    scores: {},
    round: 0,
    totalRounds: 3,
    roundWinners: [],
    gameOverData: null,
    announcement: null,
    chatMessages: [],
    isHost: false,
    error: null,

    // ─── Socket Init ───────────────────────────────────────────────────────────
    initSocket: (address) => {
        const existing = get().socket
        if (existing?.connected) {
            set({ myAddress: address })
            return
        }

        const socket = io(BACKEND_URL, {
            transports: ['websocket', 'polling'],
            reconnectionAttempts: 5,
            reconnectionDelay: 2000,
        })

        socket.on('connect', () => {
            console.log('[Socket] Connected:', socket.id)
            set({ connected: true, error: null })
        })

        socket.on('disconnect', () => {
            console.log('[Socket] Disconnected')
            set({ connected: false })
        })

        socket.on('connect_error', (err) => {
            console.error('[Socket] Error:', err.message)
            set({ error: 'Cannot connect to game server. Is it running?' })
        })

        // ── Room Events ──────────────────────────────────────────────────────────
        socket.on('room-created', ({ roomId, room }) => {
            set({ roomId, roomData: room, players: room.players, gameStatus: 'waiting', isHost: true })
        })

        socket.on('joined-room', ({ roomId, room }) => {
            set({
                roomId,
                roomData: room,
                players: room.players,
                gameStatus: 'waiting',
                isHost: room.host === address,
            })
        })

        socket.on('room-updated', (room) => {
            set({
                roomData: room,
                players: room.players,
                isHost: room.host === address,
            })
        })

        socket.on('room-list', (rooms) => {
            set({ publicRooms: rooms })
        })

        // ── Game Events ──────────────────────────────────────────────────────────
        socket.on('all-ready', ({ countdown }) => {
            set({ allReadyCountdown: countdown })
        })

        socket.on('game-starting', ({ players }) => {
            set({ players, gameStatus: 'in_game' })
        })

        socket.on('mini-game-start', ({ round, totalRounds, game, scores, announcement }) => {
            set({
                round,
                totalRounds,
                currentMiniGame: game,
                scores,
                announcement,
                gameStatus: 'in_game',
            })
        })

        socket.on('mini-game-end', ({ winner, placements, scores, roundWinners, nextRound }) => {
            set({ scores, roundWinners, currentMiniGame: null })
        })

        socket.on('game-over', ({ champion, leaderboard, roundWinners }) => {
            set({
                gameOverData: { champion, leaderboard, roundWinners },
                gameStatus: 'game_over',
                currentMiniGame: null,
            })
        })

        // ── Multiplayer Position Events (handled in GameCanvas) ──────────────────
        socket.on('player-moved', (data) => {
            set((state) => ({ playerPositions: { ...state.playerPositions, [data.address]: data } }))
        })

        socket.on('action-result', ({ address, action, result }) => {
            if (action?.type === 'eliminated') {
                set((state) => ({
                    eliminatedPlayers: new Set([...(state.eliminatedPlayers || []), address]),
                }))
            }
            if (result?.scores) {
                set({ scores: result.scores })
            }
        })

        // ── Chat ──────────────────────────────────────────────────────────────────
        socket.on('chat-message', (msg) => {
            set((state) => ({
                chatMessages: [...state.chatMessages.slice(-99), msg],
            }))
        })

        socket.on('host-changed', ({ newHost }) => {
            set({ isHost: newHost === address })
        })

        socket.on('player-disconnected', ({ address: addr }) => {
            set((state) => ({
                players: state.players.map((p) =>
                    p.address === addr ? { ...p, disconnected: true } : p
                ),
            }))
        })

        socket.on('error', ({ message }) => {
            set({ error: message })
            setTimeout(() => set({ error: null }), 5000)
        })

        set({ socket, myAddress: address, playerPositions: {}, eliminatedPlayers: new Set() })
    },

    // ─── Actions ───────────────────────────────────────────────────────────────
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

    sendMove: (address, x, y, vx, vy, animation) => {
        const { socket, roomId } = get()
        socket?.emit('player-move', { address, x, y, vx, vy, animation, roomId })
    },

    sendAction: (address, action) => {
        get().socket?.emit('player-action', { address, action })
    },

    sendEliminated: (address) => {
        get().socket?.emit('player-eliminated', { address })
    },

    sendChat: (walletAddress, message) => {
        get().socket?.emit('chat-message', { walletAddress, message })
    },

    requestRoomList: () => {
        get().socket?.emit('room-list')
    },

    addBot: (walletAddress, difficulty = 'easy') => {
        get().socket?.emit('add-bot', { walletAddress, difficulty })
    },

    leaveRoom: (walletAddress) => {
        get().socket?.emit('leave-room', { walletAddress })
        set({
            roomId: null,
            roomData: null,
            players: [],
            gameStatus: 'idle',
            currentMiniGame: null,
            scores: {},
            round: 0,
            gameOverData: null,
            isHost: false,
            chatMessages: [],
            playerPositions: {},
            eliminatedPlayers: new Set(),
        })
    },

    clearError: () => set({ error: null }),
    resetGame: () => set({
        gameStatus: 'idle',
        gameOverData: null,
        currentMiniGame: null,
        scores: {},
        round: 0,
        roundWinners: [],
    }),
}))

export default useGameStore
