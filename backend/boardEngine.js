/**
 * boardEngine.js v3 — Pummel Party Türkçe Edition
 * - 48 karo, doğa temalı yılan yol
 * - Anahtar sistemi: başlangıç 40, anahtar karolar +5, kasa açmak -40
 * - Dinamik kasa: tek kasa, oyunculardan en uzak karoyo spawn edilir
 * - Tur tabanlı mini game: herkes zar atınca mini game başlar
 * - Pummel Party silahları mini game ödülü
 */

// ─── Silahlar ─────────────────────────────────────────────────────────────────
const SILAHLAR = [
    { id: 'bumerang', isim: 'Bumerang', ikon: '🪃' },
    { id: 'bomba', isim: 'Bomba', ikon: '💣' },
    { id: 'sapan', isim: 'Sapan', ikon: '🎯' },
    { id: 'boks', isim: 'Boks Eldiveni', ikon: '🥊' },
    { id: 'sandvic', isim: 'Sandviç', ikon: '🥪' },
    { id: 'roket', isim: 'Roket Fırlatıcı', ikon: '🚀' },
    { id: 'cekic', isim: 'Çekiç', ikon: '🔨' },
    { id: 'kalkan', isim: 'Kalkan', ikon: '🛡️' },
    { id: 'yildirim', isim: 'Yıldırım', ikon: '⚡' },
    { id: 'buz', isim: 'Buz Topu', ikon: '🧊' },
    { id: 'miknatıs', isim: 'Mega Mıknatıs', ikon: '🧲' },
    { id: 'isınlanma', isim: 'Işınlanma', ikon: '✨' },
    { id: 'testere', isim: 'Döner Testere', ikon: '⚙️' },
    { id: 'top', isim: 'Dev Top', ikon: '💥' },
    { id: 'muz', isim: 'Kaygan Muz', ikon: '🍌' },
    { id: 'kanca', isim: 'Çelik Kanca', ikon: '🎣' },
    { id: 'degnek', isim: 'Sihirli Değnek', ikon: '🪄' },
    { id: 'iksir', isim: 'Can İksiri', ikon: '⚗️' },
    { id: 'ok', isim: 'Ok ve Yay', ikon: '🏹' },
    { id: 'el_bomba', isim: 'El Bombası', ikon: '💥' },
    { id: 'buz_tabanca', isim: 'Buz Tabancası', ikon: '🔫' },
    { id: 'lazer', isim: 'Lazer Tabanca', ikon: '🔆' },
    { id: 'tornado', isim: 'Tornado', ikon: '🌪️' },
    { id: 'kanguru', isim: 'Kanguru Zıplaması', ikon: '🦘' },
]

// ─── Board Karoları ────────────────────────────────────────────────────────────
// 48 karo, tipler: start | normal | anahtar | tuzak | heal | portal
const KARO_TIPLERI = [
    'start', 'normal', 'anahtar', 'normal', 'tuzak', 'anahtar', // 0-5
    'normal', 'normal', 'anahtar', 'tuzak', 'normal', 'heal',    // 6-11
    'normal', 'anahtar', 'tuzak', 'normal',              // 12-15   corner/col
    'normal', 'heal',              // 16-17   corner/col
    'normal', 'anahtar', 'tuzak', 'normal', 'anahtar', 'normal',  // 18-23
    'tuzak', 'anahtar', 'normal', 'anahtar', 'tuzak', 'normal',   // 24-29
    'heal', 'normal', 'anahtar', 'normal',             // 30-33   corner/col
    'normal', 'heal',              // 34-35   corner/col
    'normal', 'anahtar', 'tuzak', 'normal', 'anahtar', 'normal',  // 36-41
    'tuzak', 'anahtar', 'normal', 'normal', 'anahtar', 'normal',  // 42-47
]

const KARO_ISIMLER = {
    start: 'Başlangıç', normal: 'Normal', anahtar: '+5 Anahtar',
    tuzak: 'Tuzak', heal: 'Şifa', portal: 'Portal',
}

const TOPLAM_KARO = 48
const KASA_ANAHTAR = 40  // kasa açmak için gereken anahtar
const BASLANGGIC_ANAHTAR = 40
const KASA_KAZANMAK = 3  // kaç kasa açılınca kazanılır
const MAX_HP = 3

// ─── State ────────────────────────────────────────────────────────────────────
const boardStates = new Map()

function kasaSpawn(state) {
    // Tüm oyunculardan en uzak karo (Manhattan distance toplamı en büyük)
    let bestTile = 1, bestScore = 0
    for (let t = 1; t < TOPLAM_KARO; t++) {
        if (t === state.kasaTileId) continue
        const score = state.oyuncular.reduce((acc, o) => {
            const d = Math.abs(o.konum - t)
            return acc + Math.min(d, TOPLAM_KARO - d)
        }, 0)
        if (score > bestScore) { bestScore = score; bestTile = t }
    }
    state.kasaTileId = bestTile
    state.kasaAcikMi = false
}

