/**
 * socketHandlers.js v4 — Pummel Party Türkçe
 * Tur tabanlı mini game, dinamik kasa, silah ödülleri
 */
const { v4: uuidv4 } = require('uuid')
const {
    createBoardState, getBoardState, cleanupBoardState,
    initialRoll, zarAt, miniGameBitti, getSafeDurum, KARO_TIPLERI,
} = require('./boardEngine')
const { assignHorses, calculateSpeedModifier, generateHorseReply } = require('./horseAgent')

// ─── Rate limit ───────────────────────────────────────────────────────────────
const sonIslem = new Map()
function rateLimit(id, ms = 500) {
    const now = Date.now()
    if (now - (sonIslem.get(id) || 0) < ms) return false
    sonIslem.set(id, now); return true
}

// ─── At Yarışı ────────────────────────────────────────────────────────────────
const atYarislari = new Map()

function atYarisiBasla(io, roomId, oyuncular) {
    const atlar = assignHorses(oyuncular.filter(o => !o.elendi))
    const yarisState = { atlar, baslangic: Date.now(), bitti: false, kazanan: null, interval: null }
    atYarislari.set(roomId, yarisState)
    io.to(roomId).emit('at-yarisi-basladi', { atlar })

    yarisState.interval = setInterval(() => {
        const yaris = atYarislari.get(roomId)
        if (!yaris || yaris.bitti) return
        yaris.atlar.forEach(at => {
            if (at.finished) return
            let hiz = 1.3 + Math.random() * 0.5
            hiz *= at.speedModifier || 1.0
            if (at.personality === 'stubborn' && Math.random() < 0.12) hiz = -hiz * 0.2
            if (at.personality === 'lazy' && Math.random() < 0.08) hiz *= 0.05
            at.position = Math.min(100, Math.max(0, at.position + hiz))
            if (at.position >= 100 && !at.finished) {
                at.finished = true
                if (!yaris.kazanan) {
                    yaris.kazanan = at.playerAddress
                    io.to(roomId).emit('at-bitis', { adres: at.playerAddress, atIsim: at.name })
                }
            }
        })
        io.to(roomId).emit('at-konumlar', {
            atlar: yaris.atlar.map(a => ({ playerAddress: a.playerAddress, position: a.position, emotion: a.emotion, finished: a.finished }))
        })
        const hepsiBitti = yaris.atlar.every(a => a.finished) || (Date.now() - yaris.baslangic > 35000)
        if (hepsiBitti) {
            clearInterval(yaris.interval); yaris.bitti = true
            const w = yaris.kazanan || yaris.atlar.sort((a, b) => b.position - a.position)[0]?.playerAddress
            io.to(roomId).emit('at-yarisi-bitti', { kazanan: w })
        }
    }, 100)
    return atlar
}

function atYarisiDurdur(roomId) {
    const r = atYarislari.get(roomId)
    if (r?.interval) clearInterval(r.interval)
    atYarislari.delete(roomId)
}

// ─── Yardımcılar ──────────────────────────────────────────────────────────────
function getOdaSeti(room) {
    return {
        roomId: room.roomId, odaAdi: room.odaAdi, host: room.host,
        oyuncular: room.oyuncular.map(p => ({ adres: p.address, isim: p.name, hazir: p.isReady, bot: p.isBot || false })),
        durum: room.durum, maxOyuncu: room.maxOyuncu, gizli: room.gizli,
    }
}
function yayinla(io, room) { io.to(room.roomId).emit('oda-guncellendi', getOdaSeti(room)) }

