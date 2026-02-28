import { useEffect, useRef, useState } from 'react'
import { useAccount } from 'wagmi'
import { motion } from 'framer-motion'
import useGameStore from '../store/gameStore'

// ─── Top-Down Horse Race ──────────────────────────────────────────────────────
// Bird's eye view: oval/circular track, horses as colored ovals moving around it

const HORSE_COLORS = {
    hothead: '#ef4444', stubborn: '#8b5cf6',
    lazy: '#94a3b8', gentle: '#10b981', competitive: '#f59e0b',
}

const EMOTION_ICONS = {
    angry: '🔥', calm: '😌', happy: '😊', sad: '😢',
    defiant: '😤', motivated: '💪', sleepy: '💤',
    determined: '⚡', focused: '🎯', cocky: '😏', neutral: '',
}

const W = 700, H = 420
const CX = W / 2, CY = H / 2
// Oval track dimensions
const RX = 260, RY = 155

// Convert horse position (0-100) to (x,y) on oval track
function posToXY(position, laneOffset = 0) {
    // position 0-100 → angle around oval (start at bottom)
    const t = (position / 100) * Math.PI * 2 - Math.PI / 2
    const x = CX + (RX + laneOffset) * Math.cos(t)
    const y = CY + (RY + laneOffset) * Math.sin(t)
    return { x, y, angle: t }
}

// Draw top-down horse (oval body + direction)
function drawTopDownHorse(ctx, x, y, angle, color, emotion, name, isMe, finished) {
    const glow = finished ? '#fbbf24' : (EMOTION_ICONS[emotion] ? color : color)
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(angle + Math.PI / 2)

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)'
    ctx.beginPath(); ctx.ellipse(2, 2, 16, 10, 0, 0, Math.PI * 2); ctx.fill()

    // Glow
    if (emotion && emotion !== 'neutral') {
        ctx.shadowColor = glow; ctx.shadowBlur = 16
    }

    // Body (oval)
    ctx.fillStyle = color
    ctx.beginPath(); ctx.ellipse(0, 0, 16, 10, 0, 0, Math.PI * 2); ctx.fill()
    ctx.shadowBlur = 0

    // Head bump (front)
    ctx.fillStyle = color
    ctx.beginPath(); ctx.ellipse(0, -14, 7, 5, 0, 0, Math.PI * 2); ctx.fill()

    // Mane stripe
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    ctx.fillRect(-2, -18, 4, 10)

    // Outline
    ctx.strokeStyle = isMe ? '#fbbf24' : 'rgba(255,255,255,0.6)'
    ctx.lineWidth = isMe ? 2.5 : 1.5
    ctx.beginPath(); ctx.ellipse(0, 0, 16, 10, 0, 0, Math.PI * 2); ctx.stroke()

    // Finish check
    if (finished) {
        ctx.font = '12px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText('🏆', 0, 0)
    }

    ctx.restore()

    // Floating name + emotion
    ctx.font = 'bold 9px monospace'
    ctx.fillStyle = isMe ? '#fbbf24' : 'rgba(255,255,255,0.9)'
    ctx.textAlign = 'center'
    ctx.fillText(name.slice(0, 8), x, y - 24)
    if (emotion && EMOTION_ICONS[emotion]) {
        ctx.font = '11px serif'
        ctx.fillText(EMOTION_ICONS[emotion], x + 14, y - 20)
    }
}

