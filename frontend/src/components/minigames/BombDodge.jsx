import { useEffect, useRef, useState, useCallback } from 'react'
import { useAccount } from 'wagmi'
import { motion, AnimatePresence } from 'framer-motion'
import useGameStore from '../../store/gameStore'

const CANVAS_W = 760
const CANVAS_H = 400
const BOMB_RADIUS = 20
const EXPLOSION_RADIUS = 70
const SAFE_ZONE_PX = 200

function randomBomb(id) {
    return {
        id,
        x: SAFE_ZONE_PX + Math.random() * (CANVAS_W - SAFE_ZONE_PX * 2),
        y: 20 + Math.random() * 100,
        countdown: 3 + Math.floor(Math.random() * 2),
        exploding: false,
        done: false,
    }
}

export default function BombDodge() {
    const { address } = useAccount()
    const { sendEliminated, players } = useGameStore()
    const [bombs, setBombs] = useState(() => [randomBomb(1), randomBomb(2)])
    const [myPos, setMyPos] = useState({ x: 380, y: 350 })
    const [eliminated, setEliminated] = useState(false)
    const [explosions, setExplosions] = useState([])
    const canvasRef = useRef(null)
    const bombsRef = useRef(bombs)
    const myPosRef = useRef(myPos)
    let bombCounter = useRef(3)

    useEffect(() => { bombsRef.current = bombs }, [bombs])
    useEffect(() => { myPosRef.current = myPos }, [myPos])

    // Countdown bombs
    useEffect(() => {
        if (eliminated) return
        const t = setInterval(() => {
            setBombs((prev) => {
                const next = prev.map((b) => {
                    if (b.done) return b
                    if (b.exploding) return { ...b, done: true }
                    const nc = b.countdown - 1
                    if (nc <= 0) {
                        // Check if player is in blast radius
                        const dist = Math.hypot(myPosRef.current.x - b.x, myPosRef.current.y - b.y)
                        if (dist < EXPLOSION_RADIUS + 20) {
                            setEliminated(true)
                            sendEliminated(address)
                        }
                        setExplosions((e) => [...e, { x: b.x, y: b.y, id: b.id, t: Date.now() }])
                        return { ...b, exploding: true }
                    }
                    return { ...b, countdown: nc }
                })
                // Spawn new bomb
                if (next.filter((b) => !b.done).length < 3) {
                    bombCounter.current++
                    return next.filter((b) => !b.done).concat(randomBomb(bombCounter.current))
                }
                return next.filter((b) => !b.done)
            })
        }, 1000)
        return () => clearInterval(t)
    }, [eliminated, address])

    // Cleanup explosions
    useEffect(() => {
        const t = setInterval(() => {
            setExplosions((e) => e.filter((ex) => Date.now() - ex.t < 800))
        }, 200)
        return () => clearInterval(t)
    }, [])

    // Mouse move to dodge
    const handleMouseMove = useCallback((e) => {
        const rect = canvasRef.current?.getBoundingClientRect()
        if (!rect) return
        setMyPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    }, [])

    // Draw
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        let raf
        const draw = () => {
            ctx.fillStyle = '#080818'
            ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
            // Explosions
            explosions.forEach((ex) => {
                const age = (Date.now() - ex.t) / 800
                ctx.globalAlpha = 1 - age
                const grad = ctx.createRadialGradient(ex.x, ex.y, 0, ex.x, ex.y, EXPLOSION_RADIUS * (1 + age))
                grad.addColorStop(0, '#fde68a')
                grad.addColorStop(0.4, '#f97316')
                grad.addColorStop(1, 'transparent')
                ctx.fillStyle = grad
                ctx.beginPath(); ctx.arc(ex.x, ex.y, EXPLOSION_RADIUS * (1 + age * 0.5), 0, Math.PI * 2); ctx.fill()
                ctx.globalAlpha = 1
            })
            // Bombs
            bombsRef.current.forEach((b) => {
                ctx.shadowColor = b.countdown <= 1 ? '#ef4444' : '#f97316'
                ctx.shadowBlur = 20
                ctx.fillStyle = '#1a1a1a'
                ctx.beginPath(); ctx.arc(b.x, b.y, BOMB_RADIUS, 0, Math.PI * 2); ctx.fill()
                ctx.strokeStyle = b.countdown <= 1 ? '#ef4444' : '#f97316'
                ctx.lineWidth = 2
                ctx.stroke()
                ctx.shadowBlur = 0
                ctx.fillStyle = '#fff'
                ctx.font = 'bold 14px monospace'
                ctx.textAlign = 'center'
                ctx.fillText(b.countdown, b.x, b.y + 5)
                // Fuse
                ctx.strokeStyle = '#fbbf24'
                ctx.lineWidth = 2
                ctx.beginPath(); ctx.moveTo(b.x, b.y - BOMB_RADIUS); ctx.quadraticCurveTo(b.x + 15, b.y - 35, b.x + 10, b.y - 50); ctx.stroke()
            })
            // Player
            if (!eliminated) {
                const p = myPosRef.current
                ctx.shadowColor = '#06b6d4'
                ctx.shadowBlur = 15
                ctx.fillStyle = '#06b6d4'
                ctx.beginPath(); ctx.arc(p.x, p.y, 14, 0, Math.PI * 2); ctx.fill()
                ctx.shadowBlur = 0
                ctx.fillStyle = '#fff'
                ctx.font = '8px monospace'
                ctx.textAlign = 'center'
                ctx.fillText('YOU', p.x, p.y + 3)
            }
            raf = requestAnimationFrame(draw)
        }
        raf = requestAnimationFrame(draw)
        return () => cancelAnimationFrame(raf)
    }, [explosions, eliminated])

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1rem', padding: '1rem', position: 'relative' }}>
            <AnimatePresence>
                {eliminated && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ position: 'absolute', inset: 0, zIndex: 30, background: 'rgba(10,10,30,0.9)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
                        <div style={{ fontSize: '3rem' }}>💥</div>
                        <div style={{ fontFamily: 'var(--font-pixel)', color: 'var(--color-red)', fontSize: '1rem' }}>BOOM! ELIMINATED!</div>
                    </motion.div>
                )}
            </AnimatePresence>
            <div style={{ fontFamily: 'var(--font-orbitron)', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>💣 MOVE YOUR CURSOR TO DODGE THE BOMBS!</div>
            <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} onMouseMove={handleMouseMove} style={{ border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', cursor: eliminated ? 'default' : 'none', maxWidth: '100%' }} />
        </div>
    )
}
