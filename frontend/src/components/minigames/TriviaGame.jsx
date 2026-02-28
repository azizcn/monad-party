import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { motion, AnimatePresence } from 'framer-motion'
import useGameStore from '../../store/gameStore'

export default function TriviaGame({ gameData }) {
    const { address } = useAccount()
    const { sendAction, scores } = useGameStore()
    const [selected, setSelected] = useState(null)
    const [revealed, setRevealed] = useState(false)
    const [timeLeft, setTimeLeft] = useState(15)

    const question = gameData?.triviaQuestion
    const options = question?.options || []
    const correct = question?.answer

    // Countdown
    useEffect(() => {
        setTimeLeft(15)
        setSelected(null)
        setRevealed(false)
        const t = setInterval(() => {
            setTimeLeft((c) => {
                if (c <= 1) { clearInterval(t); setRevealed(true); return 0 }
                return c - 1
            })
        }, 1000)
        return () => clearInterval(t)
    }, [gameData?.id])

    const handleAnswer = (opt) => {
        if (selected || revealed) return
        setSelected(opt)
        setRevealed(true)
        sendAction(address, { type: 'answer', answer: opt })
    }

    const optColors = ['#7c3aed', '#06b6d4', '#fbbf24', '#ec4899']
    const optLabels = ['A', 'B', 'C', 'D']
    const pct = (timeLeft / 15) * 100

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '2rem', gap: '2rem', maxWidth: 700, margin: '0 auto' }}>
            {/* Timer */}
            <div style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontFamily: 'var(--font-orbitron)', fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>🧠 CRYPTO TRIVIA</span>
                    <span style={{ fontFamily: 'var(--font-orbitron)', fontWeight: 900, fontSize: '1.25rem', color: timeLeft <= 5 ? 'var(--color-red)' : 'var(--color-purple-light)' }}>{timeLeft}s</span>
                </div>
                <div className="progress-bar">
                    <motion.div className="progress-fill" style={{ width: `${pct}%`, background: timeLeft <= 5 ? 'linear-gradient(90deg, var(--color-red), #f87171)' : undefined }} />
                </div>
            </div>

            {/* Question */}
            <div className="card-glow" style={{ width: '100%', textAlign: 'center', padding: '2rem' }}>
                <div style={{ fontFamily: 'var(--font-orbitron)', fontWeight: 700, fontSize: 'clamp(0.9rem, 2vw, 1.25rem)', lineHeight: 1.5, color: 'white' }}>
                    {question?.question || 'Loading question...'}
                </div>
            </div>

            {/* Options */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', width: '100%' }}>
                {options.map((opt, i) => {
                    const isCorrect = revealed && opt === correct
                    const isWrong = revealed && opt === selected && opt !== correct
                    const isMySelected = selected === opt
                    return (
                        <motion.button
                            key={opt}
                            onClick={() => handleAnswer(opt)}
                            disabled={!!selected || revealed}
                            whileHover={!selected && !revealed ? { scale: 1.03 } : {}}
                            whileTap={!selected && !revealed ? { scale: 0.97 } : {}}
                            style={{
                                padding: '1rem 1.5rem',
                                borderRadius: '10px',
                                border: `2px solid ${isCorrect ? 'var(--color-green)' : isWrong ? 'var(--color-red)' : isMySelected ? optColors[i] : 'var(--color-border)'}`,
                                background: isCorrect ? 'rgba(16,185,129,0.2)' : isWrong ? 'rgba(239,68,68,0.2)' : isMySelected ? `${optColors[i]}20` : 'var(--color-surface)',
                                cursor: selected || revealed ? 'default' : 'pointer',
                                display: 'flex', alignItems: 'center', gap: '0.75rem',
                                transition: 'all 0.3s ease', textAlign: 'left',
                            }}
                        >
                            <span style={{ width: 28, height: 28, borderRadius: '50%', background: optColors[i], display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-orbitron)', fontWeight: 900, fontSize: '0.75rem', flexShrink: 0, color: i === 2 ? '#000' : '#fff' }}>
                                {optLabels[i]}
                            </span>
                            <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', fontWeight: 500, color: isCorrect ? 'var(--color-green)' : isWrong ? 'var(--color-red)' : 'var(--color-text)' }}>
                                {opt}
                            </span>
                            {isCorrect && <span style={{ marginLeft: 'auto', color: 'var(--color-green)', fontSize: '1.2rem' }}>✅</span>}
                            {isWrong && <span style={{ marginLeft: 'auto', color: 'var(--color-red)', fontSize: '1.2rem' }}>❌</span>}
                        </motion.button>
                    )
                })}
            </div>

            {/* Result message */}
            <AnimatePresence>
                {revealed && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ fontFamily: 'var(--font-orbitron)', fontSize: '0.875rem', color: selected === correct ? 'var(--color-green)' : 'var(--color-red)', textAlign: 'center' }}>
                        {!selected ? '⏰ Time\'s up!' : selected === correct ? '🎉 CORRECT! Sending answer to server...' : '💀 Wrong answer! The correct answer was: ' + correct}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
