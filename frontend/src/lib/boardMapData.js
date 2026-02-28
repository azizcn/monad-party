// Backend boardEngine.js graph representation
const graph = {};
const _pattern = ['normal', 'normal', 'anahtar', 'tuzak', 'heal', 'normal', 'anahtar'];
for (let i = 0; i < 192; i++) {
    graph[i] = { id: i, tip: i === 0 ? 'start' : _pattern[i % 7], next: [(i + 1) % 192] };
}
// Branches
graph[30].next.push(192);
graph[192] = { id: 192, tip: 'tuzak', next: [193] };
graph[193] = { id: 193, tip: 'anahtar', next: [194] };
graph[194] = { id: 194, tip: 'heal', next: [35] };

graph[80].next.push(195);
graph[195] = { id: 195, tip: 'anahtar', next: [196] };
graph[196] = { id: 196, tip: 'normal', next: [85] };

graph[140].next.push(197);
graph[197] = { id: 197, tip: 'heal', next: [198] };
graph[198] = { id: 198, tip: 'tuzak', next: [199] };
graph[199] = { id: 199, tip: 'anahtar', next: [145] };

// Simple procedural layout generator for 192 nodes
let pos = {};
let x = 0, y = 0;
let dir = 0; // 0=R, 1=D, 2=L, 3=U
let stepsInDir = 0;
let maxSteps = 4;
const D = 120; // Distance between tiles

function move(d) {
    if (d === 0) x += D;
    else if (d === 1) y += D;
    else if (d === 2) x -= D;
    else if (d === 3) y -= D;
}

// Generate main path 0-191 winding in a spiral/zig-zag
for (let i = 0; i < 192; i++) {
    pos[i] = { x, y };
    move(dir);
    stepsInDir++;
    if (stepsInDir >= maxSteps) {
        dir = (dir + 1) % 4; // Turn right
        stepsInDir = 0;
        if (dir % 2 === 0) maxSteps += 2; // Spiral outwards slightly
    }
}

// Branches
// Branch 1 (192-194) jumping from 30 to 35
pos[192] = { x: pos[30].x + (pos[35].x - pos[30].x) * 0.25 - 80, y: pos[30].y + (pos[35].y - pos[30].y) * 0.25 - 80 };
pos[193] = { x: pos[30].x + (pos[35].x - pos[30].x) * 0.5 - 120, y: pos[30].y + (pos[35].y - pos[30].y) * 0.5 - 120 };
pos[194] = { x: pos[30].x + (pos[35].x - pos[30].x) * 0.75 - 80, y: pos[30].y + (pos[35].y - pos[30].y) * 0.75 - 80 };

// Branch 2
pos[195] = { x: pos[80].x + (pos[85].x - pos[80].x) * 0.33 + 80, y: pos[80].y + (pos[85].y - pos[80].y) * 0.33 + 80 };
pos[196] = { x: pos[80].x + (pos[85].x - pos[80].x) * 0.66 + 80, y: pos[80].y + (pos[85].y - pos[80].y) * 0.66 + 80 };

// Branch 3
pos[197] = { x: pos[140].x + (pos[145].x - pos[140].x) * 0.25 + 100, y: pos[140].y + (pos[145].y - pos[140].y) * 0.25 - 100 };
pos[198] = { x: pos[140].x + (pos[145].x - pos[140].x) * 0.5 + 150, y: pos[140].y + (pos[145].y - pos[140].y) * 0.5 - 150 };
pos[199] = { x: pos[140].x + (pos[145].x - pos[140].x) * 0.75 + 100, y: pos[140].y + (pos[145].y - pos[140].y) * 0.75 - 100 };

// Find bounding box to normalize coordinates
let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
for (let id in pos) {
    if (pos[id].x < minX) minX = pos[id].x;
    if (pos[id].y < minY) minY = pos[id].y;
}

const margin = 300;
for (let id in pos) {
    pos[id].x = pos[id].x - minX + margin;
    pos[id].y = pos[id].y - minY + margin;
    if (pos[id].x > maxX) maxX = pos[id].x;
    if (pos[id].y > maxY) maxY = pos[id].y;
}

export const KAROLAR_GRAPH = graph;
export const KAROLAR_POSITIONS = pos;
export const BOARD_WIDTH = maxX + margin;
export const BOARD_HEIGHT = maxY + margin;
