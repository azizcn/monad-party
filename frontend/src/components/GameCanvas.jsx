import { useEffect, useRef, useCallback } from 'react'
import { useAccount } from 'wagmi'
import useGameStore from '../store/gameStore'

const CANVAS_W = 800
const CANVAS_H = 500
const GRAVITY = 0.5
const JUMP_FORCE = -12
const MOVE_SPEED = 4
const AVATAR_COLORS = ['#7c3aed', '#06b6d4', '#fbbf24', '#ec4899', '#10b981', '#f97316', '#3b82f6', '#ef4444']

// ─── Platform definitions ─────────────────────────────────────────────────────
const PLATFORMS = [
    { x: 0, y: CANVAS_H - 40, w: CANVAS_W, h: 40 },      // Ground
    { x: 100, y: 360, w: 160, h: 16 },
    { x: 320, y: 300, w: 160, h: 16 },
    { x: 540, y: 360, w: 160, h: 16 },
    { x: 200, y: 220, w: 120, h: 16 },
    { x: 450, y: 220, w: 120, h: 16 },
    { x: 330, y: 140, w: 140, h: 16 },
]

function spawnPosition(index) {
    const slots = [
        { x: 50, y: 400 }, { x: 150, y: 400 }, { x: 250, y: 400 },
        { x: 350, y: 400 }, { x: 450, y: 400 }, { x: 550, y: 400 },
        { x: 650, y: 400 }, { x: 700, y: 400 },
    ]
    return slots[index % slots.length]
}

