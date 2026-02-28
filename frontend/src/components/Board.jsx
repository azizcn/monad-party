import { useEffect, useRef, useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { KAROLAR_POSITIONS, KAROLAR_GRAPH, BOARD_WIDTH, BOARD_HEIGHT } from '../lib/boardMapData'

const TIP_RENK = { start: '#166534', normal: '#1e3a5f', anahtar: '#78350f', tuzak: '#7f1d1d', heal: '#14532d' }
const TIP_SINIR = { start: '#4ade80', normal: '#555555', anahtar: '#fbbf24', tuzak: '#f87171', heal: '#86efac' }
const TIP_IKON = { start: '🏁', normal: '', anahtar: '🗝️', tuzak: '💀', heal: '❤️' }
const OYUNCU_RENK = ['#7c3aed', '#06b6d4', '#fbbf24', '#ec4899', '#10b981', '#f97316', '#3b82f6', '#ef4444']

function arka(ctx, W, H) {
    // Gökyüzü → çimen gradyanı
    const g = ctx.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, '#1a4731'); g.addColorStop(0.4, '#166534'); g.addColorStop(1, '#14532d')
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)

    // Grid çim dokusu
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1
    for (let x = 0; x < W; x += 100) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
    for (let y = 0; y < H; y += 100) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }

    // Çiçekler
    ctx.fillStyle = 'rgba(52,211,153,0.12)'
    for (let i = 0; i < 600; i++) {
        const gx = Math.random() * W, gy = Math.random() * H
        ctx.beginPath(); ctx.arc(gx, gy, 2 + Math.random() * 4, 0, Math.PI * 2); ctx.fill()
    }
}

function karoPath(ctx, x, y, r) {
    ctx.beginPath()
    for (let i = 0; i < 6; i++) {
        const a = Math.PI / 3 * i - Math.PI / 6
        const hx = x + r * Math.cos(a), hy = y + r * Math.sin(a)
        i === 0 ? ctx.moveTo(hx, hy) : ctx.lineTo(hx, hy)
    }
    ctx.closePath()
}

