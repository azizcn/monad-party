import { useEffect, useRef, useState } from 'react'
import { useAccount } from 'wagmi'
import { motion, AnimatePresence } from 'framer-motion'
import useGameStore from '../../store/gameStore'
import GameCanvas from '../GameCanvas'

const CANVAS_H = 500
const PLATFORM_DROP_INTERVAL = 3000

const INITIAL_PLATFORMS_COUNT = 7

export default function PlatformSurvival() {
    const { address } = useAccount()
    const { sendEliminated } = useGameStore()
    const [eliminated, setEliminated] = useState(false)
    const [platformsLeft, setPlatformsLeft] = useState(INITIAL_PLATFORMS_COUNT)
    const [dropMessage, setDropMessage] = useState(null)

    // Simulate dropping platforms
    useEffect(() => {
        if (eliminated || platformsLeft <= 1) return
        const t = setTimeout(() => {
            setPlatformsLeft((p) => p - 1)
            setDropMessage('⚠️ Platform gone!')
            setTimeout(() => setDropMessage(null), 1500)
        }, PLATFORM_DROP_INTERVAL)
        return () => clearTimeout(t)
    }, [platformsLeft, eliminated])

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            {/* Danger bar */}
            <div style={{ position: 'absolute', top: '0.75rem', left: '50%', transform: 'translateX(-50%)', zIndex: 20, display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(5,5,16,0.85)', padding: '0.5rem 1.5rem', borderRadius: '9999px', border: '1px solid rgba(239,68,68,0.3)' }}>
                <span style={{ fontFamily: 'var(--font-orbitron)', fontSize: '0.7rem', color: 'var(--color-red)' }}>🏔️ PLATFORMS LEFT</span>
                {Array.from({ length: INITIAL_PLATFORMS_COUNT }).map((_, i) => (
                    <motion.div
                        key={i}
                        style={{ width: 20, height: 8, borderRadius: 2, background: i < platformsLeft ? 'var(--color-green)' : 'var(--color-red)' }}
                        animate={i === platformsLeft ? { scale: [1, 1.3, 1], opacity: [1, 0.5, 0] } : {}}
                    />
                ))}
            </div>

            {/* Drop warning */}
            <AnimatePresence>
                {dropMessage && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.2 }}
                        style={{ position: 'absolute', top: '30%', left: '50%', transform: 'translateX(-50%)', zIndex: 50, fontFamily: 'var(--font-pixel)', fontSize: '1rem', color: 'var(--color-red)', textShadow: '0 0 20px var(--color-red)', background: 'rgba(10,10,20,0.9)', padding: '0.75rem 2rem', borderRadius: '8px', border: '1px solid var(--color-red)' }}
                    >
                        {dropMessage}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Eliminated overlay */}
            <AnimatePresence>
                {eliminated && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ position: 'absolute', inset: 0, zIndex: 30, background: 'rgba(10,10,30,0.9)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
                        <div style={{ fontSize: '3rem' }}>🕳️</div>
                        <div style={{ fontFamily: 'var(--font-pixel)', color: 'var(--color-red)', fontSize: '1rem' }}>YOU FELL!</div>
                    </motion.div>
                )}
            </AnimatePresence>

            <GameCanvas />

            <div style={{ position: 'absolute', bottom: '0.75rem', left: '50%', transform: 'translateX(-50%)', background: 'rgba(5,5,16,0.8)', padding: '0.3rem 1rem', borderRadius: '9999px', fontSize: '0.7rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-orbitron)' }}>
                STAY ON THE PLATFORMS — DON'T FALL!
            </div>
        </div>
    )
}
