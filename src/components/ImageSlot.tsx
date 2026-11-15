import { useEffect, useState } from 'react'
import { loadPublicIndex } from '../lib/publicIndex'
import { publicUrl } from '../lib/publicUrl'
import { cx } from './cx'

/** Aspect ratios from GAME_DESIGN 10.3 */
export const IMAGE_ASPECT = {
  mission: '16 / 7',
  thumb: '1 / 1',
  rocket: '1 / 3',
  collection: '4 / 3',
  analog: '16 / 9',
} as const

export type AiMarkCorner = 'tl' | 'tr' | 'bl' | 'br'

const CORNER: Record<AiMarkCorner, string> = {
  tl: 'top-3 left-3',
  tr: 'top-2 right-2',
  bl: 'bottom-2 left-2',
  br: 'bottom-2 right-2',
}

/**
 * Visible "SI-generated" chip (Space Apps rule: synthetic-intelligence images carry a visible watermark).
 * Absolutely positioned: place it inside any `relative` picture frame. Never use it on real NASA photos.
 */
export function AiMark({ corner = 'tr', className }: { corner?: AiMarkCorner; className?: string }) {
  return (
    <span
      className={cx(
        'pointer-events-none absolute z-10 inline-flex h-[18px] items-center rounded-full border border-white/20 bg-[#06141b]/65 px-2 text-[12px] leading-none font-normal tracking-wide whitespace-nowrap text-white/75 backdrop-blur-sm select-none',
        CORNER[corner],
        className,
      )}
      aria-hidden="true"
    >
      SI-generated
    </span>
  )
}

export interface ImageSlotProps {
  /** CSS aspect-ratio, e.g. "16 / 7", or a number (w/h), or a key of IMAGE_ASPECT */
  aspect?: string | number
  /** if public/images/cards/<id>.webp exists (and loads) it is shown, otherwise the slot stays empty */
  id?: string
  className?: string
  /** CSS object-position of the picture (default centred), e.g. '50% 0%' to keep the top of a cover visible */
  position?: string
  /** show the visible "SI-generated" chip (true = top right) once the picture is loaded; use for every AI-made picture */
  aiMark?: boolean | AiMarkCorner
}

const resolved = new Map<string, string | null>()

/**
 * Picture slot in a glass frame: faint grid, hairline, no icon or text when empty. Never generate artwork for it.
 * Probes public/images/cards/index.json first so missing images are not even requested.
 */
export function ImageSlot({ aspect = '16 / 9', id, className, position, aiMark }: ImageSlotProps) {
  const [src, setSrc] = useState<string | null>(id ? (resolved.get(id) ?? null) : null)

  useEffect(() => {
    if (!id) return
    if (resolved.has(id)) {
      setSrc(resolved.get(id) ?? null)
      return
    }
    let cancelled = false
    const file = `${id}.webp`
    loadPublicIndex('images/cards').then((idx) => {
      if (cancelled || (idx && !idx.has(file))) {
        if (idx && !idx.has(file)) resolved.set(id, null)
        return
      }
      const url = publicUrl(`images/cards/${file}`)
      const img = new Image()
      img.onload = () => {
        resolved.set(id, url)
        if (!cancelled) setSrc(url)
      }
      img.onerror = () => resolved.set(id, null)
      img.src = url
    })
    return () => {
      cancelled = true
    }
  }, [id])

  const ratio = typeof aspect === 'string' && aspect in IMAGE_ASPECT ? IMAGE_ASPECT[aspect as keyof typeof IMAGE_ASPECT] : aspect
  return (
    <div
      className={cx('bg-grid relative w-full overflow-hidden rounded-card border border-white/10 shadow-[inset_0_1px_0_rgb(255_255_255/0.05)]', className)}
      style={{ aspectRatio: ratio }}
      aria-hidden="true"
    >
      {src && <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" style={position ? { objectPosition: position } : undefined} draggable={false} />}
      {src && aiMark && <AiMark corner={aiMark === true ? 'tr' : aiMark} />}
    </div>
  )
}
