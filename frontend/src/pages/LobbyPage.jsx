import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseEther, keccak256, toHex } from 'viem'
import { motion, AnimatePresence } from 'framer-motion'
import useGameStore from '../store/gameStore'

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || ''
const CONTRACT_ABI = [
    {
        name: 'createRoom',
        type: 'function',
        stateMutability: 'payable',
        inputs: [{ name: 'roomId', type: 'bytes32' }, { name: 'maxPlayers', type: 'uint8' }],
        outputs: [],
    },
    {
        name: 'joinRoom',
        type: 'function',
        stateMutability: 'payable',
        inputs: [{ name: 'roomId', type: 'bytes32' }],
        outputs: [],
    },
]

function generateRoomId() {
    return keccak256(toHex(Math.random().toString(36) + Date.now()))
}

function RoomCard({ room, onJoin, isJoining }) {
    const pct = (room.playerCount / room.maxPlayers) * 100
    return (
        <motion.div
            className="card"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            style={{ marginBottom: '0.75rem', cursor: 'pointer' }}
            whileHover={{ borderColor: 'var(--color-cyan)', scale: 1.01 }}
        >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <div style={{ fontFamily: 'var(--font-orbitron)', fontWeight: 700, marginBottom: '0.25rem' }}>{room.roomName}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        Host: {room.host?.slice(0, 6)}...{room.host?.slice(-4)}
                    </div>
                    <div style={{ marginTop: '0.5rem' }}>
                        <div className="progress-bar" style={{ width: 120 }}>
                            <div className="progress-fill" style={{ width: `${pct}%`, background: pct > 75 ? 'linear-gradient(90deg, var(--color-red), #f87171)' : undefined }} />
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
                            {room.playerCount}/{room.maxPlayers} players
                        </div>
                    </div>
                </div>
                <button className="btn btn-cyan btn-sm" onClick={() => onJoin(room.roomId)} disabled={isJoining || room.playerCount >= room.maxPlayers}>
                    {isJoining ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'JOIN →'}
                </button>
            </div>
        </motion.div>
    )
}

