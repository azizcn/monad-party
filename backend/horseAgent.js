/**
 * horseAgent.js
 * AI Horse personalities for the Horse Race mini-game.
 * Each horse has a unique personality affecting speed based on chat messages.
 */

const Anthropic = require('@anthropic-ai/sdk')

const client = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null

// ─── Horse Personalities ───────────────────────────────────────────────────────
const HORSE_PERSONALITIES = ['hothead', 'stubborn', 'lazy', 'gentle', 'competitive']

const HORSE_NAMES = {
    hothead: ['Thunder', 'Blaze', 'Inferno', 'Rage'],
    stubborn: ['Nope', 'Mule', 'Granite', 'Boulder'],
    lazy: ['Slumber', 'Couch', 'Yawn', 'Pillow'],
    gentle: ['Daisy', 'Breeze', 'Serene', 'Calm'],
    competitive: ['Rocket', 'Flash', 'Turbo', 'Ace'],
}

const HORSE_COLORS = {
    hothead: '#ef4444',
    stubborn: '#8b5cf6',
    lazy: '#94a3b8',
    gentle: '#10b981',
    competitive: '#f59e0b',
}

const PERSONALITY_PROMPTS = {
    hothead: `You are a hot-headed horse who gets angry easily. You speak in short, aggressive sentences. 
When insulted or pressured, you rage and run FASTER. When praised, you calm down briefly. 
Keep replies under 2 sentences. Show emotion with ALL CAPS when angry.`,

    stubborn: `You are a deeply stubborn horse. You always do the OPPOSITE of what you're told. 
If told to go fast, you slow down. If told to stop, you run. You speak matter-of-factly. 
Keep replies under 2 sentences. Never admit being stubborn.`,

    lazy: `You are an extremely lazy horse who would rather nap than race. You use lots of ellipses and yawns. 
You need constant encouragement to keep moving. Without praise every 10 seconds, you slow down.
Keep replies under 2 sentences. Frequently mention being tired.`,

    gentle: `You are a kind, gentle horse who loves being praised and treated nicely. 
Compliments make you run happily and fast. Harsh words make you sad and slow.
Keep replies under 2 sentences. Use gentle, warm language.`,

    competitive: `You are an intensely competitive horse who hates losing. 
When behind other horses, you push yourself harder. When winning, you might get cocky.
Keep replies under 2 sentences. Always reference the race standings.`,
}

// ─── Speed Modifiers ───────────────────────────────────────────────────────────

// Keywords that trigger personality reactions
const TRIGGER_KEYWORDS = {
    hothead: {
        anger: ['slow', 'bad', 'loser', 'worst', 'terrible', 'useless', 'pathetic', 'lazy', 'garbage'],
        calm: ['good', 'great', 'amazing', 'best', 'love', 'beautiful', 'calm'],
    },
    stubborn: {
        commands: ['go', 'fast', 'run', 'slow', 'stop', 'turn', 'hurry', 'speed'],
    },
    lazy: {
        praise: ['good', 'great', 'amazing', 'go', 'run', 'best', 'love'],
    },
    gentle: {
        praise: ['beautiful', 'amazing', 'love', 'great', 'good', 'best', 'wonderful', 'lovely'],
        harsh: ['bad', 'slow', 'loser', 'worst', 'stupid'],
    },
    competitive: {
        losing: ['behind', 'last', 'slow', 'losing'],
        winning: ['first', 'winning', 'best', 'fastest'],
    },
}

