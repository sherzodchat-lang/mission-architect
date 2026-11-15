import { Fragment, type ReactNode } from 'react'
import { cx } from '../cx'

export interface PageHeaderProps {
  /** crumbs, last one is the current page: ["Earth Observation", "Spacecraft builder"] */
  breadcrumb?: ReactNode[]
  title: ReactNode
  subtitle?: ReactNode
  /** block under the title in place of / after the subtitle (team bar) */
  below?: ReactNode
  /** step counter "02 / 05": [current, total] (1-based) */
  step?: [number, number]
  /** actions on the right (Undo / Redo / Save draft, Compare missions, Export report) */
  actions?: ReactNode
  /** small line under the actions, e.g. "Saved just now" */
  actionsNote?: ReactNode
  /** 'page' = 44px title (03-06), 'hero' = 72px display title (01) */
  size?: 'page' | 'hero'
  className?: string
}

/**
 * Breadcrumb + large light title + subtitle (left) and step counter + actions (right), as in mockups 02-06.
 * Padding matches the shell content gutter: 40px left, 16px right, sits right under the 64px top bar.
 */
export function PageHeader({
  breadcrumb,
  title,
  subtitle,
  below,
  step,
  actions,
  actionsNote,
  size = 'page',
  className,
}: PageHeaderProps) {
  return (
    <div className={cx('flex shrink-0 items-end justify-between gap-8 pt-2.5 pr-4 pb-4 pl-10', className)}>
      <div className="min-w-0">
        {breadcrumb && breadcrumb.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-1.5 flex items-center gap-3 text-sm text-text-dim">
            {breadcrumb.map((c, i) => (
              <Fragment key={i}>
                {i > 0 && <span aria-hidden="true">/</span>}
                <span className={i === breadcrumb.length - 1 ? 'text-text' : undefined}>{c}</span>
              </Fragment>
            ))}
          </nav>
        )}
        <h1
          className={cx(
            'text-text',
            size === 'hero' ? 'text-display font-normal' : 'text-title font-normal',
          )}
        >
          {title}
        </h1>
        {subtitle != null && (
          <p className={cx('text-text-dim', size === 'hero' ? 'mt-3 text-2xl' : 'mt-1.5 text-lg')}>{subtitle}</p>
        )}
        {below != null && <div className="mt-2">{below}</div>}
      </div>
      {(step || actions) && (
        <div className="flex shrink-0 flex-col items-end gap-2 pb-1">
          <div className="flex items-center gap-5">
            {step && (
              <span className="text-lg text-text tabular-nums" aria-label={`Step ${step[0]} of ${step[1]}`}>
                {String(step[0]).padStart(2, '0')}
                <span className="text-text-dim"> / {String(step[1]).padStart(2, '0')}</span>
              </span>
            )}
            {step && actions && <span className="h-9 w-px bg-hairline" aria-hidden="true" />}
            {actions && <div className="flex items-center gap-3">{actions}</div>}
          </div>
          {actionsNote != null && <div className="text-sm text-text-dim">{actionsNote}</div>}
        </div>
      )}
    </div>
  )
}
