import type { ReactNode } from 'react'
import { cx, TONE_TEXT, type Tone } from './cx'
import { Icon, type IconName } from './Icon'

export interface StatTileProps {
  label: ReactNode
  value: ReactNode
  icon?: IconName
  /** colour of the value (default neutral text) */
  tone?: Tone
  /** small line under the value/label */
  hint?: ReactNode
  /**
   * 'hero'    = big light number over a dim label, glass tile (01 "03 missions unlocked", 06 "76 GB")
   * 'compact' = label over a mono value, no frame (04 "Altitude 600 km", 05 telemetry rows)
   * 'tile'    = legacy small framed box: icon + label + value (default, for un-restyled screens)
   */
  variant?: 'hero' | 'compact' | 'tile'
  /** hero/compact: draw no glass frame (when placed inside a panel) */
  bare?: boolean
  className?: string
}

/** Stat display. See `variant`. */
export function StatTile({ label, value, icon, tone = 'neutral', hint, variant = 'tile', bare, className }: StatTileProps) {
  if (variant === 'hero') {
    return (
      <div className={cx(!bare && 'glass px-6 py-5', 'flex flex-col', className)}>
        <div className={cx('text-stat font-light tracking-[-0.02em]', TONE_TEXT[tone])}>{value}</div>
        <div className="mt-2 text-lg leading-snug text-text-dim">{label}</div>
        {hint && <div className="mt-1 text-sm text-text-dim">{hint}</div>}
      </div>
    )
  }
  if (variant === 'compact') {
    return (
      <div className={cx(!bare && 'glass-inset px-4 py-3', 'min-w-0', className)}>
        <div className="flex items-center gap-2 text-sm text-text-dim">
          {icon && <Icon name={icon} size={16} />}
          {label}
        </div>
        <div className={cx('num mt-0.5 text-2xl', TONE_TEXT[tone])}>{value}</div>
        {hint && <div className="mt-0.5 text-sm text-text-dim">{hint}</div>}
      </div>
    )
  }
  return (
    <div className={cx('glass-inset flex items-center gap-3 px-3.5 py-2.5', className)}>
      {icon && <Icon name={icon} size={24} className="shrink-0 text-text-dim" />}
      <div className="min-w-0">
        <div className="truncate text-sm leading-tight text-text-dim">{label}</div>
        <div className={cx('text-lg leading-tight font-medium', TONE_TEXT[tone])}>{value}</div>
        {hint && <div className="text-xs text-text-dim">{hint}</div>}
      </div>
    </div>
  )
}
