import { useEffect, useRef, useState } from 'react'
import { useAccount } from 'wagmi'
import { motion, AnimatePresence } from 'framer-motion'
import useGameStore from '../store/gameStore'

// ─── At Yarışı — Sprite tabanlı ────────────────────────────────────────────────
// Jokey sprite sheet: iki kare yan yana (her biri yaklaşık yarısı)
// Kullanıcının sağladığı resim: iki pozlama, at koşuyor.

const JOKEY_RENK = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#95a5a6']
const DUYGU_IKON = {
    angry: '🔥', calm: '😌', happy: '😊', sad: '😢',
    defiant: '😤', motivated: '💪', sleepy: '💤',
    determined: '⚡', focused: '🎯', cocky: '😏', neutral: '', content: '🙂',
}

const KISILIK_ISIM = { hothead: 'Ateşli', stubborn: 'İnatçı', lazy: 'Tembel', gentle: 'Nazik', competitive: 'Hırslı' }
const KISILIK_IPUCU = {
    hothead: 'Hakaret/kötü kelimeler → 4.5x hız! Övgü → yavaşlar.',
    stubborn: '"Hızlan" dersen yavaşlar! "Dur/yavaş" dersen koşar.',
    lazy: 'Sürekli övgü gerek, yoksa uyur. "harika", "hadi" de!',
    gentle: '"Güzelsin", "harika" → 3x hız! Hakaret → ağlar, durur.',
    competitive: 'Gerideyken kendiliğinden 4x hızlanır. Lider olunca yavaşlar.',
}
const KISILIK_RENK = {
    hothead: '#ef4444', stubborn: '#8b5cf6', lazy: '#94a3b8',
    gentle: '#10b981', competitive: '#f59e0b',
}
const MODIFIER_LABEL = [
    { max: 0, label: '⏪ Geri', color: '#ef4444' },
    { max: 0.3, label: '🐢 Çok Yavaş', color: '#f97316' },
    { max: 0.9, label: '😴 Yavaş', color: '#eab308' },
    { max: 1.5, label: '🏃 Normal', color: '#22c55e' },
    { max: 2.5, label: '🔥 Hızlı', color: '#06b6d4' },
    { max: 5, label: '⚡ SÜPER HIZ', color: '#a855f7' },
]
function hizLabel(mod) {
    for (const m of MODIFIER_LABEL) if (mod <= m.max) return m
    return MODIFIER_LABEL[MODIFIER_LABEL.length - 1]
}

// ─── Sprite tabanlı at çizimi ────────────────────────────────────────────────
// Kullanıcının sağladığı sprite sheet 2 frame içeriyor.
// Sprite sheet yoksa fallback olarak eski vektörel çizim kullanılır.

function frameDivisor(speedMod) {
    if (speedMod > 3.0) return 2
    if (speedMod > 2.0) return 3
    if (speedMod > 1.5) return 4
    if (speedMod > 0.8) return 7
    if (speedMod > 0.3) return 14
    return 30 // very slow or reversed
}

