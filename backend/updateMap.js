const fs = require('fs');
const engPath = 'C:/Users/azizc/.gemini/antigravity/scratch/monad-party/backend/boardEngine.js';
let eng = fs.readFileSync(engPath, 'utf8');

// HP ve Hasar ayarlari
eng = eng.replace(/const MAX_HP = 3/g, 'const MAX_HP = 100');
eng = eng.replace(/mevcutOyuncu.hp \- 1\)/g, 'mevcutOyuncu.hp - 20)');
eng = eng.replace(/\-1 Can/g, '-20 Can');
eng = eng.replace(/mevcutOyuncu.hp \+ 1\)/g, 'mevcutOyuncu.hp + 20)');
eng = eng.replace(/\+1 Can/g, '+20 Can');

// 192 nodes graph olusturma
const _types = ['normal', 'normal', 'anahtar', 'tuzak', 'heal', 'normal', 'anahtar'];
let nodes = {};
for (let i = 0; i < 192; i++) {
    nodes[i] = { id: i, type: i === 0 ? 'start' : _types[i % 7], next: [(i + 1) % 192] };
}
// Dallar (Branches)
// Dal 1: 30'da ayrilan yol 35'te birlesir
nodes[30].next.push(192);
nodes[192] = { id: 192, type: 'tuzak', next: [193] };
nodes[193] = { id: 193, type: 'anahtar', next: [194] };
nodes[194] = { id: 194, type: 'heal', next: [35] };

// Dal 2: 80'de ayrilan yol 85'te birlesir
nodes[80].next.push(195);
nodes[195] = { id: 195, type: 'anahtar', next: [196] };
nodes[196] = { id: 196, type: 'normal', next: [85] };

// Dal 3: 140'ta ayrilan yol 145'te birlesir
nodes[140].next.push(197);
nodes[197] = { id: 197, type: 'heal', next: [198] };
nodes[198] = { id: 198, type: 'tuzak', next: [199] };
nodes[199] = { id: 199, type: 'anahtar', next: [145] };

const graphCode = 'const KARO_GRAPH = ' + JSON.stringify(nodes, null, 2) + ';\nconst TOPLAM_KARO = ' + Object.keys(nodes).length + ';\n';

// KARO_TIPLERI dizisini KALDIR:
eng = eng.replace(/const KARO_TIPLERI = \[[\s\S]*?\]/g, graphCode);
eng = eng.replace(/const TOPLAM_KARO = 48\n/g, '');

fs.writeFileSync(engPath, eng);
console.log('boardEngine.js updated with 100 HP and 192+ nodes flat graph.');
