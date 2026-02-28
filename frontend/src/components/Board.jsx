import { useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// Board layout: 20 tiles arranged in a rectangular loop
// Top row (0-5), right col (6-9), bottom row (10-15), left col (16-19)
const BOARD_W = 650
const BOARD_H = 480
const TILE_W = 90
const TILE_H = 72
const COLS = 6
const ROWS = 5

// Map tile index → pixel position {x, y}
function tilePosition(id) {
    // Top row: 0..5 (left to right)
    if (id <= 5) return { x: 20 + id * TILE_W, y: 20 }
    // Right col: 6..9 (top to bottom)
    if (id <= 9) return { x: 20 + 5 * TILE_W, y: 20 + (id - 5) * TILE_H }
    // Bottom row: 10..15 (right to left)
    if (id <= 15) return { x: 20 + (15 - id) * TILE_W, y: 20 + 5 * TILE_H }
    // Left col: 16..19 (bottom to top)
    return { x: 20, y: 20 + (20 - id) * TILE_H }
}

const TILE_COLORS = {
    normal: '#1e1b4b',
    chest: '#92400e',
    minigame: '#1e3a5f',
    trap: '#450a0a',
    star: '#365314',
}

const TILE_BORDER_COLORS = {
    normal: '#6366f1',
    chest: '#f59e0b',
    minigame: '#06b6d4',
    trap: '#ef4444',
    star: '#84cc16',
}

const TILE_ICONS = {
    normal: '🟦',
    chest: '🎁',
    minigame: '🎲',
    trap: '💀',
    star: '⭐',
}

const PLAYER_COLORS = ['#7c3aed', '#06b6d4', '#fbbf24', '#ec4899', '#10b981', '#f97316', '#3b82f6', '#ef4444']

export default function Board({ tiles = [], players = [], boardState, currentPlayer, address, onRollDice, isMyTurn, lastDice, diceAnimating }) {
    const canvasRef = useRef(null)

    const draw = useCallback(() => {
        const canvas = canvasRef.current
        if (!canvas || !tiles.length) return
        const ctx = canvas.getContext('2d')
        canvas.width = BOARD_W
        canvas.height = BOARD_H

        // Background
        ctx.fillStyle = '#07071a'
        ctx.fillRect(0, 0, BOARD_W, BOARD_H)

        // Path connecting tiles
        ctx.strokeStyle = 'rgba(99,102,241,0.3)'
        ctx.lineWidth = 3
        ctx.setLineDash([8, 4])
        ctx.beginPath()
        tiles.forEach((tile, i) => {
            const pos = tilePosition(tile.id)
            const cx = pos.x + TILE_W / 2
            const cy = pos.y + TILE_H / 2
            if (i === 0) ctx.moveTo(cx, cy)
            else ctx.lineTo(cx, cy)
        })
        const first = tilePosition(0)
        ctx.lineTo(first.x + TILE_W / 2, first.y + TILE_H / 2)
        ctx.stroke()
        ctx.setLineDash([])

        // Draw tiles
        tiles.forEach(tile => {
            const pos = tilePosition(tile.id)
            const x = pos.x, y = pos.y
            const bg = TILE_COLORS[tile.type] || '#1e1b4b'
            const border = TILE_BORDER_COLORS[tile.type] || '#6366f1'

            // Tile background with glow
            ctx.shadowColor = border
            ctx.shadowBlur = 8
            ctx.fillStyle = bg
            roundRect(ctx, x + 2, y + 2, TILE_W - 4, TILE_H - 4, 10)
            ctx.fill()
            ctx.shadowBlur = 0

            // Border
            ctx.strokeStyle = border
            ctx.lineWidth = 2
            roundRect(ctx, x + 2, y + 2, TILE_W - 4, TILE_H - 4, 10)
            ctx.stroke()

            // Icon
            ctx.font = '22px serif'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(TILE_ICONS[tile.type] || '🟦', x + TILE_W / 2, y + TILE_H / 2 - 6)

            // Tile name
            ctx.fillStyle = 'rgba(255,255,255,0.6)'
            ctx.font = '9px monospace'
            ctx.fillText(tile.name.slice(0, 10), x + TILE_W / 2, y + TILE_H - 10)

            // Tile ID
            ctx.fillStyle = 'rgba(255,255,255,0.2)'
            ctx.font = '8px monospace'
            ctx.fillText(String(tile.id), x + 8, y + 14)
        })

        // Draw player tokens
        if (boardState?.players) {
            boardState.players.forEach((player, i) => {
                const tileId = player.position
                const pos = tilePosition(tileId)
                const color = PLAYER_COLORS[i % 8]
                // Offset multiple players on same tile
                const samePos = boardState.players.slice(0, i).filter(p => p.position === tileId)
                const offsetX = (samePos.length % 3) * 22
                const offsetY = Math.floor(samePos.length / 3) * 22
                const cx = pos.x + 16 + offsetX
                const cy = pos.y + 16 + offsetY

                // Token shadow/glow
                ctx.shadowColor = color
                ctx.shadowBlur = 12
                ctx.fillStyle = color
                ctx.beginPath()
                ctx.arc(cx, cy, 12, 0, Math.PI * 2)
                ctx.fill()
                ctx.shadowBlur = 0

                // Token outline
                ctx.strokeStyle = '#fff'
                ctx.lineWidth = 2
                ctx.beginPath()
                ctx.arc(cx, cy, 12, 0, Math.PI * 2)
                ctx.stroke()

                // Initials
                ctx.fillStyle = '#fff'
                ctx.font = 'bold 8px monospace'
                ctx.textAlign = 'center'
                ctx.textBaseline = 'middle'
                const isBot = player.isBot
                ctx.fillText(isBot ? '🤖' : player.address?.slice(2, 4).toUpperCase(), cx, cy)

                // Chest counter
                if (player.chests > 0) {
                    ctx.fillStyle = '#f59e0b'
                    ctx.font = 'bold 9px monospace'
                    ctx.fillText(`🎁${player.chests}`, cx, cy + 18)
                }

                // "YOUR TURN" indicator
                if (player.address === currentPlayer) {
                    ctx.strokeStyle = '#fbbf24'
                    ctx.lineWidth = 3
                    ctx.setLineDash([4, 2])
                    ctx.beginPath()
                    ctx.arc(cx, cy, 16, 0, Math.PI * 2)
                    ctx.stroke()
                    ctx.setLineDash([])
                }
            })
        }
    }, [tiles, boardState, currentPlayer])

    useEffect(() => {
        draw()
    }, [draw])

    return (
        <div style={{ position: 'relative', display: 'inline-block' }}>
            <canvas
                ref={canvasRef}
                style={{ display: 'block', borderRadius: 12, border: '1px solid rgba(99,102,241,0.3)', imageRendering: 'pixelated' }}
            />

            {/* Dice + Roll button overlay */}
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', zIndex: 10 }}>
                {/* Dice display */}
                <AnimatePresence>
                    {lastDice && (
                        <motion.div
                            key={lastDice + diceAnimating}
                            initial={{ scale: 2, rotate: 180, opacity: 0 }}
                            animate={{ scale: 1, rotate: 0, opacity: 1 }}
                            exit={{ opacity: 0, scale: 0.5 }}
                            style={{
                                width: 64, height: 64,
                                background: 'linear-gradient(135deg, #7c3aed, #4c1d95)',
                                border: '2px solid rgba(124,58,237,0.8)',
                                borderRadius: 12,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '2rem', fontWeight: 900,
                                boxShadow: '0 0 30px rgba(124,58,237,0.6)',
                                fontFamily: 'var(--font-orbitron)',
                                color: 'white',
                            }}
                        >
                            {['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][lastDice - 1] || lastDice}
                        </motion.div>
                    )}
                </AnimatePresence>

                {isMyTurn && (
                    <motion.button
                        onClick={onRollDice}
                        disabled={diceAnimating}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        animate={{ boxShadow: ['0 0 10px rgba(251,191,36,0.4)', '0 0 25px rgba(251,191,36,0.8)', '0 0 10px rgba(251,191,36,0.4)'] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        style={{
                            padding: '0.75rem 2rem',
                            background: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
                            border: 'none', borderRadius: '9999px',
                            fontFamily: 'var(--font-orbitron)', fontWeight: 900,
                            fontSize: '0.875rem', color: '#000',
                            cursor: diceAnimating ? 'not-allowed' : 'pointer',
                            opacity: diceAnimating ? 0.6 : 1,
                        }}
                    >
                        🎲 ROLL DICE
                    </motion.button>
                )}
            </div>
        </div>
    )
}

// Helper: rounded rect path
function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    ctx.lineTo(x + w, y + h - r)
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    ctx.lineTo(x + r, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
}
