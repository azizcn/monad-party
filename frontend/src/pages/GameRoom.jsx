import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { motion, AnimatePresence } from 'framer-motion'
import useGameStore from '../store/gameStore'
import GameCanvas from '../components/GameCanvas'
import GameOver from '../components/GameOver'
import CoinRush from '../components/minigames/CoinRush'
import BombDodge from '../components/minigames/BombDodge'
import TriviaGame from '../components/minigames/TriviaGame'
import PlatformSurvival from '../components/minigames/PlatformSurvival'
import LastStanding from '../components/minigames/LastStanding'

const AVATAR_COLORS = ['#7c3aed', '#06b6d4', '#fbbf24', '#ec4899', '#10b981', '#f97316', '#3b82f6', '#ef4444']
const GAME_ICONS = { 'last-standing': '⚔️', 'coin-rush': '💰', 'bomb-dodge': '💣', race: '🏁', trivia: '🧠', 'platform-survival': '🏔️' }

// ── Test mode: no contract address = free play ──────────────────────────────
const TEST_MODE = !import.meta.env.VITE_CONTRACT_ADDRESS

function PlayerSlot({ player, index, isMe }) {
    const color = AVATAR_COLORS[index % 8]
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.75rem 1rem', background: isMe ? 'rgba(124,58,237,0.15)' : 'var(--color-surface)',
                border: `1px solid ${isMe ? 'var(--color-purple)' : 'var(--color-border)'}`,
                borderRadius: '10px',
            }}
        >
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: 700, color: '#000', flexShrink: 0, boxShadow: `0 0 10px ${color}80` }}>
                {player.isBot ? '🤖' : (player.address?.slice(2, 4).toUpperCase() || '??')}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-orbitron)', fontSize: '0.7rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {player.isBot ? (player.name || player.address) : `${player.address?.slice(0, 6)}...${player.address?.slice(-4)}`}
                    {isMe && <span style={{ marginLeft: '0.4rem', fontSize: '0.6rem', color: 'var(--color-cyan-light)' }}>(YOU)</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: player.isReady ? 'var(--color-green)' : 'var(--color-red)', boxShadow: player.isReady ? '0 0 6px var(--color-green)' : 'none' }} />
                    <span style={{ fontSize: '0.65rem', color: player.isReady ? 'var(--color-green)' : 'var(--color-text-muted)' }}>
                        {player.isBot ? '🤖 BOT' : player.isReady ? 'READY' : 'WAITING...'}
                    </span>
                </div>
            </div>
        </motion.div>
    )
}

function EmptySlot() {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', border: '1px dashed var(--color-border)', borderRadius: '10px', opacity: 0.4 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--color-surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>?</div>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)' }}>Waiting for player...</span>
        </div>
    )
}

function Scoreboard({ scores, players }) {
    const sorted = Object.entries(scores).sort(([, a], [, b]) => b - a)
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {sorted.map(([addr, score], i) => {
                const player = players.find((p) => p.address === addr)
                const color = AVATAR_COLORS[players.indexOf(player) % 8]
                return (
                    <div key={addr} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.6rem', background: i === 0 ? 'rgba(251,191,36,0.1)' : 'var(--color-surface)', borderRadius: '6px', border: `1px solid ${i === 0 ? 'rgba(251,191,36,0.3)' : 'var(--color-border)'}` }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, width: 16, color: ['var(--color-yellow)', 'var(--color-text-muted)', '#cd7f32'][i] || 'var(--color-text-dim)' }}>#{i + 1}</span>
                        <div style={{ width: 16, height: 16, borderRadius: '50%', background: color, flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: '0.7rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-orbitron)' }}>{addr?.slice(0, 6)}...{addr?.slice(-4)}</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-yellow)' }}>{score}</span>
                    </div>
                )
            })}
        </div>
    )
}

