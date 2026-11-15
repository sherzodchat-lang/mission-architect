import type { ReactNode } from 'react'
import { audio } from '../audio/audioManager'
import { cx } from './cx'
import { Tooltip } from './Tooltip'

export interface TabItem<T extends string = string> {
  id: T
  label: ReactNode
  /** small count/badge after the label */
  badge?: ReactNode
  disabled?: boolean
  /** tooltip shown on a disabled tab (why it is unavailable) */
  disabledReason?: string
}

export interface TabsProps<T extends string = string> {
  tabs: TabItem<T>[]
  value: T
  onChange: (id: T) => void
  /**
   * 'pill' (= 'segmented') = glass track with a mint active segment (catalog tabs "Payload | Power | Comms",
   * "Globe | Ground track", "1x | 4x"); 'underline' = light chip row for filters (event log).
   */
  variant?: 'pill' | 'segmented' | 'underline'
  /** stretch tabs to fill the row (equal widths) */
  fill?: boolean
  size?: 'sm' | 'md'
  className?: string
  'aria-label'?: string
}

export function Tabs<T extends string = string>({
  tabs,
  value,
  onChange,
  variant = 'pill',
  fill,
  size = 'md',
  className,
  'aria-label': ariaLabel,
}: TabsProps<T>) {
  const seg = variant !== 'underline'
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cx(
        seg
          ? 'inline-flex items-center gap-0.5 rounded-control border border-white/10 bg-white/[0.04] p-1 shadow-[inset_0_1px_2px_rgb(0_0_0/0.18)]'
          : 'flex flex-wrap gap-1.5',
        fill && 'flex w-full',
        className,
      )}
    >
      {tabs.map((t) => {
        const active = t.id === value
        const btn = (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={active}
            disabled={t.disabled}
            onClick={() => {
              if (!active) {
                audio.playSfx('ui_click')
                onChange(t.id)
              }
            }}
            className={cx(
              'inline-flex items-center justify-center gap-1.5 font-medium whitespace-nowrap transition-[background-color,color,box-shadow] duration-200',
              fill && 'flex-1',
              seg && [
                size === 'sm' ? 'h-8 rounded-[8px] px-3 text-sm' : 'h-9 rounded-[9px] px-4 text-sm',
                active ? 'mint-fill' : 'text-text hover:bg-white/[0.06]',
              ],
              !seg && [
                'h-8 rounded-full border px-3.5 text-sm',
                active
                  ? 'border-white/20 bg-white/[0.12] text-text'
                  : 'border-white/10 text-text-dim hover:border-white/20 hover:text-text',
              ],
              t.disabled && 'cursor-not-allowed opacity-40 hover:bg-transparent',
            )}
          >
            {t.label}
            {t.badge != null && <span className={cx('num text-xs', active ? 'opacity-75' : 'text-text-dim')}>{t.badge}</span>}
          </button>
        )
        return t.disabled && t.disabledReason ? (
          <Tooltip key={t.id} content={t.disabledReason} placement="bottom" className={fill ? 'flex-1' : undefined}>
            {btn}
          </Tooltip>
        ) : (
          btn
        )
      })}
    </div>
  )
}
