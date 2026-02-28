/**
 * boardMapData.js v2
 * Dairesel yuvarlak harita yapısı — Pummel Party tarzı.
 * Ana yol: büyük elips yörüngesi (60 karo).
 * Dallanma noktaları: 6 ayrı kısa alternatif yol.
 * Karo tipleri: normal, anahtar, tuzak, heal, start
 * KOSİÇ YOLU: Her karo tek yön (ileri) — geldiğin yere dönemezsin.
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

// Ana Halka: 0..59 — TEK YÖNLÜ (sadece next, öncesine dönüş yok)
for (let i = 0; i < ANA_KARO; i++) {
    const angle = (2 * Math.PI * i) / ANA_KARO - Math.PI / 2  // 12 saatten başla
    pos[i] = elipsNoktasi(CX, CY, RX, RY, angle)
    graph[i] = {
        id: i,
        tip: i === 0 ? 'start' : _tip[i % _tip.length],
        next: [(i + 1) % ANA_KARO],
        // Yön açısı: bir sonraki karoya olan açı
        dir: null,  // sonrada hesaplanacak
    }
}

// ─── Dal 1: Karo 10'dan 18'e → 4 karo alternatif yol (üstten/içten) ──────────
const dal1Start = 10, dal1End = 18
const dal1Ids = [60, 61, 62, 63]
graph[dal1Start].next.push(dal1Ids[0])

const a10 = (2 * Math.PI * dal1Start) / ANA_KARO - Math.PI / 2
const a18 = (2 * Math.PI * dal1End) / ANA_KARO - Math.PI / 2
const d1mid = (a10 + a18) / 2

pos[60] = elipsNoktasi(CX, CY, RX * 0.75, RY * 0.75, d1mid - 0.22)
pos[61] = elipsNoktasi(CX, CY, RX * 0.58, RY * 0.58, d1mid - 0.07)
pos[62] = elipsNoktasi(CX, CY, RX * 0.58, RY * 0.58, d1mid + 0.07)
pos[63] = elipsNoktasi(CX, CY, RX * 0.75, RY * 0.75, d1mid + 0.22)

graph[60] = { id: 60, tip: 'tuzak', next: [61] }
graph[61] = { id: 61, tip: 'anahtar', next: [62] }
graph[62] = { id: 62, tip: 'heal', next: [63] }
graph[63] = { id: 63, tip: 'tuzak', next: [dal1End] }

// ─── Dal 2: Karo 20'den 28'e → 3 karo dal (aynı dal grubu) ───────────────────
const dal2Start = 20, dal2End = 28
const dal2Ids = [64, 65, 66]
graph[dal2Start].next.push(dal2Ids[0])

const a20 = (2 * Math.PI * dal2Start) / ANA_KARO - Math.PI / 2
const a28 = (2 * Math.PI * dal2End) / ANA_KARO - Math.PI / 2
const d2mid = (a20 + a28) / 2

pos[64] = elipsNoktasi(CX, CY, RX * 1.30, RY * 1.30, d2mid - 0.18)
pos[65] = elipsNoktasi(CX, CY, RX * 1.48, RY * 1.48, d2mid)
pos[66] = elipsNoktasi(CX, CY, RX * 1.30, RY * 1.30, d2mid + 0.18)

graph[64] = { id: 64, tip: 'heal', next: [65] }
graph[65] = { id: 65, tip: 'anahtar', next: [66] }
graph[66] = { id: 66, tip: 'heal', next: [dal2End] }

// ─── Dal 3: Karo 32'den 40'a → 3 karo dal (dışarı) ──────────────────────────
const dal3Start = 32, dal3End = 40
const dal3Ids = [67, 68, 69]
graph[dal3Start].next.push(dal3Ids[0])

const a32 = (2 * Math.PI * dal3Start) / ANA_KARO - Math.PI / 2
const a40 = (2 * Math.PI * dal3End) / ANA_KARO - Math.PI / 2
const d3mid = (a32 + a40) / 2

pos[67] = elipsNoktasi(CX, CY, RX * 1.30, RY * 1.30, d3mid - 0.15)
pos[68] = elipsNoktasi(CX, CY, RX * 1.45, RY * 1.45, d3mid)
pos[69] = elipsNoktasi(CX, CY, RX * 1.30, RY * 1.30, d3mid + 0.15)

graph[67] = { id: 67, tip: 'tuzak', next: [68] }
graph[68] = { id: 68, tip: 'anahtar', next: [69] }
graph[69] = { id: 69, tip: 'tuzak', next: [dal3End] }

// ─── Dal 4: Karo 43'ten 50'ye → 4 karo dal (içe/merkeze) ────────────────────
const dal4Start = 43, dal4End = 50
const dal4Ids = [70, 71, 72, 73]
graph[dal4Start].next.push(dal4Ids[0])

const a43 = (2 * Math.PI * dal4Start) / ANA_KARO - Math.PI / 2
const a50 = (2 * Math.PI * dal4End) / ANA_KARO - Math.PI / 2
const d4mid = (a43 + a50) / 2

pos[70] = elipsNoktasi(CX, CY, RX * 0.72, RY * 0.72, d4mid - 0.25)
pos[71] = elipsNoktasi(CX, CY, RX * 0.52, RY * 0.52, d4mid - 0.08)
pos[72] = elipsNoktasi(CX, CY, RX * 0.52, RY * 0.52, d4mid + 0.08)
pos[73] = elipsNoktasi(CX, CY, RX * 0.72, RY * 0.72, d4mid + 0.25)

graph[70] = { id: 70, tip: 'tuzak', next: [71] }
graph[71] = { id: 71, tip: 'anahtar', next: [72] }
graph[72] = { id: 72, tip: 'heal', next: [73] }
graph[73] = { id: 73, tip: 'normal', next: [dal4End] }

// ─── Dal 5: Karo 5'ten 13'e → 3 karo dal (dışarı/sağ) ──────────────────────
const dal5Start = 5, dal5End = 13
const dal5Ids = [74, 75, 76]
graph[dal5Start].next.push(dal5Ids[0])

const a5 = (2 * Math.PI * dal5Start) / ANA_KARO - Math.PI / 2
const a13 = (2 * Math.PI * dal5End) / ANA_KARO - Math.PI / 2
const d5mid = (a5 + a13) / 2

pos[74] = elipsNoktasi(CX, CY, RX * 1.28, RY * 1.28, d5mid - 0.18)
pos[75] = elipsNoktasi(CX, CY, RX * 1.42, RY * 1.42, d5mid)
pos[76] = elipsNoktasi(CX, CY, RX * 1.28, RY * 1.28, d5mid + 0.18)

graph[74] = { id: 74, tip: 'anahtar', next: [75] }
graph[75] = { id: 75, tip: 'tuzak', next: [76] }
graph[76] = { id: 76, tip: 'anahtar', next: [dal5End] }

// ─── Dal 6: Karo 52'den 58'e → 3 karo dal (içe) ────────────────────────────
const dal6Start = 52, dal6End = 58
const dal6Ids = [77, 78, 79]
graph[dal6Start].next.push(dal6Ids[0])

const a52 = (2 * Math.PI * dal6Start) / ANA_KARO - Math.PI / 2
const a58 = (2 * Math.PI * dal6End) / ANA_KARO - Math.PI / 2
const d6mid = (a52 + a58) / 2

pos[77] = elipsNoktasi(CX, CY, RX * 0.68, RY * 0.68, d6mid - 0.15)
pos[78] = elipsNoktasi(CX, CY, RX * 0.52, RY * 0.52, d6mid)
pos[79] = elipsNoktasi(CX, CY, RX * 0.68, RY * 0.68, d6mid + 0.15)

graph[77] = { id: 77, tip: 'heal', next: [78] }
graph[78] = { id: 78, tip: 'anahtar', next: [79] }
graph[79] = { id: 79, tip: 'heal', next: [dal6End] }

// ─── Yön Açıları Hesapla (her karo için) ────────────────────────────────────
for (const idStr in graph) {
    const id = Number(idStr)
    const node = graph[id]
    if (pos[id] && node.next.length > 0) {
        // Birincil next'e yön
        const nid = node.next[0]
        if (pos[nid]) {
            const dx = pos[nid].x - pos[id].x
            const dy = pos[nid].y - pos[id].y
            graph[id].dir = Math.atan2(dy, dx)
        }
    }
}

// ─── BFS: En kısa yol (kasa'ya) ────────────────────────────────────────────
export function enKisaYol(baslangic, hedef, graphData) {
    if (baslangic === hedef) return [baslangic]
    const queue = [[baslangic]]
    const ziyaret = new Set([baslangic])
    while (queue.length > 0) {
        const yol = queue.shift()
        const son = yol[yol.length - 1]
        const node = graphData[son]
        if (!node) continue
        for (const nid of node.next) {
            if (ziyaret.has(nid)) continue
            const yeniYol = [...yol, nid]
            if (nid === hedef) return yeniYol
            ziyaret.add(nid)
            queue.push(yeniYol)
        }
    }
    return null  // yol bulunamadı
}

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
