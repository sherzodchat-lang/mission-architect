import type { ReactNode } from 'react'
import { cx, fmtNum, TONE_TEXT, type Status } from './cx'
import { Icon, type IconName } from './Icon'
import { Tooltip } from './Tooltip'

export interface GaugeProps {
  label: string
  /** "kg", "W", "$M", "GB", "Mbps", "mo" */
  unit: string
  used: number
  available: number
  status: Status
  /** lines shown on hover, e.g. ["Imager 6 W", "Radio 2 W"] */
  breakdown?: string[]
  /** heading of the tooltip, default "<label>: used / available unit" */
  tooltipTitle?: string
  /**
   * 'horizontal' (default for new code) = thin bar with label left and mono "used / available unit" right, as in
   * the 03 "System constraints" panel. 'vertical' = legacy tall bar, kept for compatibility.
   */
  orientation?: 'vertical' | 'horizontal'
  /** horizontal only: label and value stacked above the bar (04 bottom strip). Default false = one row. */
  stacked?: boolean
  /** optional icon before the label (horizontal) */
  icon?: IconName
  /** override number formatting for used/available */
  format?: (n: number) => string
  /** custom value text instead of "used / available unit" (e.g. "10 Mbps" for a rate) */
  valueText?: ReactNode
  /** bar height in px for vertical variant (default 150) */
  barHeight?: number
  className?: string
}

/** Bar fill per status: mint-green ok, warm amber warning, coral critical. */
const FILL: Record<Status, string> = {
  green: 'bg-green',
  amber: 'bg-amber',
  red: 'bg-red',
}
/** value text colour: neutral when ok (as in the mockups), tinted when not */
const VALUE: Record<Status, string> = {
  green: 'text-text',
  amber: 'text-amber',
  red: 'text-red',
}

function tip(p: GaugeProps, fmt: (n: number) => string): ReactNode {
  return (
    <>
      <b className="mb-1 block font-medium text-text">
        {p.tooltipTitle ?? (
          <>
            {p.label} <span className="num font-normal text-text-dim">{fmt(p.used)} / {fmt(p.available)} {p.unit}</span>
          </>
        )}
      </b>
      {p.breakdown?.map((l, i) => (
        <span key={i} className="block text-text-dim">
          {l}
        </span>
      ))}
      {!p.breakdown?.length && <span className="block text-text-dim">No breakdown yet.</span>}
    </>
  )
}

export function Gauge(props: GaugeProps) {
  const { label, unit, used, available, status, orientation = 'vertical', icon, className } = props
  const fmt = props.format ?? fmtNum
  const ratio = available > 0 ? used / available : used > 0 ? 2 : 0
  const pct = Math.max(0, Math.min(1, ratio)) * 100
  const over = used > available
  const aria = `${label} ${fmt(used)} of ${fmt(available)} ${unit}`
  const value = props.valueText ?? (
    <>
      {fmt(used)} / {fmt(available)} {unit}
    </>
  )

  if (orientation === 'horizontal') {
    const bar = (
      <div className="relative h-1.5 rounded-full bg-white/[0.13]">
        <div
          className={cx('absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out', FILL[status])}
          style={{ width: `${pct}%` }}
        />
        {over && (
          <span
            className={cx('absolute -top-1 right-0 h-3.5 w-[3px] rounded-full shadow-[0_0_0_2px_rgb(10_26_33/0.8)]', FILL[status])}
            aria-hidden="true"
          />
        )}
      </div>
    )
    return (
      <Tooltip content={tip(props, fmt)} placement="top" className={cx('min-w-0 flex-1', className)}>
        <div className="w-full outline-offset-4" tabIndex={0} role="group" aria-label={aria}>
          {props.stacked ? (
            <>
              <div className="flex items-center gap-2 text-sm text-text">
                {icon && <Icon name={icon} size={18} className="text-text-dim" />}
                {label}
              </div>
              <div className={cx('num mt-0.5 mb-2 text-base whitespace-nowrap', VALUE[status])}>{value}</div>
            </>
          ) : (
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <span className="flex items-center gap-2 text-base whitespace-nowrap text-text">
                {icon && <Icon name={icon} size={18} className="self-center text-text-dim" />}
                {label}
              </span>
              <span className={cx('num text-base whitespace-nowrap', VALUE[status])}>{value}</span>
            </div>
          )}
          {bar}
        </div>
      </Tooltip>
    )
  }

  // ---- legacy vertical variant ----
  const h = props.barHeight ?? 150
  return (
    <Tooltip content={tip(props, fmt)} placement="bottom" className={className}>
      <div className="flex w-[84px] flex-col items-center" tabIndex={0} role="group" aria-label={aria}>
        <div className="num mb-1.5 text-xs text-text-dim">
          {fmt(available)} {unit}
        </div>
        <div className="relative w-2 rounded-full bg-white/[0.13]" style={{ height: h }}>
          <div
            className={cx('absolute right-0 bottom-0 left-0 rounded-full transition-[height] duration-500 ease-out', FILL[status])}
            style={{ height: `${pct}%` }}
          />
          {over && (
            <span className={cx('absolute -top-1 left-1/2 h-[3px] w-4 -translate-x-1/2 rounded-full', FILL[status])} aria-hidden="true" />
          )}
        </div>
        <div className="mt-2 text-sm font-medium text-text">{label}</div>
        <div className={cx('num text-center text-xs leading-tight', TONE_TEXT[status === 'green' ? 'neutral' : status])}>
          {fmt(used)} /<br />
          {fmt(available)} {unit}
        </div>
      </div>
    </Tooltip>
  )
}