export default function HorseRace({ horses = [] }) {
    const { address } = useAccount()
    const canvasRef = useRef(null)
    const rafRef = useRef(null)
    const frameRef = useRef(0)
    const [chatMsg, setChatMsg] = useState('')
    const [chatLog, setChatLog] = useState([])
    const [winner, setWinner] = useState(null)

    const { sendHorseChat, encourageHorse, horsePositions, horseEmotions, horseReplies } = useGameStore()

    const myHorse = horses.find(h => h.playerAddress === address)

    // Append new replies
    useEffect(() => {
        if (horseReplies?.length) {
            setChatLog(prev => {
                const last = horseReplies[horseReplies.length - 1]
                if (prev.length && prev[prev.length - 1].reply === last.reply) return prev
                return [...prev.slice(-15), last]
            })
        }
    }, [horseReplies])

    // Game loop
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas || !horses.length) return
        const ctx = canvas.getContext('2d')
        canvas.width = W; canvas.height = H

        const loop = () => {
            frameRef.current++
            ctx.clearRect(0, 0, W, H)

            // Background
            const bg = ctx.createRadialGradient(CX, CY, 30, CX, CY, 320)
            bg.addColorStop(0, '#0d1b2a')
            bg.addColorStop(1, '#07071a')
            ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)

            // Outer oval track (grass/dirt)
            ctx.fillStyle = '#1a2e1a'
            ctx.beginPath(); ctx.ellipse(CX, CY, RX + 50, RY + 50, 0, 0, Math.PI * 2); ctx.fill()

            // Track surface
            ctx.fillStyle = '#7c4412'
            ctx.beginPath(); ctx.ellipse(CX, CY, RX + 30, RY + 30, 0, 0, Math.PI * 2); ctx.fill()

            // Inner oval (infield)
            ctx.fillStyle = '#14432a'
            ctx.beginPath(); ctx.ellipse(CX, CY, RX - 30, RY - 30, 0, 0, Math.PI * 2); ctx.fill()

            // Track outline
            ctx.strokeStyle = 'rgba(255,255,255,0.15)'
            ctx.lineWidth = 2
            ctx.beginPath(); ctx.ellipse(CX, CY, RX + 30, RY + 30, 0, 0, Math.PI * 2); ctx.stroke()
            ctx.beginPath(); ctx.ellipse(CX, CY, RX - 28, RY - 28, 0, 0, Math.PI * 2); ctx.stroke()

            // Lane dividers
            for (let i = 0; i < horses.length; i++) {
                const laneR = RX - 20 + i * (60 / Math.max(horses.length, 1))
                ctx.strokeStyle = 'rgba(255,255,255,0.06)'
                ctx.lineWidth = 1
                ctx.beginPath(); ctx.ellipse(CX, CY, laneR, laneR * (RY / RX), 0, 0, Math.PI * 2); ctx.stroke()
            }

            // Finish line
            const finishAngle = -Math.PI / 2
            const fx1 = CX + (RX - 30) * Math.cos(finishAngle)
            const fy1 = CY + (RY - 30) * Math.sin(finishAngle)
            const fx2 = CX + (RX + 30) * Math.cos(finishAngle)
            const fy2 = CY + (RY + 30) * Math.sin(finishAngle)
            ctx.strokeStyle = '#fbbf24'
            ctx.lineWidth = 3
            ctx.beginPath(); ctx.moveTo(fx1, fy1); ctx.lineTo(fx2, fy2); ctx.stroke()
            ctx.fillStyle = '#fbbf24'
            ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center'
            ctx.fillText('START/FINISH', CX, CY - RY - 38)

            // Center text
            ctx.fillStyle = 'rgba(255,255,255,0.15)'
            ctx.font = 'bold 20px var(--font-orbitron, monospace)'
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
            ctx.fillText('HORSE', CX, CY - 12)
            ctx.fillText('RACE', CX, CY + 12)

            // Draw horses (each in own lane)
            horses.forEach((horse, i) => {
                const pos = horsePositions?.[horse.playerAddress]?.position ?? horse.position ?? 0
                const emotion = horseEmotions?.[horse.playerAddress] ?? 'neutral'
                const isMe = horse.playerAddress === address
                const laneOffset = -20 + i * (50 / Math.max(horses.length, 1))
                const { x, y, angle } = posToXY(pos, laneOffset)
                const color = HORSE_COLORS[horse.personality] || '#7c3aed'
                const fin = horsePositions?.[horse.playerAddress]?.finished || false
                drawTopDownHorse(ctx, x, y, angle, color, emotion, horse.name, isMe, fin)
            })

            rafRef.current = requestAnimationFrame(loop)
        }
        rafRef.current = requestAnimationFrame(loop)
        return () => cancelAnimationFrame(rafRef.current)
    }, [horses, horsePositions, horseEmotions, address])

    useEffect(() => {
        const onKey = e => { if (e.code === 'Space') { e.preventDefault(); encourageHorse(address) } }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [address, encourageHorse])

    const handleSend = e => {
        e.preventDefault()
        if (!chatMsg.trim()) return
        sendHorseChat(address, chatMsg.trim())
        setChatLog(prev => [...prev.slice(-15), { playerAddress: address, message: chatMsg, horseName: myHorse?.name }])
        setChatMsg('')
    }

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: '1rem', height: '100%', padding: '1rem' }}>
            {/* Race Canvas */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.7rem', color: 'var(--color-yellow)', letterSpacing: '0.2em' }}>🐴 HORSE RACE — TOP VIEW</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--color-text-dim)', fontFamily: 'var(--font-orbitron)' }}>SPACE = Encourage | Chat to boost</div>
                </div>
                <canvas ref={canvasRef} style={{ borderRadius: 12, border: '1px solid rgba(251,191,36,0.3)', maxWidth: '100%', boxShadow: '0 0 30px rgba(251,191,36,0.1)' }} />
                {myHorse && (
                    <div style={{ background: `${HORSE_COLORS[myHorse.personality]}15`, border: `1px solid ${HORSE_COLORS[myHorse.personality]}40`, borderRadius: 8, padding: '0.4rem 0.75rem', fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                        {myHorse.personality === 'hothead' && '🔥 Hakaret et (\"yavaş\", \"berbat\") → Sinirlenip 2.8x hızlanır!'}
                        {myHorse.personality === 'stubborn' && '😤 İnatçı! \"Hızlan\" dersen yavaşlar, \"dur\" dersen uçar!'}
                        {myHorse.personality === 'lazy' && '💤 Tembel! Sık sık ov yoksa uyuyakalar...'}
                        {myHorse.personality === 'gentle' && '🌸 Nazik! \"Güzelsin\", \"harikasin\" de → 2x hız!'}
                        {myHorse.personality === 'competitive' && '⚡ Rekabetçi! Geriden gelirken patlama yapar!'}
                    </div>
                )}
            </div>

            {/* Horse Chat — Only YOUR horse */}
            <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--color-border)' }}>
                    <div style={{ fontFamily: 'var(--font-orbitron)', fontSize: '0.65rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>💬 YOUR HORSE CHAT</div>
                    {myHorse && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: HORSE_COLORS[myHorse.personality] }} />
                            <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{myHorse.name}</span>
                            <span style={{ fontSize: '0.65rem', color: 'var(--color-text-dim)', textTransform: 'capitalize' }}>({myHorse.personality})</span>
                        </div>
                    )}
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {chatLog.length === 0 && <div style={{ color: 'var(--color-text-dim)', fontSize: '0.7rem', textAlign: 'center', marginTop: '1rem' }}>Atına bir şeyler söyle!</div>}
                    {chatLog.map((entry, i) => (
                        <div key={i}>
                            {entry.message && (
                                <div style={{ fontSize: '0.72rem', marginBottom: '0.15rem' }}>
                                    <span style={{ color: 'var(--color-cyan-light)', fontWeight: 600 }}>Sen: </span>
                                    <span style={{ color: 'var(--color-text-muted)' }}>{entry.message}</span>
                                </div>
                            )}
                            {entry.reply && (
                                <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                                    style={{ fontSize: '0.72rem', background: 'rgba(124,58,237,0.12)', borderLeft: '2px solid var(--color-purple)', borderRadius: '0 6px 6px 0', padding: '0.25rem 0.4rem', marginBottom: '0.15rem' }}>
                                    <span style={{ color: 'var(--color-purple-light)', fontWeight: 600 }}>{entry.horseName}: </span>
                                    <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>{entry.reply}</span>
                                </motion.div>
                            )}
                        </div>
                    ))}
                </div>
                <form onSubmit={handleSend} style={{ display: 'flex', gap: '0.4rem', padding: '0.5rem', borderTop: '1px solid var(--color-border)' }}>
                    <input className="input" style={{ flex: 1, fontSize: '0.75rem', padding: '0.35rem 0.5rem' }}
                        placeholder="Atına yaz..." value={chatMsg} onChange={e => setChatMsg(e.target.value)} maxLength={80} />
                    <button className="btn btn-primary btn-sm" type="submit">→</button>
                </form>
            </div>
        </div>
    )
}