export default function LobbyPage() {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const defaultTab = searchParams.get('tab') === 'create' ? 'create' : 'find'
    const [tab, setTab] = useState(defaultTab)
    const [roomName, setRoomName] = useState('')
    const [isPrivate, setIsPrivate] = useState(false)
    const [maxPlayers, setMaxPlayers] = useState(8)
    const [search, setSearch] = useState('')
    const [joiningRoomId, setJoiningRoomId] = useState(null)
    const [pendingRoomIdHex, setPendingRoomIdHex] = useState(null)
    const [pendingOp, setPendingOp] = useState(null) // 'create' | 'join'

    const { address } = useAccount()
    const { writeContract, data: txHash, isPending } = useWriteContract()
    const { isLoading: isTxLoading, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({ hash: txHash })

    const { createRoom, joinRoom, roomId, requestRoomList, connected, error } = useGameStore()
    const publicRooms = useGameStore((s) => s.publicRooms || [])

    useEffect(() => {
        if (connected) {
            requestRoomList()
            const t = setInterval(requestRoomList, 5000)
            return () => clearInterval(t)
        }
    }, [connected])

    useEffect(() => {
        if (roomId) navigate(`/game/${roomId}`)
    }, [roomId])

    useEffect(() => {
        if (isTxSuccess && txHash && pendingOp) {
            if (pendingOp === 'create') {
                createRoom(address, roomName || `${address?.slice(0, 6)}'s Room`, isPrivate, txHash)
            } else if (pendingOp === 'join') {
                joinRoom(joiningRoomId, address, txHash)
            }
            setPendingOp(null)
        }
    }, [isTxSuccess, txHash])

    const handleCreate = useCallback(() => {
        if (!address) return
        if (!CONTRACT_ADDRESS) {
            createRoom(address, roomName || 'My Room', isPrivate, null)
            return
        }
        const rid = generateRoomId()
        setPendingRoomIdHex(rid)
        setPendingOp('create')
        writeContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'createRoom', args: [rid, maxPlayers], value: parseEther('1') })
    }, [address, roomName, isPrivate, maxPlayers])

    const handleJoin = useCallback((targetRoomId) => {
        if (!address) return
        setJoiningRoomId(targetRoomId)
        if (!CONTRACT_ADDRESS) {
            joinRoom(targetRoomId, address, null)
            return
        }
        // Convert string roomId to bytes32 (backend uses uuid strings, contract uses bytes32)
        const ridHex = keccak256(toHex(targetRoomId))
        setPendingOp('join')
        writeContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'joinRoom', args: [ridHex], value: parseEther('1') })
    }, [address])

    const isLoading = isPending || isTxLoading
    const filteredRooms = publicRooms.filter((r) => r.roomName?.toLowerCase().includes(search.toLowerCase()))

    return (
        <div style={{ minHeight: '100vh', padding: '5rem 2rem 2rem', maxWidth: 1100, margin: '0 auto' }} className="grid-bg">
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>← Back</button>
                <h1 style={{ fontFamily: 'var(--font-orbitron)', fontSize: '1.5rem', background: 'linear-gradient(135deg, var(--color-purple-light), var(--color-cyan-light))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    GAME LOBBY
                </h1>
                <span style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: '9999px', padding: '0.2rem 0.8rem', fontSize: '0.7rem', fontFamily: 'var(--font-orbitron)', color: 'var(--color-yellow)' }}>
                    ENTRY: 1 MON
                </span>
            </div>

            {error && (
                <div style={{ marginBottom: '1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '8px', padding: '0.75rem 1rem', color: '#f87171', fontSize: '0.875rem' }}>⚠️ {error}</div>
            )}

            {/* Tab toggle */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
                {['find', 'create'].map((t) => (
                    <button
                        key={t}
                        className={`btn ${tab === t ? 'btn-primary' : 'btn-ghost'} btn-sm`}
                        onClick={() => setTab(t)}
                        style={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}
                    >
                        {t === 'find' ? '🔍 Find Room' : '🏠 Create Room'}
                    </button>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: tab === 'find' ? '1fr' : '1fr 1fr', gap: '2rem' }}>
                {/* ─── Find Rooms Panel ─── */}
                {(tab === 'find') && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                            <input className="input" placeholder="Search rooms..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1 }} />
                            <button className="btn btn-ghost btn-sm" onClick={requestRoomList} title="Refresh">↺</button>
                        </div>
                        <div style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: '0.5rem' }}>
                            {filteredRooms.length === 0 ? (
                                <div className="card" style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '3rem' }}>
                                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎮</div>
                                    <div style={{ fontFamily: 'var(--font-orbitron)', fontSize: '0.875rem' }}>No rooms found</div>
                                    <div style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>Create one or check back soon!</div>
                                </div>
                            ) : (
                                filteredRooms.map((room) => (
                                    <RoomCard key={room.roomId} room={room} onJoin={handleJoin} isJoining={isLoading && joiningRoomId === room.roomId} />
                                ))
                            )}
                        </div>
                    </motion.div>
                )}

                {/* ─── Create Room Panel ─── */}
                {tab === 'create' && (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="card-glow" style={{ padding: '2rem', height: 'fit-content' }}>
                        <h2 style={{ fontFamily: 'var(--font-orbitron)', fontSize: '1rem', marginBottom: '1.5rem', color: 'var(--color-purple-light)' }}>CREATE A ROOM</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-orbitron)', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>ROOM NAME</label>
                                <input className="input" placeholder="My Awesome Room" value={roomName} onChange={(e) => setRoomName(e.target.value)} maxLength={32} />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-orbitron)', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>MAX PLAYERS: {maxPlayers}</label>
                                <input type="range" min={2} max={8} value={maxPlayers} onChange={(e) => setMaxPlayers(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--color-purple)' }} />
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--color-text-dim)' }}><span>2</span><span>8</span></div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: 'var(--color-surface)', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                                <div>
                                    <div style={{ fontFamily: 'var(--font-orbitron)', fontSize: '0.75rem', fontWeight: 700 }}>{isPrivate ? '🔒 PRIVATE' : '🌐 PUBLIC'}</div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>{isPrivate ? 'Share room code to invite' : 'Listed in room finder'}</div>
                                </div>
                                <button
                                    onClick={() => setIsPrivate(!isPrivate)}
                                    style={{ width: 48, height: 26, borderRadius: 13, background: isPrivate ? 'var(--color-purple)' : 'var(--color-surface2)', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}
                                >
                                    <div style={{ position: 'absolute', top: 3, left: isPrivate ? 25 : 3, width: 20, height: 20, borderRadius: '50%', background: 'white', transition: 'left 0.2s' }} />
                                </button>
                            </div>
                            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.8rem' }}>
                                    <span style={{ color: 'var(--color-text-muted)' }}>Entry fee</span>
                                    <span style={{ color: 'var(--color-yellow)', fontWeight: 700 }}>1 MON</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.8rem' }}>
                                    <span style={{ color: 'var(--color-text-muted)' }}>Platform fee</span>
                                    <span style={{ color: 'var(--color-text-muted)' }}>5%</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', fontWeight: 600 }}>
                                    <span>Max pot ({maxPlayers} players)</span>
                                    <span style={{ color: 'var(--color-green)' }}>{(maxPlayers * 0.95).toFixed(2)} MON</span>
                                </div>
                            </div>
                            <motion.button
                                className="btn btn-primary btn-lg"
                                style={{ width: '100%', fontFamily: 'var(--font-pixel)', fontSize: '0.7rem', letterSpacing: '0.08em' }}
                                onClick={handleCreate}
                                disabled={isLoading}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                {isLoading ? <><span className="spinner" /> CONFIRMING...</> : '🎮 CREATE & PAY 1 MON'}
                            </motion.button>
                            {txHash && (
                                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textAlign: 'center', wordBreak: 'break-all' }}>
                                    Tx: <a href={`https://testnet.monadexplorer.com/tx/${txHash}`} target="_blank" rel="noreferrer" style={{ color: 'var(--color-cyan-light)' }}>{txHash?.slice(0, 20)}...</a>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    )
}