export default function GameRoom() {
    const { roomId } = useParams()
    const navigate = useNavigate()
    const { address } = useAccount()
    const [chatInput, setChatInput] = useState('')
    const [myReady, setMyReady] = useState(false)
    const [allReadyCountdown, setAllReadyCountdown] = useState(null)
    const [countdown, setCountdown] = useState(null)
    const [botDifficulty, setBotDifficulty] = useState('easy')
    const [addingBot, setAddingBot] = useState(false)
    const chatRef = useRef(null)

    const {
        players, gameStatus, currentMiniGame, scores, round, totalRounds,
        isHost, chatMessages, sendChat, setReady, startGame, leaveRoom, addBot,
        announcement, gameOverData, error, connected, roomData,
    } = useGameStore()

    useEffect(() => {
        if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
    }, [chatMessages])

    // All-ready countdown
    useEffect(() => {
        const unsub = useGameStore.subscribe((state) => {
            if (state.allReadyCountdown && !allReadyCountdown) {
                setAllReadyCountdown(state.allReadyCountdown)
                let c = state.allReadyCountdown
                const t = setInterval(() => {
                    c--
                    if (c <= 0) clearInterval(t)
                    setAllReadyCountdown(c > 0 ? c : null)
                }, 1000)
            }
        })
        return unsub
    }, [])

    // Mini-game countdown timer
    useEffect(() => {
        if (currentMiniGame) {
            setCountdown(currentMiniGame.duration)
            const t = setInterval(() => {
                setCountdown((c) => {
                    if (c <= 1) { clearInterval(t); return 0 }
                    return c - 1
                })
            }, 1000)
            return () => clearInterval(t)
        }
    }, [currentMiniGame?.id])

    const handleReady = () => {
        const next = !myReady
        setMyReady(next)
        setReady(address, next)
    }

    const handleStart = () => startGame(address)

    const handleAddBot = () => {
        setAddingBot(true)
        addBot(address, botDifficulty)
        setTimeout(() => setAddingBot(false), 1000)
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

    const readyCount = players.filter((p) => p.isReady || p.isBot).length
    // Can start with 1+ player (test mode) or 2+ (normal)
    const canStart = isHost && players.length >= 1 && gameStatus === 'waiting'
    const canAddBot = isHost && players.length < (roomData?.maxPlayers || 8) && gameStatus === 'waiting'

    if (gameStatus === 'game_over' && gameOverData) {
        return <GameOver data={gameOverData} />
    }

    return (
        <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: gameStatus === 'in_game' ? '1fr 280px' : '1fr 320px', gridTemplateRows: 'auto 1fr', gap: '0', background: 'var(--color-bg)' }}>

            {/* ─── Top Bar ─── */}
            <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1.5rem', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', zIndex: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button className="btn btn-ghost btn-sm" onClick={handleLeave}>← Leave</button>

                    {/* Test mode badge */}
                    {TEST_MODE && (
                        <div style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', borderRadius: '6px', padding: '0.2rem 0.6rem', fontSize: '0.6rem', fontFamily: 'var(--font-orbitron)', color: 'var(--color-green)', letterSpacing: '0.1em' }}>
                            🆓 FREE PLAY MODE
                        </div>
                    )}

                    <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.6rem', color: 'var(--color-purple-light)' }}>ROOM CODE</span>
                    <button
                        style={{ fontFamily: 'var(--font-orbitron)', fontSize: '0.875rem', fontWeight: 700, background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '0.3rem 0.75rem', color: 'var(--color-cyan-light)', cursor: 'pointer' }}
                        onClick={() => navigator.clipboard.writeText(roomId)}
                        title="Click to copy"
                    >
                        {roomId?.slice(0, 8).toUpperCase()}
                    </button>
                </div>

                {gameStatus === 'in_game' && currentMiniGame && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span style={{ fontSize: '1.5rem' }}>{GAME_ICONS[currentMiniGame.id]}</span>
                        <div>
                            <div style={{ fontFamily: 'var(--font-orbitron)', fontWeight: 700, fontSize: '0.875rem' }}>{currentMiniGame.name}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Round {round}/{totalRounds}</div>
                        </div>
                        <div style={{ background: countdown < 10 ? 'rgba(239,68,68,0.2)' : 'rgba(124,58,237,0.2)', border: `1px solid ${countdown < 10 ? 'rgba(239,68,68,0.4)' : 'rgba(124,58,237,0.4)'}`, borderRadius: '8px', padding: '0.4rem 0.8rem', fontFamily: 'var(--font-orbitron)', fontWeight: 900, fontSize: '1.25rem', color: countdown < 10 ? '#f87171' : 'var(--color-purple-light)', minWidth: 60, textAlign: 'center' }}>
                            {countdown}s
                        </div>
                    </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: connected ? 'var(--color-green)' : 'var(--color-red)' }} />
                    <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-orbitron)' }}>{players.length} PLAYERS</span>
                </div>
            </div>

            {/* ─── Main Game Area ─── */}
            <div style={{ overflow: 'hidden', position: 'relative' }}>
                {gameStatus === 'waiting' && (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
                        <div style={{ textAlign: 'center', maxWidth: 540 }}>
                            {allReadyCountdown ? (
                                <motion.div key="countdown" animate={{ scale: [1.5, 1], opacity: [0, 1] }} transition={{ duration: 0.5 }}>
                                    <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '4rem', color: 'var(--color-yellow)', textShadow: 'var(--glow-yellow)' }}>{allReadyCountdown}</div>
                                    <div style={{ fontFamily: 'var(--font-orbitron)', color: 'var(--color-text-muted)' }}>GET READY!</div>
                                </motion.div>
                            ) : (
                                <>
                                    <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.75rem', color: 'var(--color-purple-light)', marginBottom: '1rem', letterSpacing: '0.1em' }}>
                                        {players.length < 2 ? 'ADD BOTS OR WAIT FOR PLAYERS...' : 'WAITING FOR PLAYERS...'}
                                    </div>
                                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem', color: 'var(--color-text-muted)' }}>{readyCount}/{players.length} ready</div>
                                    <div className="progress-bar" style={{ width: 300, margin: '0 auto 2rem' }}>
                                        <div className="progress-fill" style={{ width: `${(readyCount / Math.max(players.length, 1)) * 100}%` }} />
                                    </div>

                                    {/* Action buttons */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                                            <motion.button
                                                className={`btn ${myReady ? 'btn-danger' : 'btn-green'} btn-lg`}
                                                style={{ background: myReady ? undefined : 'linear-gradient(135deg, var(--color-green), #34d399)', color: myReady ? undefined : '#000' }}
                                                onClick={handleReady}
                                                whileHover={{ scale: 1.05 }}
                                                whileTap={{ scale: 0.95 }}
                                            >
                                                {myReady ? '❌ NOT READY' : '✅ READY'}
                                            </motion.button>

                                            {canStart && (
                                                <motion.button
                                                    className="btn btn-primary btn-lg animate-pulse-glow"
                                                    onClick={handleStart}
                                                    whileHover={{ scale: 1.05 }}
                                                    whileTap={{ scale: 0.95 }}
                                                >
                                                    🚀 START GAME
                                                </motion.button>
                                            )}
                                        </div>

                                        {/* ── Add Bot Button (host only) ── */}
                                        {canAddBot && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 8 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '0.5rem 0.75rem' }}
                                            >
                                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-orbitron)' }}>BOT:</span>
                                                <select
                                                    value={botDifficulty}
                                                    onChange={(e) => setBotDifficulty(e.target.value)}
                                                    style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text)', padding: '0.25rem 0.4rem', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'var(--font-orbitron)' }}
                                                >
                                                    <option value="easy">Easy</option>
                                                    <option value="medium">Medium</option>
                                                    <option value="hard">Hard</option>
                                                </select>
                                                <motion.button
                                                    className="btn btn-primary"
                                                    style={{ padding: '0.35rem 0.85rem', fontSize: '0.8rem' }}
                                                    onClick={handleAddBot}
                                                    disabled={addingBot}
                                                    whileHover={{ scale: 1.05 }}
                                                    whileTap={{ scale: 0.95 }}
                                                >
                                                    {addingBot ? '⏳' : '🤖 Add Bot'}
                                                </motion.button>
                                                <span style={{ fontSize: '0.65rem', color: 'var(--color-text-dim)' }}>{players.filter(p => p.isBot).length} bots</span>
                                            </motion.div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {gameStatus === 'in_game' && currentMiniGame && (
                    <>
                        {announcement && (
                            <motion.div
                                initial={{ opacity: 0, y: -20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                style={{ position: 'absolute', top: '1rem', left: '50%', transform: 'translateX(-50%)', zIndex: 50, background: 'rgba(10,10,30,0.9)', border: '1px solid var(--color-purple)', borderRadius: '10px', padding: '0.75rem 1.5rem', fontFamily: 'var(--font-orbitron)', fontSize: '0.875rem', maxWidth: '80%', textAlign: 'center', backdropFilter: 'blur(10px)' }}
                            >
                                🎙️ {announcement}
                            </motion.div>
                        )}

                        {currentMiniGame.id === 'trivia' ? (
                            <TriviaGame gameData={currentMiniGame} />
                        ) : currentMiniGame.id === 'coin-rush' ? (
                            <CoinRush />
                        ) : currentMiniGame.id === 'bomb-dodge' ? (
                            <BombDodge />
                        ) : currentMiniGame.id === 'platform-survival' ? (
                            <PlatformSurvival />
                        ) : (
                            <LastStanding />
                        )}
                    </>
                )}
            </div>

            {/* ─── Right Panel ─── */}
            <div style={{ background: 'var(--color-surface)', borderLeft: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Players */}
                <div style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)', flex: gameStatus === 'in_game' ? '0 0 auto' : 1, overflow: 'auto' }}>
                    <h3 style={{ fontFamily: 'var(--font-orbitron)', fontSize: '0.7rem', color: 'var(--color-text-muted)', letterSpacing: '0.15em', marginBottom: '0.75rem' }}>PLAYERS</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {players.map((p, i) => (
                            <PlayerSlot key={p.address} player={p} index={i} isMe={p.address === address} />
                        ))}
                        {Array.from({ length: Math.max(0, (roomData?.maxPlayers || 8) - players.length) }).map((_, i) => (
                            <EmptySlot key={`empty-${i}`} index={players.length + i} />
                        ))}
                    </div>
                </div>

                {/* Scoreboard (in-game) */}
                {gameStatus === 'in_game' && (
                    <div style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)', flex: '0 0 auto' }}>
                        <h3 style={{ fontFamily: 'var(--font-orbitron)', fontSize: '0.7rem', color: 'var(--color-text-muted)', letterSpacing: '0.15em', marginBottom: '0.75rem' }}>SCOREBOARD</h3>
                        <Scoreboard scores={scores} players={players} />
                    </div>
                )}

                {/* Chat */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '1rem' }}>
                    <h3 style={{ fontFamily: 'var(--font-orbitron)', fontSize: '0.7rem', color: 'var(--color-text-muted)', letterSpacing: '0.15em', marginBottom: '0.75rem' }}>CHAT</h3>
                    <div ref={chatRef} style={{ flex: 1, overflowY: 'auto', marginBottom: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        {chatMessages.length === 0 && <div style={{ color: 'var(--color-text-dim)', fontSize: '0.75rem', textAlign: 'center', marginTop: '1rem' }}>No messages yet...</div>}
                        {chatMessages.map((msg, i) => (
                            <div key={i} style={{ fontSize: '0.75rem' }}>
                                <span style={{ color: msg.address === 'SYSTEM' ? 'var(--color-cyan-light)' : 'var(--color-purple-light)', fontWeight: 600 }}>
                                    {msg.address === 'SYSTEM' ? '🔔' : msg.address?.slice(0, 6)}{msg.address !== 'SYSTEM' && ':'}{' '}
                                </span>
                                <span style={{ color: 'var(--color-text-muted)' }}>{msg.message}</span>
                            </div>
                        ))}
                    </div>
                    <form onSubmit={handleChatSend} style={{ display: 'flex', gap: '0.5rem' }}>
                        <input className="input" style={{ flex: 1, fontSize: '0.8rem', padding: '0.5rem 0.75rem' }} placeholder="Type a message..." value={chatInput} onChange={(e) => setChatInput(e.target.value)} maxLength={200} />
                        <button className="btn btn-primary btn-sm" type="submit">→</button>
                    </form>
                </div>
            </div>
        </div>
    )
}