// ─── Ana Handler ──────────────────────────────────────────────────────────────
function setupSocketHandlers(io, rooms) {
    io.on('connection', (socket) => {
        let mevcutOdaId = null

        // ── Oda Oluştur ───────────────────────────────────────────────────────────
        socket.on('create-room', ({ walletAddress, roomName, isPrivate, txHash }) => {
            if (!walletAddress) return socket.emit('hata', { mesaj: 'Cüzdan adresi gerekli' })
            const roomId = uuidv4()
            const room = {
                roomId, odaAdi: roomName || `${walletAddress.slice(0, 6)}'nin Odası`,
                host: walletAddress,
                oyuncular: [{ address: walletAddress, name: walletAddress.slice(0, 8), socketId: socket.id, isReady: false, isBot: false }],
                durum: 'bekliyor', maxOyuncu: 8, gizli: !!isPrivate, olusturuldu: Date.now(), ozetler: [],
            }
            rooms.set(roomId, room)
            socket.join(roomId); mevcutOdaId = roomId
            socket.emit('room-created', { roomId, room: getOdaSeti(room) })
            socket.emit('joined-room', { roomId, room: getOdaSeti(room) })
            yayinla(io, room)
        })

        // ── Odaya Katıl ───────────────────────────────────────────────────────────
        socket.on('join-room', ({ roomId, walletAddress }) => {
            const room = rooms.get(roomId)
            if (!room) return socket.emit('hata', { mesaj: 'Oda bulunamadı' })
            if (room.durum !== 'bekliyor') return socket.emit('hata', { mesaj: 'Oyun başladı' })
            if (room.oyuncular.length >= room.maxOyuncu) return socket.emit('hata', { mesaj: 'Oda dolu' })
            const mevcut = room.oyuncular.find(p => p.address === walletAddress)
            if (mevcut) { mevcut.socketId = socket.id; socket.join(roomId); mevcutOdaId = roomId; return socket.emit('joined-room', { roomId, room: getOdaSeti(room) }) }
            room.oyuncular.push({ address: walletAddress, name: walletAddress.slice(0, 8), socketId: socket.id, isReady: false, isBot: false })
            socket.join(roomId); mevcutOdaId = roomId
            socket.emit('joined-room', { roomId, room: getOdaSeti(room) })
            yayinla(io, room)
        })

        // ── Hızlı Eşleşme ─────────────────────────────────────────────────────────
        socket.on('quick-match', ({ walletAddress }) => {
            let room = null
            for (const [, r] of rooms) { if (!r.gizli && r.durum === 'bekliyor' && r.oyuncular.length < r.maxOyuncu) { room = r; break } }
            if (!room) {
                const roomId = uuidv4()
                room = { roomId, host: walletAddress, odaAdi: `Hızlı #${roomId.slice(0, 4).toUpperCase()}`, oyuncular: [], durum: 'bekliyor', maxOyuncu: 8, gizli: false, olusturuldu: Date.now() }
                rooms.set(roomId, room)
            }
            if (!room.oyuncular.find(p => p.address === walletAddress)) room.oyuncular.push({ address: walletAddress, name: walletAddress.slice(0, 8), socketId: socket.id, isReady: false, isBot: false })
            socket.join(room.roomId); mevcutOdaId = room.roomId
            socket.emit('joined-room', { roomId: room.roomId, room: getOdaSeti(room) })
            yayinla(io, room)
        })

        // ── Bot Ekle ──────────────────────────────────────────────────────────────
        socket.on('add-bot', ({ walletAddress }) => {
            if (!mevcutOdaId) return
            const room = rooms.get(mevcutOdaId)
            if (!room || room.host !== walletAddress || room.durum !== 'bekliyor') return
            if (room.oyuncular.length >= room.maxOyuncu) return
            const kisiler = ['hothead', 'stubborn', 'lazy', 'gentle', 'competitive']
            const p = kisiler[Math.floor(Math.random() * kisiler.length)]
            const isimler = { hothead: 'Ateşli', stubborn: 'İnatçı', lazy: 'Tembel', gentle: 'Nazik', competitive: 'Hırslı' }
            const botId = `bot_${p.slice(0, 3)}_${Date.now().toString(36)}`
            room.oyuncular.push({ address: botId, name: `🤖${isimler[p]}Bot`, socketId: null, isReady: true, isBot: true, botKisilik: p })
            yayinla(io, room)
            io.to(mevcutOdaId).emit('sohbet-mesaji', { adres: 'SISTEM', mesaj: `🤖 ${isimler[p]}Bot katıldı! (${p} kişilik)`, zaman: Date.now() })
        })

        // ── Hazır ─────────────────────────────────────────────────────────────────
        socket.on('player-ready', ({ walletAddress, isReady }) => {
            if (!mevcutOdaId) return
            const room = rooms.get(mevcutOdaId)
            if (!room) return
            const p = room.oyuncular.find(p => p.address === walletAddress)
            if (p) { p.isReady = isReady; yayinla(io, room) }
        })

        // ── Oyunu Başlat ──────────────────────────────────────────────────────────
        socket.on('start-game', ({ walletAddress }) => {
            if (!mevcutOdaId) return
            const room = rooms.get(mevcutOdaId)
            if (!room || room.host !== walletAddress || room.durum !== 'bekliyor') return
            if (room.oyuncular.length < 1) return socket.emit('hata', { mesaj: 'En az 1 oyuncu gerekli' })
            room.durum = 'oyunda'
            const boardState = createBoardState(room.roomId, room.oyuncular)
            yayinla(io, room)
            io.to(room.roomId).emit('oyun-basladi', {
                oyuncular: room.oyuncular, durum: getSafeDurum(boardState), faz: 'initial_roll',
            })
            setTimeout(() => io.to(room.roomId).emit('sohbet-mesaji', { adres: 'SISTEM', mesaj: '🎲 Sıra belirlemek için zar atın!', zaman: Date.now() }), 1000)
        })

        // ── İlk Zar (sıra belirleme) ──────────────────────────────────────────────
        socket.on('initial-roll', ({ walletAddress }) => {
            if (!mevcutOdaId || !rateLimit(socket.id + 'init')) return
            const sonuc = initialRoll(mevcutOdaId, walletAddress)
            if (sonuc.hata) return socket.emit('hata', { mesaj: sonuc.hata })
            io.to(mevcutOdaId).emit('initial-roll-result', {
                adres: walletAddress, siraBelirli: sonuc.siraBelirli,
                durum: sonuc.durum, mesaj: sonuc.mesaj,
            })
            if (sonuc.siraBelirli) {
                io.to(mevcutOdaId).emit('board-guncellendi', { durum: sonuc.durum })
                setTimeout(() => botSirasiIsle(io, rooms, mevcutOdaId), 1500)
            }
        })

        // ── Zar At ────────────────────────────────────────────────────────────────
        socket.on('roll-dice', ({ walletAddress }) => {
            if (!mevcutOdaId || !rateLimit(socket.id + 'roll')) return
            const sonuc = zarAt(mevcutOdaId, walletAddress)
            if (sonuc.hata) return socket.emit('hata', { mesaj: sonuc.hata })
            io.to(mevcutOdaId).emit('zar-atildi', {
                adres: walletAddress, zar: sonuc.etki.zar, toplam: sonuc.etki.toplam,
                yeniKonum: sonuc.etki.yeniKonum, etki: sonuc.etki,
                durum: sonuc.durum, mesaj: sonuc.etki.mesaj,
            })
            if (sonuc.etki.miniGameBasla) {
                const room = rooms.get(mevcutOdaId)
                if (room) setTimeout(() => atYarisiBasla(io, mevcutOdaId, room.oyuncular), 3000)
            }
            if (sonuc.etki.kazanan) {
                setTimeout(() => io.to(mevcutOdaId).emit('oyun-bitti', { kazanan: sonuc.etki.kazanan, durum: sonuc.durum }), 1500)
            } else {
                setTimeout(() => botSirasiIsle(io, rooms, mevcutOdaId), 1800)
            }
        })

        // ── At Yarışı Sonuç ───────────────────────────────────────────────────────
        socket.on('at-yarisi-sonuc', ({ siralama }) => {
            // siralama: [{ adres }] birinciden sonuncuya
            if (!mevcutOdaId) return
            const yaris = atYarislari.get(mevcutOdaId)
            if (yaris) { clearInterval(yaris.interval); atYarislari.delete(mevcutOdaId) }
            const sonuc = miniGameBitti(mevcutOdaId, siralama)
            if (!sonuc) return
            io.to(mevcutOdaId).emit('mini-game-oduller', { oduller: sonuc.oduller, durum: sonuc.durum })
            setTimeout(() => {
                io.to(mevcutOdaId).emit('board-guncellendi', { durum: sonuc.durum })
                botSirasiIsle(io, rooms, mevcutOdaId)
            }, 3000)
        })

        // ── At Teşvik (SPACE) ─────────────────────────────────────────────────────
        socket.on('at-tesvik', ({ walletAddress }) => {
            const yaris = atYarislari.get(mevcutOdaId)
            if (!yaris) return
            const at = yaris.atlar.find(a => a.playerAddress === walletAddress)
            if (!at || at.finished) return
            const mod = calculateSpeedModifier(at.personality, 'git koş hızlan', {})
            at.speedModifier = mod.modifier; at.emotion = mod.emotion
            setTimeout(() => { if (at) at.speedModifier = 1.0 }, mod.duration || 2000)
            io.to(mevcutOdaId).emit('at-duygu', { playerAddress: walletAddress, duygu: mod.emotion })
        })

        // ── At Sohbet ─────────────────────────────────────────────────────────────
        socket.on('at-sohbet', async ({ walletAddress, mesaj }) => {
            const yaris = atYarislari.get(mevcutOdaId)
            if (!yaris) return
            const at = yaris.atlar.find(a => a.playerAddress === walletAddress)
            if (!at) return
            const sira = [...yaris.atlar].sort((a, b) => b.position - a.position)
            const rank = sira.findIndex(a => a.playerAddress === walletAddress)
            const mod = calculateSpeedModifier(at.personality, mesaj, { isLeading: rank === 0, isLast: rank === yaris.atlar.length - 1 })
            at.speedModifier = mod.modifier; at.emotion = mod.emotion
            setTimeout(() => { if (at) at.speedModifier = 1.0 }, mod.duration || 2500)
            socket.emit('at-sohbet-gonderildi', { adres: walletAddress, mesaj, atIsim: at.name, kisilik: at.personality, duygu: mod.emotion })
            socket.emit('at-duygu', { playerAddress: walletAddress, duygu: mod.emotion })
            io.to(mevcutOdaId).emit('at-duygu', { playerAddress: walletAddress, duygu: mod.emotion })
            const cevap = await generateHorseReply(at.personality, mesaj)
            socket.emit('at-cevap', { playerAddress: walletAddress, atIsim: at.name, cevap, duygu: mod.emotion })
        })

        // ── Sohbet ────────────────────────────────────────────────────────────────
        socket.on('chat-message', ({ walletAddress, message }) => {
            if (!mevcutOdaId) return
            io.to(mevcutOdaId).emit('sohbet-mesaji', { adres: walletAddress, mesaj: String(message).slice(0, 200), zaman: Date.now() })
        })
        socket.on('room-list', () => {
            const liste = []
            for (const [, r] of rooms) { if (!r.gizli && r.durum === 'bekliyor') liste.push({ roomId: r.roomId, odaAdi: r.odaAdi, oyuncuSayisi: r.oyuncular.length, maxOyuncu: r.maxOyuncu }) }
            socket.emit('room-list', liste)
        })
        socket.on('leave-room', ({ walletAddress }) => ayril(walletAddress))
        socket.on('disconnect', () => {
            sonIslem.delete(socket.id)
            if (mevcutOdaId) {
                const room = rooms.get(mevcutOdaId)
                const p = room?.oyuncular.find(q => q.socketId === socket.id)
                if (p && !p.isBot) { p.disconnected = true; setTimeout(() => { if (p.disconnected) ayril(p.address) }, 30000) }
            }
        })

        function ayril(adres) {
            if (!mevcutOdaId) return
            const room = rooms.get(mevcutOdaId)
            if (!room) return
            room.oyuncular = room.oyuncular.filter(p => p.address !== adres)
            if (!room.oyuncular.length) { cleanupBoardState(mevcutOdaId); atYarisiDurdur(mevcutOdaId); rooms.delete(mevcutOdaId); mevcutOdaId = null; return }
            if (room.host === adres) { room.host = room.oyuncular[0].address; io.to(mevcutOdaId).emit('host-degisti', { yeniHost: room.host }) }
            socket.leave(mevcutOdaId); yayinla(io, room); mevcutOdaId = null
        }
    })
}

