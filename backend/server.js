require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const { setupSocketHandlers } = require("./socketHandlers");

// ─── App Setup ────────────────────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);

const FRONTEND_URL = process.env.FRONTEND_URL || '*';
const PORT = process.env.PORT || 3001;

// Allow all origins for Railway/Vercel compatibility
const corsOptions = {
    origin: FRONTEND_URL === '*' ? true : FRONTEND_URL,
    methods: ["GET", "POST"],
    credentials: FRONTEND_URL !== '*',
};

app.use(cors(corsOptions));
app.use(express.json());

// ─── Socket.io ────────────────────────────────────────────────────────────────
const io = new Server(server, {
    cors: corsOptions,
    pingTimeout: 60000,
    pingInterval: 25000,
});

// ─── In-Memory Room Store ─────────────────────────────────────────────────────
/**
 * Room shape:
 * {
 *   roomId: string,
 *   roomName: string,
 *   host: string (wallet address),
 *   players: [{ address, socketId, isReady, score, isEliminated, isBot }],
 *   status: 'waiting' | 'in_game' | 'finished',
 *   gameState: object | null,
 *   maxPlayers: number,
 *   isPrivate: boolean,
 *   createdAt: number,
 *   txHash: string | null,   // contract tx confirming room creation
 * }
 */
const rooms = new Map();

// Export rooms so handlers can access them
module.exports.rooms = rooms;
module.exports.io = io;

// ─── Setup Socket Handlers ────────────────────────────────────────────────────
setupSocketHandlers(io, rooms);

// ─── REST Endpoints ───────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
    res.json({ status: "ok", rooms: rooms.size, time: Date.now() });
});

app.get("/rooms", (_req, res) => {
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
    res.json(publicRooms);
});

app.get("/room/:roomId", (req, res) => {
    const room = rooms.get(req.params.roomId);
    if (!room) return res.status(404).json({ error: "Room not found" });
    res.json({
        roomId: room.roomId,
        roomName: room.roomName,
        host: room.host,
        players: room.players.map((p) => ({ address: p.address, isReady: p.isReady, score: p.score, isBot: p.isBot })),
        status: room.status,
        maxPlayers: room.maxPlayers,
        isPrivate: room.isPrivate,
    });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
server.listen(PORT, () => {
    console.log(`\n🎮 Monad Party Game Server`);
    console.log(`   Port:     ${PORT}`);
    console.log(`   Frontend: ${FRONTEND_URL}`);
    console.log(`   Contract: ${process.env.CONTRACT_ADDRESS || "not set"}\n`);
});
