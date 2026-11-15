import { cx } from './cx'
import { Gauge, type GaugeProps } from './Gauge'

export interface ResourceStripProps {
  items: Omit<GaugeProps, 'orientation'>[]
  /** label + mono value stacked above each bar (04 bottom strip, default true) */
  stacked?: boolean
  className?: string
}

/** Glass strip of horizontal gauges separated by hairlines (bottom strip of 04 "Orbit & launch"). */
export function ResourceStrip({ items, stacked = true, className }: ResourceStripProps) {
  return (
    <div className={cx('glass flex items-center px-7 py-3.5', className)}>
      {items.map((it, i) => (
        <div key={it.label} className={cx('flex min-w-0 flex-1 items-center', i > 0 && 'ml-7 border-l border-hairline pl-7')}>
          <Gauge stacked={stacked} {...it} orientation="horizontal" />
        </div>
      ))}
    </div>
  )
}
