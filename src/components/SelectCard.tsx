import type { HTMLAttributes, KeyboardEvent, ReactNode } from 'react'
import { audio } from '../audio/audioManager'
import { cx } from './cx'
import { Icon } from './Icon'

export interface SelectCardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  selected?: boolean
  /** not selectable (e.g. GEO for a CubeSat); dimmed, with `disabledReason` as native title */
  disabled?: boolean
  disabledReason?: string
  /** locked (e.g. unlocked by stars): dimmed + lock badge */
  locked?: boolean
  onSelect?: () => void
  children?: ReactNode
}

/**
 * Selectable glass card: mint hairline frame + faint mint tint + corner check when selected. A div with role="button" so it can
 * contain real buttons (e.g. +/-) inside.
 */
export function SelectCard({
  selected,
  disabled,
  disabledReason,
  locked,
  onSelect,
  className,
  children,
  ...rest
}: SelectCardProps) {
  const inert = disabled || locked
  const fire = () => {
    if (inert) return
    audio.playSfx('ui_click')
    onSelect?.()
  }
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      fire()
    }
  }
  return (
    <div
      role="button"
      tabIndex={inert ? -1 : 0}
      aria-pressed={selected}
      aria-disabled={inert || undefined}
      title={inert ? disabledReason : undefined}
      onClick={fire}
      onKeyDown={onKey}
      className={cx(
        'glass relative text-left transition-[border-color,background-color,box-shadow] duration-200',
        selected
          ? '!border-mint/55 !bg-mint/[0.07] shadow-[inset_0_1px_0_rgb(255_255_255/0.08),0_0_0_1px_rgb(163_240_212/0.18),0_18px_40px_-18px_rgb(0_8_12/0.65)]'
          : '',
        !inert && !selected && 'cursor-pointer hover:!border-white/25 hover:!bg-white/[0.07]',
        !inert && selected && 'cursor-pointer',
        inert && 'cursor-not-allowed',
        disabled && 'opacity-50 saturate-50',
        locked && 'opacity-75 saturate-0',
        className,
      )}
      {...rest}
    >
      {children}
      {selected && (
        <span className="mint-fill absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-full">
          <Icon name="check" size={16} strokeWidth={2.4} />
        </span>
      )}
      {locked && (
        <span className="absolute inset-0 flex items-center justify-center rounded-panel bg-bg/50 text-text-dim">
          <span className="glass-strong flex h-14 w-14 items-center justify-center rounded-full">
            <Icon name="lock" size={26} />
          </span>
        </span>
      )}
    </div>
  )
}
