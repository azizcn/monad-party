import { useEffect, useRef, useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { KAROLAR_POSITIONS, KAROLAR_GRAPH, BOARD_WIDTH, BOARD_HEIGHT, enKisaYol } from '../lib/boardMapData'

const TIP_RENK = { start: '#166534', normal: '#1e3a5f', anahtar: '#78350f', tuzak: '#7f1d1d', heal: '#14532d' }
const TIP_SINIR = { start: '#4ade80', normal: '#3b5278', anahtar: '#fbbf24', tuzak: '#f87171', heal: '#86efac' }
const TIP_IKON = { start: '🏁', normal: '', anahtar: '🗝️', tuzak: '💀', heal: '❤️' }
const OYUNCU_RENK = ['#7c3aed', '#06b6d4', '#fbbf24', '#ec4899', '#10b981', '#f97316', '#3b82f6', '#ef4444']

// ─── Arka plan çizimi (tek seferlik, offscreen canvas'a) ────────────────────
let bgCanvas = null
let bgDrawn = false

function getOrDrawBg(W, H) {
    if (!bgCanvas || bgCanvas.width !== W || bgCanvas.height !== H || !bgDrawn) {
        bgCanvas = document.createElement('canvas')
        bgCanvas.width = W; bgCanvas.height = H
        const ctx = bgCanvas.getContext('2d')

        const g = ctx.createLinearGradient(0, 0, 0, H)
        g.addColorStop(0, '#0d2318'); g.addColorStop(0.4, '#14532d'); g.addColorStop(1, '#0a3d1f')
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)

        // Grid
        ctx.strokeStyle = 'rgba(255,255,255,0.03)'; ctx.lineWidth = 1
        for (let x = 0; x < W; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
        for (let y = 0; y < H; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }

        // Çiçek noktaları (deterministik)
        ctx.fillStyle = 'rgba(52,211,153,0.10)'
        for (let i = 0; i < 800; i++) {
            // pseudo-random ama deterministik
            const gx = ((i * 2971 + 137) % W)
            const gy = ((i * 1093 + 239) % H)
            ctx.beginPath(); ctx.arc(gx, gy, 1.5 + (i % 3), 0, Math.PI * 2); ctx.fill()
        }

        bgDrawn = true
    }
    return bgCanvas
}

function karoPath(ctx, x, y, r) {
    ctx.beginPath()
    for (let i = 0; i < 6; i++) {
        const a = Math.PI / 3 * i - Math.PI / 6
        i === 0 ? ctx.moveTo(x + r * Math.cos(a), y + r * Math.sin(a)) : ctx.lineTo(x + r * Math.cos(a), y + r * Math.sin(a))
    }
    ctx.closePath()
}

export default function Board({ karoTipleri = {}, kasaTileId = null, boardState, address, onRollDice, onInitialRoll, onChooseBranch, isMyTurn, isInitialRollPhase, sonZar, zarAnimasyon, isBranchChoicePhase }) {
    const canvasRef = useRef(null)
    const animRef = useRef({})
    const rafRef = useRef(null)
    const frameRef = useRef(0)

    // ─── Camera State ─────────────────────────────────────────────────────────
    const cameraRef = useRef({
        x: BOARD_WIDTH / 2,
        y: BOARD_HEIGHT / 2,
        zoom: 1.0,
        // free mode state
        free: false,
        dragX: 0,
        dragY: 0,
    })
    const [freeCamera, setFreeCamera] = useState(false)
    const isDraggingRef = useRef(false)
    const dragStartRef = useRef({ x: 0, y: 0, cx: 0, cy: 0 })

    const draw = useCallback(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        const viewW = canvas.clientWidth, viewH = canvas.clientHeight
        if (canvas.width !== viewW) canvas.width = viewW
        if (canvas.height !== viewH) canvas.height = viewH

        frameRef.current++
        const frame = frameRef.current
        const cam = cameraRef.current

        // ─── Determine camera target ─────────────────────────────────────────
        let targetX = BOARD_WIDTH / 2, targetY = BOARD_HEIGHT / 2

        if (!cam.free && boardState?.mevcutOyuncu) {
            const activePlayer = boardState.oyuncular.find(p => p.adres === boardState.mevcutOyuncu)
            if (activePlayer && KAROLAR_POSITIONS[activePlayer.konum]) {
                const anim = animRef.current[activePlayer.adres]
                if (anim && anim.x) { targetX = anim.x; targetY = anim.y }
                else { targetX = KAROLAR_POSITIONS[activePlayer.konum].x; targetY = KAROLAR_POSITIONS[activePlayer.konum].y }
            }
        } else if (!cam.free) {
            targetX = BOARD_WIDTH / 2
            targetY = BOARD_HEIGHT / 2
        }

        if (!cam.free) {
            cam.x += (targetX - cam.x) * 0.08
            cam.y += (targetY - cam.y) * 0.08
        }

        ctx.save()
        // Center camera + zoom
        ctx.translate(viewW / 2 - cam.x * cam.zoom, viewH / 2 - cam.y * cam.zoom)
        ctx.scale(cam.zoom, cam.zoom)

        // ─── Background (cached) ─────────────────────────────────────────────
        ctx.drawImage(getOrDrawBg(BOARD_WIDTH, BOARD_HEIGHT), 0, 0)

        // Animated particles (floating dots)
        ctx.save()
        for (let i = 0; i < 25; i++) {
            const px = ((i * 3137 + frame * 0.4 + i * 40) % BOARD_WIDTH)
            const py = ((i * 1327 + Math.sin(frame * 0.012 + i) * 40) % BOARD_HEIGHT)
            const alpha = 0.05 + 0.06 * Math.sin(frame * 0.03 + i * 0.8)
            ctx.fillStyle = `rgba(52,211,153,${alpha.toFixed(3)})`
            ctx.beginPath(); ctx.arc(px, py, 2 + (i % 3), 0, Math.PI * 2); ctx.fill()
        }
        ctx.restore()

        // ─── Yol şeridi (arkaplan) ────────────────────────────────────────────
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

        // Yol kenar (depth trick)
        ctx.strokeStyle = '#3d2f1f'; ctx.lineWidth = 46; ctx.globalCompositeOperation = 'destination-over'
        ctx.stroke(); ctx.globalCompositeOperation = 'source-over'

        // ─── Kasa'ya En Kısa Yol (BFS) ─────────────────────────────────────────
        let kasaYolu = null
        if (kasaTileId !== null && boardState?.mevcutOyuncu) {
            const cp = boardState.oyuncular.find(p => p.adres === boardState.mevcutOyuncu)
            if (cp && KAROLAR_POSITIONS[kasaTileId]) {
                kasaYolu = enKisaYol(cp.konum, kasaTileId, KAROLAR_GRAPH)
            }
        }

        // Yol vurgusu (path highlight)
        if (kasaYolu && kasaYolu.length > 1) {
            ctx.save()
            ctx.strokeStyle = `rgba(251,191,36,${0.18 + 0.12 * Math.sin(frame * 0.05)})`
            ctx.lineWidth = 18
            ctx.lineJoin = 'round'
            ctx.lineCap = 'round'
            ctx.beginPath()
            for (let i = 0; i < kasaYolu.length - 1; i++) {
                const p1 = KAROLAR_POSITIONS[kasaYolu[i]]
                const p2 = KAROLAR_POSITIONS[kasaYolu[i + 1]]
                if (p1 && p2) {
                    if (i === 0) ctx.moveTo(p1.x, p1.y)
                    ctx.lineTo(p2.x, p2.y)
                }
            }
            ctx.stroke()
            ctx.restore()
        }

        // ─── Kasa yönü (dashed line) ──────────────────────────────────────────
        if (kasaTileId !== null && KAROLAR_POSITIONS[kasaTileId] && boardState?.mevcutOyuncu) {
            const cp = boardState.oyuncular.find(p => p.adres === boardState.mevcutOyuncu)
            if (cp && KAROLAR_POSITIONS[cp.konum]) {
                const p1 = KAROLAR_POSITIONS[cp.konum]
                const p2 = KAROLAR_POSITIONS[kasaTileId]
                ctx.strokeStyle = `rgba(251, 191, 36, ${0.3 + 0.25 * Math.sin(frame * 0.07)})`
                ctx.lineWidth = 3; ctx.setLineDash([15, 10])
                ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke()
                ctx.setLineDash([])
            }
        }

        // ─── Karolar ──────────────────────────────────────────────────────────
        for (const [idStr, pos] of Object.entries(KAROLAR_POSITIONS)) {
            const id = Number(idStr)
            const node = KAROLAR_GRAPH[id]
            const tip = node ? node.tip : 'normal'
            const isKasa = id === kasaTileId
            const isOnPath = kasaYolu && kasaYolu.includes(id)
            const r = 24

            // Kasa parlaması
            if (isKasa) {
                const glow = 0.4 + 0.35 * Math.sin(frame * 0.08)
                ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 20 * glow
                ctx.fillStyle = '#78350f'
                karoPath(ctx, pos.x, pos.y, r + 3 * glow); ctx.fill()
                ctx.shadowBlur = 0

                ctx.strokeStyle = `rgba(251,191,36,${glow + 0.35})`; ctx.lineWidth = 3
                karoPath(ctx, pos.x, pos.y, r + 3 * glow); ctx.stroke()
            } else {
                ctx.fillStyle = TIP_RENK[tip] || TIP_RENK.normal
                karoPath(ctx, pos.x, pos.y, r); ctx.fill()
                // Path highlight border
                ctx.strokeStyle = isOnPath ? `rgba(251,191,36,${0.5 + 0.3 * Math.sin(frame * 0.07)})` : (TIP_SINIR[tip] || '#555555')
                ctx.lineWidth = isOnPath ? 3 : 2
                karoPath(ctx, pos.x, pos.y, r); ctx.stroke()
            }

            // İkon
            const ikon = isKasa ? '🎁' : TIP_IKON[tip]
            if (ikon) {
                ctx.font = `${isKasa ? r * 0.85 : r * 0.72}px serif`
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
                ctx.fillText(ikon, pos.x, pos.y - 2)
            }

            // Kasa tile yanında sandık çizimi
            if (isKasa) {
                const cx = pos.x + r + 14, cy = pos.y - 8
                const bw = 18, bh = 13
                const glow2 = 0.5 + 0.4 * Math.sin(frame * 0.09)
                ctx.save()
                ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 10 * glow2
                // Sandık gövdesi
                ctx.fillStyle = '#78350f'
                ctx.beginPath(); ctx.roundRect(cx - bw / 2, cy, bw, bh, 2); ctx.fill()
                ctx.strokeStyle = `rgba(251,191,36,${glow2})`; ctx.lineWidth = 1.5
                ctx.stroke()
                // Sandık kapağı
                ctx.fillStyle = '#92400e'
                ctx.beginPath(); ctx.roundRect(cx - bw / 2, cy - 5, bw, 6, [2, 2, 0, 0]); ctx.fill()
                ctx.strokeStyle = `rgba(251,191,36,${glow2})`; ctx.lineWidth = 1
                ctx.stroke()
                // Kilit
                ctx.fillStyle = `rgba(251,191,36,${glow2 + 0.2})`
                ctx.beginPath(); ctx.arc(cx, cy + 2, 2.5, 0, Math.PI * 2); ctx.fill()
                ctx.shadowBlur = 0
                ctx.restore()
            }

            // ID
            ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = '9px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'
            ctx.fillText(String(id), pos.x, pos.y + r - 7)

            // ─── Yön Oku (direction arrow) ────────────────────────────────────
            if (node && node.next.length > 0) {
                node.next.forEach((nid, ni) => {
                    const np = KAROLAR_POSITIONS[nid]
                    if (!np) return
                    const dx = np.x - pos.x, dy = np.y - pos.y
                    const len = Math.sqrt(dx * dx + dy * dy)
                    if (len < 1) return
                    const nx = dx / len, ny = dy / len
                    // Arrow tip position (on edge of tile)
                    const arrowX = pos.x + nx * (r + 10)
                    const arrowY = pos.y + ny * (r + 10)

                    // Color: main path = cyan, branch = purple
                    const arrowColor = ni === 0 ? 'rgba(34,211,238,0.7)' : 'rgba(167,139,250,0.9)'
                    const arrowSize = ni === 0 ? 7 : 9

                    ctx.save()
                    ctx.translate(arrowX, arrowY)
                    ctx.rotate(Math.atan2(ny, nx))
                    ctx.fillStyle = arrowColor
                    ctx.beginPath()
                    ctx.moveTo(arrowSize, 0)
                    ctx.lineTo(-arrowSize * 0.6, -arrowSize * 0.55)
                    ctx.lineTo(-arrowSize * 0.6, arrowSize * 0.55)
                    ctx.closePath(); ctx.fill()
                    ctx.restore()
                })
            }
        }

        // ─── Oyuncu Token'ları ─────────────────────────────────────────────────
        const sortedPlayers = [...(boardState?.oyuncular || [])].sort((a, b) => (a.konum || 0) - (b.konum || 0))
        sortedPlayers.forEach((oy, i) => {
            if (oy.elendi) return
            let drawX = 0, drawY = 0, scale = 1.0

            const anim = animRef.current[oy.adres]
            if (anim && anim.path && anim.path.length > 0) {
                anim.progress += 0.025   // yavaş yürüme (eski: 0.08)
                if (anim.progress >= 1) { anim.progress = 0; anim.currentIndex++ }
                if (anim.currentIndex >= anim.path.length - 1) {
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
                        drawY -= 30 * Math.sin(t * Math.PI)
                        scale = 1 + Math.sin(t * Math.PI) * 0.2
                    }
                }
                anim.x = drawX; anim.y = drawY
            } else {
                const pos = KAROLAR_POSITIONS[oy.konum] || KAROLAR_POSITIONS[0]
                drawX = pos.x; drawY = pos.y
                if (!anim) animRef.current[oy.adres] = { x: drawX, y: drawY }
                const onSameTile = boardState.oyuncular.filter(p => !p.elendi && p.konum === oy.konum)
                const idx = onSameTile.findIndex(p => p.adres === oy.adres)
                if (onSameTile.length > 1) {
                    const ang = (Math.PI * 2 * idx) / onSameTile.length
                    drawX += Math.cos(ang) * 10; drawY += Math.sin(ang) * 10
                }
            }

            const c = OYUNCU_RENK[i % 8]
            const px = drawX, py = drawY - 6
            const isActive = oy.adres === boardState?.mevcutOyuncu

            // Gölge
            ctx.fillStyle = 'rgba(0,0,0,0.4)'
            ctx.beginPath(); ctx.ellipse(px, py + 16, 10, 4, 0, 0, Math.PI * 2); ctx.fill()

            // Gövde glow
            ctx.shadowColor = c; ctx.shadowBlur = isActive ? 22 : 10
            ctx.fillStyle = c
            ctx.beginPath(); ctx.arc(px, py, 13 * scale, 0, Math.PI * 2); ctx.fill()
            ctx.shadowBlur = 0

            // Parlak üst
            ctx.fillStyle = 'rgba(255,255,255,0.3)'
            ctx.beginPath(); ctx.arc(px - 3, py - 3, 5 * scale, 0, Math.PI * 2); ctx.fill()

            // Kenar
            ctx.strokeStyle = oy.adres === address ? '#fbbf24' : 'rgba(255,255,255,0.7)'
            ctx.lineWidth = oy.adres === address ? 3 : 1.5
            ctx.beginPath(); ctx.arc(px, py, 13 * scale, 0, Math.PI * 2); ctx.stroke()

            // İnitial / bot
            ctx.fillStyle = '#fff'; ctx.font = `bold ${8 * scale}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
            ctx.fillText(oy.bot ? '🤖' : (oy.adres?.slice(2, 4)?.toUpperCase() || '??'), px, py)

            // Can
            ctx.fillStyle = '#ef4444'; ctx.font = 'bold 9px monospace'; ctx.textBaseline = 'alphabetic'
            ctx.fillText(`🖤${oy.hp || 0}`, px, py - 24)

            // Anahtar
            ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center'
            ctx.fillText(`🗝️${oy.anahtar || 0}`, px, py + 28)

            // Kasa
            if ((oy.kasalar || 0) > 0) { ctx.fillStyle = '#a78bfa'; ctx.font = 'bold 9px monospace'; ctx.fillText(`🎁${oy.kasalar}`, px, py + 39) }

            // Aktif oyuncu — dönen halkası
            if (isActive) {
                const pulse = 1 + 0.18 * Math.sin(frame * 0.12)
                ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2.5; ctx.setLineDash([4, 3])
                ctx.beginPath(); ctx.arc(px, py, 19 * pulse * scale, 0, Math.PI * 2); ctx.stroke()
                ctx.setLineDash([])

                // Zıplayan üçgen ok yukarıda
                const bounce = Math.sin(frame * 0.15) * 4
                ctx.fillStyle = '#fbbf24'
                ctx.beginPath()
                ctx.moveTo(px, py - 32 + bounce)
                ctx.lineTo(px - 5, py - 24 + bounce)
                ctx.lineTo(px + 5, py - 24 + bounce)
                ctx.closePath(); ctx.fill()
            }
        })

        ctx.restore() // restore camera transform
    }, [karoTipleri, kasaTileId, boardState, address])

    // ─── Animation Loop ─────────────────────────────────────────────────────────
    useEffect(() => {
        let raf
        const animate = () => { draw(); raf = requestAnimationFrame(animate) }
        raf = requestAnimationFrame(animate)
        return () => cancelAnimationFrame(raf)
    }, [draw])

    // ─── Mouse events for pan/zoom ──────────────────────────────────────────────
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const cam = cameraRef.current

        const onMouseDown = (e) => {
            if (!cam.free) return
            isDraggingRef.current = true
            dragStartRef.current = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y }
            canvas.style.cursor = 'grabbing'
        }
        const onMouseMove = (e) => {
            if (!isDraggingRef.current) return
            const dx = (e.clientX - dragStartRef.current.x) / cam.zoom
            const dy = (e.clientY - dragStartRef.current.y) / cam.zoom
            cam.x = dragStartRef.current.cx - dx
            cam.y = dragStartRef.current.cy - dy
            // Clamp
            cam.x = Math.max(0, Math.min(BOARD_WIDTH, cam.x))
            cam.y = Math.max(0, Math.min(BOARD_HEIGHT, cam.y))
        }
        const onMouseUp = () => { isDraggingRef.current = false; canvas.style.cursor = cam.free ? 'grab' : 'default' }
        const onWheel = (e) => {
            if (!cam.free) return
            e.preventDefault()
            const delta = e.deltaY > 0 ? 0.9 : 1.1
            cam.zoom = Math.min(3, Math.max(0.3, cam.zoom * delta))
        }

        canvas.addEventListener('mousedown', onMouseDown)
        window.addEventListener('mousemove', onMouseMove)
        window.addEventListener('mouseup', onMouseUp)
        canvas.addEventListener('wheel', onWheel, { passive: false })
        return () => {
            canvas.removeEventListener('mousedown', onMouseDown)
            window.removeEventListener('mousemove', onMouseMove)
            window.removeEventListener('mouseup', onMouseUp)
            canvas.removeEventListener('wheel', onWheel)
        }
    }, [])

    const toggleFreeCamera = () => {
        const cam = cameraRef.current
        cam.free = !cam.free
        setFreeCamera(cam.free)
        if (canvasRef.current) canvasRef.current.style.cursor = cam.free ? 'grab' : 'default'
    }

    const [kasaYoluUzunluk, setKasaYoluUzunluk] = useState(null)

    useEffect(() => {
        if (kasaTileId !== null && boardState?.mevcutOyuncu) {
            const cp = boardState.oyuncular?.find(p => p.adres === boardState.mevcutOyuncu)
            if (cp) {
                try {
                    const yol = enKisaYol(cp.konum, kasaTileId, KAROLAR_GRAPH)
                    setKasaYoluUzunluk(yol ? yol.length - 1 : null)
                } catch { setKasaYoluUzunluk(null) }
            }
        } else {
            setKasaYoluUzunluk(null)
        }
    }, [kasaTileId, boardState])

    return (
        <div style={{ position: 'relative', display: 'inline-block', width: '100%', height: 'calc(100vh - 120px)' }}>
            <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%', borderRadius: 14, border: '1px solid rgba(34,197,94,0.4)', boxShadow: '0 0 50px rgba(22,163,74,0.2)', backgroundColor: '#0d2318' }} />

            {/* Kamera Toggle Butonu */}
            <button
                onClick={toggleFreeCamera}
                style={{
                    position: 'absolute', top: 12, right: 12, zIndex: 20,
                    padding: '0.35rem 0.75rem', background: freeCamera ? 'rgba(251,191,36,0.2)' : 'rgba(0,0,0,0.6)',
                    border: `1px solid ${freeCamera ? '#fbbf24' : 'rgba(255,255,255,0.2)'}`,
                    borderRadius: 8, color: freeCamera ? '#fbbf24' : '#aaa', cursor: 'pointer',
                    fontSize: '0.7rem', fontFamily: 'var(--font-orbitron)', letterSpacing: '0.05em',
                    transition: 'all 0.2s',
                }}
            >
                {freeCamera ? '🔓 Serbest Kamera' : '🔒 Kilitle Kamera'}
            </button>
            {freeCamera && (
                <div style={{ position: 'absolute', top: 44, right: 12, zIndex: 20, fontSize: '0.6rem', color: 'rgba(255,255,255,0.5)', pointerEvents: 'none' }}>
                    Sürükle = Gezin • Scroll = Zoom
                </div>
            )}

            {/* Kasa Yol Göstergesi */}
            {kasaYoluUzunluk !== null && (
                <div style={{
                    position: 'absolute', top: 12, left: 12, zIndex: 20,
                    background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(251,191,36,0.5)',
                    borderRadius: 8, padding: '0.35rem 0.75rem',
                    fontSize: '0.7rem', fontFamily: 'var(--font-orbitron)', color: '#fbbf24',
                    backdropFilter: 'blur(4px)',
                }}>
                    📍 {kasaYoluUzunluk} adım → 🎁 Kasa
                </div>
            )}

            {/* Ok Anahtar (Legend) */}
            <div style={{
                position: 'absolute', top: kasaYoluUzunluk !== null ? 52 : 12, left: 12, zIndex: 20,
                background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, padding: '0.3rem 0.6rem',
                fontSize: '0.58rem', color: 'rgba(255,255,255,0.7)',
                backdropFilter: 'blur(4px)', display: 'flex', gap: '0.75rem', alignItems: 'center',
            }}>
                <span style={{ color: 'rgba(34,211,238,0.9)' }}>▶ Ana yol</span>
                <span style={{ color: 'rgba(167,139,250,0.9)' }}>▶ Dal yol</span>
                <span style={{ color: 'rgba(251,191,36,0.8)' }}>―― Kasaya giden yol</span>
            </div>

            {/* Branch Choice Seçim Modal */}
            <AnimatePresence>
                {isBranchChoicePhase && (() => {
                    const myPlayer = boardState?.oyuncular?.find(p => p.adres === address)
                    const myNode = myPlayer ? KAROLAR_GRAPH[myPlayer.konum] : null
                    const branches = myNode?.next || []
                    if (branches.length < 2) return null
                    return (
                        <motion.div key="branch-modal" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }}
                            style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(0,0,0,0.92)', padding: '2rem', borderRadius: 16, border: '2px solid #fbbf24', textAlign: 'center', zIndex: 100, backdropFilter: 'blur(12px)', minWidth: 300 }}>
                            <h3 style={{ color: '#fbbf24', marginBottom: '1rem', marginTop: 0 }}>⑂ Yol Ayrımı!</h3>
                            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.78rem', marginBottom: '1.2rem', marginTop: 0 }}>Hangi yolu seçiyorsun?</p>
                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                                {branches.map((n, ni) => (
                                    <button key={n} onClick={() => onChooseBranch(n)}
                                        style={{ padding: '0.9rem 1.6rem', background: ni === 0 ? 'linear-gradient(135deg,#06b6d4,#0e7490)' : 'linear-gradient(135deg,#a855f7,#7c3aed)', border: 'none', borderRadius: 10, color: '#fff', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem', boxShadow: `0 0 18px ${ni === 0 ? 'rgba(6,182,212,0.45)' : 'rgba(168,85,247,0.45)'}`, transition: 'transform 0.15s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                                        <span style={{ fontSize: '1.4rem' }}>{ni === 0 ? '🛤️' : '🌿'}</span>
                                        <span>{KAROLAR_GRAPH[n]?.tip?.toUpperCase() || 'YOL'}</span>
                                        <span style={{ opacity: 0.55, fontSize: '0.65rem' }}>#{n}</span>
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    )
                })()}
            </AnimatePresence>

            {/* Zar & Butonlar */}
            <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem', zIndex: 10 }}>
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
