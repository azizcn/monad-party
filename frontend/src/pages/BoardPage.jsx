import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { motion, AnimatePresence } from 'framer-motion'
import useGameStore from '../store/gameStore'
import Board from '../components/Board'
import HorseRace from '../components/HorseRace'

const OYUNCU_RENK = ['#7c3aed', '#06b6d4', '#fbbf24', '#ec4899', '#10b981', '#f97316', '#3b82f6', '#ef4444']

// Zar Animasyon Overlay
function DiceAnimation({ dice, visible }) {
    const FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅']
    return (
        <AnimatePresence>
            {visible && dice?.length === 2 && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.3 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.3 }}
                    transition={{ type: 'spring', bounce: 0.5, duration: 0.5 }}
                    style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        justifyContent: 'center', zIndex: 9999, pointerEvents: 'none',
                    }}
                >
                    <motion.div
                        style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', background: 'rgba(0,0,0,0.75)', padding: '2rem 3rem', borderRadius: 24, border: '2px solid rgba(251,191,36,0.6)', backdropFilter: 'blur(10px)' }}
                    >
                        {dice.map((d, i) => (
                            <motion.div
                                key={i}
                                initial={{ rotateX: 720 + (i * 180), rotateY: 720, scale: 0.5 }}
                                animate={{ rotateX: 0, rotateY: 0, scale: 1 }}
                                transition={{ duration: 0.6, delay: i * 0.12, type: 'spring', bounce: 0.4 }}
                                style={{
                                    width: 72, height: 72,
                                    background: 'linear-gradient(135deg,#7c3aed,#4c1d95)',
                                    border: '3px solid rgba(124,58,237,0.8)',
                                    borderRadius: 16,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '2.4rem',
                                    boxShadow: '0 0 30px rgba(124,58,237,0.7)',
                                }}
                            >
                                {FACES[d - 1]}
                            </motion.div>
                        ))}
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.5 }}
                            style={{
                                width: 72, height: 72,
                                background: 'rgba(251,191,36,0.2)',
                                border: '3px solid rgba(251,191,36,0.7)',
                                borderRadius: 16,
                                display: 'flex', flexDirection: 'column', alignItems: 'center',
                                justifyContent: 'center', color: '#fbbf24', fontWeight: 900,
                                fontSize: '1.6rem', boxShadow: '0 0 20px rgba(251,191,36,0.5)',
                            }}
                        >
                            {dice.reduce((a, b) => a + b, 0)}
                        </motion.div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

