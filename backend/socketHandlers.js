/**
 * socketHandlers.js
 * All Socket.io event handlers with rate limiting, validation, and cheat prevention.
 */

const { v4: uuidv4 } = require("uuid");
const {
    initGameState,
    startNextMiniGame,
    handlePlayerAction,
    endMiniGame,
    getGameState,
    cleanupGameState,
} = require("./gameEngine");
const { createBotPlayer } = require("./aiAgent");

// ─── Rate Limiting ─────────────────────────────────────────────────────────────
const moveRateLimits = new Map(); // socketId → { count, window }
const MOVE_RATE_LIMIT = 60; // max move events per second

function checkMoveRateLimit(socketId) {
    const now = Date.now();
    const entry = moveRateLimits.get(socketId);
    if (!entry || now - entry.window > 1000) {
        moveRateLimits.set(socketId, { count: 1, window: now });
        return true;
    }
    if (entry.count >= MOVE_RATE_LIMIT) return false;
    entry.count++;
    return true;
}

// ─── Position Validation ───────────────────────────────────────────────────────
const MAX_SPEED = 600; // pixels per second
const lastPositions = new Map(); // socketId → { x, y, t }

function validatePosition(socketId, x, y) {
    const last = lastPositions.get(socketId);
    const now = Date.now();
    if (last) {
        const dt = (now - last.t) / 1000;
        const dist = Math.sqrt((x - last.x) ** 2 + (y - last.y) ** 2);
        if (dist / dt > MAX_SPEED * 1.5) {
            return false; // teleporting/cheating
        }
    }
    lastPositions.set(socketId, { x, y, t: now });
    return true;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getRoomSummary(room) {
    return {
        roomId: room.roomId,
        roomName: room.roomName,
        host: room.host,
        players: room.players.map((p) => ({
            address: p.address,
            isReady: p.isReady,
            score: p.score,
            isBot: p.isBot || false,
        })),
        status: room.status,
        maxPlayers: room.maxPlayers,
        isPrivate: room.isPrivate,
    };
}

function broadcastRoomUpdate(io, room) {
    io.to(room.roomId).emit("room-updated", getRoomSummary(room));
}

function findOrCreateWaitingRoom(rooms, walletAddress) {
    for (const [, room] of rooms) {
        if (!room.isPrivate && room.status === "waiting" && room.players.length < room.maxPlayers) {
            return room;
        }
    }
    // Create a new room
    const roomId = uuidv4();
    const newRoom = {
        roomId,
        roomName: `Quick Match #${roomId.slice(0, 4).toUpperCase()}`,
        host: walletAddress,
        players: [],
        status: "waiting",
        gameState: null,
        maxPlayers: 8,
        isPrivate: false,
        createdAt: Date.now(),
        txHash: null,
        chatMessages: [],
    };
    rooms.set(roomId, newRoom);
    return newRoom;
}

// ─── Main Handler Setup ────────────────────────────────────────────────────────

function setupSocketHandlers(io, rooms) {
    io.on("connection", (socket) => {
        console.log(`[Socket] Connected: ${socket.id}`);
        let currentRoomId = null;

        // ── Create Room ─────────────────────────────────────────────────────────
        socket.on("create-room", ({ walletAddress, roomName, isPrivate, maxPlayers = 8, txHash }) => {
            if (!walletAddress) return socket.emit("error", { message: "Wallet address required" });

            const roomId = uuidv4();
            const room = {
                roomId,
                roomName: roomName || `${walletAddress.slice(0, 6)}'s Room`,
                host: walletAddress,
                players: [{
                    address: walletAddress,
                    socketId: socket.id,
                    isReady: false,
                    score: 0,
                    isEliminated: false,
                    isBot: false,
                }],
                status: "waiting",
                gameState: null,
                maxPlayers: Math.min(Math.max(maxPlayers, 2), 8),
                isPrivate: !!isPrivate,
                createdAt: Date.now(),
                txHash: txHash || null,
                chatMessages: [],
            };

            rooms.set(roomId, room);
            socket.join(roomId);
            currentRoomId = roomId;

            socket.emit("room-created", { roomId, room: getRoomSummary(room) });
            broadcastRoomUpdate(io, room);
            console.log(`[Room] Created: ${roomId} by ${walletAddress}`);
        });

        // ── Join Room ───────────────────────────────────────────────────────────
        socket.on("join-room", ({ roomId, walletAddress, txHash }) => {
            const room = rooms.get(roomId);
            if (!room) return socket.emit("error", { message: "Room not found" });
            if (room.status !== "waiting") return socket.emit("error", { message: "Game already started" });
            if (room.players.length >= room.maxPlayers) return socket.emit("error", { message: "Room is full" });
            if (room.players.find((p) => p.address === walletAddress)) {
                // Reconnect: update socketId
                const player = room.players.find((p) => p.address === walletAddress);
                player.socketId = socket.id;
                socket.join(roomId);
                currentRoomId = roomId;
                return socket.emit("joined-room", { roomId, room: getRoomSummary(room) });
            }

            room.players.push({
                address: walletAddress,
                socketId: socket.id,
                isReady: false,
                score: 0,
                isEliminated: false,
                isBot: false,
                txHash: txHash || null,
            });

            socket.join(roomId);
            currentRoomId = roomId;
            socket.emit("joined-room", { roomId, room: getRoomSummary(room) });
            broadcastRoomUpdate(io, room);
            console.log(`[Room] ${walletAddress} joined ${roomId}`);
        });

        // ── Quick Match ─────────────────────────────────────────────────────────
        socket.on("quick-match", ({ walletAddress, txHash }) => {
            if (!walletAddress) return socket.emit("error", { message: "Wallet address required" });

            const room = findOrCreateWaitingRoom(rooms, walletAddress);

            if (!room.players.find((p) => p.address === walletAddress)) {
                room.players.push({
                    address: walletAddress,
                    socketId: socket.id,
                    isReady: false,
                    score: 0,
                    isEliminated: false,
                    isBot: false,
                    txHash: txHash || null,
                });
            }

            socket.join(room.roomId);
            currentRoomId = room.roomId;
            socket.emit("joined-room", { roomId: room.roomId, room: getRoomSummary(room) });
            broadcastRoomUpdate(io, room);
        });

        // ── Player Ready ────────────────────────────────────────────────────────
        socket.on("player-ready", ({ walletAddress, isReady }) => {
            if (!currentRoomId) return;
            const room = rooms.get(currentRoomId);
            if (!room) return;

            const player = room.players.find((p) => p.address === walletAddress);
            if (player) {
                player.isReady = isReady;
                broadcastRoomUpdate(io, room);

                // Auto-countdown if all ready
                const allReady = room.players.every((p) => p.isReady) && room.players.length >= 2;
                if (allReady) {
                    io.to(currentRoomId).emit("all-ready", { countdown: 10 });
                }
            }
        });

        // ── Start Game ──────────────────────────────────────────────────────────
        socket.on("start-game", ({ walletAddress }) => {
            if (!currentRoomId) return;
            const room = rooms.get(currentRoomId);
            if (!room) return socket.emit("error", { message: "Room not found" });
            if (room.host !== walletAddress) return socket.emit("error", { message: "Only host can start" });
            if (room.players.length < 2) return socket.emit("error", { message: "Need at least 2 players" });
            if (room.status !== "waiting") return socket.emit("error", { message: "Game already started" });

            // Fill with bots if less than 2 human players (optional, only if alone)
            // Always add bots to make game more fun when < 4 players
            while (room.players.length < 4) {
                const bot = createBotPlayer("easy");
                bot.socketId = null;
                room.players.push(bot);
            }

            room.status = "in_game";
            const state = initGameState(room.roomId, room.players);
            room.gameState = state;

            broadcastRoomUpdate(io, room);
            io.to(room.roomId).emit("game-starting", { players: room.players, countdown: 3 });

            // Start first mini game after 4s countdown
            setTimeout(() => startNextMiniGame(io, room.roomId, rooms), 4000);
        });

        // ── Chat Message ────────────────────────────────────────────────────────
        socket.on("chat-message", ({ walletAddress, message }) => {
            if (!currentRoomId) return;
            const room = rooms.get(currentRoomId);
            if (!room) return;
            const trimmed = String(message).slice(0, 200);
            const msg = { address: walletAddress, message: trimmed, timestamp: Date.now() };
            room.chatMessages.push(msg);
            if (room.chatMessages.length > 100) room.chatMessages.shift();
            io.to(currentRoomId).emit("chat-message", msg);
        });

        // ── Player Movement ──────────────────────────────────────────────────────
        socket.on("player-move", ({ address, x, y, vx, vy, animation, roomId: rId }) => {
            const rid = rId || currentRoomId;
            if (!rid) return;

            if (!checkMoveRateLimit(socket.id)) return; // rate limit
            if (!validatePosition(socket.id, x, y)) return; // cheat check

            socket.to(rid).emit("player-moved", { address, x, y, vx, vy, animation });
        });

        // ── Player Action ────────────────────────────────────────────────────────
        socket.on("player-action", ({ address, action }) => {
            if (!currentRoomId) return;
            const state = getGameState(currentRoomId);
            if (!state) return;

            const result = handlePlayerAction(currentRoomId, address, action);
            if (!result.valid) return;

            // Broadcast result
            io.to(currentRoomId).emit("action-result", { address, action, result: result.result });

            // Handle trivia answers
            if (action.type === "answer" && state.currentGame?.id === "trivia") {
                if (result.result.correct) {
                    // First correct answer wins the round
                    endMiniGame(io, currentRoomId, rooms, address);
                }
            }
        });

        // ── Player Eliminated ────────────────────────────────────────────────────
        socket.on("player-eliminated", ({ address }) => {
            if (!currentRoomId) return;
            const state = getGameState(currentRoomId);
            if (!state) return;

            handlePlayerAction(currentRoomId, address, { type: "eliminated" });
            io.to(currentRoomId).emit("action-result", {
                address,
                action: { type: "eliminated" },
                result: { eliminated: address },
            });

            const room = rooms.get(currentRoomId);
            if (!room) return;
            const alive = room.players.filter(
                (p) => !state.eliminatedPlayers.has(p.address) && !p.isBot
            );
            if (alive.length === 1) {
                endMiniGame(io, currentRoomId, rooms, alive[0].address);
            }
        });

        // ── Force End Mini Game (host only) ──────────────────────────────────────
        socket.on("force-end-minigame", ({ walletAddress }) => {
            if (!currentRoomId) return;
            const room = rooms.get(currentRoomId);
            if (!room || room.host !== walletAddress) return;
            endMiniGame(io, currentRoomId, rooms, null);
        });

        // ── Room List ────────────────────────────────────────────────────────────
        socket.on("room-list", () => {
            const publicRooms = [];
            for (const [, room] of rooms) {
                if (!room.isPrivate && room.status === "waiting") {
                    publicRooms.push({
                        roomId: room.roomId,
                        roomName: room.roomName,
                        host: room.host,
                        playerCount: room.players.length,
                        maxPlayers: room.maxPlayers,
                        createdAt: room.createdAt,
                    });
                }
            }
            socket.emit("room-list", publicRooms);
        });

        // ── Leave Room ───────────────────────────────────────────────────────────
        socket.on("leave-room", ({ walletAddress }) => {
            handleLeave(walletAddress);
        });

        // ── Disconnect ───────────────────────────────────────────────────────────
        socket.on("disconnect", () => {
            console.log(`[Socket] Disconnected: ${socket.id}`);
            moveRateLimits.delete(socket.id);
            lastPositions.delete(socket.id);

            if (currentRoomId) {
                const room = rooms.get(currentRoomId);
                if (room) {
                    const player = room.players.find((p) => p.socketId === socket.id);
                    if (player) {
                        // Mark as disconnected but keep in room for 30s
                        player.disconnected = true;
                        io.to(currentRoomId).emit("player-disconnected", { address: player.address });

                        setTimeout(() => {
                            const r = rooms.get(currentRoomId);
                            if (r && player.disconnected) {
                                handleLeave(player.address);
                            }
                        }, 30000);
                    }
                }
            }
        });

        // ─── Internal Leave Handler ────────────────────────────────────────────
        function handleLeave(walletAddress) {
            if (!currentRoomId) return;
            const room = rooms.get(currentRoomId);
            if (!room) return;

            room.players = room.players.filter((p) => p.address !== walletAddress);

            if (room.players.length === 0) {
                // Clean up empty room
                cleanupGameState(currentRoomId);
                rooms.delete(currentRoomId);
                currentRoomId = null;
                return;
            }

            // Transfer host if needed
            if (room.host === walletAddress) {
                room.host = room.players[0].address;
                io.to(currentRoomId).emit("host-changed", { newHost: room.host });
            }

            socket.leave(currentRoomId);
            broadcastRoomUpdate(io, room);
            currentRoomId = null;
        }
    });
}

module.exports = { setupSocketHandlers };
