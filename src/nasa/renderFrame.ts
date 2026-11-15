/** Canvas renderer: clean NASA frame + the player's design effects (blur, smear, noise, lost strips, partial downlink). */
import type { FrameEffects } from './frames'

function rng(seed: number) {
  let a = seed >>> 0 || 1
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

let filterSupport: boolean | null = null
function supportsFilter(ctx: CanvasRenderingContext2D): boolean {
  if (filterSupport == null) {
    const before = ctx.filter
    ctx.filter = 'blur(2px)'
    filterSupport = ctx.filter === 'blur(2px)'
    ctx.filter = before
  }
  return filterSupport
}

/** Rows of the lost (storage overflow) strips, as [y0, y1) fractions. Deterministic per frame. */
export function lostBands(lost: number, seed: number, span = 1): [number, number][] {
  if (lost <= 0.01) return []
  const r = rng(seed ^ 0x51ed)
  const n = 1 + Math.min(4, Math.floor(lost * 6))
  const each = lost / n
  const bands: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const slot = (i + 0.15 + r() * 0.7) / n
    const y0 = Math.max(0, Math.min(1 - each, slot - each / 2))
    bands.push([y0 * span, (y0 + each) * span])
  }
  return bands
}

/**
 * Draw `src` into `out` with the effects. `reveal` (0..1) animates the scan-line arrival of the received rows.
 * Returns the y fraction where received data ends (for HTML overlays).
 */
