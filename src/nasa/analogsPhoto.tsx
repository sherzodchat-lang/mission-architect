import type { ReactNode } from 'react'
import { ImageSlot, cx } from '../components'
import type { Analog } from '../data'
import { useNasaImage } from './imageLibrary'

/**
 * Real photo of an analog mission from the NASA Image and Video Library (curated nasa_id, live search otherwise),
 * with the API's credit. Offline / no picture: the mission's own card picture. `children` are overlaid (name, %).
 */
export function AnalogPhoto({
  analog,
  className,
  credit = 'corner',
  children,
}: {
  analog: Analog
  className?: string
  /** 'corner' = small credit at the top left; 'none' = caller prints it. */
  credit?: 'corner' | 'none'
  children?: ReactNode
}) {
  const { status, image } = useNasaImage(analog.image?.nasaId, analog.image ? null : analog.imageQuery)
  const caption = analog.image?.caption || image?.title || analog.name
  return (
    <div className={cx('relative overflow-hidden rounded-card bg-bg-2', className)}>
      {status === 'ready' && image ? (
        <img
          key={image.src}
          src={image.src}
          alt={`${caption}. Credit: ${image.credit}`}
          className="absolute inset-0 h-full w-full animate-fade-in object-cover"
          loading="lazy"
          draggable={false}
        />
      ) : status === 'loading' ? (
        <div className="bg-grid absolute inset-0 animate-pulse-soft" aria-hidden="true" />
      ) : (
        <ImageSlot id={`collection_${analog.mission}`} aspect="analog" className="absolute inset-0 !h-full !rounded-none !border-0" aiMark="tl" />
      )}
      {children}
      {credit === 'corner' && status === 'ready' && image && (
        <span
          className="absolute top-2.5 left-2.5 max-w-[55%] truncate rounded-full bg-bg/75 px-2 py-0.5 text-xs leading-tight text-text-dim"
          title={`${caption} · ${image.credit} · NASA Image and Video Library (${image.nasaId})`}
        >
          {image.credit}
        </span>
      )}
    </div>
  )
}
