// Procedural texture cache for the 3D view. Generation runs in a Web Worker when available
// (keeps the SVG fallback animating), otherwise on the main thread after one frame.
import type { BodyKind } from './model'
import { generateBody, type BodyPixels } from './texgen'

export type { BodyPixels }

const cache = new Map<BodyKind, Promise<BodyPixels>>()
let worker: Worker | null | undefined
let seq = 0
const pending = new Map<number, { resolve: (p: BodyPixels) => void; reject: (e: unknown) => void }>()

function getWorker(): Worker | null {
  if (worker !== undefined) return worker
  try {
    if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') throw new Error('no worker')
    const w = new Worker(new URL('./texture.worker.ts', import.meta.url), { type: 'module' })
    w.onmessage = (e: MessageEvent<{ id: number; ok: boolean; px?: BodyPixels; error?: string }>) => {
      const p = pending.get(e.data.id)
      if (!p) return
      pending.delete(e.data.id)
      if (e.data.ok && e.data.px) p.resolve(e.data.px)
      else p.reject(new Error(e.data.error ?? 'texture worker failed'))
    }
    w.onerror = () => {
      // fall back to the main thread for everything still waiting
      worker = null
      pending.forEach((p, id) => {
        pending.delete(id)
        p.reject(new Error('worker error'))
      })
    }
    worker = w
  } catch {
    worker = null
  }
  return worker
}

function onMainThread(kind: BodyKind): Promise<BodyPixels> {
  return new Promise((resolve, reject) =>
    setTimeout(() => {
      try {
        resolve(
          generateBody(kind, (w, h) => {
            const c = document.createElement('canvas')
            c.width = w
            c.height = h
            return c
          }),
        )
      } catch (e) {
        reject(e)
      }
    }, 32),
  )
}

/** Pixels for a body's textures (generated once per session). */
export function bodyPixels(kind: BodyKind): Promise<BodyPixels> {
  let p = cache.get(kind)
  if (!p) {
    const w = getWorker()
    p = w
      ? new Promise<BodyPixels>((resolve, reject) => {
          const id = ++seq
          pending.set(id, { resolve, reject })
          w.postMessage({ id, kind })
        }).catch(() => onMainThread(kind))
      : onMainThread(kind)
    cache.set(kind, p)
  }
  return p
}

/** Soft round sprite (glows). */
let glowCanvas: HTMLCanvasElement | null = null
export function glowSprite(): HTMLCanvasElement {
  if (glowCanvas) return glowCanvas
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 64
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grd.addColorStop(0, 'rgba(255,255,255,1)')
  grd.addColorStop(0.25, 'rgba(255,255,255,0.55)')
  grd.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 64, 64)
  glowCanvas = c
  return c
}
