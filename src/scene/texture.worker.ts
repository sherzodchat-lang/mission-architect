// Generates procedural planet textures off the main thread.
import { generateBody } from './texgen'
import type { BodyKind } from './model'

self.onmessage = (e: MessageEvent<{ id: number; kind: BodyKind }>) => {
  const { id, kind } = e.data
  try {
    const px = generateBody(kind, (w, h) => new OffscreenCanvas(w, h))
    const transfer = [px.map.buffer, px.aux.buffer, ...(px.clouds ? [px.clouds.buffer] : [])] as ArrayBuffer[]
    ;(self as unknown as Worker).postMessage({ id, ok: true, px }, transfer)
  } catch (err) {
    ;(self as unknown as Worker).postMessage({ id, ok: false, error: String(err) })
  }
}