export default function GameCanvas() {
    const canvasRef = useRef(null)
    const selfRef = useRef({
        x: 100, y: 400, vx: 0, vy: 0, isGrounded: false,
        width: 28, height: 40, animation: 'idle',
    })
    const keysRef = useRef({})
    const animFrameRef = useRef(null)
    const lastSentRef = useRef(0)

    const { address } = useAccount()
    const { players, sendMove, playerPositions, currentMiniGame } = useGameStore()

    // Initialize own position based on index
    useEffect(() => {
        const idx = players.findIndex((p) => p.address === address)
        const pos = spawnPosition(idx >= 0 ? idx : 0)
        selfRef.current.x = pos.x
        selfRef.current.y = pos.y
    }, [address])

    // ─── Keyboard input ───────────────────────────────────────────────────────
    useEffect(() => {
        const onDown = (e) => {
            keysRef.current[e.code] = true
            if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) e.preventDefault()
        }
        const onUp = (e) => { keysRef.current[e.code] = false }
        window.addEventListener('keydown', onDown)
        window.addEventListener('keyup', onUp)
        return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp) }
    }, [])

    // ─── Collision ────────────────────────────────────────────────────────────
    const checkPlatform = useCallback((self, platforms) => {
        const bottom = self.y + self.height
        const cx = self.x + self.width / 2
        for (const p of platforms) {
            if (cx > p.x && cx < p.x + p.w && bottom > p.y && bottom < p.y + p.h + 10 && self.vy >= 0) {
                self.y = p.y - self.height
                self.vy = 0
                self.isGrounded = true
                return true
            }
        }
        return false
    }, [])

    // ─── Draw player ─────────────────────────────────────────────────────────
    const drawPlayer = useCallback((ctx, x, y, color, label, isMe) => {
        const px = Math.round(x)
        const py = Math.round(y)
        // Shadow
        ctx.fillStyle = `${color}40`
        ctx.beginPath(); ctx.ellipse(px + 14, py + 42, 14, 4, 0, 0, Math.PI * 2); ctx.fill()
        // Body
        ctx.fillStyle = color
        ctx.fillRect(px + 6, py + 14, 16, 16)
        // Head
        ctx.fillRect(px + 8, py, 12, 14)
        // Eyes
        ctx.fillStyle = '#000'
        ctx.fillRect(px + 10, py + 4, 3, 3)
        ctx.fillRect(px + 15, py + 4, 3, 3)
        // Legs
        ctx.fillStyle = color
        ctx.fillRect(px + 6, py + 30, 6, 12)
        ctx.fillRect(px + 16, py + 30, 6, 12)
        // Arms
        ctx.fillRect(px, py + 14, 6, 8)
        ctx.fillRect(px + 22, py + 14, 6, 8)
        // Label
        ctx.fillStyle = isMe ? '#fff' : '#ccc'
        ctx.font = isMe ? 'bold 9px monospace' : '8px monospace'
        ctx.textAlign = 'center'
        const short = label ? `${label.slice(0, 6)}` : '???'
        ctx.fillText(short, px + 14, py - 4)
    }, [])

    // ─── Draw platform ────────────────────────────────────────────────────────
    const drawPlatform = useCallback((ctx, p) => {
        ctx.fillStyle = '#1a1a40'
        ctx.fillRect(p.x, p.y, p.w, p.h)
        // Top edge glow
        ctx.fillStyle = '#3b3b8a'
        ctx.fillRect(p.x, p.y, p.w, 3)
    }, [])

    // ─── Game Loop ────────────────────────────────────────────────────────────
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')

        const gamePlatforms = currentMiniGame?.id === 'platform-survival'
            ? PLATFORMS.slice(0, -2) // fewer platforms
            : PLATFORMS

        const loop = () => {
            const self = selfRef.current
            const keys = keysRef.current

            // ── Physics ────────────────────────────────────────────────────────────
            self.isGrounded = false
            self.vy += GRAVITY

            if (keys['ArrowLeft'] || keys['KeyA']) { self.vx = -MOVE_SPEED; self.animation = 'run' }
            else if (keys['ArrowRight'] || keys['KeyD']) { self.vx = MOVE_SPEED; self.animation = 'run' }
            else { self.vx = 0; self.animation = 'idle' }

            if ((keys['ArrowUp'] || keys['KeyW'] || keys['Space']) && self.isGrounded) {
                self.vy = JUMP_FORCE
                self.animation = 'jump'
            }

            self.x += self.vx
            self.y += self.vy

            // Boundaries
            self.x = Math.max(0, Math.min(CANVAS_W - self.width, self.x))

            // Platform collision
            checkPlatform(self, gamePlatforms)

            // Fall below canvas = respawn
            if (self.y > CANVAS_H + 50) {
                const idx = players.findIndex((p) => p.address === address)
                const pos = spawnPosition(idx >= 0 ? idx : 0)
                self.x = pos.x; self.y = pos.y; self.vy = 0
            }

            // ── Send position to server (throttled to ~30fps) ─────────────────────
            const now = Date.now()
            if (now - lastSentRef.current > 33) {
                sendMove(address, self.x, self.y, self.vx, self.vy, self.animation)
                lastSentRef.current = now
            }

            // ── Draw ──────────────────────────────────────────────────────────────
            // Background
            ctx.fillStyle = '#050510'
            ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

            // Grid
            ctx.strokeStyle = 'rgba(124,58,237,0.04)'
            ctx.lineWidth = 1
            for (let x = 0; x < CANVAS_W; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_H); ctx.stroke() }
            for (let y = 0; y < CANVAS_H; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_W, y); ctx.stroke() }

            // Platforms
            gamePlatforms.forEach((p) => drawPlatform(ctx, p))

            // Other players (interpolated from socket)
            players.forEach((player, i) => {
                if (player.address === address) return
                const pos = playerPositions?.[player.address]
                if (pos) {
                    drawPlayer(ctx, pos.x, pos.y, AVATAR_COLORS[i % 8], player.address, false)
                }
            })

            // Self
            const selfIndex = players.findIndex((p) => p.address === address)
            drawPlayer(ctx, self.x, self.y, AVATAR_COLORS[selfIndex >= 0 ? selfIndex % 8 : 0], address, true)

            animFrameRef.current = requestAnimationFrame(loop)
        }

        animFrameRef.current = requestAnimationFrame(loop)
        return () => cancelAnimationFrame(animFrameRef.current)
    }, [address, players, currentMiniGame, checkPlatform, drawPlatform, drawPlayer, sendMove, playerPositions])

    // ─── Responsive scaling ───────────────────────────────────────────────────
    const scale = Math.min(1, (typeof window !== 'undefined' ? window.innerWidth - 320 : 800) / CANVAS_W)

    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', background: '#050510' }}>
            <canvas
                ref={canvasRef}
                width={CANVAS_W}
                height={CANVAS_H}
                style={{ display: 'block', border: '1px solid var(--color-border)', borderRadius: '4px', imageRendering: 'pixelated', maxWidth: '100%' }}
            />
        </div>
    )
}
