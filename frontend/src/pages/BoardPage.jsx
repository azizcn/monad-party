import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { motion, AnimatePresence } from 'framer-motion'
import useGameStore from '../store/gameStore'
import Board from '../components/Board'
import HorseRace from '../components/HorseRace'

const PLAYER_COLORS = ['#7c3aed', '#06b6d4', '#fbbf24', '#ec4899', '#10b981', '#f97316', '#3b82f6', '#ef4444']

const TILE_LEGEND = [
    { type: 'chest', icon: '🎁', label: 'Chest (+1, 3=WIN)', color: '#f59e0b' },
    { type: 'minigame', icon: '🎲', label: 'Horse Race!', color: '#06b6d4' },
    { type: 'trap', icon: '💀', label: 'Trap (-1 chest)', color: '#ef4444' },
    { type: 'normal', icon: '🟦', label: 'Normal', color: '#6366f1' },
]

export default function BoardPage() {
    const { roomId } = useParams()
    const navigate = useNavigate()
    const { address } = useAccount()
    const [myReady, setMyReady] = useState(false)
    const [diceAnimating, setDiceAnimating] = useState(false)
    const [chatInput, setChatInput] = useState('')
    const [botDifficulty, setBotDifficulty] = useState('easy')
    const chatRef = useRef(null)

    const {
        players, gameStatus, boardState, tiles, currentPlayer,
        isHost, chatMessages, sendChat, setReady, startGame,
        leaveRoom, addBot, rollDice, horses, horseRaceActive,
        boardGameOver, connected, roomData, lastDice, tileLog,
    } = useGameStore()

    useEffect(() => {
        if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
    }, [chatMessages])

    const isMyTurn = boardState?.currentPlayer === address && gameStatus === 'in_game' && !horseRaceActive
    const readyCount = players.filter(p => p.isReady || p.isBot).length
    const canStart = isHost && players.length >= 1 && gameStatus === 'waiting'
    const canAddBot = isHost && players.length < (roomData?.maxPlayers || 8) && gameStatus === 'waiting'

    const handleRollDice = () => {
        if (!isMyTurn || diceAnimating) return
        setDiceAnimating(true)
        rollDice(address)
        setTimeout(() => setDiceAnimating(false), 1200)
    }

    const handleChatSend = (e) => {
        e.preventDefault()
        if (!chatInput.trim()) return
        sendChat(address, chatInput.trim())
        setChatInput('')
    }

    const handleLeave = () => {
        leaveRoom(address)
        navigate('/')
    }

    if (boardGameOver) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)', gap: '2rem' }} className="grid-bg">
                {/* Confetti */}
                {Array.from({ length: 60 }).map((_, i) => (
                    <motion.div key={i} style={{ position: 'fixed', top: -20, left: `${Math.random() * 100}%`, width: 10, height: 10, background: PLAYER_COLORS[i % 8], borderRadius: i % 2 ? '50%' : 2 }}
                        animate={{ y: '110vh', rotate: Math.random() * 720, x: Math.random() * 200 - 100 }}
                        transition={{ duration: 2 + Math.random() * 2, delay: Math.random() * 1.5 }} />
                ))}
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', bounce: 0.6 }} style={{ textAlign: 'center', zIndex: 10 }}>
                    <div style={{ fontSize: '4rem', marginBottom: '0.5rem' }}>🏆</div>
                    <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '1.5rem', color: 'var(--color-yellow)', textShadow: '0 0 30px rgba(251,191,36,0.8)', marginBottom: '0.5rem' }}>
                        {boardGameOver.winner === address ? 'YOU WIN!' : 'GAME OVER!'}
                    </div>
                    <div style={{ fontFamily: 'var(--font-orbitron)', fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '2rem' }}>
                        Champion: {boardGameOver.winner?.slice(0, 12)}...
                    </div>
                    {/* Leaderboard */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '2rem', maxWidth: 400 }}>
                        {boardGameOver.boardState?.players?.sort((a, b) => b.chests - a.chests).map((p, i) => (
                            <div key={p.address} style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--color-surface)', border: `1px solid ${p.address === boardGameOver.winner ? 'rgba(251,191,36,0.5)' : 'var(--color-border)'}`, borderRadius: 10, padding: '0.75rem 1rem' }}>
                                <span style={{ fontSize: '1.25rem' }}>{['🥇', '🥈', '🥉'][i] || `#${i + 1}`}</span>
                                <span style={{ flex: 1, fontFamily: 'var(--font-orbitron)', fontSize: '0.75rem' }}>{p.name}</span>
                                <span style={{ color: 'var(--color-yellow)', fontWeight: 700 }}>🎁 {p.chests}</span>
                            </div>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                        <motion.button className="btn btn-primary btn-lg" onClick={() => { leaveRoom(address); navigate('/lobby') }} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>🎮 Play Again</motion.button>
                        <motion.button className="btn btn-ghost btn-lg" onClick={handleLeave} whileHover={{ scale: 1.05 }}>🏠 Main Menu</motion.button>
                    </div>
                </motion.div>
            </div>
        )
    }

    return (
        <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: horseRaceActive ? '1fr' : '1fr 300px', gridTemplateRows: 'auto 1fr', background: 'var(--color-bg)' }}>

            {/* ── Top Bar ── */}
            <div style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1.5rem', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button className="btn btn-ghost btn-sm" onClick={handleLeave}>← Leave</button>
                    <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.65rem', color: 'var(--color-purple-light)', letterSpacing: '0.15em' }}>MONAD PARTY</span>
                    {!import.meta.env.VITE_CONTRACT_ADDRESS && (
                        <div style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', borderRadius: 6, padding: '0.15rem 0.5rem', fontSize: '0.6rem', fontFamily: 'var(--font-orbitron)', color: 'var(--color-green)' }}>
                            🆓 FREE
                        </div>
                    )}
                </div>

                {gameStatus === 'in_game' && boardState && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        {horseRaceActive ? (
                            <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.7rem', color: 'var(--color-yellow)', animation: 'pulse 1s infinite' }}>🐴 HORSE RACE!</div>
                        ) : (
                            <div style={{ fontFamily: 'var(--font-orbitron)', fontSize: '0.8rem' }}>
                                Turn: <span style={{ color: 'var(--color-cyan-light)', fontWeight: 700 }}>
                                    {boardState.currentPlayer === address ? 'YOUR TURN 🎲' : `${boardState.currentPlayer?.slice(0, 8)}...`}
                                </span>
                            </div>
                        )}
                    </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: connected ? 'var(--color-green)' : 'var(--color-red)' }} />
                    <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-orbitron)' }}>{players.length}P</span>
                </div>
            </div>

            {/* ── Main Area ── */}
            <div style={{ overflow: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>

                {/* Waiting Lobby */}
                {gameStatus === 'waiting' && (
                    <div style={{ textAlign: 'center', maxWidth: 520 }}>
                        <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '1rem', color: 'var(--color-purple-light)', marginBottom: '0.5rem' }}>
                            🐴 MONAD PARTY BOARD GAME
                        </div>
                        <div style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
                            Roll dice, collect 3 chests to win! Horse races on 🎲 tiles.
                        </div>

                        {/* Legend */}
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                            {TILE_LEGEND.map(t => (
                                <div key={t.type} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'var(--color-surface)', border: `1px solid ${t.color}40`, borderRadius: 6, padding: '0.25rem 0.5rem', fontSize: '0.7rem' }}>
                                    <span>{t.icon}</span>
                                    <span style={{ color: t.color }}>{t.label}</span>
                                </div>
                            ))}
                        </div>

                        <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: 'var(--color-text-muted)' }}>{readyCount}/{players.length} ready</div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <motion.button className={`btn ${myReady ? 'btn-danger' : 'btn-green'} btn-lg`}
                                    style={{ background: myReady ? undefined : 'linear-gradient(135deg,var(--color-green),#34d399)', color: myReady ? undefined : '#000' }}
                                    onClick={() => { const n = !myReady; setMyReady(n); setReady(address, n) }}
                                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                    {myReady ? '❌ NOT READY' : '✅ READY'}
                                </motion.button>
                                {canStart && (
                                    <motion.button className="btn btn-primary btn-lg animate-pulse-glow" onClick={() => startGame(address)} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                        🎲 START GAME
                                    </motion.button>
                                )}
                            </div>
                            {canAddBot && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '0.5rem 0.75rem' }}>
                                    <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-orbitron)', color: 'var(--color-text-muted)' }}>BOT:</span>
                                    <select value={botDifficulty} onChange={e => setBotDifficulty(e.target.value)}
                                        style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 6, color: 'var(--color-text)', padding: '0.25rem', fontSize: '0.75rem', cursor: 'pointer' }}>
                                        <option value="easy">Easy</option>
                                        <option value="medium">Medium</option>
                                        <option value="hard">Hard</option>
                                    </select>
                                    <button className="btn btn-primary" style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem' }} onClick={() => addBot(address, botDifficulty)}>🤖 Add Bot</button>
                                </motion.div>
                            )}
                        </div>
                    </div>
                )}

                {/* Board Game */}
                {gameStatus === 'in_game' && !horseRaceActive && tiles?.length > 0 && (
                    <>
                        <Board
                            tiles={tiles}
                            players={players}
                            boardState={boardState}
                            currentPlayer={boardState?.currentPlayer}
                            address={address}
                            onRollDice={handleRollDice}
                            isMyTurn={isMyTurn}
                            lastDice={lastDice}
                            diceAnimating={diceAnimating}
                        />

                        {/* Event log */}
                        {tileLog?.length > 0 && (
                            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '0.6rem 1rem', maxWidth: 650, width: '100%', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                                <span style={{ fontSize: '1.1rem' }}>
                                    {tileLog[tileLog.length - 1]?.split('').slice(0, 2).join('')}
                                </span>
                                {' '}{tileLog[tileLog.length - 1]}
                            </motion.div>
                        )}
                    </>
                )}

                {/* Horse Race Mini-Game */}
                {gameStatus === 'in_game' && horseRaceActive && horses?.length > 0 && (
                    <div style={{ width: '100%', height: 'calc(100vh - 80px)' }}>
                        <HorseRace horses={horses} />
                    </div>
                )}
            </div>

            {/* ── Right Panel (Chat + Scoreboard) ── */}
            {!horseRaceActive && (
                <div style={{ background: 'var(--color-surface)', borderLeft: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                    {/* Players + Scores */}
                    <div style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)', overflow: 'auto', maxHeight: '45%' }}>
                        <h3 style={{ fontFamily: 'var(--font-orbitron)', fontSize: '0.7rem', color: 'var(--color-text-muted)', letterSpacing: '0.15em', marginBottom: '0.75rem' }}>PLAYERS</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            {players.map((p, i) => {
                                const bp = boardState?.players?.find(bp => bp.address === p.address)
                                const isCurrentTurn = boardState?.currentPlayer === p.address && gameStatus === 'in_game'
                                return (
                                    <div key={p.address} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', background: isCurrentTurn ? 'rgba(251,191,36,0.1)' : 'var(--color-bg2)', border: `1px solid ${isCurrentTurn ? 'rgba(251,191,36,0.4)' : 'var(--color-border)'}`, borderRadius: 8 }}>
                                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: PLAYER_COLORS[i % 8], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, color: '#000', flexShrink: 0 }}>
                                            {p.isBot ? '🤖' : p.address?.slice(2, 4).toUpperCase()}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontFamily: 'var(--font-orbitron)', fontSize: '0.65rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {p.isBot ? p.name : `${p.address?.slice(0, 6)}...`}
                                                {p.address === address && <span style={{ color: 'var(--color-cyan-light)', marginLeft: '0.3rem', fontSize: '0.55rem' }}>(you)</span>}
                                                {isCurrentTurn && <span style={{ color: 'var(--color-yellow)', marginLeft: '0.3rem' }}>🎲</span>}
                                            </div>
                                        </div>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-yellow)' }}>🎁 {bp?.chests || 0}</div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Chat */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '1rem' }}>
                        <h3 style={{ fontFamily: 'var(--font-orbitron)', fontSize: '0.7rem', color: 'var(--color-text-muted)', letterSpacing: '0.15em', marginBottom: '0.75rem' }}>CHAT</h3>
                        <div ref={chatRef} style={{ flex: 1, overflowY: 'auto', marginBottom: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            {chatMessages.map((msg, i) => (
                                <div key={i} style={{ fontSize: '0.75rem' }}>
                                    <span style={{ color: msg.address === 'SYSTEM' ? 'var(--color-cyan-light)' : 'var(--color-purple-light)', fontWeight: 600 }}>
                                        {msg.address === 'SYSTEM' ? '🔔' : msg.address?.slice(0, 6)}: </span>
                                    <span style={{ color: 'var(--color-text-muted)' }}>{msg.message}</span>
                                </div>
                            ))}
                        </div>
                        <form onSubmit={handleChatSend} style={{ display: 'flex', gap: '0.5rem' }}>
                            <input className="input" style={{ flex: 1, fontSize: '0.75rem', padding: '0.4rem 0.6rem' }} placeholder="Chat..." value={chatInput} onChange={e => setChatInput(e.target.value)} maxLength={200} />
                            <button className="btn btn-primary btn-sm" type="submit">→</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
