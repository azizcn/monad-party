import { useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, useBalance, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseEther, keccak256, toHex } from 'viem'
import { motion } from 'framer-motion'
import useGameStore from '../store/gameStore'
import useWalletStore from '../store/walletStore'

// Contract ABI (minimal — only what we need on frontend)
const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || ''
const CONTRACT_ABI = [
    {
        name: 'createRoom',
        type: 'function',
        stateMutability: 'payable',
        inputs: [
            { name: 'roomId', type: 'bytes32' },
            { name: 'maxPlayers', type: 'uint8' },
        ],
        outputs: [],
    },
]

// Generate a random bytes32 room ID
function generateRoomId() {
    const random = Math.random().toString(36) + Date.now().toString(36)
    return keccak256(toHex(random))
}

// ─── Pixel Character SVG ──────────────────────────────────────────────────────
const COLORS = ['#7c3aed', '#06b6d4', '#fbbf24', '#ec4899', '#10b981', '#f97316', '#3b82f6', '#ef4444']

function PixelChar({ color, style }) {
    return (
        <svg width="32" height="48" viewBox="0 0 32 48" fill="none" style={style}>
            {/* Head */}
            <rect x="10" y="2" width="12" height="12" fill={color} />
            {/* Eyes */}
            <rect x="12" y="6" width="2" height="2" fill="#000" />
            <rect x="18" y="6" width="2" height="2" fill="#000" />
            {/* Body */}
            <rect x="8" y="14" width="16" height="14" fill={color} />
            {/* Arms */}
            <rect x="2" y="14" width="6" height="8" fill={color} opacity="0.8" />
            <rect x="24" y="14" width="6" height="8" fill={color} opacity="0.8" />
            {/* Legs */}
            <rect x="8" y="28" width="6" height="12" fill={color} opacity="0.9" />
            <rect x="18" y="28" width="6" height="12" fill={color} opacity="0.9" />
        </svg>
    )
}