export default function Board({ karoTipleri = {}, kasaTileId = null, boardState, address, onRollDice, onInitialRoll, onChooseBranch, isMyTurn, isInitialRollPhase, sonZar, zarAnimasyon, isBranchChoicePhase }) {
    const canvasRef = useRef(null)
    const animRef = useRef({}) // { adres: { path: [], progress: 0 } }
    const rafRef = useRef(null)
    const cameraRef = useRef({ x: KAROLAR_POSITIONS[0]?.x || 0, y: KAROLAR_POSITIONS[0]?.y || 0 })

    const draw = useCallback(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        const viewW = canvas.clientWidth, viewH = canvas.clientHeight
        canvas.width = viewW; canvas.height = viewH

        // Find camera target
        let targetX = BOARD_WIDTH / 2, targetY = BOARD_HEIGHT / 2
        if (boardState?.mevcutOyuncu) {
            const activePlayer = boardState.oyuncular.find(p => p.adres === boardState.mevcutOyuncu)
            if (activePlayer && KAROLAR_POSITIONS[activePlayer.konum]) {
                const anim = animRef.current[activePlayer.adres]
                if (anim && anim.x) {
                    targetX = anim.x
                    targetY = anim.y
                } else {
                    targetX = KAROLAR_POSITIONS[activePlayer.konum].x
                    targetY = KAROLAR_POSITIONS[activePlayer.konum].y
                }
            }
        }

        // Smooth camera follow
        cameraRef.current.x += (targetX - cameraRef.current.x) * 0.1
        cameraRef.current.y += (targetY - cameraRef.current.y) * 0.1

        ctx.save()
        // Center camera
        ctx.translate(viewW / 2 - cameraRef.current.x, viewH / 2 - cameraRef.current.y)

        arka(ctx, BOARD_WIDTH, BOARD_HEIGHT)

        // Yol şeridi (bg) graph edges
        ctx.strokeStyle = 'rgba(139,115,85,0.8)'; ctx.lineWidth = 42; ctx.lineJoin = 'round'
        ctx.beginPath()
        for (const [idStr, node] of Object.entries(KAROLAR_GRAPH)) {
            const p1 = KAROLAR_POSITIONS[idStr]
            if (!p1) continue
            node.next.forEach(nid => {
                const p2 = KAROLAR_POSITIONS[nid]
                if (p2) { ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y) }
            })
        }
        ctx.stroke()

        // Yol kenarları
        ctx.strokeStyle = '#555555'; ctx.lineWidth = 44; ctx.globalCompositeOperation = 'destination-over';
        ctx.stroke(); ctx.globalCompositeOperation = 'source-over'

        // Kasa yönü çizgisi (Dashed line to chest)
        if (kasaTileId !== null && KAROLAR_POSITIONS[kasaTileId] && boardState?.mevcutOyuncu) {
            const cp = boardState.oyuncular.find(p => p.adres === boardState.mevcutOyuncu)
            if (cp && KAROLAR_POSITIONS[cp.konum]) {
                const p1 = KAROLAR_POSITIONS[cp.konum]
                const p2 = KAROLAR_POSITIONS[kasaTileId]
                ctx.strokeStyle = 'rgba(251, 191, 36, 0.4)'; ctx.lineWidth = 4
                ctx.setLineDash([15, 15])
                ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke()
                ctx.setLineDash([])
            }
        }

        // Karolar
        for (const [idStr, pos] of Object.entries(KAROLAR_POSITIONS)) {
            const id = Number(idStr)
            const node = KAROLAR_GRAPH[id]
            const tip = node ? node.tip : 'normal'
            const isKasa = id === kasaTileId
            const isMevcut = boardState?.mevcutOyuncu && boardState?.oyuncular?.some(o => Number(o.konum) === id && o.adres === boardState.mevcutOyuncu)
            const r = 24

            // Flat shading requested by user (matte)
            ctx.shadowBlur = 0
            ctx.fillStyle = isKasa ? '#78350f' : (TIP_RENK[tip] || TIP_RENK.normal)
            karoPath(ctx, pos.x, pos.y, r); ctx.fill()

            ctx.strokeStyle = isKasa ? '#fbbf24' : (TIP_SINIR[tip] || '#555555')
            ctx.lineWidth = isKasa ? 4 : 2
            karoPath(ctx, pos.x, pos.y, r); ctx.stroke()

            // İkon
            const ikon = isKasa ? '🎁' : TIP_IKON[tip]
            if (ikon) { ctx.font = `${r * 0.75}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(ikon, pos.x, pos.y - 2) }

            // ID
            ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '10px monospace'; ctx.textAlign = 'center'; ctx.fillText(String(id), pos.x, pos.y + r - 8)
        }

        // Oyuncu token'ları
        const sortedPlayers = [...(boardState?.oyuncular || [])].sort((a, b) => (a.konum || 0) - (b.konum || 0))
        sortedPlayers.forEach((oy, i) => {
            if (oy.elendi) return

            let drawX = 0, drawY = 0, scale = 1.0

            const anim = animRef.current[oy.adres]
            if (anim && anim.path && anim.path.length > 0) {
                // Hop animation along path array
                anim.progress += 0.08
                if (anim.progress >= 1) {
                    anim.progress = 0
                    anim.currentIndex++
                }
                if (anim.currentIndex >= anim.path.length - 1) {
                    // done
                    anim.path = []
                    drawX = KAROLAR_POSITIONS[oy.konum].x
                    drawY = KAROLAR_POSITIONS[oy.konum].y
                } else {
                    const fromPos = KAROLAR_POSITIONS[anim.path[anim.currentIndex]]
                    const toPos = KAROLAR_POSITIONS[anim.path[anim.currentIndex + 1]]
                    if (fromPos && toPos) {
                        const t = anim.progress
                        drawX = fromPos.x + (toPos.x - fromPos.x) * t
                        drawY = fromPos.y + (toPos.y - fromPos.y) * t
                        // Hop Arc
                        const hopHeight = 30 * Math.sin(t * Math.PI)
                        drawY -= hopHeight
                        scale = 1 + Math.sin(t * Math.PI) * 0.2
                    }
                }
                anim.x = drawX
                anim.y = drawY
            } else {
                const pos = KAROLAR_POSITIONS[oy.konum] || KAROLAR_POSITIONS[0]
                drawX = pos.x
                drawY = pos.y
                if (!anim) animRef.current[oy.adres] = { x: drawX, y: drawY }

                // Offset overlaps
                const onSameTile = boardState.oyuncular.filter(p => !p.elendi && p.konum === oy.konum)
                const index = onSameTile.findIndex(p => p.adres === oy.adres)
                if (onSameTile.length > 1) {
                    const ang = (Math.PI * 2 * index) / onSameTile.length
                    const offsetDiff = 10
                    drawX += Math.cos(ang) * offsetDiff
                    drawY += Math.sin(ang) * offsetDiff
                }
            }
            const c = OYUNCU_RENK[i % 8]
            const px = drawX, py = drawY - 6

            // Gölge
            ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(px, py + 16, 10, 4, 0, 0, Math.PI * 2); ctx.fill()

            // Gövde
            ctx.shadowColor = c; ctx.shadowBlur = 14
            ctx.fillStyle = c; ctx.beginPath(); ctx.arc(px, py, 13 * scale, 0, Math.PI * 2); ctx.fill()
            ctx.shadowBlur = 0

            // Parlak üst
            ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.arc(px - 3, py - 3, 5 * scale, 0, Math.PI * 2); ctx.fill()

            // Kenar
            ctx.strokeStyle = oy.adres === address ? '#fbbf24' : 'rgba(255,255,255,0.8)'
            ctx.lineWidth = oy.adres === address ? 3 : 1.5; ctx.beginPath(); ctx.arc(px, py, 13 * scale, 0, Math.PI * 2); ctx.stroke()

            // İnitial
            ctx.fillStyle = '#fff'; ctx.font = `bold ${8 * scale}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
            ctx.fillText(oy.bot ? '🤖' : (oy.adres?.slice(2, 4)?.toUpperCase() || '??'), px, py)

            // Can 100 üstünden
            ctx.fillStyle = '#ef4444'; ctx.font = 'bold 9px monospace'
            ctx.fillText(`🖤${oy.hp || 0}`, px, py - 24)

            // Anahtar sayısı
            ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center'
            ctx.fillText(`🗝️${oy.anahtar || 0}`, px, py + 26)

            // Kasa
            if ((oy.kasalar || 0) > 0) { ctx.fillStyle = '#a78bfa'; ctx.font = 'bold 9px monospace'; ctx.fillText(`🎁${oy.kasalar}`, px, py + 36) }

            // Sıra ok
            if (oy.adres === boardState.mevcutOyuncu) {
                ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2; ctx.setLineDash([3, 2])
                ctx.beginPath(); ctx.arc(px, py, 18, 0, Math.PI * 2); ctx.stroke()
                ctx.setLineDash([])
            }
        })

        ctx.restore() // restore camera clip
    }, [karoTipleri, kasaTileId, boardState, address])

    // Animation Loop
    useEffect(() => {
        let raf
        const animate = () => {
            draw()
            raf = requestAnimationFrame(animate)
        }
        raf = requestAnimationFrame(animate)
        return () => cancelAnimationFrame(raf)
    }, [draw])

    // Detect movement path and set up animations
    useEffect(() => {
        if (!boardState?.kayit?.length) return
        const lastEvent = boardState.kayit[boardState.kayit.length - 1]
        // Whenever a player moves, we set up the animation path array
        const currentPlayer = boardState.oyuncular.find(p => p.adres === boardState.mevcutOyuncu)
        if (currentPlayer && currentPlayer.adres === address) return // Client handles their own animations smoothly (hypothetical optimization, ignoring for standard implementation)
    }, [boardState])

    return (
        <div style={{ position: 'relative', display: 'inline-block', width: '100%', height: 'calc(100vh - 120px)' }}>
            <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%', borderRadius: 14, border: '1px solid rgba(34,197,94,0.4)', boxShadow: '0 0 50px rgba(22,163,74,0.2)', backgroundColor: '#1a4731' }} />

            {/* Branch Choice Selection Modal */}
            <AnimatePresence>
                {isBranchChoicePhase && isMyTurn && boardState?.mevcutOyuncu === address && (
                    <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(0,0,0,0.8)', padding: '2rem', borderRadius: 16, border: '2px solid #fbbf24', textAlign: 'center', zIndex: 100 }}>
                        <h3 style={{ color: '#fbbf24', marginBottom: '1rem', marginTop: 0 }}>Yol Ayrımı! Hangi Yön?</h3>
                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                            {KAROLAR_GRAPH[boardState.oyuncular.find(p => p.adres === address)?.konum]?.next.map((n) => (
                                <button key={n} onClick={() => onChooseBranch(n)} style={{ padding: '0.8rem 1.5rem', background: '#3b82f6', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}>
                                    {KAROLAR_GRAPH[n]?.tip?.toUpperCase() || 'YOL'} (Id: {n})
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem', zIndex: 10 }}>
                {/* Çift zar göstergesi */}
                <AnimatePresence>
                    {sonZar?.length === 2 && (
                        <motion.div key={sonZar.join()} initial={{ scale: 1.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
                            style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                            {sonZar.map((d, i) => (
                                <motion.div key={i} initial={{ rotate: 180 }} animate={{ rotate: 0 }} transition={{ delay: i * 0.1 }}
                                    style={{ width: 46, height: 46, background: 'linear-gradient(135deg,#7c3aed,#4c1d95)', border: '2px solid rgba(124,58,237,0.8)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem', boxShadow: '0 0 20px rgba(124,58,237,0.5)' }}>
                                    {['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][d - 1]}
                                </motion.div>
                            ))}
                            <div style={{ width: 46, height: 46, background: 'rgba(251,191,36,0.2)', border: '2px solid rgba(251,191,36,0.6)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1.1rem', color: '#fbbf24' }}>
                                {sonZar.reduce((a, b) => a + b, 0)}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {isInitialRollPhase && (
                    <motion.button onClick={onInitialRoll} disabled={zarAnimasyon}
                        whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
                        animate={{ boxShadow: ['0 0 8px rgba(16,185,129,0.4)', '0 0 24px rgba(16,185,129,0.9)', '0 0 8px rgba(16,185,129,0.4)'] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        style={{ padding: '0.6rem 1.8rem', background: 'linear-gradient(135deg,#10b981,#34d399)', border: 'none', borderRadius: '9999px', fontFamily: 'var(--font-orbitron)', fontWeight: 900, fontSize: '0.85rem', color: '#000', cursor: 'pointer', opacity: zarAnimasyon ? 0.6 : 1 }}>
                        🎲 SIRA İÇİN ZAR AT
                    </motion.button>
                )}
                {isMyTurn && (
                    <motion.button onClick={onRollDice} disabled={zarAnimasyon}
                        whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
                        animate={{ boxShadow: ['0 0 8px rgba(251,191,36,0.4)', '0 0 24px rgba(251,191,36,0.9)', '0 0 8px rgba(251,191,36,0.4)'] }}
                        transition={{ duration: 1.2, repeat: Infinity }}
                        style={{ padding: '0.6rem 1.8rem', background: 'linear-gradient(135deg,#f59e0b,#fbbf24)', border: 'none', borderRadius: '9999px', fontFamily: 'var(--font-orbitron)', fontWeight: 900, fontSize: '0.85rem', color: '#000', cursor: 'pointer', opacity: zarAnimasyon ? 0.6 : 1 }}>
                        🎲 ZAR AT
                    </motion.button>
                )}
            </div>
        </div>
    )
}
