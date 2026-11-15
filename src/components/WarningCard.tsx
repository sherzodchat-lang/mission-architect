import type { ReactNode } from 'react'
import { audio } from '../audio/audioManager'
import { cx } from './cx'
import { Icon } from './Icon'

export interface WarningCardProps {
  severity: 'amber' | 'red'
  /** WHAT happened, short heading: "Power deficit" */
  what: ReactNode
  /** optional value after the title, rendered "Power deficit · 5 W" */
  value?: ReactNode
  /** WHY: "Payload demand exceeds solar generation." */
  why?: ReactNode
  /** mono numbers line: "Demand 14 W / Available 9 W" */
  detail?: ReactNode
  /** HOW to fix: "Add solar capacity or remove an instrument." (rendered as a dim "Fix:" line) */
  fix?: ReactNode
  /** link label, e.g. "Review power options" (an arrow is appended); needs `onAction` */
  actionLabel?: ReactNode
  onAction?: () => void
  /** optional trailing element (e.g. small button) - legacy slot */
  action?: ReactNode
  className?: string
}

const RAIL = { red: 'bg-red', amber: 'bg-amber' } as const

/**
 * Constraint warning as in 03 "System constraints": glass card with a coloured left rail, title · value,
 * explanation, mono numbers and a "Review ... ->" link. With only `what` it renders as a one-line notice.
 */
export function WarningCard({
  severity,
  what,
  value,
  why,
  detail,
  fix,
  actionLabel,
  onAction,
  action,
  className,
}: WarningCardProps) {
  const compact = why == null && detail == null && fix == null && actionLabel == null
  return (
    <div
      role="alert"
      className={cx(
        'glass-inset relative flex items-start gap-3 !rounded-card py-3.5 pr-4 pl-[34px]',
        severity === 'red' && '!border-red/25',
        className,
      )}
    >
      <span
        className={cx('absolute top-3.5 bottom-3.5 left-4 w-[3px] rounded-full', RAIL[severity])}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <h3 className={cx('leading-snug text-text', compact ? 'text-base font-normal' : 'text-lg font-medium')}>
          {what}
          {value != null && (
            <>
              <span className="mx-1.5 text-text-dim" aria-hidden="true">
                ·
              </span>
              <span className="num">{value}</span>
            </>
          )}
        </h3>
        {why != null && <p className="mt-1 text-sm leading-snug text-text-dim">{why}</p>}
        {detail != null && <p className="num mt-1 text-sm text-text">{detail}</p>}
        {fix != null && (
          <p className="mt-1 text-sm leading-snug text-text-dim">
            <span className="text-text">Fix: </span>
            {fix}
          </p>
        )}
        {actionLabel != null && onAction && (
          <button
            type="button"
            onClick={() => {
              audio.playSfx('ui_click')
              onAction()
            }}
            className="mt-2 inline-flex items-center gap-1.5 text-sm text-text underline decoration-white/40 underline-offset-4 transition-colors hover:text-mint hover:decoration-mint/70"
          >
            {actionLabel}
            <Icon name="arrowRight" size={16} />
          </button>
        )}
      </div>
      {action}
    </div>
  )
}

export interface CheckRowProps {
  children: ReactNode
  /** false renders a grey, empty circle */
  ok?: boolean
  className?: string
}

/** "Mass within limit" / installed-stack style row with a mint check. */
export function CheckRow({ children, ok = true, className }: CheckRowProps) {
  return (
    <div className={cx('flex items-center gap-2.5 py-1.5 text-base text-text', className)}>
      <span
        className={cx(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
          ok ? 'mint-fill' : 'border border-white/30 text-transparent',
        )}
      >
        <Icon name="check" size={13} strokeWidth={2.6} />
      </span>
      {children}
    </div>
  )
}
