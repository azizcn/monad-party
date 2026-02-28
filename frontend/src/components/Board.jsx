import { useEffect, useRef, useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ─── 48 Karo Yılan Yol — Doğa Teması ─────────────────────────────────────────
// 3 satır yılan + son sütun geri; 1100×640 canvas
const W = 1100, H = 640

// Karo konumları: satır-başı-başı yapısı
const KAROLAR = (() => {
    const pos = []
    const xs = Array.from({ length: 12 }, (_, i) => 80 + i * 88)   // 12 sütun
    const y1 = 560, y2 = 380, y3 = 200, y4 = 100              // satır y'leri
    // Satır 1: sola→sağa (0-11)
    xs.forEach(x => pos.push({ x, y: y1 }))
    // Sütun sağ: yukarı (12-13)
    pos.push({ x: xs[11], y: (y1 + y2) / 2 })
    pos.push({ x: xs[11], y: y2 })
        // Satır 2: sağ→sola (14-25, 12 tile)
        ;[...xs].reverse().forEach(x => pos.push({ x, y: y2 }))
    // Sol sütun yukarı (26-27)
    pos.push({ x: xs[0], y: (y2 + y3) / 2 })
    pos.push({ x: xs[0], y: y3 })
    // Satır 3: sola→sağa (28-37, 10 tile)
    xs.slice(0, 10).forEach(x => pos.push({ x, y: y3 }))
    // Sağ sütun yukarı (38-39)
    pos.push({ x: xs[9], y: (y3 + y4) / 2 })
    pos.push({ x: xs[9], y: y4 })
        // Satır 4: sağ→sola (40-47, 8 tile)
        ;[...xs.slice(0, 8)].reverse().forEach(x => pos.push({ x, y: y4 }))
    return pos // 48 tile
})()

const TIP_RENK = { start: '#166534', normal: '#1e3a5f', anahtar: '#78350f', tuzak: '#7f1d1d', heal: '#14532d' }
const TIP_SINIR = { start: '#4ade80', normal: '#60a5fa', anahtar: '#fbbf24', tuzak: '#f87171', heal: '#86efac' }
const TIP_IKON = { start: '🏁', normal: '', anahtar: '🗝️', tuzak: '💀', heal: '❤️' }
const OYUNCU_RENK = ['#7c3aed', '#06b6d4', '#fbbf24', '#ec4899', '#10b981', '#f97316', '#3b82f6', '#ef4444']

function arka(ctx) {
    // Gökyüzü → çimen gradyanı
    const g = ctx.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, '#1a4731'); g.addColorStop(0.4, '#166534'); g.addColorStop(1, '#14532d')
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)

    // Grid çim dokusu
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1
    for (let x = 0; x < W; x += 30) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
    for (let y = 0; y < H; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }

    // Çimenler (üstten bakış, nokta kümeleri)
    ctx.fillStyle = 'rgba(52,211,153,0.12)'
    for (let i = 0; i < 180; i++) {
        const gx = Math.random() * W, gy = Math.random() * H
        ctx.beginPath(); ctx.arc(gx, gy, 2 + Math.random() * 4, 0, Math.PI * 2); ctx.fill()
    }

    // Ağaçlar (üstten bakış: koyu yeşil daire)
    const agaclar = [[50, 80], [100, 150], [30, 400], [60, 490], [1050, 90], [1020, 300], [1050, 500],
    [200, 50], [400, 60], [600, 50], [800, 80], [950, 60],
    [150, 620], [350, 610], [600, 600], [850, 610], [1000, 600], [30, 260]]
    agaclar.forEach(([ax, ay]) => {
        ctx.shadowColor = '#052e16'; ctx.shadowBlur = 8
        ctx.fillStyle = '#052e16'; ctx.beginPath(); ctx.arc(ax, ay, 18, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = '#166534'; ctx.beginPath(); ctx.arc(ax, ay, 12, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = '#22c55e'; ctx.beginPath(); ctx.arc(ax - 3, ay - 3, 6, 0, Math.PI * 2); ctx.fill()
        ctx.shadowBlur = 0
    })

    // Çiçekler
    const cicekler = [[250, 540], [450, 540], [700, 420], [900, 380], [300, 200], [500, 160], [400, 620]]
    cicekler.forEach(([fx, fy]) => {
        ctx.fillStyle = '#fde68a'; ctx.beginPath(); ctx.arc(fx, fy, 4, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = '#f59e0b'; ctx.beginPath(); ctx.arc(fx, fy, 2, 0, Math.PI * 2); ctx.fill()
    })

    // Taşlı nehir (yatay şerit)
    ctx.fillStyle = 'rgba(56,189,248,0.12)'
    ctx.beginPath(); ctx.ellipse(W / 2, H / 2 - 20, 200, 25, 0.1, 0, Math.PI * 2); ctx.fill()
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

export default function Board({ karoTipleri = [], kasaTileId = null, boardState, address, onRollDice, onInitialRoll, isMyTurn, isInitialRollPhase, sonZar, zarAnimasyon }) {
    const canvasRef = useRef(null)
    const animRef = useRef({}) // { adres: { x, y, hedefX, hedefY } }
    const rafRef = useRef(null)

    const draw = useCallback(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        canvas.width = W; canvas.height = H

        arka(ctx)

        // Yol şeridi (bg)
        ctx.strokeStyle = 'rgba(139,115,85,0.5)'; ctx.lineWidth = 36; ctx.setLineDash([])
        ctx.beginPath()
        KAROLAR.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y))
        ctx.stroke()

        // Yol şeridi kenarları
        ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 38; ctx.setLineDash([])

        // Son → başa ok
        const son = KAROLAR[47], ilk = KAROLAR[0]
        ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 2; ctx.setLineDash([6, 4])
        ctx.beginPath(); ctx.moveTo(son.x, son.y); ctx.lineTo(ilk.x, ilk.y); ctx.stroke()
        ctx.setLineDash([])

        // Oklar yönlere
        KAROLAR.forEach((pos, i) => {
            if (i >= KAROLAR.length - 1) return
            const next = KAROLAR[i + 1]
            const dx = next.x - pos.x, dy = next.y - pos.y, len = Math.sqrt(dx * dx + dy * dy)
            if (len < 2) return
            const mx = pos.x + dx * 0.55, my = pos.y + dy * 0.55, ang = Math.atan2(dy, dx)
            ctx.save(); ctx.globalAlpha = 0.2; ctx.fillStyle = '#fff'
            ctx.translate(mx, my); ctx.rotate(ang)
            ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-4, -4); ctx.lineTo(-4, 4); ctx.closePath(); ctx.fill()
            ctx.restore()
        })

        // Karolar
        KAROLAR.forEach((pos, id) => {
            const tip = karoTipleri[id] || 'normal'
            const isKasa = id === kasaTileId
            const isMevcut = boardState?.mevcutOyuncu && boardState?.oyuncular?.some(o => Number(o.konum) === id && o.adres === boardState.mevcutOyuncu)
            const r = 24

            ctx.shadowColor = isKasa ? '#fbbf24' : (TIP_SINIR[tip] || '#60a5fa')
            ctx.shadowBlur = (isKasa || isMevcut) ? 22 : 6
            ctx.fillStyle = isKasa ? '#78350f' : (TIP_RENK[tip] || TIP_RENK.normal)
            karoPath(ctx, pos.x, pos.y, r); ctx.fill()
            ctx.shadowBlur = 0

            ctx.strokeStyle = isKasa ? '#fbbf24' : (TIP_SINIR[tip] || '#60a5fa')
            ctx.lineWidth = isKasa ? 3 : 2
            karoPath(ctx, pos.x, pos.y, r); ctx.stroke()

            // İkon
            const ikon = isKasa ? '🎁' : TIP_IKON[tip]
            if (ikon) { ctx.font = `${r * 0.75}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(ikon, pos.x, pos.y - 2) }

            // ID
            ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.font = '7px monospace'; ctx.textAlign = 'center'; ctx.fillText(String(id), pos.x, pos.y + r - 8)
        })

        // Oyuncu token'ları
        boardState?.oyuncular?.forEach((oy, i) => {
            if (oy.elendi) return
            const konum = Number(oy.konum)
            const tilePos = KAROLAR[konum] || KAROLAR[0]
            const c = OYUNCU_RENK[i % 8]
            const ayni = (boardState.oyuncular || []).slice(0, i).filter(p => Number(p.konum) === konum && !p.elendi).length
            const ox = (ayni % 2) * 22 - 11, oy2 = Math.floor(ayni / 2) * 20 - 10
            const px = tilePos.x + ox, py = tilePos.y - 6 + oy2

            // Gölge
            ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(px, py + 16, 10, 4, 0, 0, Math.PI * 2); ctx.fill()

            // Gövde
            ctx.shadowColor = c; ctx.shadowBlur = 14
            ctx.fillStyle = c; ctx.beginPath(); ctx.arc(px, py, 13, 0, Math.PI * 2); ctx.fill()
            ctx.shadowBlur = 0

            // Parlak üst
            ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.arc(px - 3, py - 3, 5, 0, Math.PI * 2); ctx.fill()

            // Kenar
            ctx.strokeStyle = oy.adres === address ? '#fbbf24' : 'rgba(255,255,255,0.8)'
            ctx.lineWidth = oy.adres === address ? 3 : 1.5; ctx.beginPath(); ctx.arc(px, py, 13, 0, Math.PI * 2); ctx.stroke()

            // İnitial
            ctx.fillStyle = '#fff'; ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
            ctx.fillText(oy.bot ? '🤖' : (oy.adres?.slice(2, 4)?.toUpperCase() || '??'), px, py)

            // Can kalpleri
            for (let h = 0; h < (oy.hp || 0); h++) { ctx.font = '8px serif'; ctx.fillText('❤️', px - 9 + h * 10, py - 24) }

            // Anahtar sayısı
            ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center'
            ctx.fillText(`🗝️${oy.anahtar || 0}`, px, py + 26)

            // Kasa
            if ((oy.kasalar || 0) > 0) { ctx.fillStyle = '#a78bfa'; ctx.font = 'bold 8px monospace'; ctx.fillText(`🎁${oy.kasalar}`, px, py + 36) }

            // Sıra ok
            if (oy.adres === boardState.mevcutOyuncu) {
                ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2; ctx.setLineDash([3, 2])
                ctx.beginPath(); ctx.arc(px, py, 18, 0, Math.PI * 2); ctx.stroke()
                ctx.setLineDash([])
            }
        })
    }, [karoTipleri, kasaTileId, boardState, address])

    useEffect(() => { draw() }, [draw])

    return (
        <div style={{ position: 'relative', display: 'inline-block' }}>
            <canvas ref={canvasRef} style={{ display: 'block', borderRadius: 14, border: '1px solid rgba(34,197,94,0.4)', boxShadow: '0 0 50px rgba(22,163,74,0.2)', maxWidth: '100%' }} />

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
