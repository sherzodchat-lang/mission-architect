import type { ReactNode } from 'react'
import { audio } from '../audio/audioManager'
import { cx } from './cx'

export interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  /** label after the switch (switch form only) */
  label?: ReactNode
  /**
   * Two labels -> renders a segmented two-state control ("Exploded | Assembled"):
   * the first option is `checked=false`, the second `checked=true`. Without it renders a switch.
   */
  options?: [ReactNode, ReactNode]
  size?: 'sm' | 'md'
  disabled?: boolean
  className?: string
  'aria-label'?: string
}

/** Switch (role="switch") or segmented two-state toggle (`options`). */
export function Toggle({
  checked,
  onChange,
  label,
  options,
  size = 'md',
  disabled,
  className,
  'aria-label': ariaLabel,
}: ToggleProps) {
  const fire = (next: boolean) => {
    if (next === checked) return
    audio.playSfx('ui_click')
    onChange(next)
  }

  if (options) {
    return (
      <div
        role="radiogroup"
        aria-label={ariaLabel}
        className={cx(
          'inline-flex items-center gap-0.5 rounded-control border border-white/10 bg-white/[0.04] p-1 shadow-[inset_0_1px_2px_rgb(0_0_0/0.18)]',
          disabled && 'opacity-45',
          className,
        )}
      >
        {options.map((opt, i) => {
          const on = (i === 1) === checked
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={disabled}
              onClick={() => fire(i === 1)}
              className={cx(
                'inline-flex items-center justify-center font-medium whitespace-nowrap transition-[background-color,color] duration-200',
                size === 'sm' ? 'h-8 rounded-[8px] px-3 text-sm' : 'h-9 rounded-[9px] px-4 text-sm',
                on ? 'mint-fill' : 'text-text hover:bg-white/[0.06]',
              )}
            >
              {opt}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => fire(!checked)}
      className={cx('inline-flex items-center gap-3 text-base text-text disabled:opacity-45', className)}
    >
      <span
        className={cx(
          'relative h-6 w-11 shrink-0 rounded-full border transition-colors duration-200',
          checked ? 'border-transparent bg-mint/90' : 'border-white/15 bg-white/[0.08]',
        )}
      >
        <span
          className={cx(
            'absolute top-[3px] h-4 w-4 rounded-full shadow-[0_1px_3px_rgb(0_0_0/0.35)] transition-[left,background-color] duration-200 ease-out',
            checked ? 'left-[23px] bg-on-mint' : 'left-[3px] bg-text-dim',
          )}
        />
      </span>
      {label}
    </button>
  )
}