// ─── Floating Characters ──────────────────────────────────────────────────────
function FloatingChars() {
    return (
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
            {COLORS.map((color, i) => (
                <motion.div
                    key={i}
                    style={{ position: 'absolute', bottom: -60, left: `${10 + i * 12}%` }}
                    animate={{ y: [-10, 10, -10] }}
                    transition={{ duration: 2 + i * 0.3, repeat: Infinity, ease: 'easeInOut' }}
                >
                    <PixelChar color={color} style={{ opacity: 0.25, filter: `drop-shadow(0 0 8px ${color})` }} />
                </motion.div>
            ))}
        </div>
    )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function HomePage() {
    const navigate = useNavigate()
    const { address, isConnected, chain } = useAccount()
    const { data: balanceData } = useBalance({ address, enabled: !!address })
    const setWallet = useWalletStore((s) => s.setWallet)
    const { initSocket, quickMatch, createRoom, roomId, error, connected } = useGameStore()

    // ── Wagmi contract write for Quick Play / Create Room ──────────────────────
    const { writeContract, data: txHash, isPending } = useWriteContract()
    const { isLoading: isTxLoading, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({ hash: txHash })

    // Pending action ref to execute after tx confirms
    const pendingAction = useGameStore((s) => s._pendingAction)

    useEffect(() => {
        if (address) {
            setWallet({
                address,
                balance: balanceData?.formatted ?? '0',
                isConnected,
                chainId: chain?.id,
            })
            initSocket(address)
        }
    }, [address, isConnected, balanceData, chain])

    useEffect(() => {
        if (isTxSuccess && txHash) {
            const action = useGameStore.getState()._pendingAction
            if (action === 'quick-match') {
                quickMatch(address, txHash)
            } else if (action?.startsWith('create-')) {
                createRoom(address, 'Quick Room', false, txHash)
            }
            useGameStore.setState({ _pendingAction: null })
        }
    }, [isTxSuccess, txHash])

    // Navigate when room is ready
    useEffect(() => {
        if (roomId) navigate(`/game/${roomId}`)
    }, [roomId])

    const handleQuickPlay = useCallback(() => {
        if (!isConnected) return
        if (!CONTRACT_ADDRESS) {
            // For dev without contract: skip tx
            quickMatch(address, null)
            return
        }
        const rid = generateRoomId()
        useGameStore.setState({ _pendingAction: 'quick-match' })
        writeContract({
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'createRoom',
            args: [rid, 8],
            value: parseEther('1'),
        })
    }, [isConnected, address])

    const handleCreateRoom = useCallback(() => {
        navigate('/lobby?tab=create')
    }, [])

    const handleFindRoom = useCallback(() => {
        navigate('/lobby?tab=find')
    }, [])

    const isLoading = isPending || isTxLoading

    const balance = balanceData ? parseFloat(balanceData.formatted).toFixed(4) : '0.0000'
    const isWrongNetwork = isConnected && chain?.id !== 10143

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }} className="grid-bg">
            <FloatingChars />

            {/* Background gradient orbs */}
            <div style={{ position: 'absolute', top: '10%', left: '15%', width: 400, height: 400, background: 'radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: '10%', right: '15%', width: 400, height: 400, background: 'radial-gradient(circle, rgba(6,182,212,0.15) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />

            {/* Top bar */}
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 2rem', background: 'rgba(5,5,16,0.8)', backdropFilter: 'blur(10px)', borderBottom: '1px solid var(--color-border)', zIndex: 100 }}>
                <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.65rem', color: 'var(--color-purple-light)', letterSpacing: '0.1em' }}>MONAD PARTY</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {isConnected && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '0.4rem 0.8rem' }}>
                            <span style={{ color: 'var(--color-yellow)', fontSize: '1rem' }}>💰</span>
                            <span style={{ fontFamily: 'var(--font-orbitron)', fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-yellow)' }}>{balance} MON</span>
                        </div>
                    )}
                    <ConnectButton />
                </div>
            </div>

            {/* Main content */}
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                style={{ textAlign: 'center', maxWidth: 700, padding: '2rem', zIndex: 1 }}
            >
                {/* Big glitch title */}
                <motion.h1
                    className="animate-glitch"
                    style={{ fontFamily: 'var(--font-pixel)', fontSize: 'clamp(1.5rem, 5vw, 3rem)', color: 'var(--color-cyan-light)', marginBottom: '0.5rem', lineHeight: 1.3, letterSpacing: '0.08em' }}
                >
                    MONAD
                </motion.h1>
                <h1 style={{ fontFamily: 'var(--font-pixel)', fontSize: 'clamp(1.5rem, 5vw, 3rem)', color: 'white', letterSpacing: '0.08em', marginBottom: '1.5rem' }}>
                    PARTY
                </h1>

                {/* Subtitle */}
                <p style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-orbitron)', fontSize: '0.875rem', letterSpacing: '0.2em', marginBottom: '0.5rem' }}>
                    WEB3 MULTIPLAYER PARTY GAME ON MONAD TESTNET
                </p>

                {/* Entry fee badge */}
                <motion.div
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.4)', borderRadius: '9999px', padding: '0.4rem 1.2rem', marginBottom: '3rem' }}
                >
                    <span>🏆</span>
                    <span style={{ fontFamily: 'var(--font-orbitron)', fontWeight: 700, fontSize: '0.8rem', color: 'var(--color-yellow)' }}>ENTRY FEE: 1 MON — WINNER TAKES ALL</span>
                </motion.div>

                {/* Wrong network warning */}
                {isWrongNetwork && (
                    <div style={{ marginBottom: '1.5rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '8px', padding: '0.75rem 1.5rem', color: '#f87171', fontFamily: 'var(--font-orbitron)', fontSize: '0.75rem' }}>
                        ⚠️ Please switch to Monad Testnet (Chain ID: 10143)
                    </div>
                )}

                {/* Error display */}
                {error && (
                    <div style={{ marginBottom: '1.5rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '8px', padding: '0.75rem 1.5rem', color: '#f87171', fontFamily: 'var(--font-body)', fontSize: '0.875rem' }}>
                        {error}
                    </div>
                )}

                {/* Buttons */}
                {!isConnected ? (
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <ConnectButton label="🔗 CONNECT WALLET TO PLAY" />
                    </div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}
                    >
                        {/* Quick Play — main CTA */}
                        <motion.button
                            className="btn btn-primary btn-lg animate-pulse-glow"
                            style={{ width: '100%', maxWidth: 380, fontSize: '1rem', padding: '1.25rem 2rem', fontFamily: 'var(--font-pixel)', letterSpacing: '0.1em' }}
                            onClick={handleQuickPlay}
                            disabled={isLoading || isWrongNetwork}
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                        >
                            {isLoading ? (
                                <><span className="spinner" /> CONFIRMING TX...</>
                            ) : (
                                <>🎮 QUICK PLAY</>
                            )}
                        </motion.button>

                        <div style={{ display: 'flex', gap: '1rem', width: '100%', maxWidth: 380 }}>
                            <motion.button
                                className="btn btn-cyan"
                                style={{ flex: 1 }}
                                onClick={handleCreateRoom}
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.97 }}
                            >
                                🏠 CREATE ROOM
                            </motion.button>
                            <motion.button
                                className="btn btn-ghost"
                                style={{ flex: 1 }}
                                onClick={handleFindRoom}
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.97 }}
                            >
                                🔍 FIND ROOM
                            </motion.button>
                        </div>

                        {/* Server status */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: connected ? 'var(--color-green)' : 'var(--color-red)', boxShadow: connected ? '0 0 8px var(--color-green)' : 'none' }} />
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-orbitron)' }}>
                                {connected ? 'SERVER ONLINE' : 'CONNECTING...'}
                            </span>
                        </div>
                    </motion.div>
                )}

                {/* Rules */}
                <div style={{ marginTop: '4rem', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', textAlign: 'center' }}>
                    {[
                        { icon: '💰', label: 'PAY 1 MON', desc: 'Entry fee per game' },
                        { icon: '⚔️', label: '8 PLAYERS', desc: '6 wild mini-games' },
                        { icon: '🏆', label: 'WIN THE POT', desc: 'Auto paid on-chain' },
                    ].map(({ icon, label, desc }) => (
                        <div key={label} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '1rem' }}>
                            <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>{icon}</div>
                            <div style={{ fontFamily: 'var(--font-orbitron)', fontWeight: 700, fontSize: '0.65rem', color: 'var(--color-purple-light)', letterSpacing: '0.1em' }}>{label}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>{desc}</div>
                        </div>
                    ))}
                </div>
            </motion.div>
        </div>
    )
}
