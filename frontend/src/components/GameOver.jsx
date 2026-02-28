import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import useGameStore from '../store/gameStore'
import useWalletStore from '../store/walletStore'

const AVATAR_COLORS = ['#7c3aed', '#06b6d4', '#fbbf24', '#ec4899', '#10b981', '#f97316', '#3b82f6', '#ef4444']
const MEDALS = ['🥇', '🥈', '🥉']

function Confetti({ count = 80 }) {
    const colors = ['#7c3aed', '#06b6d4', '#fbbf24', '#ec4899', '#10b981']
    return (
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 5 }}>
            {Array.from({ length: count }).map((_, i) => (
                <motion.div
                    key={i}
                    style={{
                        position: 'absolute',
                        top: -20,
                        left: `${Math.random() * 100}%`,
                        width: 8 + Math.random() * 8,
                        height: 8 + Math.random() * 8,
                        background: colors[i % colors.length],
                        borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                    }}
                    animate={{ y: '110vh', rotate: Math.random() * 720 - 360, x: Math.random() * 200 - 100 }}
                    transition={{ duration: 2 + Math.random() * 2, delay: Math.random() * 1.5, ease: 'easeIn' }}
                />
            ))}
        </div>
    )
}

export default function GameOver({ data }) {
    const navigate = useNavigate()
    const { address } = useWalletStore()
    const { resetGame, leaveRoom } = useGameStore()
    const { champion, leaderboard = [], roundWinners = [] } = data || {}

    const iWon = champion === address
    const pot = leaderboard.length * 0.95 // approximate

    const handlePlayAgain = () => {
        resetGame()
        navigate('/lobby')
    }
    const handleMainMenu = () => {
        leaveRoom(address)
        navigate('/')
    }

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', position: 'relative', overflow: 'hidden', background: 'var(--color-bg)' }} className="grid-bg">
            {iWon && <Confetti />}

            {/* Background glow */}
            <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', width: 500, height: 500, background: `radial-gradient(circle, ${iWon ? 'rgba(251,191,36,0.2)' : 'rgba(124,58,237,0.1)'} 0%, transparent 70%)`, pointerEvents: 'none' }} />

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: 700, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem' }}>

                {/* Title */}
                <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', bounce: 0.5 }} style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: 'var(--font-pixel)', fontSize: iWon ? '1.5rem' : '1.2rem', color: iWon ? 'var(--color-yellow)' : 'white', textShadow: iWon ? 'var(--glow-yellow)' : 'none', marginBottom: '0.5rem', letterSpacing: '0.1em' }}>
                        {iWon ? '🏆 YOU WIN! 🏆' : 'GAME OVER'}
                    </div>
                    {iWon && (
                        <div style={{ fontFamily: 'var(--font-orbitron)', fontSize: '1rem', color: 'var(--color-green)' }}>
                            💎 Reward: ~{pot.toFixed(2)} MON sent to your wallet!
                        </div>
                    )}
                </motion.div>

                {/* Winner card */}
                {champion && (
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        style={{ background: 'linear-gradient(135deg, rgba(251,191,36,0.15), rgba(251,191,36,0.05))', border: '2px solid rgba(251,191,36,0.5)', borderRadius: '16px', padding: '1.5rem 3rem', textAlign: 'center', boxShadow: 'var(--glow-yellow)' }}
                    >
                        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>👑</div>
                        <div style={{ fontFamily: 'var(--font-orbitron)', fontWeight: 900, fontSize: '1.25rem', color: 'var(--color-yellow)', marginBottom: '0.25rem' }}>CHAMPION</div>
                        <div style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                            {champion?.slice(0, 10)}...{champion?.slice(-8)}
                        </div>
                    </motion.div>
                )}

                {/* Leaderboard */}
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    <div style={{ fontFamily: 'var(--font-orbitron)', fontSize: '0.7rem', color: 'var(--color-text-muted)', letterSpacing: '0.15em', marginBottom: '0.25rem' }}>FINAL STANDINGS</div>
                    {leaderboard.map((entry, i) => (
                        <motion.div
                            key={entry.address}
                            initial={{ opacity: 0, x: -30 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.4 + i * 0.08 }}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem 1rem',
                                background: i === 0 ? 'rgba(251,191,36,0.1)' : 'var(--color-surface)',
                                border: `1px solid ${i === 0 ? 'rgba(251,191,36,0.4)' : 'var(--color-border)'}`,
                                borderRadius: '10px',
                            }}
                        >
                            <span style={{ fontSize: '1.25rem', minWidth: 32 }}>{MEDALS[i] || `#${i + 1}`}</span>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: AVATAR_COLORS[i % 8], display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-orbitron)', fontWeight: 700, fontSize: '0.65rem', color: '#000' }}>
                                {entry.address?.slice(2, 4).toUpperCase()}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontFamily: 'var(--font-orbitron)', fontWeight: 600, fontSize: '0.8rem' }}>
                                    {entry.address?.slice(0, 8)}...{entry.address?.slice(-6)}
                                    {entry.address === address && <span style={{ marginLeft: '0.5rem', color: 'var(--color-cyan-light)', fontSize: '0.65rem' }}>(YOU)</span>}
                                </div>
                            </div>
                            <div style={{ fontFamily: 'var(--font-orbitron)', fontWeight: 900, fontSize: '1.1rem', color: i === 0 ? 'var(--color-yellow)' : 'var(--color-text)' }}>{entry.score} pts</div>
                            {i === 0 && (
                                <div style={{ fontSize: '0.7rem', fontFamily: 'var(--font-orbitron)', color: 'var(--color-green)', minWidth: 60, textAlign: 'right' }}>+{pot.toFixed(2)} MON</div>
                            )}
                        </motion.div>
                    ))}
                </div>

                {/* Round winners recap */}
                {roundWinners.length > 0 && (
                    <div style={{ width: '100%' }}>
                        <div style={{ fontFamily: 'var(--font-orbitron)', fontSize: '0.7rem', color: 'var(--color-text-muted)', letterSpacing: '0.15em', marginBottom: '0.5rem' }}>ROUND RECAP</div>
                        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                            {roundWinners.map((rw, i) => (
                                <div key={i} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '0.5rem 0.75rem', fontSize: '0.75rem' }}>
                                    <span style={{ color: 'var(--color-text-muted)' }}>Round {rw.round}: </span>
                                    <span style={{ color: 'var(--color-purple-light)', fontWeight: 600 }}>{rw.winner?.slice(0, 6)}...</span>
                                    <span style={{ color: 'var(--color-text-muted)' }}> won {rw.game}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* CTA Buttons */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} style={{ display: 'flex', gap: '1rem' }}>
                    <motion.button className="btn btn-primary btn-lg" onClick={handlePlayAgain} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                        🎮 PLAY AGAIN
                    </motion.button>
                    <motion.button className="btn btn-ghost btn-lg" onClick={handleMainMenu} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                        🏠 MAIN MENU
                    </motion.button>
                </motion.div>
            </motion.div>
        </div>
    )
}
