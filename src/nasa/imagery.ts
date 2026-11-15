/**
 * Browser client for keyless, CORS-enabled NASA tile services (GIBS, Moon Trek, Mars Trek).
 * Tiles are fetched lazily, kept in memory and in the Cache API (survives reloads), and composed into one
 * frame canvas. Every failure resolves quietly: the caller gets `null` / an 'offline' status, never a throw.
 */
import { LAYERS, layerUrl, type ImageryLayer } from './layers'
import { planFrame } from './tiles'

const CACHE_NAME = 'ma-nasa-tiles-v1'
const memory = new Map<string, Promise<ImageBitmap | null>>()
let failures = 0

export type ImageryStatus = 'ok' | 'partial' | 'offline' | 'unavailable'

export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

async function fetchBlob(url: string, signal?: AbortSignal): Promise<Blob | null> {
  let cache: Cache | null = null
  try {
    if (typeof caches !== 'undefined') cache = await caches.open(CACHE_NAME)
  } catch {
    cache = null
  }
  try {
    const hit = cache ? await cache.match(url) : undefined
    if (hit) return await hit.blob()
  } catch {
    /* cache read failed: fall through to the network */
  }
  if (isOffline()) return null
  try {
    const res = await fetch(url, { mode: 'cors', credentials: 'omit', signal })
    if (!res.ok) return null
    const type = res.headers.get('content-type') ?? ''
    if (!type.startsWith('image/')) return null
    if (cache) cache.put(url, res.clone()).catch(() => {})
    return await res.blob()
  } catch {
    failures++
    return null
  }
}

/** One tile as an ImageBitmap (null when missing / offline). Shared between callers. */
export function loadTile(url: string): Promise<ImageBitmap | null> {
  let p = memory.get(url)
  if (!p) {
    p = fetchBlob(url).then(async (b) => {
      if (!b) return null
      try {
        return await createImageBitmap(b)
      } catch {
        return null
      }
    })
    memory.set(url, p)
    // do not pin failures forever: allow a retry later (e.g. after reconnecting)
    p.then((v) => {
      if (!v) setTimeout(() => memory.delete(url), 15000)
    })
  }
  return p
}

export interface ComposeRequest {
  layer: ImageryLayer
  lat: number
  lon: number
  zoom: number
  date: string | null
  width: number
  height: number
}

export interface ComposeResult {
  canvas: HTMLCanvasElement | null
  status: ImageryStatus
  /** layer actually drawn (fallback when the primary had no tiles) */
  layer: ImageryLayer
  /** date actually drawn (a neighbouring day when the requested one had a swath gap) */
  date?: string | null
}

async function drawLayer(
  ctx: CanvasRenderingContext2D,
  layer: ImageryLayer,
  r: ComposeRequest,
  alpha = 1,
  filter = 'none',
): Promise<{ got: number; total: number }> {
  const plan = planFrame(layer, r.lat, r.lon, r.zoom, r.width, r.height)
  const sx = r.width / plan.cropW
  const sy = r.height / plan.cropH
  const bitmaps = await Promise.all(plan.tiles.map((t) => loadTile(layerUrl(layer, t.z, t.x, t.y, r.date))))
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.filter = filter
  ctx.imageSmoothingQuality = 'high'
  let got = 0
  plan.tiles.forEach((t, i) => {
    const b = bitmaps[i]
    if (!b) return
    got++
    ctx.drawImage(b, t.dx * sx, t.dy * sy, 256 * sx + 0.5, 256 * sy + 0.5)
  })
  ctx.restore()
  return { got, total: plan.tiles.length }
}

/** Compose the clean (effect-free) frame for a layer around a target. */
export async function composeFrame(r: ComposeRequest): Promise<ComposeResult> {
  if (typeof document === 'undefined') return { canvas: null, status: 'unavailable', layer: r.layer }
  if (isOffline()) return { canvas: null, status: 'offline', layer: r.layer }
  const canvas = document.createElement('canvas')
  canvas.width = r.width
  canvas.height = r.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return { canvas: null, status: 'unavailable', layer: r.layer }
  ctx.fillStyle = '#050c10'
  ctx.fillRect(0, 0, r.width, r.height)

  const tryLayer = async (layer: ImageryLayer) => {
    if (layer.base && LAYERS[layer.base]) {
      // dim, desaturated context map under a transparent data overlay
      await drawLayer(ctx, LAYERS[layer.base], { ...r, layer: LAYERS[layer.base], date: null }, 0.55, 'saturate(0.35) brightness(0.7)')
    }
    return drawLayer(ctx, layer, r)
  }
  const before = failures
  let used = r.layer
  let res = await tryLayer(r.layer)
  let drawnDate = r.date
  // daily swath products have black gaps between orbits: try neighbouring days and keep the fullest frame
  if (res.got > 0 && r.layer.temporal === 'daily' && r.date && !r.layer.base) {
    let bestGap = gapShare(ctx, r.width, r.height)
    if (bestGap > 0.06) {
      // the neighbouring days load in parallel; keep the one with the smallest gap
      const alts = await Promise.all(
        [-1, 1, -2, 2].map(async (off) => {
          const c = document.createElement('canvas')
          c.width = r.width
          c.height = r.height
          const cx = c.getContext('2d', { willReadFrequently: true })
          if (!cx) return null
          cx.fillStyle = '#050c10'
          cx.fillRect(0, 0, r.width, r.height)
          const alt = await drawLayer(cx, r.layer, { ...r, date: shiftDate(r.date!, off) })
          return alt.got ? { c, gap: gapShare(cx, r.width, r.height), date: shiftDate(r.date!, off) } : null
        }),
      )
      let best: { c: HTMLCanvasElement; date: string } | null = null
      for (const a of alts) {
        if (a && a.gap < bestGap - 0.02) {
          bestGap = a.gap
          best = a
        }
      }
      if (best) {
        ctx.drawImage(best.c, 0, 0)
        drawnDate = best.date
      }
    }
  }
  if (res.got === 0 && r.layer.fallback && LAYERS[r.layer.fallback]) {
    used = LAYERS[r.layer.fallback]
    ctx.fillRect(0, 0, r.width, r.height)
    res = await tryLayer(used)
  }
  if (res.got === 0) {
    const networkDown = failures > before || isOffline()
    return { canvas: null, status: networkDown ? 'offline' : 'unavailable', layer: used }
  }
  return { canvas, status: res.got < res.total ? 'partial' : 'ok', layer: used, date: drawnDate }
}

/** Share of (near-)black pixels: missing swath data. */
function gapShare(ctx: CanvasRenderingContext2D, w: number, h: number): number {
  try {
    const d = ctx.getImageData(0, 0, w, h).data
    let n = 0
    let total = 0
    for (let i = 0; i < d.length; i += 4 * 7) {
      total++
      if (d[i] + d[i + 1] + d[i + 2] < 24) n++
    }
    return total ? n / total : 0
  } catch {
    return 0
  }
}

function shiftDate(iso: string, days: number): string {
  const t = Date.parse(`${iso}T00:00:00Z`) + days * 86400000
  return new Date(t).toISOString().slice(0, 10)
}