function createBoardState(roomId, players) {
    const state = {
        roomId,
        faz: 'initial_roll',
        oyuncular: players.map((p, i) => ({
            adres: p.address,
            isim: p.name || p.address?.slice(0, 8),
            bot: p.isBot || false,
            konum: 0,
            kasalar: 0,
            anahtar: BASLANGGIC_ANAHTAR,
            hp: MAX_HP,
            elendi: false,
            renk: ['#7c3aed', '#06b6d4', '#fbbf24', '#ec4899', '#10b981', '#f97316', '#3b82f6', '#ef4444'][i % 8],
            initialRoll: null,
            silah: null,
        })),
        tur: 0,
        kazanan: null,
        sonZar: null,
        kayit: [],
        // Round tracking
        roundNo: 0,
        roundAtanlar: [],  // bu turda zar atan adresler
        // Chest
        kasaTileId: null,
        kasaAcikMi: false,
    }
    boardStates.set(roomId, state)
    // İlk kasa spawn
    kasaSpawn(state)
    return state
}

function getBoardState(roomId) { return boardStates.get(roomId) }
function cleanupBoardState(roomId) { boardStates.delete(roomId) }

// ─── İlk Zar (sıra belirleme) ─────────────────────────────────────────────────
function initialRoll(roomId, adres) {
    const state = boardStates.get(roomId)
    if (!state || state.faz !== 'initial_roll') return { hata: 'Yanlış faz' }
    const oyuncu = state.oyuncular.find(o => o.adres === adres)
    if (!oyuncu || oyuncu.initialRoll !== null) return { hata: 'Zaten attı' }

    const z1 = r6(), z2 = r6()
    oyuncu.initialRoll = z1 + z2
    state.kayit.push(`${oyuncu.isim} → ${z1}+${z2}=${z1 + z2}`)

    // Botları da at
    state.oyuncular.filter(o => o.bot && o.initialRoll === null).forEach(bot => {
        const b1 = r6(), b2 = r6(); bot.initialRoll = b1 + b2
        state.kayit.push(`${bot.isim} → ${b1}+${b2}=${b1 + b2}`)
    })

    const hepsAtmis = state.oyuncular.every(o => o.initialRoll !== null)
    if (hepsAtmis) {
        state.oyuncular.sort((a, b) => b.initialRoll - a.initialRoll)
        state.faz = 'zar'
        state.tur = 0
        state.roundAtanlar = []
        return {
            tamam: true, siraBelirli: true,
            mesaj: `Sıra belirlendi! ${state.oyuncular.map((o, i) => `${i + 1}. ${o.isim}(${o.initialRoll})`).join(' → ')}`,
            durum: getSafeDurum(state),
        }
    }
    return { tamam: true, siraBelirli: false, mesaj: `${oyuncu.isim} ${z1 + z2} attı`, durum: getSafeDurum(state) }
}

