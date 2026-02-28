import { create } from 'zustand'
import { io } from 'socket.io-client'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

const useGameStore = create((set, get) => ({
    // ─── Bağlantı & Oda ───────────────────────────────────────────────────────
    socket: null,
    baglandi: false,
    odaId: null,
    odaVeri: null,
    oyuncular: [],
    benimAdresim: null,
    oyunDurumu: 'bosta', // 'bosta'|'bekliyor'|'oyunda'|'bitti'
    hostMu: false,
    sohbetler: [],
    hata: null,

    // ─── Harita Durumu ────────────────────────────────────────────────────────
    boardState: null,
    boardFaz: 'bosta',     // 'initial_roll'|'zar'|'mini_game'|'bitti'
    karoTipleri: [],
    kasaTileId: null,
    sonZar: null,
    etkinlikKaydi: [],
    oyunBitti: null,
    ilkZarAtildimi: false,

    // ─── At Yarışı ────────────────────────────────────────────────────────────
    atYarisiAktif: false,
    atlar: [],
    atKonumlar: {},
    atDuygular: {},
    atCevaplar: [],
    miniGameOduller: null,

    // ─── Socket Başlat ────────────────────────────────────────────────────────
    socketBaslat: (adres) => {
        const mevcut = get().socket
        if (mevcut?.connected) { set({ benimAdresim: adres }); return }

        const socket = io(BACKEND_URL, { transports: ['websocket', 'polling'], reconnectionAttempts: 8, reconnectionDelay: 2000 })

        socket.on('connect', () => set({ baglandi: true, hata: null }))
        socket.on('disconnect', () => set({ baglandi: false }))
        socket.on('connect_error', () => set({ hata: 'Sunucuya bağlanılamıyor.' }))

        // ── Oda Olayları ──────────────────────────────────────────────────────
        socket.on('room-created', ({ roomId, room }) =>
            set({ odaId: roomId, odaVeri: room, oyuncular: room.oyuncular || [], oyunDurumu: 'bekliyor', hostMu: true }))
        socket.on('joined-room', ({ roomId, room }) =>
            set({ odaId: roomId, odaVeri: room, oyuncular: room.oyuncular || [], oyunDurumu: 'bekliyor', hostMu: room.host === adres }))
        socket.on('oda-guncellendi', (room) =>
            set({ odaVeri: room, oyuncular: room.oyuncular || [], hostMu: room.host === adres }))
        socket.on('room-list', (liste) => set({ acikOdalar: liste }))
        socket.on('host-degisti', ({ yeniHost }) => set({ hostMu: yeniHost === adres }))

        // ── Oyun Olayları ─────────────────────────────────────────────────────
        socket.on('oyun-basladi', ({ oyuncular, durum, faz }) => {
            set({
                oyuncular,
                oyunDurumu: 'oyunda',
                boardState: durum,
                boardFaz: faz || 'initial_roll',
                karoTipleri: durum?.karoTipleri || [],
                kasaTileId: durum?.kasaTileId ?? null,
                etkinlikKaydi: [],
                oyunBitti: null,
                atYarisiAktif: false,
                sonZar: null,
                ilkZarAtildimi: false,
                miniGameOduller: null,
            })
        })

        socket.on('initial-roll-result', ({ adres: addr, siraBelirli, durum, mesaj }) => {
            set(state => ({
                boardState: durum || state.boardState,
                boardFaz: siraBelirli ? 'zar' : 'initial_roll',
                kasaTileId: durum?.kasaTileId ?? state.kasaTileId,
                etkinlikKaydi: mesaj ? [...(state.etkinlikKaydi || []).slice(-12), mesaj] : state.etkinlikKaydi,
                ilkZarAtildimi: addr === state.benimAdresim ? true : state.ilkZarAtildimi,
            }))
        })

        socket.on('board-guncellendi', ({ durum }) => {
            if (durum) set({ boardState: durum, boardFaz: durum.faz, kasaTileId: durum.kasaTileId })
        })

        socket.on('zar-atildi', ({ adres: addr, zar, toplam, yeniKonum, etki, durum, mesaj }) => {
            set(state => ({
                boardState: durum,
                boardFaz: durum?.faz || state.boardFaz,
                kasaTileId: durum?.kasaTileId ?? state.kasaTileId,
                sonZar: Array.isArray(zar) ? zar : [zar || 1, 0],
                etkinlikKaydi: mesaj ? [...(state.etkinlikKaydi || []).slice(-12), mesaj] : state.etkinlikKaydi,
            }))
        })

        socket.on('oyun-bitti', ({ kazanan, durum }) =>
            set({ oyunBitti: { kazanan, durum }, atYarisiAktif: false }))

        // ── At Yarışı ─────────────────────────────────────────────────────────
        socket.on('at-yarisi-basladi', ({ atlar }) =>
            set({ atYarisiAktif: true, atlar, atKonumlar: {}, atDuygular: {}, atCevaplar: [], miniGameOduller: null }))

        socket.on('at-konumlar', ({ atlar }) => {
            const konumlar = {}, duygular = {}
            atlar.forEach(a => {
                konumlar[a.playerAddress] = { position: a.position, finished: a.finished }
                duygular[a.playerAddress] = a.emotion || 'neutral'
            })
            set({ atKonumlar: konumlar, atDuygular: duygular })
        })

        socket.on('at-duygu', ({ playerAddress, duygu }) =>
            set(s => ({ atDuygular: { ...s.atDuygular, [playerAddress]: duygu } })))

        socket.on('at-cevap', (cevapVeri) =>
            set(s => ({ atCevaplar: [...s.atCevaplar.slice(-15), cevapVeri] })))

        socket.on('at-sohbet-gonderildi', (data) =>
            set(s => ({ atCevaplar: [...s.atCevaplar.slice(-15), data] })))

        socket.on('at-yarisi-bitti', ({ kazanan }) =>
            setTimeout(() => set({ atYarisiAktif: false }), 3000))

        socket.on('mini-game-oduller', ({ oduller, durum }) => {
            set({ miniGameOduller: oduller, boardState: durum, boardFaz: durum?.faz })
        })

        // ── Sohbet & Hata ─────────────────────────────────────────────────────
        socket.on('sohbet-mesaji', (msg) =>
            set(s => ({ sohbetler: [...s.sohbetler.slice(-99), msg] })))

        socket.on('hata', ({ mesaj }) => {
            set({ hata: mesaj })
            setTimeout(() => set({ hata: null }), 5000)
        })
        // Backend'den gelen eski 'error' event de yakala
        socket.on('error', ({ message }) => {
            set({ hata: message })
            setTimeout(() => set({ hata: null }), 5000)
        })

        set({ socket, benimAdresim: adres })
    },

    // ─── Eylemler ─────────────────────────────────────────────────────────────
    odaOlustur: (adres, odaAdi, gizli) =>
        get().socket?.emit('create-room', { walletAddress: adres, roomName: odaAdi, isPrivate: gizli }),
    odayaKatil: (odaId, adres) =>
        get().socket?.emit('join-room', { roomId: odaId, walletAddress: adres }),
    hizliEslesmek: (adres) =>
        get().socket?.emit('quick-match', { walletAddress: adres }),
    hazirOl: (adres, hazir) =>
        get().socket?.emit('player-ready', { walletAddress: adres, isReady: hazir }),
    oyunuBaslat: (adres) =>
        get().socket?.emit('start-game', { walletAddress: adres }),
    botEkle: (adres) =>
        get().socket?.emit('add-bot', { walletAddress: adres }),
    ilkZarAt: (adres) => {
        get().socket?.emit('initial-roll', { walletAddress: adres })
        set({ ilkZarAtildimi: true })
    },
    zarAt: (adres) =>
        get().socket?.emit('roll-dice', { walletAddress: adres }),
    sohbetGonder: (adres, mesaj) =>
        get().socket?.emit('chat-message', { walletAddress: adres, message: mesaj }),
    atSohbetGonder: (adres, mesaj) =>
        get().socket?.emit('at-sohbet', { walletAddress: adres, mesaj }),
    atTesvik: (adres) =>
        get().socket?.emit('at-tesvik', { walletAddress: adres }),
    atYarisiSonucGonder: (siralama) =>
        get().socket?.emit('at-yarisi-sonuc', { siralama }),
    secimYap: (adres, secilenYolId) =>
        get().socket?.emit('choose-branch', { walletAddress: adres, secilenYolId }),
    chooseBranch: (adres, secilenYolId) =>
        get().socket?.emit('choose-branch', { walletAddress: adres, secilenYolId }),
    odaListesi: () =>
        get().socket?.emit('room-list'),
    odayiTerk: (adres) => {
        get().socket?.emit('leave-room', { walletAddress: adres })
        set({
            odaId: null, odaVeri: null, oyuncular: [], oyunDurumu: 'bosta',
            boardState: null, boardFaz: 'bosta', karoTipleri: [], kasaTileId: null,
            sonZar: null, etkinlikKaydi: [], oyunBitti: null,
            atYarisiAktif: false, atlar: [], atKonumlar: {}, atDuygular: {}, atCevaplar: [],
            hostMu: false, sohbetler: [], hata: null, ilkZarAtildimi: false, miniGameOduller: null,
        })
    },
    hataTemizle: () => set({ hata: null }),

    // ─── İngilizce Uyumluluk Fonksiyon Alias'ları ─────────────────────────────
    initSocket: (adres) => get().socketBaslat(adres),
    createRoom: (adres, isim, gizli) => get().odaOlustur(adres, isim, gizli),
    joinRoom: (odaId, adres) => get().odayaKatil(odaId, adres),
    quickMatch: (adres) => get().hizliEslesmek(adres),
    requestRoomList: () => get().odaListesi(),
    setReady: (adres, hazir) => get().hazirOl(adres, hazir),
    startGame: (adres) => get().oyunuBaslat(adres),
    addBot: (adres) => get().botEkle(adres),
    rollDice: (adres) => get().zarAt(adres),
    initialRoll: (adres) => get().ilkZarAt(adres),
    sendChat: (adres, mesaj) => get().sohbetGonder(adres, mesaj),
    sendHorseChat: (adres, mesaj) => get().atSohbetGonder(adres, mesaj),
    encourageHorse: (adres) => get().atTesvik(adres),
    leaveRoom: (adres) => get().odayiTerk(adres),
    clearError: () => set({ hata: null }),
}))