// ─── Bot Otomatik Oynama ───────────────────────────────────────────────────────
function botSirasiIsle(io, rooms, roomId) {
    const board = getBoardState(roomId)
    if (!board || board.faz !== 'zar') return
    const mevcutOyuncu = board.oyuncular[board.tur]
    if (!mevcutOyuncu?.bot) return

    setTimeout(() => {
        const b = getBoardState(roomId)
        if (!b || b.faz !== 'zar') return
        const cp = b.oyuncular[b.tur]
        if (!cp?.bot) return
        const sonuc = zarAt(roomId, cp.adres)
        if (!sonuc.tamam) return
        io.to(roomId).emit('zar-atildi', {
            adres: cp.adres, zar: sonuc.etki.zar, toplam: sonuc.etki.toplam,
            yeniKonum: sonuc.etki.yeniKonum, etki: sonuc.etki,
            durum: sonuc.durum, mesaj: sonuc.etki.mesaj,
        })
        const botSohbetler = ['Hesaplıyorum... 🤖', 'Benim zar sıram!', 'Haydi!', 'Mükemmel strateji!']
        if (Math.random() < 0.35) io.to(roomId).emit('sohbet-mesaji', { adres: cp.adres, mesaj: botSohbetler[Math.floor(Math.random() * botSohbetler.length)], zaman: Date.now() })

        if (sonuc.etki.miniGameBasla) {
            const rm = rooms.get(roomId)
            if (rm) setTimeout(() => atYarisiBasla(io, roomId, rm.oyuncular), 3000)
        }
        if (sonuc.etki.kazanan) {
            setTimeout(() => io.to(roomId).emit('oyun-bitti', { kazanan: sonuc.etki.kazanan, durum: sonuc.durum }), 1500)
        } else {
            setTimeout(() => botSirasiIsle(io, rooms, roomId), 1800)
        }
    }, 1200 + Math.random() * 800)
}

module.exports = { setupSocketHandlers }