function atCizSprite(ctx, x, y, imgRef, kare, renk, duygu, isim, bitti, isMe, scale = 1, speedMod = 1.0) {
    const img = imgRef.current
    const FRAME_COUNT = 2
    const frameIdx = bitti ? 0 : Math.floor(kare / frameDivisor(speedMod)) % FRAME_COUNT
    const W = img ? Math.floor(img.naturalWidth / FRAME_COUNT) : 80
    const H = img ? img.naturalHeight : 60
    const dw = Math.round(W * scale * 1.2)
    const dh = Math.round(H * scale * 1.2)

    ctx.save()

    // Renk tonu kaplama (jockey rengi için hafif renk mix)
    ctx.translate(x, y)

    // Gölge
    ctx.fillStyle = 'rgba(0,0,0,0.25)'
    ctx.beginPath()
    ctx.ellipse(0, dh * 0.5 + 2, dw * 0.35, 5 * scale, 0, 0, Math.PI * 2)
    ctx.fill()

    // Duygu / Bitti simgesi
    if (duygu && DUYGU_IKON[duygu]) {
        ctx.font = `${14 * scale}px serif`
        ctx.textAlign = 'center'
        ctx.fillText(DUYGU_IKON[duygu], 0, -dh * 0.5 - 8 * scale)
    }
    if (bitti) {
        ctx.font = `${18 * scale}px serif`
        ctx.textAlign = 'center'
        ctx.fillText('🏆', 0, -dh * 0.5 - 22 * scale)
    }

    // Benim atım vurgu hale
    if (isMe) {
        ctx.strokeStyle = 'rgba(251,191,36,0.7)'
        ctx.lineWidth = 2
        ctx.setLineDash([4, 3])
        ctx.beginPath()
        ctx.ellipse(0, dh * 0.2, dw * 0.4, dh * 0.35, 0, 0, Math.PI * 2)
        ctx.stroke()
        ctx.setLineDash([])
    }

    if (img && img.complete && img.naturalWidth > 0) {
        // Sprite sheet'ten ilgili frame'i çiz (arka plan çizilmez — şeffaflık korunur)
        ctx.globalCompositeOperation = 'source-over'
        ctx.drawImage(img, frameIdx * W, 0, W, H, -dw / 2, -dh * 0.5, dw, dh)
    } else {
        // Fallback: basit koşu animasyonu
        const isFrame1 = frameIdx === 0
        const ba = isFrame1 ? 5 : -5
        ctx.fillStyle = renk || '#8B4513'
        ctx.beginPath(); ctx.ellipse(0, 0, 20 * scale, 10 * scale, 0, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.moveTo(8 * scale, -2 * scale); ctx.lineTo(20 * scale, -18 * scale); ctx.lineTo(26 * scale, -14 * scale); ctx.lineTo(15 * scale, -2 * scale); ctx.fill()
        ctx.fillStyle = '#4a2511'
        ctx.fillRect((-15 + ba) * scale, 5 * scale, 5 * scale, 15 * scale)
        ctx.fillRect((5 - ba) * scale, 5 * scale, 4 * scale, 14 * scale)
        ctx.fillRect((-10 - ba) * scale, 5 * scale, 5 * scale, 15 * scale)
        ctx.fillRect((10 + ba) * scale, 5 * scale, 5 * scale, 15 * scale)
    }

    ctx.restore()

    // İsim etiketi
    ctx.save()
    ctx.fillStyle = isMe ? 'rgba(251,191,36,0.85)' : 'rgba(0,0,0,0.7)'
    ctx.beginPath()
    ctx.roundRect(x - 28 * scale, y + dh * 0.52, 56 * scale, 13 * scale, 4)
    ctx.fill()
    ctx.fillStyle = isMe ? '#000' : '#fff'
    ctx.font = `bold ${7 * scale}px monospace`
    ctx.textAlign = 'center'
    ctx.fillText(isim.slice(0, 10), x, y + dh * 0.52 + 9 * scale)
    ctx.restore()
}

export default function HorseRace({ atlar = [], onYarisBitti }) {
    const { address } = useAccount()
    const canvasRef = useRef(null)
    const rafRef = useRef(null)
    const kareRef = useRef(0)
    const bgOffsetRef = useRef(0)
    const jokeySpriteRef = useRef(null)
    const [sohbet, setSohbet] = useState('')
    const [sohbetLog, setSohbetLog] = useState([])
    const [bitis, setBitis] = useState(null)
    const [kalan, setKalan] = useState(120)              // 120 saniyelik yarış
    const timerRef = useRef(null)
    const baslangicRef = useRef(Date.now())
    const kalanRef = useRef(120)

    const { atSohbetGonder, atTesvik, atKonumlar, atDuygular, atCevaplar } = useGameStore()
    const benimAtim = atlar.find(a => a.playerAddress === address)

    // Jokey sprite yükle
    useEffect(() => {
        const img = new Image()
        img.onload = () => { jokeySpriteRef.current = img }
        img.onerror = () => { jokeySpriteRef.current = null }
        // Kullanıcı tarafından sağlanan jokey görseli
        img.src = '/jockey_sprite.png'
    }, [])

    // Zamanlayıcı
    useEffect(() => {
        baslangicRef.current = Date.now()
        timerRef.current = setInterval(() => {
            const gecen = Math.floor((Date.now() - baslangicRef.current) / 1000)
            const k = Math.max(0, 120 - gecen)
            kalanRef.current = k
            setKalan(k)
            if (k <= 0) { clearInterval(timerRef.current); handleYarisBitti() }
        }, 1000)
        return () => clearInterval(timerRef.current)
    }, [])

    // Cevapları logla
    useEffect(() => {
        if (atCevaplar?.length) {
            const son = atCevaplar[atCevaplar.length - 1]
            setSohbetLog(prev => [...prev.slice(-12), son])
        }
    }, [atCevaplar])

    const handleYarisBitti = () => {
        const sonAtar = [...atlar].sort((a, b) => {
            const posA = atKonumlar?.[a.playerAddress]?.position ?? a.position ?? 0
            const posB = atKonumlar?.[b.playerAddress]?.position ?? b.position ?? 0
            return posB - posA
        })
        const siralama = sonAtar.map(a => ({ adres: a.playerAddress }))
        onYarisBitti?.(siralama)
        setBitis(sonAtar[0]?.playerAddress)
    }

    // Oyun döngüsü — Parallax Side View
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas || !atlar.length) return
        const ctx = canvas.getContext('2d')

        const resize = () => {
            canvas.width = canvas.clientWidth
            canvas.height = canvas.clientHeight
        }
        resize()
        window.addEventListener('resize', resize)

        const loop = () => {
            kareRef.current++
            bgOffsetRef.current += 2
            const viewW = canvas.width, viewH = canvas.height
            ctx.clearRect(0, 0, viewW, viewH)

            // 1. Gökyüzü
            const grad = ctx.createLinearGradient(0, 0, 0, viewH * 0.45)
            grad.addColorStop(0, '#0f172a')
            grad.addColorStop(0.5, '#1e3a5f')
            grad.addColorStop(1, '#1a5c32')
            ctx.fillStyle = grad; ctx.fillRect(0, 0, viewW, viewH)

            // Yıldızlar (statik parallax)
            ctx.fillStyle = 'rgba(255,255,255,0.55)'
            for (let i = 0; i < 30; i++) {
                const sx = ((i * 137 + bgOffsetRef.current * 0.05) % viewW)
                const sy = (i * 53) % (viewH * 0.3)
                const ss = 1 + (i % 3) * 0.5
                ctx.beginPath(); ctx.arc(sx, sy, ss, 0, Math.PI * 2); ctx.fill()
            }

            // Bulutlar Parallax
            ctx.fillStyle = 'rgba(255,255,255,0.18)'
            const cloudOffset = (bgOffsetRef.current * 0.3) % viewW
            for (let i = 0; i < 4; i++) {
                const cx = (i * 280 - cloudOffset + viewW * 2) % viewW
                const cy = 35 + (i % 3) * 18
                ctx.beginPath(); ctx.arc(cx, cy, 28, 0, Math.PI * 2); ctx.fill()
                ctx.beginPath(); ctx.arc(cx + 28, cy, 20, 0, Math.PI * 2); ctx.fill()
                ctx.beginPath(); ctx.arc(cx - 18, cy + 5, 22, 0, Math.PI * 2); ctx.fill()
            }

            // Uzak tepeler
            const hillOffset = (bgOffsetRef.current * 0.4) % (viewW * 1.5)
            ctx.fillStyle = '#1a4a25'
            ctx.beginPath(); ctx.moveTo(0, viewH * 0.48)
            for (let x = -hillOffset; x < viewW + 200; x += 150) {
                ctx.bezierCurveTo(x + 30, viewH * 0.3, x + 90, viewH * 0.3, x + 150, viewH * 0.48)
            }
            ctx.lineTo(viewW, viewH); ctx.lineTo(0, viewH); ctx.closePath(); ctx.fill()

            // Uzak ağaçlar
            const treeOffset = (bgOffsetRef.current * 0.6) % 160
            for (let x = -treeOffset; x < viewW; x += 160) {
                ctx.fillStyle = '#14532d'
                ctx.beginPath(); ctx.moveTo(x + 30, viewH * 0.48); ctx.lineTo(x + 60, viewH * 0.28); ctx.lineTo(x + 90, viewH * 0.48); ctx.fill()
                ctx.fillStyle = '#166534'
                ctx.beginPath(); ctx.moveTo(x + 40, viewH * 0.42); ctx.lineTo(x + 60, viewH * 0.22); ctx.lineTo(x + 80, viewH * 0.42); ctx.fill()
                ctx.fillStyle = '#3d2a10'
                ctx.fillRect(x + 56, viewH * 0.48, 8, viewH * 0.06)
            }

            // Zemin (pist)
            ctx.fillStyle = '#16a34a'
            ctx.fillRect(0, viewH * 0.48, viewW, viewH)

            // Pist şeritleri
            ctx.fillStyle = '#15803d'
            const pistH = viewH - viewH * 0.48
            const pistTop = viewH * 0.48
            atlar.forEach((_, i) => {
                const lineY = pistTop + (i / atlar.length) * pistH
                ctx.fillRect(0, lineY, viewW, 1)
            })

            // Perspektif zemin çizgileri (hız hissi)
            ctx.fillStyle = 'rgba(0,0,0,0.12)'
            const lineOffset = bgOffsetRef.current % 60
            for (let gx = -lineOffset; gx < viewW; gx += 60) {
                ctx.fillRect(gx, pistTop, 2, viewH - pistTop)
            }

            // Bitiş Çizgisi
            const finishLineX = viewW - 80
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.setLineDash([12, 12])
            ctx.beginPath(); ctx.moveTo(finishLineX, pistTop); ctx.lineTo(finishLineX, viewH); ctx.stroke()
            ctx.setLineDash([])
            // Bitiş bayrağı
            ctx.font = '24px serif'; ctx.textBaseline = 'top'
            ctx.fillText('🏁', finishLineX - 12, pistTop)

            // Atları çiz
            const Y_SPACING = (viewH - pistTop - 60) / Math.max(atlar.length, 1)
            const sortedHorses = [...atlar].sort((a, b) => {
                const posA = atKonumlar?.[a.playerAddress]?.position ?? a.position ?? 0
                const posB = atKonumlar?.[b.playerAddress]?.position ?? b.position ?? 0
                return posA - posB
            })

            sortedHorses.forEach((at) => {
                const i = atlar.findIndex(a => a.playerAddress === at.playerAddress)
                const pos = atKonumlar?.[at.playerAddress]?.position ?? at.position ?? 0
                const duygu = atDuygular?.[at.playerAddress] ?? 'neutral'
                const yPos = pistTop + 30 + (i * Y_SPACING)
                const atX = 60 + (pos / 100) * (finishLineX - 70)
                const bitmis = atKonumlar?.[at.playerAddress]?.finished || false
                const isMe = at.playerAddress === address
                const sprScale = 0.6
                const speedMod = atKonumlar?.[at.playerAddress]?.speedMod ?? 1.0

                atCizSprite(ctx, atX, yPos, jokeySpriteRef, bitmis ? 0 : kareRef.current, at.color || '#8B4513', duygu, at.name, bitmis, isMe, sprScale, speedMod)
            })

            rafRef.current = requestAnimationFrame(loop)
        }
        rafRef.current = requestAnimationFrame(loop)
        return () => {
            cancelAnimationFrame(rafRef.current)
            window.removeEventListener('resize', resize)
        }
    }, [atlar, atKonumlar, atDuygular, address])

    // SPACE = teşvik
    useEffect(() => {
        const fn = e => { if (e.code === 'Space') { e.preventDefault(); atTesvik(address) } }
        window.addEventListener('keydown', fn)
        return () => window.removeEventListener('keydown', fn)
    }, [address, atTesvik])

    const handleSohbet = e => {
        e.preventDefault()
        if (!sohbet.trim()) return
        atSohbetGonder(address, sohbet.trim())
        setSohbetLog(prev => [...prev.slice(-12), { adres: address, mesaj: sohbet, atIsim: benimAtim?.name }])
        setSohbet('')
    }

    // Anlık hız bilgisi
    const suankiModifier = benimAtim ? (atKonumlar?.[benimAtim.playerAddress]?.speedMod ?? 1.0) : 1.0
    const hizBilgi = hizLabel(suankiModifier)

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 290px', gap: '0.75rem', height: '100%', padding: '0.75rem' }}>

            {/* Pist */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: 0 }}>
                {/* Başlık */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.7rem', color: 'var(--color-yellow)', letterSpacing: '0.15em' }}>🐴 AT YARIŞI</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        {/* Timer Bar */}
                        <div style={{ position: 'relative', width: 120, height: 14, background: 'rgba(255,255,255,0.1)', borderRadius: 7, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.15)' }}>
                            <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${(kalan / 120) * 100}%`, background: kalan < 20 ? '#ef4444' : kalan < 45 ? '#f59e0b' : '#22c55e', borderRadius: 7, transition: 'width 1s linear,background 0.5s' }} />
                        </div>
                        <div style={{ fontFamily: 'var(--font-orbitron)', fontSize: '0.78rem', color: kalan < 20 ? 'var(--color-red)' : 'var(--color-cyan-light)', minWidth: 42 }}>
                            ⏱️ {kalan}s
                        </div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--color-text-dim)' }}>SPACE=Teşvik</div>
                    </div>
                </div>

                <canvas ref={canvasRef} style={{ borderRadius: 12, border: '1px solid rgba(251,191,36,0.3)', flex: 1, display: 'block', minHeight: 300, background: '#0f172a' }} />

                {/* ─── At Özellikleri Paneli ───────────────────────────────── */}
                {benimAtim && (
                    <div style={{ background: `${KISILIK_RENK[benimAtim.personality] || '#7c3aed'}18`, border: `1px solid ${KISILIK_RENK[benimAtim.personality] || '#7c3aed'}40`, borderRadius: 10, padding: '0.5rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.78rem', color: KISILIK_RENK[benimAtim.personality] }}>
                                {benimAtim.name}
                            </span>
                            <span style={{ fontSize: '0.65rem', background: `${KISILIK_RENK[benimAtim.personality]}30`, border: `1px solid ${KISILIK_RENK[benimAtim.personality]}60`, borderRadius: 4, padding: '0 6px', color: KISILIK_RENK[benimAtim.personality] }}>
                                {KISILIK_ISIM[benimAtim.personality]}
                            </span>
                            {/* Anlık hız */}
                            <span style={{ fontSize: '0.63rem', color: hizBilgi.color, marginLeft: 'auto', fontWeight: 700 }}>
                                {hizBilgi.label} ({suankiModifier.toFixed(1)}x)
                            </span>
                        </div>
                        <div style={{ fontSize: '0.66rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                            💡 <em>{KISILIK_IPUCU[benimAtim.personality]}</em>
                        </div>
                    </div>
                )}

                {/* Sıralama */}
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    {[...atlar].sort((a, b) => (atKonumlar?.[b.playerAddress]?.position ?? b.position ?? 0) - (atKonumlar?.[a.playerAddress]?.position ?? a.position ?? 0)).map((at, i) => {
                        const duygu = atDuygular?.[at.playerAddress] ?? 'neutral'
                        return (
                            <div key={at.playerAddress} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'var(--color-surface)', border: `1px solid ${i === 0 ? 'rgba(251,191,36,0.5)' : 'var(--color-border)'}`, borderRadius: 6, padding: '0.2rem 0.5rem', fontSize: '0.63rem' }}>
                                <span>{['🥇', '🥈', '🥉'][i] || `#${i + 1}`}</span>
                                <span>{at.name}</span>
                                {DUYGU_IKON[duygu] && <span>{DUYGU_IKON[duygu]}</span>}
                                <span style={{ color: 'var(--color-text-dim)' }}>{Math.round(atKonumlar?.[at.playerAddress]?.position ?? at.position ?? 0)}%</span>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* ─── At Sohbet Paneli ─────────────────────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '0.65rem', borderBottom: '1px solid var(--color-border)' }}>
                    <div style={{ fontSize: '0.65rem', fontFamily: 'var(--font-orbitron)', color: 'var(--color-text-muted)', marginBottom: '0.2rem' }}>💬 ATINLA KONUŞ</div>
                    {benimAtim && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: KISILIK_RENK[benimAtim.personality] || '#7c3aed' }} />
                            <span style={{ fontWeight: 700, fontSize: '0.75rem' }}>{benimAtim.name}</span>
                            <span style={{ fontSize: '0.6rem', color: 'var(--color-text-dim)' }}>({KISILIK_ISIM[benimAtim.personality]})</span>
                        </div>
                    )}
                    {/* Kişilik tablosu */}
                    <div style={{ marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        {atlar.map((at, i) => {
                            const pos = atKonumlar?.[at.playerAddress]?.position ?? at.position ?? 0
                            const duygu = atDuygular?.[at.playerAddress] ?? 'neutral'
                            const isMe = at.playerAddress === address
                            return (
                                <div key={at.playerAddress} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.6rem', opacity: isMe ? 1 : 0.7 }}>
                                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: KISILIK_RENK[at.personality] || '#888', flexShrink: 0 }} />
                                    <span style={{ fontWeight: isMe ? 700 : 400, color: isMe ? KISILIK_RENK[at.personality] : 'var(--color-text-muted)' }}>{at.name}</span>
                                    <span style={{ color: 'var(--color-text-dim)' }}>({KISILIK_ISIM[at.personality]})</span>
                                    {DUYGU_IKON[duygu] && <span>{DUYGU_IKON[duygu]}</span>}
                                    <div style={{ flex: 1, background: 'rgba(255,255,255,0.1)', borderRadius: 2, height: 4, overflow: 'hidden' }}>
                                        <div style={{ width: `${pos}%`, height: '100%', background: KISILIK_RENK[at.personality] || '#888', borderRadius: 2 }} />
                                    </div>
                                    <span style={{ color: 'var(--color-text-dim)', minWidth: 26 }}>{Math.round(pos)}%</span>
                                </div>
                            )
                        })}
                    </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    {sohbetLog.length === 0 && <div style={{ color: 'var(--color-text-dim)', fontSize: '0.7rem', textAlign: 'center', marginTop: '0.75rem' }}>Atına bir şeyler söyle!</div>}
                    {sohbetLog.map((e, i) => (
                        <div key={i}>
                            {e.mesaj && <div style={{ fontSize: '0.7rem', marginBottom: '0.1rem' }}>
                                <span style={{ color: 'var(--color-cyan-light)', fontWeight: 600 }}>Sen: </span>
                                <span style={{ color: 'var(--color-text-muted)' }}>{e.mesaj}</span>
                            </div>}
                            {e.cevap && <motion.div initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                                style={{ fontSize: '0.7rem', background: 'rgba(124,58,237,0.1)', borderLeft: '2px solid var(--color-purple)', borderRadius: '0 5px 5px 0', padding: '0.2rem 0.35rem' }}>
                                <span style={{ color: 'var(--color-purple-light)', fontWeight: 600 }}>{e.atIsim}: </span>
                                <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>{e.cevap}</span>
                            </motion.div>}
                        </div>
                    ))}
                </div>

                {/* Girdi — copy/paste deaktif */}
                <form onSubmit={handleSohbet} style={{ display: 'flex', gap: '0.35rem', padding: '0.5rem', borderTop: '1px solid var(--color-border)', flexDirection: 'column' }}>
                    <div style={{ fontSize: '0.58rem', color: 'var(--color-text-dim)', textAlign: 'center' }}>
                        ⚠️ Kopyala/yapıştır devre dışı
                    </div>
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <input
                            className="input"
                            style={{ flex: 1, fontSize: '0.72rem', padding: '0.3rem 0.45rem' }}
                            placeholder="Atına yaz..."
                            value={sohbet}
                            onChange={e => setSohbet(e.target.value)}
                            maxLength={120}
                            onPaste={e => e.preventDefault()}
                            onCopy={e => e.preventDefault()}
                            onCut={e => e.preventDefault()}
                            onContextMenu={e => e.preventDefault()}
                            autoComplete="off"
                            spellCheck={false}
                        />
                        <button className="btn btn-primary btn-sm" type="submit">→</button>
                    </div>
                </form>
            </div>
        </div>
    )
}
