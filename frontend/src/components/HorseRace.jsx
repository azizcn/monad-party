import { useEffect, useRef, useState } from 'react'
import { useAccount } from 'wagmi'
import { motion, AnimatePresence } from 'framer-motion'
import useGameStore from '../store/gameStore'

// ─── Düz Pist At Yarışı — Üstten Bakış ───────────────────────────────────────
// Tıpkı referans resmi gibi: yatay pistte yan yana atlar, soldan sağa gidiyor

const PIST_W = 860
const SERI_Y = 80      // her şeridin yüksekliği
const SERI_PAD = 20
const BITIS_X = PIST_W - 60
const START_X = 60

// At kişilik renkleri
const AT_RENK = {
    hothead: '#8B4513', stubborn: '#696969', lazy: '#D2B48C',
    gentle: '#F5DEB3', competitive: '#8B0000',
}
const JOKEY_RENK = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#95a5a6']
const DUYGU_IKON = { angry: '🔥', calm: '😌', happy: '😊', sad: '😢', defiant: '😤', motivated: '💪', sleepy: '💤', determined: '⚡', focused: '🎯', cocky: '😏', neutral: '' }
const KISILIK_ISIM = { hothead: 'Ateşli', stubborn: 'İnatçı', lazy: 'Tembel', gentle: 'Nazik', competitive: 'Hırslı' }