// ─── Zar At ───────────────────────────────────────────────────────────────────
function zarAt(roomId, adres) {
    const state = boardStates.get(roomId)
    if (!state || state.faz !== 'zar') return { hata: 'Yanlış faz: ' + state.faz }

    const mevcutOyuncu = state.oyuncular[state.tur]
    if (!mevcutOyuncu) return { hata: 'Oyuncu yok' }
    if (mevcutOyuncu.adres !== adres) return { hata: 'Senin sıran değil', mevcutSira: mevcutOyuncu.adres }

    const z1 = r6(), z2 = r6(), toplam = z1 + z2
    state.sonZar = [z1, z2]

    const eskiKonum = mevcutOyuncu.konum
    const yeniKonum = (eskiKonum + toplam) % TOPLAM_KARO
    mevcutOyuncu.konum = yeniKonum

    const karoTip = KARO_TIPLERI[yeniKonum]
    let etki = { tip: karoTip, zar: [z1, z2], toplam, eskiKonum, yeniKonum }

    // Karo efekti
    if (karoTip === 'anahtar') {
        mevcutOyuncu.anahtar += 5
        etki.mesaj = `🗝️ ${mevcutOyuncu.isim} ${z1}+${z2}=${toplam} attı → +5 Anahtar! (${mevcutOyuncu.anahtar} anahtar)`
    } else if (karoTip === 'tuzak') {
        mevcutOyuncu.hp = Math.max(0, mevcutOyuncu.hp - 1)
        etki.mesaj = `💀 ${mevcutOyuncu.isim} ${z1}+${z2}=${toplam} attı → TUZAK! -1 Can (${mevcutOyuncu.hp}/${MAX_HP})`
        if (mevcutOyuncu.hp <= 0) {
            mevcutOyuncu.elendi = true; etki.elendi = adres
            etki.mesaj += ` — ${mevcutOyuncu.isim} ELENDI!`
            const saglar = state.oyuncular.filter(o => !o.elendi)
            if (saglar.length === 1) { state.faz = 'bitti'; state.kazanan = saglar[0].adres; etki.kazanan = saglar[0].adres }
        }
    } else if (karoTip === 'heal') {
        mevcutOyuncu.hp = Math.min(MAX_HP, mevcutOyuncu.hp + 1)
        etki.mesaj = `❤️ ${mevcutOyuncu.isim} ${z1}+${z2}=${toplam} attı → ŞİFA! +1 Can (${mevcutOyuncu.hp}/${MAX_HP})`
    } else {
        etki.mesaj = `${mevcutOyuncu.isim} ${z1}+${z2}=${toplam} attı → ${KARO_ISIMLER[karoTip] || 'Normal'}`
    }

    // Kasa kontrolü: üzerinden geçiyor mu?
    if (yeniKonum === state.kasaTileId && mevcutOyuncu.anahtar >= KASA_ANAHTAR && !etki.kazanan) {
        mevcutOyuncu.anahtar -= KASA_ANAHTAR
        mevcutOyuncu.kasalar++
        etki.kasaAcildi = adres
        etki.mesaj += ` 🎁 KASA AÇILDI! (${mevcutOyuncu.kasalar}/${KASA_KAZANMAK})`
        if (mevcutOyuncu.kasalar >= KASA_KAZANMAK) {
            state.faz = 'bitti'; state.kazanan = adres; etki.kazanan = adres
        } else {
            kasaSpawn(state) // yeni kasa konumlan
        }
    }

    state.kayit.push(etki.mesaj)

    // Sıra ilerlet
    if (!etki.kazanan) {
        state.roundAtanlar.push(adres)
        const sagOyuncular = state.oyuncular.filter(o => !o.elendi)

        // Herkes bu turda attı mı?
        const hepsAtmis = sagOyuncular.every(o => state.roundAtanlar.includes(o.adres))
        if (hepsAtmis) {
            state.faz = 'mini_game'
            state.roundAtanlar = []
            state.roundNo++
            etki.miniGameBasla = true
            etki.mesaj += ' 🐴 Mini Game başlıyor!'
        } else {
            siradakiTuru(state)
        }
    }

    return { tamam: true, durum: getSafeDurum(state), etki }
}

// Mini game bitti
function miniGameBitti(roomId, sıralama) {
    // sıralama: [{ adres, puan }] — birinciden sonuncuya
    const state = boardStates.get(roomId)
    if (!state) return null

    const anahtarOdul = [20, 15, 10, 5, 0] // 1. 20 anahtar, 2. 15...

    sıralama.forEach(({ adres }, i) => {
        const oyuncu = state.oyuncular.find(o => o.adres === adres)
        if (!oyuncu) return
        const odul = anahtarOdul[i] || 0
        oyuncu.anahtar += odul
        // 1. ye silah
        if (i === 0) {
            oyuncu.silah = SILAHLAR[Math.floor(Math.random() * SILAHLAR.length)]
        }
        state.kayit.push(`${oyuncu.isim}: +${odul} anahtar${i === 0 ? ` + ${oyuncu.silah.ikon} ${oyuncu.silah.isim}` : ''}`)
    })

    state.faz = 'zar'
    siradakiTuru(state)

    return { durum: getSafeDurum(state), oduller: sıralama.map((s, i) => ({ ...s, anahtar: anahtarOdul[i] || 0 })) }
}

function siradakiTuru(state) {
    let next = (state.tur + 1) % state.oyuncular.length
    let tries = 0
    while (state.oyuncular[next]?.elendi && tries < state.oyuncular.length) {
        next = (next + 1) % state.oyuncular.length; tries++
    }
    state.tur = next
}

function getSafeDurum(state) {
    return {
        oyuncular: state.oyuncular,
        tur: state.tur,
        mevcutOyuncu: state.oyuncular.filter(o => !o.elendi)[0]?.adres || state.oyuncular[state.tur]?.adres,
        faz: state.faz,
        kazanan: state.kazanan,
        sonZar: state.sonZar,
        kayit: state.kayit.slice(-15),
        karoTipleri: KARO_TIPLERI,
        kasaTileId: state.kasaTileId,
        roundNo: state.roundNo,
        roundAtanlar: state.roundAtanlar,
    }
}

function r6() { return Math.floor(Math.random() * 6) + 1 }

module.exports = {
    KARO_TIPLERI, KARO_ISIMLER, SILAHLAR, TOPLAM_KARO, KASA_ANAHTAR, KASA_KAZANMAK, MAX_HP, BASLANGGIC_ANAHTAR,
    createBoardState, getBoardState, cleanupBoardState,
    initialRoll, zarAt, miniGameBitti, getSafeDurum,
}
