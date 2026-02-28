/**
 * boardMapData.js
 * Dairesel yuvarlak harita yapısı — Pummel Party tarzı.
 * Ana yol: büyük elips yörüngesi (48 karo).
 * Dallanma noktaları: 3 ayrı kısa alternatif yol.
 * Karo tipleri: normal, anahtar, tuzak, heal, start
 */

// ─── Yardımcı: elips yörüngesi üstüne koordinat üret ──────────────────────────
function elipsNoktasi(cx, cy, rx, ry, angle) {
    return {
        x: Math.round(cx + rx * Math.cos(angle)),
        y: Math.round(cy + ry * Math.sin(angle)),
    }
}

// ─── Sabitler ─────────────────────────────────────────────────────────────────
const CX = 2400, CY = 1600           // Merkez
const RX = 2000, RY = 1300           // Ana elipsin yarıçapı
const ANA_KARO = 60                  // Ana halkadaki karo sayısı

// Karo tipi deseni
const _tip = ['normal', 'normal', 'anahtar', 'normal', 'tuzak', 'normal', 'heal', 'normal', 'anahtar', 'normal']

// ─── Grafik & Pozisyon Oluştur ────────────────────────────────────────────────
const graph = {}
const pos = {}

// Ana Halka: 0..59
for (let i = 0; i < ANA_KARO; i++) {
    const angle = (2 * Math.PI * i) / ANA_KARO - Math.PI / 2  // 12 saatten başla
    pos[i] = elipsNoktasi(CX, CY, RX, RY, angle)
    graph[i] = {
        id: i,
        tip: i === 0 ? 'start' : _tip[i % _tip.length],
        next: [(i + 1) % ANA_KARO],
    }
}

// ─── Dal 1: Karo 10'dan 18'e → 3 karo alternatif yol (üstten) ────────────────
// Dal karoları 60, 61, 62
const dal1Start = 10, dal1End = 18
const dal1Ids = [60, 61, 62]
graph[dal1Start].next.push(dal1Ids[0])  // Ayırım noktası

// Dal karo pozisyonları: Ana halkadan içeri doğru (kısayol)
const a10 = (2 * Math.PI * dal1Start) / ANA_KARO - Math.PI / 2
const a18 = (2 * Math.PI * dal1End) / ANA_KARO - Math.PI / 2
const d1mid = (a10 + a18) / 2

pos[60] = elipsNoktasi(CX, CY, RX * 0.72, RY * 0.72, d1mid - 0.15)
pos[61] = elipsNoktasi(CX, CY, RX * 0.6, RY * 0.6, d1mid)
pos[62] = elipsNoktasi(CX, CY, RX * 0.72, RY * 0.72, d1mid + 0.15)

graph[60] = { id: 60, tip: 'tuzak', next: [61] }
graph[61] = { id: 61, tip: 'anahtar', next: [62] }
graph[62] = { id: 62, tip: 'tuzak', next: [dal1End] }

// ─── Dal 2: Karo 25'ten 33'e → 3 karo alternatif yol (dışarı doğru) ──────────
const dal2Start = 25, dal2End = 33
const dal2Ids = [63, 64, 65]
graph[dal2Start].next.push(dal2Ids[0])

const a25 = (2 * Math.PI * dal2Start) / ANA_KARO - Math.PI / 2
const a33 = (2 * Math.PI * dal2End) / ANA_KARO - Math.PI / 2
const d2mid = (a25 + a33) / 2

pos[63] = elipsNoktasi(CX, CY, RX * 1.28, RY * 1.28, d2mid - 0.15)
pos[64] = elipsNoktasi(CX, CY, RX * 1.42, RY * 1.42, d2mid)
pos[65] = elipsNoktasi(CX, CY, RX * 1.28, RY * 1.28, d2mid + 0.15)

graph[63] = { id: 63, tip: 'heal', next: [64] }
graph[64] = { id: 64, tip: 'anahtar', next: [65] }
graph[65] = { id: 65, tip: 'heal', next: [dal2End] }

// ─── Dal 3: Karo 42'den 50'ye → 3 karo alternatif yol (kısa merkeze doğru) ───
const dal3Start = 42, dal3End = 50
const dal3Ids = [66, 67, 68]
graph[dal3Start].next.push(dal3Ids[0])

const a42 = (2 * Math.PI * dal3Start) / ANA_KARO - Math.PI / 2
const a50 = (2 * Math.PI * dal3End) / ANA_KARO - Math.PI / 2
const d3mid = (a42 + a50) / 2

pos[66] = elipsNoktasi(CX, CY, RX * 0.65, RY * 0.65, d3mid - 0.18)
pos[67] = elipsNoktasi(CX, CY, RX * 0.5, RY * 0.5, d3mid)
pos[68] = elipsNoktasi(CX, CY, RX * 0.65, RY * 0.65, d3mid + 0.18)

graph[66] = { id: 66, tip: 'tuzak', next: [67] }
graph[67] = { id: 67, tip: 'anahtar', next: [68] }
graph[68] = { id: 68, tip: 'heal', next: [dal3End] }

// ─── Sınır Kutusu ─────────────────────────────────────────────────────────────
let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
for (const id in pos) {
    if (pos[id].x < minX) minX = pos[id].x
    if (pos[id].y < minY) minY = pos[id].y
}

const margin = 300
for (const id in pos) {
    pos[id].x = pos[id].x - minX + margin
    pos[id].y = pos[id].y - minY + margin
    if (pos[id].x > maxX) maxX = pos[id].x
    if (pos[id].y > maxY) maxY = pos[id].y
}

export const KAROLAR_GRAPH = graph
export const KAROLAR_POSITIONS = pos
export const BOARD_WIDTH = maxX + margin
export const BOARD_HEIGHT = maxY + margin
export const TOPLAM_KARO = Object.keys(graph).length