export default function BoardPage() {
    const { roomId } = useParams()
    const navigate = useNavigate()
    const { address } = useAccount()
    const [hazirmiyim, setHazirmiyim] = useState(false)
    const [zarAnimasyon, setZarAnimasyon] = useState(false)
    const [zarGoster, setZarGoster] = useState(false)
    const [sohbet, setSohbet] = useState('')
    const sohbetRef = useRef(null)

    const {
        oyuncular, oyunDurumu, boardState, boardFaz, karoTipleri, kasaTileId,
        hostMu, sohbetler, sohbetGonder, hazirOl, oyunuBaslat,
        odayiTerk, botEkle, zarAt, ilkZarAt, atlar, atYarisiAktif,
        oyunBitti, baglandi, odaVeri, sonZar, etkinlikKaydi,
        ilkZarAtildimi, miniGameOduller, atYarisiSonucGonder, socketBaslat, hata,
        secimYap,
    } = useGameStore()

    useEffect(() => {
        if (address) socketBaslat(address)
    }, [address, socketBaslat])

    useEffect(() => {
        if (sohbetRef.current) sohbetRef.current.scrollTop = sohbetRef.current.scrollHeight
    }, [sohbetler])

    // Zar göster/gizle
    useEffect(() => {
        if (sonZar?.length === 2) {
            setZarGoster(true)
            const t = setTimeout(() => setZarGoster(false), 2500)
            return () => clearTimeout(t)
        }
    }, [sonZar])

    const isBranchPhase = boardFaz === 'branch_choice' || boardState?.faz === 'branch_choice'
    const benimSiram = boardState?.mevcutOyuncu === address && oyunDurumu === 'oyunda' && (boardFaz === 'zar') && !atYarisiAktif && !isBranchPhase
    const ilkZarFazi = (boardFaz === 'initial_roll' || boardState?.faz === 'initial_roll') && !ilkZarAtildimi

    const handleZar = () => {
        if (!benimSiram || zarAnimasyon) return
        setZarAnimasyon(true)
        zarAt(address)
        setTimeout(() => setZarAnimasyon(false), 1200)
    }
    const handleIlkZar = () => {
        if (ilkZarAtildimi || zarAnimasyon) return
        setZarAnimasyon(true)
        ilkZarAt(address)
        setTimeout(() => setZarAnimasyon(false), 1200)
    }
    const handleSohbet = (e) => {
        e.preventDefault()
        if (!sohbet.trim()) return
        sohbetGonder(address, sohbet.trim()); setSohbet('')
    }
    const handleCik = () => { odayiTerk(address); navigate('/') }
    const handleAtYarisiSonuc = (siralama) => { atYarisiSonucGonder(siralama) }
    const handleBranchChoice = (secilenYolId) => {
        secimYap(address, secilenYolId)
    }

    const hazirSayisi = oyuncular.filter(p => p.hazir || p.bot).length
    const baslayabilir = hostMu && oyuncular.length >= 1 && oyunDurumu === 'bekliyor'
    const botEklenebilir = hostMu && oyuncular.length < (odaVeri?.maxOyuncu || 8) && oyunDurumu === 'bekliyor'

    // ─── Oyun Bitti ──────────────────────────────────────────────────────────────
    if (oyunBitti) {
        return (
            <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)', gap: '2rem', overflow: 'hidden' }}>
                {Array.from({ length: 60 }).map((_, i) => (
                    <motion.div key={i} style={{ position: 'fixed', top: -20, left: `${Math.random() * 100}%`, width: 10, height: 10, background: OYUNCU_RENK[i % 8], borderRadius: i % 2 ? '50%' : 2 }}
                        animate={{ y: '110vh', rotate: Math.random() * 720, x: Math.random() * 200 - 100 }}
                        transition={{ duration: 2 + Math.random() * 2, delay: Math.random() * 1.5 }} />
                ))}
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', bounce: 0.6 }} style={{ textAlign: 'center', zIndex: 10 }}>
                    <div style={{ fontSize: '4rem' }}>🏆</div>
                    <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '1.5rem', color: 'var(--color-yellow)', textShadow: '0 0 30px rgba(251,191,36,0.8)', marginBottom: '0.5rem' }}>
                        {oyunBitti.kazanan === address ? '🎉 KAZANDIN!' : 'OYUN BİTTİ!'}
                    </div>
                    <div style={{ marginBottom: '2rem', color: 'var(--color-text-muted)' }}>
                        Şampiyon: <strong style={{ color: 'var(--color-yellow)' }}>{oyunBitti.kazanan?.slice(0, 12)}...</strong>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '2rem', minWidth: 360 }}>
                        {(oyunBitti.durum?.oyuncular || []).sort((a, b) => b.kasalar - a.kasalar).map((p, i) => (
                            <div key={p.adres} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--color-surface)', border: `1px solid ${p.adres === oyunBitti.kazanan ? 'rgba(251,191,36,0.5)' : 'var(--color-border)'}`, borderRadius: 10, padding: '0.6rem 1rem' }}>
                                <span style={{ fontSize: '1.2rem' }}>{['🥇', '🥈', '🥉'][i] || `${i + 1}.`}</span>
                                <span style={{ flex: 1, fontFamily: 'var(--font-orbitron)', fontSize: '0.75rem' }}>{p.isim}</span>
                                <span style={{ color: 'var(--color-yellow)' }}>🎁{p.kasalar}</span>
                                <span style={{ color: '#fbbf24' }}>🗝️{p.anahtar}</span>
                                <span>❤️{p.hp || 0}</span>
                                {p.silah && <span title={p.silah.isim}>{p.silah.ikon}</span>}
                            </div>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                        <motion.button className="btn btn-primary btn-lg" onClick={() => { odayiTerk(address); navigate('/lobby') }} whileHover={{ scale: 1.05 }}>🎮 Tekrar Oyna</motion.button>
                        <motion.button className="btn btn-ghost btn-lg" onClick={handleCik} whileHover={{ scale: 1.05 }}>🏠 Ana Menü</motion.button>
                    </div>
                </motion.div>
            </div>
        )
    }

    return (
        <div style={{
            position: 'fixed', inset: 0,
            display: 'grid',
            gridTemplateColumns: atYarisiAktif ? '1fr' : '1fr 290px',
            gridTemplateRows: 'auto 1fr',
            background: 'var(--color-bg)',
            overflow: 'hidden',
        }}>
            {/* Zar Animasyon Overlay */}
            <DiceAnimation dice={sonZar} visible={zarGoster} />

            {/* ── Üst Çubuk ── */}
            <div style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 1.2rem', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button className="btn btn-ghost btn-sm" onClick={handleCik}>← Çık</button>
                    <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.6rem', color: 'var(--color-purple-light)', letterSpacing: '0.15em' }}>🐴 MONAD PARTY</span>
                    {!import.meta.env.VITE_CONTRACT_ADDRESS && (
                        <div style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', borderRadius: 6, padding: '0.1rem 0.4rem', fontSize: '0.55rem', color: 'var(--color-green)' }}>🆓 ÜCRETSİZ</div>
                    )}
                </div>

                {/* Sıra göstergesi */}
                {oyunDurumu === 'oyunda' && boardState && !atYarisiAktif && (
                    <div style={{ fontFamily: 'var(--font-orbitron)', fontSize: '0.75rem' }}>
                        {ilkZarFazi ? (
                            <span style={{ color: 'var(--color-green)' }}>🎲 SIRA İÇİN ZAR AT</span>
                        ) : isBranchPhase && boardState?.mevcutOyuncu === address ? (
                            <span style={{ color: '#f59e0b' }}>⑂ YOL AYRIMI — Seçim Yap!</span>
                        ) : (
                            <span>Sıra: <strong style={{ color: boardState.mevcutOyuncu === address ? 'var(--color-yellow)' : 'var(--color-cyan-light)' }}>
                                {boardState.mevcutOyuncu === address ? '🎲 SENİN SIRAN' : `${boardState.oyuncular?.find(p => p.adres === boardState.mevcutOyuncu)?.isim || boardState.mevcutOyuncu?.slice(0, 8)}...`}
                            </strong></span>
                        )}
                    </div>
                )}
                {atYarisiAktif && (
                    <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.7rem', color: 'var(--color-yellow)' }}>🐴 AT YARIŞI BAŞLADI!</div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: baglandi ? 'var(--color-green)' : 'var(--color-red)' }} />
                    <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>{oyuncular.length} oyuncu</span>
                </div>
            </div>

            {/* ── Ana Alan ── */}
            <div style={{ overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' }}>

                {/* Hata mesajı */}
                <AnimatePresence>
                    {hata && (
                        <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }}
                            style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', zIndex: 100, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 8, padding: '0.5rem 1rem', fontSize: '0.8rem', color: '#fca5a5', whiteSpace: 'nowrap' }}>
                            ⚠️ {hata}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Lobi */}
                {oyunDurumu === 'bekliyor' && (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ textAlign: 'center', maxWidth: 560, padding: '2rem' }}>
                            <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.9rem', color: 'var(--color-purple-light)', marginBottom: '0.5rem' }}>🐴 MONAD PARTY BOARD OYUNU</div>
                            <div style={{ color: 'var(--color-text-muted)', marginBottom: '1rem', fontSize: '0.825rem' }}>
                                Zar at, haritada ilerle! Her tur sonunda at yarışı! 🎁 3 kasa açan kazanır!
                            </div>
                            <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '1.2rem' }}>
                                {[{ ikon: '🗝️', isim: 'Anahtar (+5)', renk: '#fbbf24' }, { ikon: '🎁', isim: 'Kasa (40 🗝️)', renk: '#a78bfa' }, { ikon: '💀', isim: 'Tuzak (-20 HP)', renk: '#f87171' }, { ikon: '❤️', isim: 'Şifa (+20 HP)', renk: '#86efac' }, { ikon: '🎲', isim: 'At Yarışı', renk: '#60a5fa' }].map(t => (
                                    <div key={t.ikon} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'var(--color-surface)', border: `1px solid ${t.renk}40`, borderRadius: 6, padding: '0.2rem 0.5rem', fontSize: '0.65rem' }}>
                                        {t.ikon} <span style={{ color: t.renk }}>{t.isim}</span>
                                    </div>
                                ))}
                            </div>
                            <div style={{ fontSize: '1.2rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>{hazirSayisi}/{oyuncular.length} hazır</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', alignItems: 'center' }}>
                                <div style={{ display: 'flex', gap: '0.6rem' }}>
                                    <motion.button
                                        className={`btn btn-lg ${hazirmiyim ? 'btn-danger' : ''}`}
                                        style={{ background: hazirmiyim ? undefined : 'linear-gradient(135deg,var(--color-green),#34d399)', color: hazirmiyim ? undefined : '#000' }}
                                        onClick={() => { const n = !hazirmiyim; setHazirmiyim(n); hazirOl(address, n) }}
                                        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                        {hazirmiyim ? '❌ Hazır Değilim' : '✅ Hazırım'}
                                    </motion.button>
                                    {baslayabilir && (
                                        <motion.button className="btn btn-primary btn-lg" onClick={() => oyunuBaslat(address)} whileHover={{ scale: 1.05 }}>
                                            🎮 OYUNU BAŞLAT
                                        </motion.button>
                                    )}
                                </div>
                                {botEklenebilir && (
                                    <motion.button className="btn btn-primary" style={{ padding: '0.35rem 1rem', fontSize: '0.8rem' }} onClick={() => botEkle(address)} whileHover={{ scale: 1.05 }}>
                                        🤖 Bot Ekle
                                    </motion.button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Harita */}
                {oyunDurumu === 'oyunda' && !atYarisiAktif && (
                    <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                        <Board
                            karoTipleri={karoTipleri}
                            kasaTileId={kasaTileId}
                            boardState={boardState}
                            address={address}
                            onRollDice={handleZar}
                            onInitialRoll={handleIlkZar}
                            onChooseBranch={handleBranchChoice}
                            isMyTurn={benimSiram}
                            isInitialRollPhase={ilkZarFazi}
                            isBranchChoicePhase={isBranchPhase && boardState?.mevcutOyuncu === address}
                            sonZar={sonZar}
                            zarAnimasyon={zarAnimasyon}
                        />
                        {/* Son etkinlik log (float) */}
                        {etkinlikKaydi?.length > 0 && (
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                                style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.75)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '0.4rem 0.9rem', fontSize: '0.75rem', color: 'var(--color-text-muted)', backdropFilter: 'blur(8px)', whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 5 }}>
                                {etkinlikKaydi[etkinlikKaydi.length - 1]}
                            </motion.div>
                        )}
                    </div>
                )}

                {/* At Yarışı */}
                {oyunDurumu === 'oyunda' && atYarisiAktif && atlar?.length > 0 && (
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                        <HorseRace atlar={atlar} onYarisBitti={handleAtYarisiSonuc} />
                    </div>
                )}

                {/* Mini Game Ödülleri */}
                <AnimatePresence>
                    {miniGameOduller && !atYarisiAktif && (
                        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
                            style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'rgba(0,0,0,0.88)', border: '1px solid rgba(251,191,36,0.4)', borderRadius: 12, padding: '1.5rem', textAlign: 'center', minWidth: 320, zIndex: 50, backdropFilter: 'blur(12px)' }}>
                            <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.7rem', color: 'var(--color-yellow)', marginBottom: '0.75rem' }}>🏆 MİNİ OYUN SONUÇLARI</div>
                            {miniGameOduller.map((o, i) => (
                                <div key={o.adres} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.5rem', marginBottom: '0.3rem', background: 'var(--color-bg2)', borderRadius: 6 }}>
                                    <span>{['🥇', '🥈', '🥉'][i] || `${i + 1}.`}</span>
                                    <span style={{ flex: 1, fontSize: '0.75rem' }}>{o.adres?.slice(0, 10)}...</span>
                                    <span style={{ color: '#fbbf24', fontWeight: 700 }}>+{o.anahtar || 0} 🗝️</span>
                                </div>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* ── Sağ Panel ── */}
            {!atYarisiAktif && (
                <div style={{ background: 'var(--color-surface)', borderLeft: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
                    {/* Oyuncular */}
                    <div style={{ padding: '0.65rem', borderBottom: '1px solid var(--color-border)', overflowY: 'auto', maxHeight: '50%' }}>
                        <h3 style={{ fontFamily: 'var(--font-orbitron)', fontSize: '0.6rem', color: 'var(--color-text-muted)', letterSpacing: '0.15em', marginBottom: '0.5rem' }}>OYUNCULAR</h3>
                        {oyuncular.map((p, i) => {
                            const bp = boardState?.oyuncular?.find(o => o.adres === p.adres)
                            const siradam = boardState?.mevcutOyuncu === p.adres && oyunDurumu === 'oyunda'
                            return (
                                <div key={p.adres} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.5rem', marginBottom: '0.2rem', background: siradam ? 'rgba(251,191,36,0.1)' : 'var(--color-bg2)', border: `1px solid ${siradam ? 'rgba(251,191,36,0.4)' : 'var(--color-border)'}`, borderRadius: 8, transition: 'all 0.2s' }}>
                                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: OYUNCU_RENK[i % 8], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', fontWeight: 700, flexShrink: 0 }}>
                                        {p.bot ? '🤖' : (p.adres?.slice(2, 4).toUpperCase() || '??')}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontFamily: 'var(--font-orbitron)', fontSize: '0.58rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {p.bot ? p.isim : `${p.adres?.slice(0, 6)}...`}
                                            {p.adres === address && <span style={{ color: 'var(--color-cyan-light)', marginLeft: '0.25rem', fontSize: '0.5rem' }}>(sen)</span>}
                                            {siradam && <span style={{ color: 'var(--color-yellow)', marginLeft: '0.25rem' }}>🎲</span>}
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.35rem', fontSize: '0.53rem', color: 'var(--color-text-dim)', marginTop: '0.1rem' }}>
                                            <span>❤️{bp?.hp ?? 100}</span>
                                            <span>🗝️{bp?.anahtar ?? 0}</span>
                                            <span>🎁{bp?.kasalar ?? 0}</span>
                                            {bp?.silah && <span title={bp.silah.isim}>{bp.silah.ikon}</span>}
                                        </div>
                                    </div>
                                    {bp?.elendi && <span style={{ color: '#f87171', fontSize: '0.58rem' }}>Elendi</span>}
                                </div>
                            )
                        })}
                    </div>

                    {/* Sohbet */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '0.65rem' }}>
                        <h3 style={{ fontFamily: 'var(--font-orbitron)', fontSize: '0.6rem', color: 'var(--color-text-muted)', letterSpacing: '0.15em', marginBottom: '0.4rem' }}>SOHBET</h3>
                        <div ref={sohbetRef} style={{ flex: 1, overflowY: 'auto', marginBottom: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            {sohbetler.map((m, i) => (
                                <div key={i} style={{ fontSize: '0.68rem' }}>
                                    <span style={{ color: m.adres === 'SISTEM' ? 'var(--color-cyan-light)' : 'var(--color-purple-light)', fontWeight: 600 }}>
                                        {m.adres === 'SISTEM' ? '🔔' : m.adres?.slice(0, 6)}: </span>
                                    <span style={{ color: 'var(--color-text-muted)' }}>{m.mesaj}</span>
                                </div>
                            ))}
                        </div>
                        <form onSubmit={handleSohbet} style={{ display: 'flex', gap: '0.4rem' }}>
                            <input className="input" style={{ flex: 1, fontSize: '0.68rem', padding: '0.3rem 0.5rem' }} placeholder="Mesaj yaz..." value={sohbet} onChange={e => setSohbet(e.target.value)} maxLength={200} />
                            <button className="btn btn-primary btn-sm" type="submit">→</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
