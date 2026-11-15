import { cx } from './cx'
import { Icon } from './Icon'

export const STEP_NAMES = ['Mission', 'Design', 'Orbit', 'Launch', 'Operations'] as const

export interface StepperProps {
  /**
   * index (0-based) of the active step; steps before it are done. Use steps.length to mark all done.
   * A fractional value (e.g. 3.5) means step floor(current) is active AND already fulfilled: it shows a check.
   */
  current: number
  steps?: readonly string[]
  /** hide the "01" numbers before the names */
  hideNumbers?: boolean
  className?: string
}

/** "● 01 Mission —— ○ 02 Design —— ..." progress line (02 bottom). Done = mint check, active = mint dot, todo = ring. */
export function Stepper({ current: rawCurrent, steps = STEP_NAMES, hideNumbers, className }: StepperProps) {
  const current = Math.floor(rawCurrent)
  const fulfilled = rawCurrent !== current
  return (
    <ol className={cx('flex items-center', className)} aria-label="Progress">
      {steps.map((name, i) => {
        const state = i < current ? 'done' : i === current ? 'active' : 'todo'
        const checked = state === 'done' || (state === 'active' && fulfilled)
        return (
          <li key={name} className="flex items-center" aria-current={state === 'active' ? 'step' : undefined}>
            {i > 0 && (
              <span
                className={cx('mx-3.5 h-px w-9', i <= current ? 'bg-mint/50' : 'bg-white/20')}
                aria-hidden="true"
              />
            )}
            <span className={cx('flex items-center gap-2.5 text-sm whitespace-nowrap', state === 'todo' ? 'text-text-dim' : 'text-text')}>
              <span
                className={cx(
                  'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full',
                  checked && 'mint-fill',
                  state === 'active' && !checked && 'bg-mint shadow-[0_0_0_4px_rgb(163_240_212/0.15)]',
                  state === 'todo' && 'border border-white/40',
                )}
              >
                {checked && <Icon name="check" size={12} strokeWidth={2.8} />}
              </span>
              {!hideNumbers && <span className="num text-xs opacity-80">{String(i + 1).padStart(2, '0')}</span>}
              {name}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
