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
    hothead: ['Fırtına', 'Alev', 'Ateş', 'Öfke'],
    stubborn: ['Kaya', 'Değirmentaşı', 'Dikbaş', 'Katı'],
    lazy: ['Uykucu', 'Tembel', 'Eşek Arısı', 'Yorgun'],
    gentle: ['Papatya', 'Esinti', 'Sakin', 'Nazık'],
    competitive: ['Roket', 'Şimşek', 'Turbo', 'İlk'],
}

const HORSE_COLORS = {
    hothead: '#ef4444',
    stubborn: '#8b5cf6',
    lazy: '#94a3b8',
    gentle: '#10b981',
    competitive: '#f59e0b',
}

const PERSONALITY_PROMPTS = {
    hothead: `Sen sinirli, ateşli bir atsın. Kısa, sert cümlelerle Türkçe konuşursun.
Hakaret edilince ya da zorlandığında ÖFKEYİ BÜYÜK HARFLERLE gösterir ve daha hızlı koşarsın.
Övüldüğünde kısaca sakinleşirsin. En fazla 2 cümle yaz, Türkçe yaz.`,

    stubborn: `Sen son derece iınatçı bir atsın. Söylenenin tam TERSİNİ yaparsın.
Hızlan dense yavaşlashırsın, dur dense koşarsın. Türkçe, kısa, ketum konuşursun.
En fazla 2 cümle yaz, Türkçe yaz.`,

    lazy: `Sen aşırı tembel, uyuşuk bir atsın. Uyku noktalama işaretleri kullanırsın.
Sürekli övülmen gerekir, yoksa durursun. En fazla 2 cümle yaz, sık sık yorgunluktan bahset, Türkçe yaz.`,

    gentle: `Sen nazik, kibar bir atsın. Övülünce mutlu olursun ve hızlanırsın.
Kötü sözler duyunca üzülür ve yavaşlarsın. En fazla 2 cümle yaz, sıcak dil kullan, Türkçe yaz.`,

    competitive: `Sen aşırı rekabetçi bir atsın. Kaybetmekten nefret edersin.
Geride kalınca daha çok çabaların, önde olunca kibirlenirsin. En fazla 2 cümle yaz, yarış durumundan bahset, Türkçe yaz.`,
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
            if (angered) return { modifier: 4.5, emotion: 'angry', duration: 8000 } // Super fast when angry
            if (calmed) return { modifier: 0.2, emotion: 'calm', duration: 5000 } // Stops when tried to be calmed
            return { modifier: 1.0, emotion: 'neutral', duration: 0 }
        }
        case 'stubborn': {
            const commanded = TRIGGER_KEYWORDS.stubborn.commands.some(kw => msg.includes(kw))
            if (msg.includes('fast') || msg.includes('go') || msg.includes('run')) {
                return { modifier: -0.5, emotion: 'defiant', duration: 5000 } // Literally goes backwards
            }
            if (msg.includes('slow') || msg.includes('stop')) {
                return { modifier: 3.5, emotion: 'defiant', duration: 5000 } // Rushes forward
            }
            if (commanded) return { modifier: 0.1, emotion: 'defiant', duration: 4000 }
            return { modifier: 1.0, emotion: 'neutral', duration: 0 }
        }
        case 'lazy': {
            const praised = TRIGGER_KEYWORDS.lazy.praise.some(kw => msg.includes(kw))
            if (praised) return { modifier: 2.2, emotion: 'motivated', duration: 6000 }
            return { modifier: 0.1, emotion: 'sleepy', duration: 4000 } // Near stop otherwise
        }
        case 'gentle': {
            const praised = TRIGGER_KEYWORDS.gentle.praise.some(kw => msg.includes(kw))
            const harsh = TRIGGER_KEYWORDS.gentle.harsh.some(kw => msg.includes(kw))
            if (praised) return { modifier: 3.0, emotion: 'happy', duration: 6000 }
            if (harsh) return { modifier: 0.1, emotion: 'sad', duration: 6000 } // Cries and stops
            return { modifier: 1.1, emotion: 'content', duration: 2000 }
        }
        case 'competitive': {
            if (isLast) return { modifier: 4.0, emotion: 'determined', duration: 6000 } // Massive rubberband
            if (isLeading) return { modifier: 0.8, emotion: 'cocky', duration: 4000 }
            const praised = TRIGGER_KEYWORDS.lazy.praise.some(kw => msg.includes(kw))
            if (praised) return { modifier: 1.8, emotion: 'focused', duration: 4000 }
            return { modifier: 1.5, emotion: 'focused', duration: 3000 }
        }
        default:
            return { modifier: 1.0, emotion: 'neutral', duration: 0 }
    }
}

// ─── AI Horse Chat Response ────────────────────────────────────────────────────

async function generateHorseReply(personality, playerMessage) {
    if (!client) {
        // API olmadan Türkçe fallback
        const fallbacks = {
            hothead: [
                'GRRR! Hızımı görürsün şimdi!',
                'BANA EMİR VER! İZLE NASIL KOŞACAĞIMI!',
                'Peki... zaten koşuyorum işte!',
                'SEN KİMSİN Kİ BANA SÖYLE!',
            ],
            stubborn: [
                'Hayır.',
                'Olmaz.',
                'İstediğimi yaparım.',
                'Sen öyle dedin, ben tam tersini yaparım.',
            ],
            lazy: [
                'Ugh... koşmak zorunda mıyım?',
                'Zzzz... ah... koşuyorum... bir dakika...',
                'Biraz sonra belki...',
                'Çok yoruldum yaa...',
            ],
            gentle: [
                'Teşekkür ederim, çok naziksin! 🌸',
                'Ne kadar güzelsin! Elimden geleni yaparım!',
                'Bu beni çok mutlu etti!',
                'Seninle koşmak çok güzel!',
            ],
            competitive: [
                'BEN ASLA KAYBETMEM!',
                'İzle nasıl geçeceğim hepsini!',
                'İkinci olmak zaten kaybetmektir!',
                'Bu yarışı ben kazanacağım!',
            ],
        }
        const options = fallbacks[personality] || ['Neyyyy...']
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
