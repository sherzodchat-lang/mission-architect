import { useId } from 'react'
import { cx, TONE_HEX, type Tone } from './cx'

export interface SparklineProps {
  values: number[]
  /** hex colour, or a Tone name (default 'green') */
  color?: string | Tone
  /** fixed axis range; defaults to min/max of values */
  min?: number
  max?: number
  /** viewBox size; the svg itself is width:100% so it scales with its container */
  width?: number
  height?: number
  /** fill under the line */
  area?: boolean
  /** dot on the last point (default true) */
  dot?: boolean
  /** show faint horizontal grid lines (default true) */
  grid?: boolean
  className?: string
}

/** Thin SVG line chart for telemetry (05 Battery / Stored data panels). */
export function Sparkline({
  values,
  color = 'green',
  min,
  max,
  width = 240,
  height = 64,
  area = true,
  dot = true,
  grid = true,
  className,
}: SparklineProps) {
  const gid = useId()
  const c = color in TONE_HEX ? TONE_HEX[color as Tone] : color
  const lo = min ?? Math.min(...values, 0)
  const hi = max ?? Math.max(...values, lo + 1)
  const pad = 4
  const n = values.length
  const x = (i: number) => pad + (n <= 1 ? 0 : (i / (n - 1)) * (width - pad * 2))
  const y = (v: number) => pad + (1 - (Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo || 1)) * (height - pad * 2)
  const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`)
  const last = values.length ? { x: x(n - 1), y: y(values[n - 1]) } : null
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" className={cx('block', className)} role="img" aria-label="Trend chart">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c} stopOpacity="0.28" />
          <stop offset="1" stopColor={c} stopOpacity="0" />
        </linearGradient>
      </defs>
      {grid &&
        [0, 0.5, 1].map((f) => (
          <line
            key={f}
            x1={pad}
            x2={width - pad}
            y1={pad + f * (height - pad * 2)}
            y2={pad + f * (height - pad * 2)}
            stroke="#ffffff"
            strokeOpacity="0.08"
          />
        ))}
      {n > 1 && area && (
        <polygon points={`${x(0)},${height - pad} ${pts.join(' ')} ${x(n - 1)},${height - pad}`} fill={`url(#${gid})`} />
      )}
      {n > 1 && (
        <polyline points={pts.join(' ')} fill="none" stroke={c} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
      )}
      {dot && last && <circle cx={last.x} cy={last.y} r="3.5" fill={c} stroke="#0a1a21" strokeWidth="1.5" />}
    </svg>
  )
}
