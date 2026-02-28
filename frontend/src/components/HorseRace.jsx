import { useEffect, useRef, useState, useCallback } from 'react'
import { useAccount } from 'wagmi'
import { motion, AnimatePresence } from 'framer-motion'
import useGameStore from '../../store/gameStore'

// ─── Horse Pixel Art Renderer ─────────────────────────────────────────────────
function drawHorse(ctx, x, y, color, emotion, frame, name, chestCount) {
    const t = frame / 4
    const legSwing = Math.sin(t) * 8
    const bodyBob = Math.abs(Math.sin(t)) * 3

    // Glow based on emotion
    const glowColors = {
        angry: '#ef4444', calm: '#06b6d4', happy: '#10b981',
        sad: '#94a3b8', defiant: '#8b5cf6', motivated: '#f59e0b',
        sleepy: '#6b7280', determined: '#fbbf24', focused: '#3b82f6',
        cocky: '#ec4899', excited: '#f97316', neutral: color,
    }
    const glow = glowColors[emotion] || color

    ctx.shadowColor = glow
    ctx.shadowBlur = emotion !== 'neutral' ? 20 : 8

    // Body
    ctx.fillStyle = color
    ctx.fillRect(x + 10, y + 10 + bodyBob, 40, 22)

    // Head
    ctx.fillRect(x + 44, y + 4 + bodyBob, 18, 14)

    // Ear
    ctx.fillRect(x + 56, y + bodyBob, 5, 7)

    // Eye
    ctx.fillStyle = '#000'
    ctx.fillRect(x + 55, y + 7 + bodyBob, 3, 3)

    // Nostril
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.fillRect(x + 60, y + 11 + bodyBob, 2, 2)

    // Mane
    ctx.fillStyle = shadeColor(color, -40)
    ctx.fillRect(x + 44, y + 6 + bodyBob, 8, 3)
    ctx.fillRect(x + 40, y + 10 + bodyBob, 8, 3)

    // Legs (animated)
    ctx.fillStyle = color
    // Front legs
    ctx.fillRect(x + 40, y + 30 + bodyBob, 6, 14 + legSwing)
    ctx.fillRect(x + 28, y + 30 + bodyBob, 6, 14 - legSwing)
    // Back legs
    ctx.fillRect(x + 16, y + 30 + bodyBob, 6, 14 + legSwing)
    ctx.fillRect(x + 7, y + 30 + bodyBob, 6, 14 - legSwing)

    // Tail
    const tailWave = Math.sin(t * 0.7) * 5
    ctx.fillStyle = shadeColor(color, -30)
    ctx.fillRect(x + 7, y + 12 + bodyBob + tailWave, 5, 15)

    ctx.shadowBlur = 0

    // Emotion indicator bubble
    const emotionIcons = {
        angry: '🔥', calm: '😌', happy: '😊', sad: '😢',
        defiant: '😤', motivated: '💪', sleepy: '💤',
        determined: '⚡', focused: '🎯', cocky: '😏', excited: '⭐',
    }
    if (emotion && emotionIcons[emotion]) {
        ctx.font = '14px serif'
        ctx.textAlign = 'center'
        ctx.fillText(emotionIcons[emotion], x + 35, y - 4)
    }

    // Name tag
    ctx.fillStyle = 'rgba(0,0,0,0.7)'
    ctx.fillRect(x + 5, y - 24, 55, 16)
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 9px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(name.slice(0, 10), x + 32, y - 12)

    // Chest indicator
    if (chestCount > 0) {
        ctx.fillStyle = '#f59e0b'
        ctx.font = '9px monospace'
        ctx.fillText(`🎁${chestCount}`, x + 32, y + 56)
    }
}

function shadeColor(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16)
    const r = Math.min(255, Math.max(0, (num >> 16) + percent))
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + percent))
    const b = Math.min(255, Math.max(0, (num & 0x0000FF) + percent))
    return `rgb(${r},${g},${b})`
}

const HORSE_COLORS_MAP = {
    hothead: '#ef4444', stubborn: '#8b5cf6',
    lazy: '#94a3b8', gentle: '#10b981', competitive: '#f59e0b',
}

