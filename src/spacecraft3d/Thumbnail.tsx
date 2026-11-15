// <ComponentThumb> — a live 3D render of one component as a cached image (catalog cards, menu tile).
// This file does NOT import three.js: the shared offscreen renderer is loaded on first use, so it is
// safe to import statically from any screen.
import { useEffect, useState, type CSSProperties } from 'react'
import type { MissionId } from '../data/types'

type Renderer = typeof import('./thumbRenderer')
let mod: Promise<Renderer> | null = null
const load = () => (mod ??= import('./thumbRenderer'))

/** in-memory copy of finished urls so remounts paint instantly */
const ready = new Map<string, string>()

export interface ComponentThumbProps {
  componentId: string
  missionId: MissionId
  /** CSS pixel size (square). Rendered at up to 2× for HiDPI. */
  size?: number
  className?: string
  style?: CSSProperties
  /** accessible text (defaults to empty = decorative) */
  alt?: string
}

export function ComponentThumb({ componentId, missionId, size = 96, className, style, alt = '' }: ComponentThumbProps) {
  const key = `${missionId}:${componentId}:${size}`
  const [url, setUrl] = useState<string | null>(() => ready.get(key) ?? null)
  useEffect(() => {
    const hit = ready.get(key)
    if (hit) {
      setUrl(hit)
      return
    }
    setUrl(null)
    let alive = true
    load()
      .then((m) => m.getThumbnail(missionId, componentId, size))
      .then((u) => {
        if (u) ready.set(key, u)
        if (alive) setUrl(u)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [key, missionId, componentId, size])

  const box: CSSProperties = { width: size, height: size, ...style }
  return url ? (
    <img src={url} width={size} height={size} alt={alt} draggable={false} className={className} style={{ ...box, objectFit: 'contain' }} />
  ) : (
    <span
      aria-hidden={!alt}
      aria-label={alt || undefined}
      className={className}
      style={{
        ...box,
        display: 'inline-block',
        borderRadius: 10,
        background: 'radial-gradient(circle at 40% 35%, rgba(140,230,210,0.10), rgba(255,255,255,0.02) 70%)',
      }}
    />
  )
}

/** Warm the cache for a whole mission catalog (call when entering the builder). */
export function prewarmThumbnails(missionId: MissionId, size = 96) {
  void load().then((m) => m.prewarm(missionId, size))
}

export default ComponentThumb
