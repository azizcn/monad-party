/**
 * aiAgent.js
 * Anthropic Claude integration for trivia, game master announcements, and bot players.
 */

require("dotenv").config();
const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 512;

// ─── Rate Limiting ─────────────────────────────────────────────────────────────
let requestCount = 0;
const RATE_LIMIT = 20; // max calls per minute
let rateWindow = Date.now();

function checkRateLimit() {
    const now = Date.now();
    if (now - rateWindow > 60000) {
        requestCount = 0;
        rateWindow = now;
    }
    if (requestCount >= RATE_LIMIT) {
        throw new Error("AI rate limit reached, please wait");
    }
    requestCount++;
}

async function callClaude(systemPrompt, userMessage) {
    checkRateLimit();
    const response = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
    });
    return response.content[0]?.text || "";
}

// ─── Trivia Agent ──────────────────────────────────────────────────────────────

/**
 * Generate a trivia question using Claude.
 * @param {"crypto"|"gaming"|"general"} topic
 * @param {"easy"|"medium"|"hard"} difficulty
 * @returns {{ question: string, options: string[], answer: string }}
 */
async function generateQuestion(topic, difficulty = "medium") {
    const system = `You are a trivia question generator for a party game. 
Generate exactly ONE multiple choice question about ${topic}.
Respond ONLY with valid JSON in this exact format (no markdown, no explanation):
{"question":"...","options":["A","B","C","D"],"answer":"A"}
The answer field must be exactly one of the option strings.
Difficulty: ${difficulty}.`;

    const userMsg = `Generate a ${difficulty} ${topic} trivia question for a Web3 party game. JSON only.`;

    try {
        const raw = await callClaude(system, userMsg);
        const trimmed = raw.trim().replace(/^```json?\n?/, "").replace(/\n?```$/, "");
        const parsed = JSON.parse(trimmed);
        if (!parsed.question || !Array.isArray(parsed.options) || !parsed.answer) {
            throw new Error("Invalid question format");
        }
        return parsed;
    } catch (err) {
        console.error("generateQuestion error:", err.message);
        // Fallback question
        return {
            question: "What blockchain is Monad built on?",
            options: ["Its own EVM-compatible chain", "Ethereum L2", "Solana fork", "Cosmos SDK"],
            answer: "Its own EVM-compatible chain",
        };
    }
}

// ─── Game Master Agent ────────────────────────────────────────────────────────

/**
 * Generate a dramatic mini-game announcement.
 */
async function generateAnnouncement(gameName, playerCount) {
    const system = `You are an ELECTRIFYING game show host for a Web3 party game called Monad Party.
Keep responses SHORT (max 2 sentences). Be dramatic, funny, and hype up the players!
DO NOT use markdown. Just plain text.`;

    const userMsg = `Announce the start of "${gameName}" to ${playerCount} players. Make it exciting!`;

    try {
        return await callClaude(system, userMsg);
    } catch {
        return `🎮 ROUND START! ${gameName} is about to begin — may the best player WIN! 🏆`;
    }
}

/**
 * Generate a winner celebration message.
 */
async function celebrateWinner(winnerAddress, score) {
    const shortAddr = `${winnerAddress.slice(0, 6)}...${winnerAddress.slice(-4)}`;
    const system = `You are an enthusiastic party game host celebrating a winner.
Keep it short (1-2 sentences). Be exciting and congratulatory. Plain text only.`;

    const userMsg = `The winner is ${shortAddr} with ${score} points! Celebrate them!`;

    try {
        return await callClaude(system, userMsg);
    } catch {
        return `🎉 CHAMPION! ${shortAddr} dominates with ${score} points and claims the MON prize! 🏆`;
    }
}

/**
 * Generate a live play commentary.
 */
async function commentPlay(event) {
    const system = `You are a sports commentator for a Web3 party game. 
One short, punchy sentence comment. Plain text only. Be funny!`;

    try {
        return await callClaude(system, JSON.stringify(event));
    } catch {
        return "🔥 Things are heating up!";
    }
}

// ─── Bot Player Agent ──────────────────────────────────────────────────────────

const BOT_NAMES = [
    "NanoBot", "CryptoKnight", "MonadMaster", "BlockBuster",
    "ChainGhost", "TxSurvivor", "GasGoblin", "ValidatorX",
];

let botCounter = 0;

/**
 * Create a bot player data object.
 */
function createBotPlayer(difficulty = "medium") {
    const name = BOT_NAMES[botCounter % BOT_NAMES.length];
    botCounter++;
    const fakeAddress = `0xB0T${String(botCounter).padStart(37, "0")}`;
    return {
        address: fakeAddress,
        name,
        isBot: true,
        difficulty,
        isReady: true,
        score: 0,
        isEliminated: false,
    };
}

/**
 * Get a bot action for the current game state.
 * Uses Claude for medium/hard bots, random logic for easy bots.
 */
async function decideBotAction(gameState, botId, difficulty = "medium") {
    if (difficulty === "easy") {
        // Random action
        const actions = ["move-left", "move-right", "jump", "idle", "collect"];
        return { type: actions[Math.floor(Math.random() * actions.length)] };
    }

    const system = `You are controlling a ${difficulty} difficulty bot in a party game.
Based on the game state, decide the BEST action. Respond with ONLY JSON:
{"type":"move-left"|"move-right"|"jump"|"collect"|"idle","reason":"brief reason"}`;

    const userMsg = `GameState: ${JSON.stringify({
        game: gameState?.currentGame?.id,
        botId,
        round: gameState?.round,
        scores: gameState?.scores,
    })}. What action should the bot take?`;

    try {
        const raw = await callClaude(system, userMsg);
        const trimmed = raw.trim().replace(/^```json?\n?/, "").replace(/\n?```$/, "");
        return JSON.parse(trimmed);
    } catch {
        // Fallback: bias towards collecting/moving
        const fallback = ["move-left", "move-right", "jump", "collect"];
        return { type: fallback[Math.floor(Math.random() * fallback.length)] };
    }
}

module.exports = {
    generateQuestion,
    generateAnnouncement,
    celebrateWinner,
    commentPlay,
    createBotPlayer,
    decideBotAction,
};
