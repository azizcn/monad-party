import { useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ─── Winding path: 28 tile positions (top-down, Pummel Party style) ────────────
// Canvas: 800 x 580
const TILE_R = 26 // hex tile radius
const PATH = [
    // Start area - bottom left
    { x: 80, y: 500 }, // 0 START
    { x: 140, y: 500 }, // 1
    { x: 200, y: 500 }, // 2 chest
    { x: 260, y: 500 }, // 3
    { x: 320, y: 500 }, // 4 trap
    // Turn up
    { x: 320, y: 440 }, // 5
    { x: 320, y: 380 }, // 6 minigame
    { x: 320, y: 320 }, // 7
    { x: 380, y: 320 }, // 8 chest
    { x: 440, y: 320 }, // 9 trap
    // Right side winding
    { x: 500, y: 320 }, // 10
    { x: 560, y: 320 }, // 11 heal
    { x: 620, y: 320 }, // 12
    { x: 680, y: 320 }, // 13 minigame
    { x: 680, y: 260 }, // 14 chest
    { x: 680, y: 200 }, // 15 trap
    { x: 620, y: 200 }, // 16
    { x: 560, y: 200 }, // 17 chest
    { x: 500, y: 200 }, // 18
    { x: 440, y: 200 }, // 19 trap
    // Back down-left
    { x: 380, y: 200 }, // 20
    { x: 320, y: 200 }, // 21 minigame
    { x: 260, y: 200 }, // 22 heal
    { x: 200, y: 200 }, // 23
    // Down to start
    { x: 140, y: 200 }, // 24 chest
    { x: 80, y: 200 }, // 25 trap
    { x: 80, y: 280 }, // 26
    { x: 80, y: 360 }, // 27 chest
]

const TILE_TYPES = ['start', 'normal', 'chest', 'normal', 'trap', 'normal', 'minigame', 'normal', 'chest', 'trap', 'normal', 'heal', 'normal', 'minigame', 'chest', 'trap', 'normal', 'chest', 'normal', 'trap', 'normal', 'minigame', 'heal', 'normal', 'chest', 'trap', 'normal', 'chest']
const TILE_COLORS = { start: '#16a34a', normal: '#1e3a5f', chest: '#92400e', minigame: '#312e81', trap: '#7f1d1d', heal: '#14532d' }
const TILE_BORDER = { start: '#4ade80', normal: '#60a5fa', chest: '#fbbf24', minigame: '#a78bfa', trap: '#f87171', heal: '#86efac' }
const TILE_ICONS = { start: '🏁', normal: '', chest: '🎁', minigame: '🎲', trap: '💀', heal: '❤️' }
const PLAYER_COLORS = ['#7c3aed', '#06b6d4', '#fbbf24', '#ec4899', '#10b981', '#f97316', '#3b82f6', '#ef4444']

// Map background decorations
function drawBackground(ctx, W, H) {
    // Sky/ground gradient
    const grad = ctx.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, '#071a1a')
    grad.addColorStop(1, '#0a1628')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, W, H)

    // Grid lines
    ctx.strokeStyle = 'rgba(99,102,241,0.06)'
    ctx.lineWidth = 1
    for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
    for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }

    // Decorative buildings (top-down rectangles)
    const buildings = [
        { x: 30, y: 30, w: 120, h: 90, color: '#0f172a', roof: '#1e293b' },
        { x: 700, y: 30, w: 90, h: 70, color: '#0f172a', roof: '#1e293b' },
        { x: 420, y: 30, w: 100, h: 60, color: '#0f172a', roof: '#1e293b' },
        { x: 30, y: 400, w: 40, h: 40, color: '#0f172a', roof: '#1e293b' },
        { x: 700, y: 440, w: 90, h: 80, color: '#0f172a', roof: '#1e293b' },
    ]
    buildings.forEach(b => {
        ctx.fillStyle = b.color
        ctx.strokeStyle = '#334155'
        ctx.lineWidth = 2
        ctx.fillRect(b.x, b.y, b.w, b.h)
        ctx.strokeRect(b.x, b.y, b.w, b.h)
        ctx.fillStyle = b.roof
        ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8)
        // Windows
        ctx.fillStyle = 'rgba(250,204,21,0.4)'
        ctx.fillRect(b.x + 10, b.y + 10, 12, 12)
        ctx.fillRect(b.x + b.w - 22, b.y + 10, 12, 12)
    })

    // Trees (top-down circles)
    const trees = [[580, 80], [560, 110], [600, 100], [160, 140], [130, 120], [420, 460], [450, 480], [500, 480], [150, 380], [700, 380]]
    trees.forEach(([tx, ty]) => {
        ctx.fillStyle = '#14532d'
        ctx.shadowColor = '#166534'
        ctx.shadowBlur = 8
        ctx.beginPath(); ctx.arc(tx, ty, 12, 0, Math.PI * 2); ctx.fill()
        ctx.shadowBlur = 0
        ctx.fillStyle = '#15803d'
        ctx.beginPath(); ctx.arc(tx, ty, 8, 0, Math.PI * 2); ctx.fill()
    })

    // Road/path texture
    ctx.strokeStyle = 'rgba(148,163,184,0.08)'
    ctx.lineWidth = 38
    ctx.setLineDash([])
    ctx.beginPath()
    PATH.forEach((p, i) => { i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y) })
    ctx.stroke()
}

