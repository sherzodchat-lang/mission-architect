import type { ReactNode } from 'react'
import { audio } from '../audio/audioManager'
import { cx } from './cx'
import { Icon } from './Icon'

export interface CheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: ReactNode
  disabled?: boolean
  /** 'box' (default) = rounded square; 'radio' = circle with mint dot (single choice look, as in 02 / 04) */
  shape?: 'box' | 'radio'
  className?: string
}

/** Checkbox with a mint tick (ground-station selection, hint settings). */
export function Checkbox({ checked, onChange, label, disabled, shape = 'box', className }: CheckboxProps) {
  return (
    <button
      type="button"
      role={shape === 'radio' ? 'radio' : 'checkbox'}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => {
        audio.playSfx('ui_click')
        onChange(!checked)
      }}
      className={cx('inline-flex items-center gap-2.5 text-base text-text disabled:opacity-45', className)}
    >
      {shape === 'radio' ? (
        <span
          className={cx(
            'flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border transition-colors',
            checked ? 'border-mint bg-mint/10' : 'border-white/35',
          )}
        >
          <span className={cx('h-2.5 w-2.5 rounded-full transition-transform', checked ? 'scale-100 bg-mint' : 'scale-0')} />
        </span>
      ) : (
        <span
          className={cx(
            'flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[7px] border transition-colors',
            checked ? 'mint-fill border-transparent' : 'border-white/30 bg-white/[0.04] text-transparent',
          )}
        >
          <Icon name="check" size={14} strokeWidth={2.6} />
        </span>
      )}
      {label}
    </button>
  )
}