export function renderFrame(
  out: HTMLCanvasElement,
  src: CanvasImageSource,
  e: FrameEffects,
  reveal = 1,
): number {
  const ctx = out.getContext('2d', { willReadFrequently: e.noise > 0.01 })
  if (!ctx) return 1
  const W = out.width
  const H = out.height
  const k = W / 480
  const r = rng(e.seed)
  ctx.save()
  ctx.fillStyle = '#050c10'
  ctx.fillRect(0, 0, W, H)

  // 1. pointing: off-target framing, roll, blur (+ smear for a tumbling spacecraft)
  const blur = e.blur * k
  const useFilter = supportsFilter(ctx)
  const drawBase = (dx: number, dy: number, alpha: number) => {
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.translate(W / 2 + e.jitterX * k + dx, H / 2 + e.jitterY * k + dy)
    ctx.rotate((e.rotation * Math.PI) / 180)
    const s = e.rotation || e.jitterX || e.jitterY ? 1.14 : 1
    if (blur > 0.2 && useFilter) ctx.filter = `blur(${blur.toFixed(1)}px)`
    if (blur > 0.2 && !useFilter) {
      // fallback blur: downsample + upsample
      const f = 1 / (1 + blur / 2)
      const tmp = document.createElement('canvas')
      tmp.width = Math.max(8, Math.round(W * f))
      tmp.height = Math.max(8, Math.round(H * f))
      tmp.getContext('2d')?.drawImage(src, 0, 0, tmp.width, tmp.height)
      ctx.imageSmoothingEnabled = true
      ctx.drawImage(tmp, (-W * s) / 2, (-H * s) / 2, W * s, H * s)
    } else {
      ctx.drawImage(src, (-W * s) / 2, (-H * s) / 2, W * s, H * s)
    }
    ctx.restore()
  }
  drawBase(0, 0, 1)
  if (e.smear > 0) {
    const ang = r() * Math.PI
    for (let i = 1; i <= 6; i++) {
      const d = i * 5 * k * e.smear
      drawBase(Math.cos(ang) * d, Math.sin(ang) * d, 0.2)
    }
  }

  // 2. radiation: grain, bright hits, streaks, dead detector columns
  if (e.noise > 0.01) {
    const img = ctx.getImageData(0, 0, W, H)
    const p = img.data
    const amp = 90 * e.noise
    for (let i = 0; i < p.length; i += 4) {
      const n = (r() - 0.5) * amp
      p[i] += n
      p[i + 1] += n
      p[i + 2] += n
    }
    const hits = Math.round(W * H * 0.004 * e.noise)
    for (let h = 0; h < hits; h++) {
      const x = Math.floor(r() * W)
      const y = Math.floor(r() * H)
      const o = (y * W + x) * 4
      p[o] = p[o + 1] = p[o + 2] = 255
    }
    ctx.putImageData(img, 0, 0)
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'
    ctx.lineWidth = Math.max(1, k)
    const streaks = Math.round(10 * e.noise)
    for (let s = 0; s < streaks; s++) {
      const x = r() * W
      const y = r() * H
      const a = r() * Math.PI
      const l = (6 + r() * 22) * k
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l)
      ctx.stroke()
    }
  }
  for (let c = 0; c < e.deadColumns; c++) {
    const x = Math.floor(r() * W)
    ctx.fillStyle = r() > 0.5 ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.7)'
    ctx.fillRect(x, 0, Math.max(1, Math.round(k)), H)
  }

  // 3. storage overflow: erased strips with corrupted packet blocks
  // strips fall inside the received part of the frame, in proportion to it
  for (const [a, b] of lostBands(e.lost, e.seed, e.arrived)) {
    const y0 = Math.round(a * H)
    const y1 = Math.round(b * H)
    ctx.fillStyle = '#071116'
    ctx.fillRect(0, y0, W, y1 - y0)
    const bw = 12 * k
    const bh = 4 * k
    for (let y = y0; y < y1; y += bh) {
      for (let x = 0; x < W; x += bw) {
        const v = r()
        if (v < 0.22) {
          ctx.fillStyle = v < 0.05 ? 'rgba(244,145,125,0.35)' : `rgba(160,190,200,${(0.05 + v * 0.3).toFixed(2)})`
          ctx.fillRect(x, y, bw - 1, bh - 1)
        }
      }
    }
    ctx.fillStyle = 'rgba(244,145,125,0.55)'
    ctx.fillRect(0, y0, W, Math.max(1, k))
    ctx.fillRect(0, y1 - Math.max(1, k), W, Math.max(1, k))
  }

  // 4. downlink: only the received rows (top to bottom), the rest still on board
  const edge = Math.max(0, Math.min(1, e.arrived * reveal))
  const ey = Math.round(edge * H)
  if (ey < H) {
    ctx.fillStyle = '#061217'
    ctx.fillRect(0, ey, W, H - ey)
    ctx.strokeStyle = 'rgba(163,240,212,0.07)'
    ctx.lineWidth = 1
    for (let x = -H; x < W; x += 14 * k) {
      ctx.beginPath()
      ctx.moveTo(x, H)
      ctx.lineTo(x + (H - ey), ey)
      ctx.stroke()
    }
    const g = ctx.createLinearGradient(0, ey - 10 * k, 0, ey + 2)
    g.addColorStop(0, 'rgba(163,240,212,0)')
    g.addColorStop(1, 'rgba(163,240,212,0.85)')
    ctx.fillStyle = g
    ctx.fillRect(0, ey - 10 * k, W, 10 * k + 2)
  }
  ctx.restore()
  return edge
}

/** Animation frame of the downlink: rows above `edge` (fraction) visible, a mint scan line at the edge. */
export function drawReveal(ctx: CanvasRenderingContext2D, full: CanvasImageSource, edge: number, finalEdge: number): void {
  const W = ctx.canvas.width
  const H = ctx.canvas.height
  const ey = Math.round(edge * H)
  ctx.drawImage(full, 0, 0)
  if (edge >= finalEdge) return
  ctx.fillStyle = '#061217'
  ctx.fillRect(0, ey, W, Math.round(finalEdge * H) - ey)
  const k = W / 480
  const g = ctx.createLinearGradient(0, ey - 10 * k, 0, ey + 2)
  g.addColorStop(0, 'rgba(163,240,212,0)')
  g.addColorStop(1, 'rgba(163,240,212,0.85)')
  ctx.fillStyle = g
  ctx.fillRect(0, ey - 10 * k, W, 10 * k + 2)
}