function drawHexTile(ctx, x, y, tileType, tileId, isHighlighted) {
    const r = TILE_R
    const bg = TILE_COLORS[tileType] || TILE_COLORS.normal
    const border = TILE_BORDER[tileType] || TILE_BORDER.normal

    // Draw hexagon shape
    ctx.beginPath()
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6
        const hx = x + r * Math.cos(angle)
        const hy = y + r * Math.sin(angle)
        i === 0 ? ctx.moveTo(hx, hy) : ctx.lineTo(hx, hy)
    }
    ctx.closePath()

    if (isHighlighted) {
        ctx.shadowColor = border
        ctx.shadowBlur = 18
    }
    ctx.fillStyle = bg
    ctx.fill()
    ctx.shadowBlur = 0

    ctx.strokeStyle = border
    ctx.lineWidth = isHighlighted ? 3 : 2
    ctx.stroke()

    // Icon
    const icon = TILE_ICONS[tileType]
    if (icon) {
        ctx.font = `${r * 0.8}px serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(icon, x, y - 2)
    }

    // Tile ID
    ctx.fillStyle = 'rgba(255,255,255,0.3)'
    ctx.font = '7px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(String(tileId), x, y + r - 8)
}

function drawArrow(ctx, from, to) {
    const dx = to.x - from.x, dy = to.y - from.y
    const len = Math.sqrt(dx * dx + dy * dy)
    if (len < 2) return
    const mx = from.x + dx * 0.5, my = from.y + dy * 0.5
    const angle = Math.atan2(dy, dx)
    ctx.save()
    ctx.globalAlpha = 0.25
    ctx.strokeStyle = '#94a3b8'
    ctx.lineWidth = 1.5
    ctx.setLineDash([4, 4])
    ctx.beginPath(); ctx.moveTo(from.x + dx * 0.28, from.y + dy * 0.28); ctx.lineTo(to.x - dx * 0.28, to.y - dy * 0.28); ctx.stroke()
    ctx.setLineDash([])
    // Arrowhead
    ctx.fillStyle = '#94a3b8'
    ctx.translate(mx, my)
    ctx.rotate(angle)
    ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(-3, -3); ctx.lineTo(-3, 3); ctx.closePath(); ctx.fill()
    ctx.restore()
}

export default function Board({ tiles = [], players = [], boardState, currentPlayer, address, onRollDice, onInitialRoll, isMyTurn, isInitialRollPhase, lastDice, diceAnimating }) {
    const canvasRef = useRef(null)
    const W = 800, H = 560

    const draw = useCallback(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        canvas.width = W; canvas.height = H

        drawBackground(ctx, W, H)

        // Arrows between tiles
        PATH.forEach((pos, i) => {
            if (i < PATH.length - 1) drawArrow(ctx, pos, PATH[i + 1])
        })
        // Last arrow back to start
        drawArrow(ctx, PATH[PATH.length - 1], PATH[0])

        // Tiles
        PATH.forEach((pos, id) => {
            const tileType = TILE_TYPES[id] || 'normal'
            const isCurrentTile = boardState?.players?.some(p => p.position === id && p.address === currentPlayer)
            drawHexTile(ctx, pos.x, pos.y, tileType, id, isCurrentTile)
        })

        // Player tokens
        boardState?.players?.forEach((player, i) => {
            if (player.eliminated) return
            const tilePos = PATH[player.position] || PATH[0]
            const color = PLAYER_COLORS[i % 8]
            const sameSpot = boardState.players.slice(0, i).filter(p => p.position === player.position && !p.eliminated).length
            const ox = (sameSpot % 2) * 22 - 11
            const oy = Math.floor(sameSpot / 2) * 20 - 10
            const px = tilePos.x + ox, py = tilePos.y - 8 + oy

            // Shadow
            ctx.fillStyle = 'rgba(0,0,0,0.5)'
            ctx.beginPath(); ctx.ellipse(px, py + 16, 10, 5, 0, 0, Math.PI * 2); ctx.fill()

            // Body circle (top-down pawn view)
            ctx.shadowColor = color
            ctx.shadowBlur = 12
            ctx.fillStyle = color
            ctx.beginPath(); ctx.arc(px, py, 12, 0, Math.PI * 2); ctx.fill()
            ctx.shadowBlur = 0

            // Highlight
            ctx.fillStyle = 'rgba(255,255,255,0.3)'
            ctx.beginPath(); ctx.arc(px - 3, py - 3, 5, 0, Math.PI * 2); ctx.fill()

            // Border
            ctx.strokeStyle = player.address === address ? '#fbbf24' : '#fff'
            ctx.lineWidth = player.address === address ? 3 : 1.5
            ctx.beginPath(); ctx.arc(px, py, 12, 0, Math.PI * 2); ctx.stroke()

            // Initial
            ctx.fillStyle = '#fff'
            ctx.font = 'bold 8px monospace'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(player.isBot ? '🤖' : (player.address?.slice(2, 4)?.toUpperCase() || '??'), px, py)

            // HP hearts above token
            const hpY = py - 22
            for (let h = 0; h < (player.hp || 0); h++) {
                ctx.font = '10px serif'; ctx.fillText('❤️', px - 10 + h * 12, hpY)
            }

            // Current turn indicator
            if (player.address === currentPlayer) {
                ctx.strokeStyle = '#fbbf24'
                ctx.lineWidth = 2
                ctx.setLineDash([3, 2])
                ctx.beginPath(); ctx.arc(px, py, 17, 0, Math.PI * 2); ctx.stroke()
                ctx.setLineDash([])
            }
        })
    }, [boardState, currentPlayer, address, tiles])

    useEffect(() => { draw() }, [draw])

    return (
        <div style={{ position: 'relative', display: 'inline-block' }}>
            <canvas ref={canvasRef} style={{ display: 'block', borderRadius: 14, border: '1px solid rgba(99,102,241,0.4)', boxShadow: '0 0 40px rgba(99,102,241,0.15)' }} />

            {/* Dice + Action Buttons */}
            <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', zIndex: 10 }}>

                {/* Double dice display */}
                <AnimatePresence>
                    {lastDice?.length === 2 && (
                        <motion.div key={lastDice.join()} initial={{ scale: 1.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
                            style={{ display: 'flex', gap: '0.5rem' }}>
                            {lastDice.map((d, i) => (
                                <motion.div key={i} initial={{ rotate: 180 }} animate={{ rotate: 0 }} transition={{ delay: i * 0.1 }}
                                    style={{ width: 48, height: 48, background: 'linear-gradient(135deg,#7c3aed,#4c1d95)', border: '2px solid rgba(124,58,237,0.8)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.75rem', boxShadow: '0 0 20px rgba(124,58,237,0.5)' }}>
                                    {['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][d - 1]}
                                </motion.div>
                            ))}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 48, height: 48, background: 'rgba(251,191,36,0.2)', border: '2px solid rgba(251,191,36,0.6)', borderRadius: 10, fontFamily: 'var(--font-orbitron)', fontWeight: 900, fontSize: '1.2rem', color: '#fbbf24' }}>
                                {lastDice.reduce((a, b) => a + b, 0)}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Roll buttons */}
                {isInitialRollPhase && (
                    <motion.button onClick={onInitialRoll} disabled={diceAnimating}
                        whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
                        animate={{ boxShadow: ['0 0 8px rgba(16,185,129,0.4)', '0 0 24px rgba(16,185,129,0.9)', '0 0 8px rgba(16,185,129,0.4)'] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        style={{ padding: '0.65rem 2rem', background: 'linear-gradient(135deg,#10b981,#34d399)', border: 'none', borderRadius: '9999px', fontFamily: 'var(--font-orbitron)', fontWeight: 900, fontSize: '0.85rem', color: '#000', cursor: 'pointer', opacity: diceAnimating ? 0.6 : 1 }}>
                        🎲 ROLL FOR TURN ORDER
                    </motion.button>
                )}
                {isMyTurn && !isInitialRollPhase && (
                    <motion.button onClick={onRollDice} disabled={diceAnimating}
                        whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
                        animate={{ boxShadow: ['0 0 8px rgba(251,191,36,0.4)', '0 0 24px rgba(251,191,36,0.9)', '0 0 8px rgba(251,191,36,0.4)'] }}
                        transition={{ duration: 1.2, repeat: Infinity }}
                        style={{ padding: '0.65rem 2rem', background: 'linear-gradient(135deg,#f59e0b,#fbbf24)', border: 'none', borderRadius: '9999px', fontFamily: 'var(--font-orbitron)', fontWeight: 900, fontSize: '0.85rem', color: '#000', cursor: 'pointer', opacity: diceAnimating ? 0.6 : 1 }}>
                        🎲 ROLL DICE
                    </motion.button>
                )}
            </div>
        </div>
    )
}