function calculateSpeedModifier(personality, message, raceContext = {}) {
    const msg = message.toLowerCase()
    const { isLeading = false, isLast = false } = raceContext

    switch (personality) {
        case 'hothead': {
            const angered = TRIGGER_KEYWORDS.hothead.anger.some(kw => msg.includes(kw))
            const calmed = TRIGGER_KEYWORDS.hothead.calm.some(kw => msg.includes(kw))
            if (angered) return { modifier: 2.8, emotion: 'angry', duration: 6000 }
            if (calmed) return { modifier: 0.9, emotion: 'calm', duration: 4000 }
            return { modifier: 1.0, emotion: 'neutral', duration: 0 }
        }
        case 'stubborn': {
            const commanded = TRIGGER_KEYWORDS.stubborn.commands.some(kw => msg.includes(kw))
            if (msg.includes('fast') || msg.includes('go') || msg.includes('run')) {
                return { modifier: 0.4, emotion: 'defiant', duration: 4000 }
            }
            if (msg.includes('slow') || msg.includes('stop')) {
                return { modifier: 2.2, emotion: 'defiant', duration: 4000 }
            }
            return { modifier: 1.0, emotion: 'neutral', duration: 0 }
        }
        case 'lazy': {
            const praised = TRIGGER_KEYWORDS.lazy.praise.some(kw => msg.includes(kw))
            if (praised) return { modifier: 1.8, emotion: 'motivated', duration: 5000 }
            return { modifier: 0.5, emotion: 'sleepy', duration: 3000 }
        }
        case 'gentle': {
            const praised = TRIGGER_KEYWORDS.gentle.praise.some(kw => msg.includes(kw))
            const harsh = TRIGGER_KEYWORDS.gentle.harsh.some(kw => msg.includes(kw))
            if (praised) return { modifier: 2.0, emotion: 'happy', duration: 5000 }
            if (harsh) return { modifier: 0.3, emotion: 'sad', duration: 5000 }
            return { modifier: 1.1, emotion: 'content', duration: 2000 }
        }
        case 'competitive': {
            if (isLast) return { modifier: 2.5, emotion: 'determined', duration: 5000 }
            if (isLeading) return { modifier: 1.2, emotion: 'cocky', duration: 3000 }
            return { modifier: 1.5, emotion: 'focused', duration: 3000 }
        }
        default:
            return { modifier: 1.0, emotion: 'neutral', duration: 0 }
    }
}

// ─── AI Horse Chat Response ────────────────────────────────────────────────────

async function generateHorseReply(personality, playerMessage) {
    if (!client) {
        // Fallback without API
        const fallbacks = {
            hothead: ['GRRRR! I\'ll show you what fast looks like!', 'YOU DARE QUESTION ME?! WATCH THIS!', 'Fine... I\'m running aren\'t I?!'],
            stubborn: ['Nope.', 'No.', 'I do what I want.', 'You said that, so I\'ll do the opposite.'],
            lazy: ['Ugh... do I have to?', 'Zzzz... oh... running... sure...', 'Maybe in a minute...'],
            gentle: ['Oh thank you! That\'s so sweet! 🌸', 'You\'re so kind! I\'ll do my best!', 'That made me very happy!'],
            competitive: ['I NEVER lose!', 'Watch me pass everyone!', 'Second place is just first loser!'],
        }
        const options = fallbacks[personality] || ['...']
        return options[Math.floor(Math.random() * options.length)]
    }

    try {
        const response = await client.messages.create({
            model: 'claude-haiku-4-5',
            max_tokens: 60,
            system: PERSONALITY_PROMPTS[personality],
            messages: [{ role: 'user', content: `Player says to you: "${playerMessage}"` }],
        })
        return response.content[0].text
    } catch (err) {
        console.error('[HorseAgent] Claude error:', err.message)
        return 'Neigh...'
    }
}

// ─── Assign Horses ─────────────────────────────────────────────────────────────

function assignHorses(players) {
    const shuffledPersonalities = [...HORSE_PERSONALITIES].sort(() => Math.random() - 0.5)
    return players.map((player, i) => {
        const personality = shuffledPersonalities[i % shuffledPersonalities.length]
        const names = HORSE_NAMES[personality]
        const name = names[Math.floor(Math.random() * names.length)]
        return {
            playerAddress: player.address,
            personality,
            name,
            color: HORSE_COLORS[personality],
            speed: 1.0,
            emotion: 'neutral',
            position: 0, // 0-100 (finish line)
            finished: false,
        }
    })
}

module.exports = {
    HORSE_PERSONALITIES,
    HORSE_NAMES,
    HORSE_COLORS,
    assignHorses,
    calculateSpeedModifier,
    generateHorseReply,
}