function atCiz(ctx, x, y, seriH, atRenk, jokeyRenk, duygu, kare, isim, bitti) {
    const kanat = Math.sin(kare * 0.4) * 5  // bacak titremesi
    ctx.save()
    ctx.translate(x, y)

    // Gölge
    ctx.fillStyle = 'rgba(0,0,0,0.2)'
    ctx.beginPath(); ctx.ellipse(0, 18, 28, 6, 0, 0, Math.PI * 2); ctx.fill()

    // At gövdesi (yatay oval)
    const govdeShadow = duygu !== 'neutral' && duygu ? 12 : 4
    ctx.shadowColor = AT_RENK[duygu] || atRenk || '#8B4513'
    ctx.shadowBlur = govdeShadow
    ctx.fillStyle = atRenk || '#8B4513'
    ctx.beginPath(); ctx.ellipse(0, 0, 30, 13, 0, 0, Math.PI * 2); ctx.fill()
    ctx.shadowBlur = 0

    // At başı (sağda — bitiş yönü)
    ctx.fillStyle = atRenk || '#8B4513'
    ctx.beginPath(); ctx.ellipse(32, -2, 10, 7, -0.3, 0, Math.PI * 2); ctx.fill()

    // Burun
    ctx.fillStyle = 'rgba(0,0,0,0.3)'
    ctx.beginPath(); ctx.ellipse(40, 0, 3, 2, 0, 0, Math.PI * 2); ctx.fill()

    // Yele (karanlık şerit)
    ctx.fillStyle = 'rgba(0,0,0,0.4)'
    ctx.fillRect(-5, -13, 18, 5)

    // Kuyruk (solda)
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.beginPath(); ctx.ellipse(-33, 0, 8, 4, 0.4, 0, Math.PI * 2); ctx.fill()

    // Bacaklar (4 adet, animasyonlu)
    ctx.fillStyle = '#5a3300'
    // Ön bacaklar
    ctx.beginPath(); ctx.ellipse(16, 13 + kanat, 4, 10, 0.1, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.ellipse(16, -13 - kanat, 4, 10, -0.1, 0, Math.PI * 2); ctx.fill()
    // Arka bacaklar
    ctx.beginPath(); ctx.ellipse(-16, 13 - kanat, 4, 10, 0.2, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.ellipse(-16, -13 + kanat, 4, 10, -0.2, 0, Math.PI * 2); ctx.fill()

    // Jokay
    ctx.fillStyle = jokeyRenk
    ctx.beginPath(); ctx.ellipse(-5, -12, 11, 8, 0, 0, Math.PI * 2); ctx.fill()

    // Jokey kaskı
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.beginPath(); ctx.arc(-5, -18, 6, Math.PI, 0); ctx.fill()

    // Bitti işareti
    if (bitti) {
        ctx.font = '18px serif'; ctx.textAlign = 'center'
        ctx.fillText('🏆', 0, -30)
    }

    // Duygu
    if (duygu && DUYGU_IKON[duygu]) {
        ctx.font = '14px serif'; ctx.textAlign = 'center'
        ctx.fillText(DUYGU_IKON[duygu], 30, -22)
    }

    ctx.restore()

    // İsim etiketi
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(x - 35, y - seriH / 2 + 4, 70, 16)
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 9px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(isim.slice(0, 10), x, y - seriH / 2 + 15)
}

export default function HorseRace({ atlar = [], onYarisBitti }) {
    const { address } = useAccount()
    const canvasRef = useRef(null)
    const rafRef = useRef(null)
    const kareRef = useRef(0)
    const [sohbet, setSohbet] = useState('')
    const [sohbetLog, setSohbetLog] = useState([])
    const [bitis, setBitis] = useState(null)
    const [kalan, setKalan] = useState(35)
    const timerRef = useRef(null)
    const baslangicRef = useRef(Date.now())

    const { atSohbetGonder, atTesvik, atKonumlar, atDuygular, atCevaplar } = useGameStore()
    const benimAtim = atlar.find(a => a.playerAddress === address)

    // Zamanlayıcı
    useEffect(() => {
        baslangicRef.current = Date.now()
        timerRef.current = setInterval(() => {
            const gecen = Math.floor((Date.now() - baslangicRef.current) / 1000)
            const k = Math.max(0, 35 - gecen)
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

    // Oyun döngüsü — düz pist çizimi
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas || !atlar.length) return
        const ctx = canvas.getContext('2d')
        const YUKSEKLIK = atlar.length * SERI_Y + SERI_PAD * 2
        canvas.width = PIST_W; canvas.height = YUKSEKLIK

        const loop = () => {
            kareRef.current++
            ctx.clearRect(0, 0, PIST_W, YUKSEKLIK)

            // Çim kenarlar
            ctx.fillStyle = '#2d8a2d'
            ctx.fillRect(0, 0, PIST_W, SERI_PAD)
            ctx.fillRect(0, YUKSEKLIK - SERI_PAD, PIST_W, SERI_PAD)

            // Pist zemin (kum/toprak rengi)
            const pistGrad = ctx.createLinearGradient(0, SERI_PAD, 0, YUKSEKLIK - SERI_PAD)
            pistGrad.addColorStop(0, '#c8a96e')
            pistGrad.addColorStop(0.5, '#d4b483')
            pistGrad.addColorStop(1, '#c8a96e')
            ctx.fillStyle = pistGrad
            ctx.fillRect(0, SERI_PAD, PIST_W, YUKSEKLIK - SERI_PAD * 2)

            // Pist çizgileri (şeritleri ayır)
            atlar.forEach((_, i) => {
                if (i > 0) {
                    ctx.strokeStyle = 'rgba(255,255,255,0.25)'
                    ctx.lineWidth = 1.5
                    ctx.setLineDash([12, 8])
                    const y = SERI_PAD + i * SERI_Y
                    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(PIST_W, y); ctx.stroke()
                    ctx.setLineDash([])
                }
            })

            // Mesafe işaretleri
            for (let x = 100; x < PIST_W - 60; x += 150) {
                ctx.strokeStyle = 'rgba(255,255,255,0.15)'
                ctx.lineWidth = 1
                ctx.setLineDash([4, 4])
                ctx.beginPath(); ctx.moveTo(x, SERI_PAD); ctx.lineTo(x, YUKSEKLIK - SERI_PAD); ctx.stroke()
                ctx.setLineDash([])
            }

            // START çizgisi
            ctx.strokeStyle = 'rgba(255,255,255,0.8)'
            ctx.lineWidth = 3
            ctx.beginPath(); ctx.moveTo(START_X, SERI_PAD); ctx.lineTo(START_X, YUKSEKLIK - SERI_PAD); ctx.stroke()

            // BİTİŞ çizgisi (damalı)
            for (let y = SERI_PAD; y < YUKSEKLIK - SERI_PAD; y += 10) {
                ctx.fillStyle = (Math.floor(y / 10)) % 2 === 0 ? '#000' : '#fff'
                ctx.fillRect(BITIS_X, y, 8, 10)
            }
            ctx.fillStyle = '#fff'
            ctx.font = 'bold 11px monospace'
            ctx.textAlign = 'center'
            ctx.fillText('BİTİŞ', BITIS_X + 4, SERI_PAD - 4)

            // Atları çiz
            atlar.forEach((at, i) => {
                const pos = atKonumlar?.[at.playerAddress]?.position ?? at.position ?? 0
                const duygu = atDuygular?.[at.playerAddress] ?? 'neutral'
                const seriMerkezY = SERI_PAD + i * SERI_Y + SERI_Y / 2
                const atX = START_X + (pos / 100) * (BITIS_X - START_X - 30)
                const bitmis = atKonumlar?.[at.playerAddress]?.finished || false
                const isMe = at.playerAddress === address
                const atRengi = AT_RENK[at.personality] || '#8B4513'
                const jokeyRengi = JOKEY_RENK[i % 8]

                atCiz(ctx, atX, seriMerkezY, SERI_Y, atRengi, jokeyRengi, duygu, kareRef.current, at.name, bitmis)

                // Benim atım vurgu
                if (isMe) {
                    ctx.strokeStyle = '#fbbf24'
                    ctx.lineWidth = 2
                    ctx.setLineDash([3, 2])
                    ctx.strokeRect(atX - 38, seriMerkezY - SERI_Y / 2 + 2, 80, SERI_Y - 4)
                    ctx.setLineDash([])
                }

                // Şerit numarası
                ctx.fillStyle = 'rgba(255,255,255,0.5)'
                ctx.font = 'bold 11px monospace'
                ctx.textAlign = 'center'
                ctx.fillText(String(i + 1), 25, seriMerkezY + 4)
            })

            rafRef.current = requestAnimationFrame(loop)
        }
        rafRef.current = requestAnimationFrame(loop)
        return () => cancelAnimationFrame(rafRef.current)
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

    const PIST_TOPLAM_H = atlar.length * SERI_Y + SERI_PAD * 2

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 270px', gap: '0.75rem', height: '100%', padding: '0.75rem' }}>

            {/* Pist */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {/* Başlık */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.7rem', color: 'var(--color-yellow)', letterSpacing: '0.15em' }}>🐴 AT YARIŞI</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ fontFamily: 'var(--font-orbitron)', fontSize: '0.7rem', color: kalan < 10 ? 'var(--color-red)' : 'var(--color-cyan-light)' }}>
                            ⏱️ {kalan}s
                        </div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--color-text-dim)' }}>SPACE = Teşvik Et</div>
                    </div>
                </div>

                <canvas ref={canvasRef} style={{ borderRadius: 10, border: '1px solid rgba(251,191,36,0.3)', maxWidth: '100%', display: 'block', imageRendering: 'auto' }} />

                {/* At kişilik ipucu */}
                {benimAtim && (
                    <div style={{ background: `${AT_RENK[benimAtim.personality] || '#7c3aed'}18`, border: `1px solid ${AT_RENK[benimAtim.personality] || '#7c3aed'}35`, borderRadius: 8, padding: '0.4rem 0.75rem', fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                        <strong>Senin Atın ({benimAtim.name} — {KISILIK_ISIM[benimAtim.personality]}):</strong>{' '}
                        {benimAtim.personality === 'hothead' && '🔥 Hakaret et → öfkelenip 2.8x hızlanır!'}
                        {benimAtim.personality === 'stubborn' && '😤 "Hızlan" dersen yavaşlar, "dur" dersen uçar!'}
                        {benimAtim.personality === 'lazy' && '💤 Sık sık "harika", "hadi" de yoksa uyur!'}
                        {benimAtim.personality === 'gentle' && '🌸 "Güzelsin", "mükemmelsin" → 2x hız!'}
                        {benimAtim.personality === 'competitive' && '⚡ Gerideyken kendiliğinden hızlanır!'}
                    </div>
                )}

                {/* Sıralama */}
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {[...atlar].sort((a, b) => (atKonumlar?.[b.playerAddress]?.position ?? b.position ?? 0) - (atKonumlar?.[a.playerAddress]?.position ?? a.position ?? 0)).map((at, i) => (
                        <div key={at.playerAddress} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'var(--color-surface)', border: `1px solid ${i === 0 ? 'rgba(251,191,36,0.5)' : 'var(--color-border)'}`, borderRadius: 6, padding: '0.2rem 0.5rem', fontSize: '0.65rem' }}>
                            <span>{['🥇', '🥈', '🥉'][i] || `#${i + 1}`}</span>
                            <span>{at.name}</span>
                            <span style={{ color: 'var(--color-text-dim)' }}>{Math.round(atKonumlar?.[at.playerAddress]?.position ?? at.position ?? 0)}%</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* At Sohbet Paneli */}
            <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '0.65rem', borderBottom: '1px solid var(--color-border)' }}>
                    <div style={{ fontSize: '0.65rem', fontFamily: 'var(--font-orbitron)', color: 'var(--color-text-muted)', marginBottom: '0.2rem' }}>💬 ATINLA KONUŞ</div>
                    {benimAtim && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: AT_RENK[benimAtim.personality] || '#7c3aed' }} />
                            <span style={{ fontWeight: 700, fontSize: '0.75rem' }}>{benimAtim.name}</span>
                            <span style={{ fontSize: '0.6rem', color: 'var(--color-text-dim)' }}>({KISILIK_ISIM[benimAtim.personality]})</span>
                        </div>
                    )}
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
                <form onSubmit={handleSohbet} style={{ display: 'flex', gap: '0.35rem', padding: '0.5rem', borderTop: '1px solid var(--color-border)' }}>
                    <input className="input" style={{ flex: 1, fontSize: '0.72rem', padding: '0.3rem 0.45rem' }}
                        placeholder="Atına yaz..." value={sohbet} onChange={e => setSohbet(e.target.value)} maxLength={80} />
                    <button className="btn btn-primary btn-sm" type="submit">→</button>
                </form>
            </div>
        </div>
    )
}
