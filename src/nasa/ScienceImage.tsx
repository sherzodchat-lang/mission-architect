import { useEffect, useRef, useState } from 'react'
import { Icon, cx } from '../components'
import type { ScienceFrame } from './frames'
import { composeFrame, type ComposeResult, type ImageryStatus } from './imagery'
import { drawReveal, renderFrame } from './renderFrame'

const composed = new Map<string, Promise<ComposeResult>>()

function getComposed(f: ScienceFrame, w: number, h: number): Promise<ComposeResult> {
  const key = `${f.layer.id}|${f.target.lat}|${f.target.lon}|${f.zoom}|${f.date}|${w}x${h}`
  let p = composed.get(key)
  if (!p) {
    p = composeFrame({ layer: f.layer, lat: f.target.lat, lon: f.target.lon, zoom: f.zoom, date: f.date, width: w, height: h })
    composed.set(key, p)
    p.then((r) => {
      if (!r.canvas) composed.delete(key) // retry later
    })
    if (composed.size > 60) composed.delete(composed.keys().next().value!)
  }
  return p
}

export interface ScienceImageProps {
  frame: ScienceFrame
  /** internal resolution (3:2) */
  width?: number
  height?: number
  /** scan-line arrival animation on first show */
  animate?: boolean
  /** start loading only when scrolled into view */
  lazy?: boolean
  /** show "Queued on board" text over the missing rows */
  showQueued?: boolean
  /** 'aspect' = 3:2 box at container width; 'cover' = fill the parent box (cropped) */
  fit?: 'aspect' | 'cover'
  className?: string
  /** called once the frame is drawn: the date and layer actually shown */
  onLoaded?: (r: { date: string | null; layerName: string }) => void
}

/** A returned NASA frame with the design effects applied. Always 3:2; fills its container width. */
export function ScienceImage({
  frame,
  width = 480,
  height = 320,
  animate = false,
  lazy = false,
  showQueued = true,
  fit = 'aspect',
  className,
  onLoaded,
}: ScienceImageProps) {
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [visible, setVisible] = useState(!lazy)
  const [status, setStatus] = useState<ImageryStatus | 'loading'>('loading')
  const [edge, setEdge] = useState(1)

  useEffect(() => {
    if (visible || !wrap.current) return
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && setVisible(true), { rootMargin: '120px' })
    io.observe(wrap.current)
    return () => io.disconnect()
  }, [visible])

  useEffect(() => {
    if (!visible) return
    let alive = true
    let raf = 0
    setStatus('loading')
    getComposed(frame, width, height).then((res) => {
      if (!alive) return
      const st: ImageryStatus = res.status
      setStatus(st)
      const out = canvas.current
      if (!res.canvas || !out) return
      onLoaded?.({ date: res.date ?? null, layerName: res.layer.name })
      // the effects are rendered once; the arrival animation only uncovers rows
      const full = document.createElement('canvas')
      full.width = out.width
      full.height = out.height
      const edgeFull = renderFrame(full, res.canvas, frame.effects, 1)
      const ctx = out.getContext('2d')
      if (!ctx) return
      const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
      if (!animate || reduced) {
        ctx.drawImage(full, 0, 0)
        setEdge(edgeFull)
        return
      }
      const t0 = performance.now()
      const dur = 1400
      const tick = (t: number) => {
        if (!alive) return
        const p = Math.min(1, (t - t0) / dur)
        drawReveal(ctx, full, edgeFull * (1 - (1 - p) ** 2), edgeFull)
        if (p < 1) raf = requestAnimationFrame(tick)
        else setEdge(edgeFull)
      }
      raf = requestAnimationFrame(tick)
    })
    return () => {
      alive = false
      cancelAnimationFrame(raf)
    }
  }, [visible, frame, width, height, animate]) // eslint-disable-line react-hooks/exhaustive-deps

  const failed = status === 'offline' || status === 'unavailable'
  return (
    <div
      ref={wrap}
      className={cx('relative w-full overflow-hidden rounded-[10px] bg-[#050c10]', fit === 'aspect' ? 'aspect-[3/2]' : 'h-full', className)}
    >
      <canvas
        ref={canvas}
        width={width}
        height={height}
        className={cx('absolute inset-0 h-full w-full object-cover transition-opacity duration-300', status === 'loading' || failed ? 'opacity-0' : 'opacity-100')}
        role="img"
        aria-label={`${frame.layer.name}: ${frame.target.name}`}
      />
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-text-dim">
          <span className="animate-pulse-soft h-2 w-2 rounded-full bg-mint" aria-hidden="true" />
          Receiving frame…
        </div>
      )}
      {failed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-4 text-center">
          <Icon name="globe" size={22} className="text-text-faint" />
          <span className="text-sm text-text-dim">
            {status === 'offline' ? 'No network — imagery unavailable' : 'NASA imagery unavailable for this frame'}
          </span>
          <span className="text-xs text-text-faint">The mission and its data still count.</span>
        </div>
      )}
      {showQueued && !failed && status !== 'loading' && edge < 0.92 && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center text-xs text-text-dim"
          style={{ top: `${edge * 100}%` }}
        >
          Still on board — waiting for downlink
        </div>
      )}
    </div>
  )
}
