import { useEffect, useRef, useState, useCallback } from 'react'
import { useAccount } from 'wagmi'
import { motion } from 'framer-motion'
import useGameStore from '../../store/gameStore'

const COIN_RADIUS = 10
const SPAWN_INTERVAL = 1200
const CANVAS_W = 760
const CANVAS_H = 400

function randomCoin() {
    return { id: Math.random(), x: 30 + Math.random() * (CANVAS_W - 60), y: 30 + Math.random() * (CANVAS_H - 80), collected: false }
}

export default function CoinRush() {
    const canvasRef = useRef(null)
    const { address } = useAccount()
    const { scores, sendAction, players } = useGameStore()
    const myScore = scores[address] || 0
    const [coins, setCoins] = useState(() => Array.from({ length: 8 }, randomCoin))
    const coinsRef = useRef(coins)
    const playerPos = useRef({ x: 100, y: 300 })

    useEffect(() => { coinsRef.current = coins }, [coins])

    // Spawn new coins
    useEffect(() => {
        const t = setInterval(() => {
            setCoins((c) => [...c.filter((coin) => !coin.collected).slice(-12), randomCoin()])
        }, SPAWN_INTERVAL)
        return () => clearInterval(t)
    }, [])

    // Click to collect
    const handleClick = useCallback((e) => {
        const rect = canvasRef.current?.getBoundingClientRect()
        if (!rect) return
        const mx = e.clientX - rect.left
        const my = e.clientY - rect.top
        let collected = false
        setCoins((prev) => prev.map((coin) => {
            if (!coin.collected && Math.hypot(mx - coin.x, my - coin.y) < COIN_RADIUS + 15) {
                collected = true
                return { ...coin, collected: true }
            }
            return coin
        }))
        if (collected) sendAction(address, { type: 'collect-coin' })
    }, [address, sendAction])

    // Draw canvas
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        let raf
        const draw = () => {
            ctx.fillStyle = '#070718'
            ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
            // Grid
            ctx.strokeStyle = 'rgba(251,191,36,0.04)'
            for (let x = 0; x < CANVAS_W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_H); ctx.stroke() }
            for (let y = 0; y < CANVAS_H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_W, y); ctx.stroke() }
            // Coins
            coinsRef.current.forEach((coin) => {
                if (coin.collected) return
                // Glow
                ctx.shadowColor = '#fbbf24'
                ctx.shadowBlur = 15
                ctx.fillStyle = '#fbbf24'
                ctx.beginPath(); ctx.arc(coin.x, coin.y, COIN_RADIUS, 0, Math.PI * 2); ctx.fill()
                ctx.shadowBlur = 0
                // Inner shine
                ctx.fillStyle = '#fde68a'
                ctx.beginPath(); ctx.arc(coin.x - 3, coin.y - 3, COIN_RADIUS * 0.4, 0, Math.PI * 2); ctx.fill()
                // Dollar hint
                ctx.fillStyle = '#92400e'
                ctx.font = 'bold 10px Arial'
                ctx.textAlign = 'center'
                ctx.fillText('$', coin.x, coin.y + 4)
            })
            raf = requestAnimationFrame(draw)
        }
        raf = requestAnimationFrame(draw)
        return () => cancelAnimationFrame(raf)
    }, [])

    // Leaderboard
    const sorted = Object.entries(scores).sort(([, a], [, b]) => b - a)

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '1rem' }}>
            {/* Score */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                <motion.div
                    key={myScore}
                    initial={{ scale: 1.5, color: '#fde68a' }}
                    animate={{ scale: 1, color: '#fbbf24' }}
                    style={{ fontFamily: 'var(--font-pixel)', fontSize: '1.5rem' }}
                >
                    💰 {myScore}
                </motion.div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    {sorted.slice(0, 4).map(([addr, score]) => (
                        <div key={addr} style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                            <div style={{ fontFamily: 'var(--font-orbitron)', color: 'var(--color-yellow)', fontWeight: 700 }}>{score}</div>
                            <div>{addr?.slice(0, 6)}</div>
                        </div>
                    ))}
                </div>
            </div>
            <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} onClick={handleClick} style={{ border: '1px solid rgba(251,191,36,0.3)', borderRadius: '8px', cursor: 'crosshair', maxWidth: '100%' }} />
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-orbitron)' }}>CLICK THE COINS TO COLLECT THEM!</div>
        </div>
    )
}
