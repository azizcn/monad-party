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

// Yandan Bakış At Çizimi (Pixel-Art esintili side-view)
function atCiz(ctx, x, y, atRenk, jokeyRenk, duygu, kare, isim, bitti) {
    // 2 frame'lik basit koşu animasyonu (kare bazlı)
    const isFrame1 = Math.floor(kare / 6) % 2 === 0
    const bacakAcisi = bitti ? 0 : (isFrame1 ? 5 : -5)

    ctx.save()
    ctx.translate(x, y)

    // Duygu (Tepede)
    if (duygu && DUYGU_IKON[duygu]) {
        ctx.font = '16px serif'; ctx.textAlign = 'center'
        ctx.fillText(DUYGU_IKON[duygu], -10, -35)
    }
    if (bitti) {
        ctx.font = '20px serif'; ctx.textAlign = 'center'
        ctx.fillText('🏆', -10, -45)
    }

    // Gövde (Gölge)
    ctx.fillStyle = 'rgba(0,0,0,0.3)'
    ctx.beginPath(); ctx.ellipse(-5, 20, 18, 5, 0, 0, Math.PI * 2); ctx.fill()

    ctx.shadowColor = AT_RENK[duygu] || atRenk || '#8B4513'
    ctx.shadowBlur = duygu !== 'neutral' ? 10 : 0

    // Arka Bacaklar (Geri Planda daha koyu)
    ctx.fillStyle = '#4a2511'
    ctx.fillRect(-15 + bacakAcisi, 5, 5, 15) // Arka Sol
    ctx.fillRect(5 - bacakAcisi, 5, 4, 14)  // Ön Sol

    // Gövde ana
    ctx.fillStyle = atRenk || '#8B4513'
    ctx.beginPath(); ctx.ellipse(-5, 0, 20, 10, 0, 0, Math.PI * 2); ctx.fill()

    // Boyun ve Baş
    ctx.beginPath()
    ctx.moveTo(8, -2)
    ctx.lineTo(20, -18) // kulak bölgesi
    ctx.lineTo(26, -14) // burun
    ctx.lineTo(15, -2)
    ctx.fill()
    ctx.shadowBlur = 0

    // Ön Bacaklar
    ctx.fillStyle = atRenk || '#8B4513'
    ctx.fillRect(-10 - bacakAcisi, 5, 5, 15) // Arka Sağ
    ctx.fillRect(10 + bacakAcisi, 5, 5, 15)  // Ön Sağ

    // Göz ve Burun
    ctx.fillStyle = '#000'
    ctx.fillRect(20, -14, 2, 2)
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.fillRect(24, -12, 2, 2)

    // Yele
    ctx.fillStyle = '#2d1406'
    ctx.beginPath()
    ctx.moveTo(4, -4); ctx.lineTo(16, -18); ctx.lineTo(10, -18); ctx.lineTo(0, -6); ctx.fill()

    // Kuyruk
    ctx.beginPath()
    ctx.moveTo(-22, -4); ctx.lineTo(-32, 5 + bacakAcisi); ctx.lineTo(-24, 8); ctx.fill()

    // Jokey
    ctx.fillStyle = jokeyRenk
    // Gövde
    ctx.beginPath(); ctx.ellipse(-5, -12, 6, 8, 0.2, 0, Math.PI * 2); ctx.fill()
    // Baş (Kask)
    ctx.fillStyle = 'white'
    ctx.beginPath(); ctx.arc(-2, -22, 5, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#000' // Vizör
    ctx.fillRect(-1, -24, 4, 3)

    ctx.restore()

    // İsim etiketi (Altında)
    ctx.fillStyle = 'rgba(0,0,0,0.7)'
    const metinG = 40
    ctx.fillRect(x - 25, y + 25, 40, 12)
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 8px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(isim.slice(0, 10), x - 5, y + 34)
}

export default function HorseRace({ atlar = [], onYarisBitti }) {
    const { address } = useAccount()
    const canvasRef = useRef(null)
    const rafRef = useRef(null)
    const kareRef = useRef(0)
    const bgOffsetRef = useRef(0)
    const [sohbet, setSohbet] = useState('')
    const [sohbetLog, setSohbetLog] = useState([])
    const [bitis, setBitis] = useState(null)
    const [kalan, setKalan] = useState(60)
    const timerRef = useRef(null)
    const baslangicRef = useRef(Date.now())

    const { atSohbetGonder, atTesvik, atKonumlar, atDuygular, atCevaplar } = useGameStore()
    const benimAtim = atlar.find(a => a.playerAddress === address)

    // Zamanlayıcı
    useEffect(() => {
        baslangicRef.current = Date.now()
        timerRef.current = setInterval(() => {
            const gecen = Math.floor((Date.now() - baslangicRef.current) / 1000)
            const k = Math.max(0, 60 - gecen)
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
        const viewW = canvas.clientWidth, viewH = canvas.clientHeight
        canvas.width = viewW; canvas.height = viewH

        const Y_SPACING = (viewH - 120) / atlar.length

        const loop = () => {
            kareRef.current++
            bgOffsetRef.current += 1.5 // Arka plan kayma hızı
            ctx.clearRect(0, 0, viewW, viewH)

            // 1. Gökyüzü ve Uzak Arka Plan (Sabit)
            const grad = ctx.createLinearGradient(0, 0, 0, viewH)
            grad.addColorStop(0, '#87CEEB'); grad.addColorStop(1, '#E0F6FF')
            ctx.fillStyle = grad; ctx.fillRect(0, 0, viewW, viewH)

            // Bulutlar Parallax
            ctx.fillStyle = 'rgba(255,255,255,0.7)'
            const cloudOffset = (bgOffsetRef.current * 0.2) % viewW
            for (let i = 0; i < 3; i++) {
                ctx.beginPath(); ctx.arc((i * 300 - cloudOffset + viewW) % viewW, 40 + (i % 2) * 20, 30, 0, Math.PI * 2); ctx.fill()
                ctx.beginPath(); ctx.arc((i * 300 - cloudOffset + viewW) % viewW + 30, 40 + (i % 2) * 20, 20, 0, Math.PI * 2); ctx.fill()
                ctx.beginPath(); ctx.arc((i * 300 - cloudOffset + viewW) % viewW - 20, 45 + (i % 2) * 20, 25, 0, Math.PI * 2); ctx.fill()
            }

            // 2. Uzak Ağaçlar Parallax
            const treeOffset = (bgOffsetRef.current * 0.5) % 100
            for (let x = -treeOffset; x < viewW; x += 100) {
                ctx.fillStyle = '#228B22'
                ctx.beginPath(); ctx.moveTo(x + 20, 80); ctx.lineTo(x + 50, 20); ctx.lineTo(x + 80, 80); ctx.fill()
                ctx.fillStyle = '#1e751e'
                ctx.beginPath(); ctx.moveTo(x + 50, 20); ctx.lineTo(x + 80, 80); ctx.lineTo(x + 50, 80); ctx.fill()
                ctx.fillStyle = '#4a2511'
                ctx.fillRect(x + 45, 80, 10, 20)
            }

            // 3. Zemin Çimenleri
            ctx.fillStyle = '#32CD32'
            ctx.fillRect(0, 100, viewW, viewH - 100)

            // Hızlı geçen zemin çizgileri (hız hissi)
            ctx.fillStyle = '#228B22'
            const lineOffset = bgOffsetRef.current % 40
            for (let y = 120; y < viewH; y += 30) {
                for (let x = -lineOffset; x < viewW; x += 80) {
                    ctx.fillRect(x, y, 20 + Math.random() * 20, 2)
                }
            }

            // Bitiş Çizgisi Hedefi
            const finishLineX = viewW - 100
            if (kalan < 50 || atlar.some(a => (atKonumlar?.[a.playerAddress]?.position ?? 0) > 80)) {
                ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.setLineDash([10, 10])
                ctx.beginPath(); ctx.moveTo(finishLineX, 100); ctx.lineTo(finishLineX, viewH); ctx.stroke()
                ctx.setLineDash([])
            }

            // Atları çiz (Side view dizilişi)
            // Y pozisyonlarını sıralamaya göre biraz dağıt ki üst üste binmesinler
            const sortedHorses = [...atlar].sort((a, b) => {
                const posA = atKonumlar?.[a.playerAddress]?.position ?? a.position ?? 0
                const posB = atKonumlar?.[b.playerAddress]?.position ?? b.position ?? 0
                return posA - posB // arkadan öne çiz (z-index)
            })

            sortedHorses.forEach((at) => {
                const i = atlar.findIndex(a => a.playerAddress === at.playerAddress)
                const pos = atKonumlar?.[at.playerAddress]?.position ?? at.position ?? 0
                const duygu = atDuygular?.[at.playerAddress] ?? 'neutral'

                // Y ekseni şerit dizilimi: 120'den başlayıp aşağı doğru
                const yPos = 130 + (i * Y_SPACING)

                // X ekseni: pos'a göre
                // Bitiş çizgisi viewW - 100'de. %100 orada olacak şekilde ayarla.
                const atX = 50 + (pos / 100) * (finishLineX - 50)

                const bitmis = atKonumlar?.[at.playerAddress]?.finished || false
                const isMe = at.playerAddress === address
                const atRengi = AT_RENK[at.personality] || '#8B4513'
                const jokeyRengi = JOKEY_RENK[i % 8]

                // Vurgu hale
                if (isMe) {
                    ctx.fillStyle = 'rgba(251, 191, 36, 0.3)'
                    ctx.beginPath(); ctx.ellipse(atX - 5, yPos + 20, 30, 8, 0, 0, Math.PI * 2); ctx.fill()
                }

                atCiz(ctx, atX, yPos, atRengi, jokeyRengi, duygu, bitmis ? 0 : kareRef.current, at.name, bitmis)
            })

            rafRef.current = requestAnimationFrame(loop)
        }
        rafRef.current = requestAnimationFrame(loop)
        return () => cancelAnimationFrame(rafRef.current)
    }, [atlar, atKonumlar, atDuygular, address, kalan])

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