// ─── State Field Alias Selectors ──────────────────────────────────────────────
// These allow old English field names to work with useGameStore()
let _syncing = false
useGameStore.subscribe((state) => {
    if (_syncing) return
    // Keep English aliases in sync as computed values
    const patch = {
        connected: state.baglandi,
        error: state.hata,
        roomId: state.odaId,
        players: state.oyuncular,
        gameStatus: state.oyunDurumu,
        chatMessages: state.sohbetler,
        isHost: state.hostMu,
        roomData: state.odaVeri,
        horseRaceActive: state.atYarisiAktif,
        horses: state.atlar,
        horsePositions: state.atKonumlar,
        horseEmotions: state.atDuygular,
        horseReplies: state.atCevaplar,
        boardGameOver: state.oyunBitti,
        lastDice: state.sonZar,
        tileLog: state.etkinlikKaydi,
        tiles: state.karoTipleri,
        myInitialRolled: state.ilkZarAtildimi,
        boardPhase: state.boardFaz,
        currentPlayer: state.boardState?.mevcutOyuncu,
        acikOdalar: state.acikOdalar || [],
    }
    // Only update if values changed to avoid infinite loop
    const current = useGameStore.getState()
    const needsUpdate = Object.keys(patch).some(k => current[k] !== patch[k])
    if (needsUpdate) {
        _syncing = true
        useGameStore.setState(patch) // merge (no second arg = false = merge)
        _syncing = false
    }
})

export default useGameStore