// ─── Main HorseRace Component ─────────────────────────────────────────────────
export default function HorseRace({ horses = [], onRaceEnd }) {
    const { address } = useAccount()
    const canvasRef = useRef(null)
    const frameRef = useRef(0)
    const rafRef = useRef(null)
    const [chatMessage, setChatMessage] = useState('')
    const [chatLog, setChatLog] = useState([])
    const [winner, setWinner] = useState(null)
    const [myHorse, setMyHorse] = useState(null)

    const { sendHorseChat, encourageHorse, horsePositions, horseEmotions, horseReplies } = useGameStore()

    // Identify my horse
    useEffect(() => {
        const h = horses.find(h => h.playerAddress === address)
        if (h) setMyHorse(h)
    }, [horses, address])

    // Listen for replies from store
    useEffect(() => {
        if (horseReplies?.length) {
            const last = horseReplies[horseReplies.length - 1]
            setChatLog(prev => [...prev.slice(-20), last])
        }
    }, [horseReplies])

    // Game loop - draw everything
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas || !horses.length) return
        const ctx = canvas.getContext('2d')
        const CANVAS_W = 540
        const CANVAS_H = horses.length * 90 + 60
        canvas.width = CANVAS_W
        canvas.height = CANVAS_H

        const loop = () => {
            frameRef.current++
            ctx.fillStyle = '#07071a'
            ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

            // Draw track lanes
            horses.forEach((horse, i) => {
                const laneY = 30 + i * 90
                // Lane
                ctx.fillStyle = i % 2 === 0 ? 'rgba(30,27,75,0.6)' : 'rgba(10,10,30,0.6)'
                ctx.fillRect(0, laneY - 10, CANVAS_W, 80)
                // Lane border
                ctx.strokeStyle = 'rgba(99,102,241,0.3)'
                ctx.lineWidth = 1
                ctx.beginPath(); ctx.moveTo(0, laneY + 70); ctx.lineTo(CANVAS_W, laneY + 70); ctx.stroke()

                // Track dashes
                for (let d = 0; d < CANVAS_W; d += 40) {
                    ctx.strokeStyle = 'rgba(255,255,255,0.1)'
                    ctx.beginPath(); ctx.moveTo(d, laneY + 35); ctx.lineTo(d + 20, laneY + 35); ctx.stroke()
                }
            })

            // Finish line
            ctx.strokeStyle = '#fbbf24'
            ctx.lineWidth = 3
            ctx.setLineDash([6, 3])
            ctx.beginPath(); ctx.moveTo(CANVAS_W - 8, 0); ctx.lineTo(CANVAS_W - 8, CANVAS_H); ctx.stroke()
            ctx.setLineDash([])
            ctx.fillStyle = '#fbbf24'
            ctx.font = 'bold 10px monospace'
            ctx.textAlign = 'center'
            ctx.fillText('FINISH', CANVAS_W - 8, 18)

            // Draw horses
            horses.forEach((horse, i) => {
                const laneY = 30 + i * 90 - 10
                const pos = horsePositions?.[horse.playerAddress]?.position ?? horse.position ?? 0
                const emotion = horseEmotions?.[horse.playerAddress] ?? 'neutral'
                const hx = 10 + (pos / 100) * (CANVAS_W - 90)
                const color = HORSE_COLORS_MAP[horse.personality] || '#7c3aed'
                const isMe = horse.playerAddress === address

                drawHorse(ctx, hx, laneY, color, emotion, frameRef.current, horse.name, 0)

                // Highlight my horse
                if (isMe) {
                    ctx.strokeStyle = '#fbbf24'
                    ctx.lineWidth = 2
                    ctx.setLineDash([4, 2])
                    ctx.strokeRect(hx - 2, laneY - 2, 70, 60)
                    ctx.setLineDash([])
                }
            })

            rafRef.current = requestAnimationFrame(loop)
        }
        rafRef.current = requestAnimationFrame(loop)
        return () => cancelAnimationFrame(rafRef.current)
    }, [horses, horsePositions, horseEmotions, address])

    // SPACE key = encourage horse
    useEffect(() => {
        const onKey = (e) => {
            if (e.code === 'Space' && !winner) {
                e.preventDefault()
                encourageHorse(address)
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [address, winner, encourageHorse])

    const handleChatSend = (e) => {
        e.preventDefault()
        if (!chatMessage.trim()) return
        sendHorseChat(address, chatMessage.trim())
        setChatLog(prev => [...prev.slice(-20), { playerAddress: address, message: chatMessage, horseName: myHorse?.name }])
        setChatMessage('')
    }

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '1rem', height: '100%', padding: '1rem' }}>
            {/* Race Canvas */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.75rem', color: 'var(--color-purple-light)', letterSpacing: '0.2em' }}>🐴 HORSE RACE</div>
                    {myHorse && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '0.3rem 0.75rem' }}>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: HORSE_COLORS_MAP[myHorse.personality] }} />
                            <span style={{ fontFamily: 'var(--font-orbitron)', fontSize: '0.7rem' }}>Your horse: <strong>{myHorse.name}</strong></span>
                            <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', textTransform: 'capitalize' }}>({myHorse.personality})</span>
                        </div>
                    )}
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)', fontFamily: 'var(--font-orbitron)' }}>
                        SPACE = Encourage
                    </div>
                </div>

                <canvas ref={canvasRef} style={{ border: '1px solid var(--color-border)', borderRadius: 10, maxWidth: '100%' }} />

                {/* Personality tip */}
                {myHorse && (
                    <div style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 8, padding: '0.5rem 0.75rem', fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                        {myHorse.personality === 'hothead' && '🔥 Your horse is HOT-HEADED! Insult it to make it rage-run faster!'}
                        {myHorse.personality === 'stubborn' && '🐴 Your horse is STUBBORN! It does the opposite. Tell it to stop... 😏'}
                        {myHorse.personality === 'lazy' && '💤 Your horse is LAZY! Praise it often or it will fall asleep!'}
                        {myHorse.personality === 'gentle' && '🌸 Your horse is GENTLE! Be kind and complimentary for max speed!'}
                        {myHorse.personality === 'competitive' && '⚡ Your horse is COMPETITIVE! It races harder when it\'s losing!'}
                    </div>
                )}
            </div>

            {/* Horse Chat Panel */}
            <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--color-border)', fontFamily: 'var(--font-orbitron)', fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                    💬 TALK TO YOUR HORSE
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {chatLog.length === 0 && (
                        <div style={{ color: 'var(--color-text-dim)', fontSize: '0.7rem', textAlign: 'center', marginTop: '1rem' }}>
                            Type something to your horse! Its personality will react...
                        </div>
                    )}
                    {chatLog.map((entry, i) => (
                        <div key={i}>
                            {/* Player message */}
                            {entry.message && (
                                <div style={{ fontSize: '0.75rem', marginBottom: '0.2rem' }}>
                                    <span style={{ color: 'var(--color-cyan-light)', fontWeight: 600 }}>You → {entry.horseName}: </span>
                                    <span style={{ color: 'var(--color-text-muted)' }}>{entry.message}</span>
                                </div>
                            )}
                            {/* Horse reply */}
                            {entry.reply && (
                                <div style={{ fontSize: '0.75rem', background: 'rgba(124,58,237,0.1)', borderLeft: '2px solid var(--color-purple)', borderRadius: '0 6px 6px 0', padding: '0.3rem 0.5rem' }}>
                                    <span style={{ color: 'var(--color-purple-light)', fontWeight: 600 }}>{entry.horseName}: </span>
                                    <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>{entry.reply}</span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
                <form onSubmit={handleChatSend} style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem', borderTop: '1px solid var(--color-border)' }}>
                    <input
                        className="input"
                        style={{ flex: 1, fontSize: '0.8rem', padding: '0.4rem 0.6rem' }}
                        placeholder="Say something to your horse..."
                        value={chatMessage}
                        onChange={e => setChatMessage(e.target.value)}
                        maxLength={100}
                    />
                    <button className="btn btn-primary btn-sm" type="submit">→</button>
                </form>
            </div>
        </div>
    )
}
