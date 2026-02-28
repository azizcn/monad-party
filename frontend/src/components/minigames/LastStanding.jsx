import { useEffect, useRef, useState } from 'react'
import { useAccount } from 'wagmi'
import { motion, AnimatePresence } from 'framer-motion'
import useGameStore from '../../store/gameStore'
import GameCanvas from '../GameCanvas'

export default function LastStanding() {
    const { address } = useAccount()
    const { sendEliminated, sendAction, players } = useGameStore()
    const [eliminated, setEliminated] = useState([])
    const [myHealth, setMyHealth] = useState(100)

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <AnimatePresence>
                {eliminated.includes(address) && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ position: 'absolute', inset: 0, zIndex: 30, background: 'rgba(10,10,30,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ fontSize: '3rem' }}>💀</div>
                        <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '1rem', color: 'var(--color-red)' }}>YOU WERE ELIMINATED</div>
                        <div style={{ color: 'var(--color-text-muted)' }}>Watching remaining players...</div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Health bar */}
            {!eliminated.includes(address) && (
                <div style={{ position: 'absolute', top: '0.75rem', left: '50%', transform: 'translateX(-50%)', zIndex: 20, display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(5,5,16,0.8)', padding: '0.5rem 1rem', borderRadius: '9999px', border: '1px solid var(--color-border)' }}>
                    <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-orbitron)', color: 'var(--color-text-muted)' }}>HP</span>
                    <div style={{ width: 120, height: 8, background: 'var(--color-surface2)', borderRadius: 4, overflow: 'hidden' }}>
                        <motion.div style={{ height: '100%', borderRadius: 4, background: myHealth > 50 ? 'var(--color-green)' : myHealth > 25 ? 'var(--color-yellow)' : 'var(--color-red)' }} animate={{ width: `${myHealth}%` }} transition={{ duration: 0.3 }} />
                    </div>
                    <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-orbitron)', color: 'white', minWidth: 32 }}>{myHealth}%</span>
                </div>
            )}

            <GameCanvas />

            <div style={{ position: 'absolute', bottom: '0.75rem', left: '50%', transform: 'translateX(-50%)', background: 'rgba(5,5,16,0.8)', padding: '0.3rem 1rem', borderRadius: '9999px', fontSize: '0.7rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-orbitron)' }}>
                WASD/ARROWS to move · SPACE to jump
            </div>
        </div>
    )
}
