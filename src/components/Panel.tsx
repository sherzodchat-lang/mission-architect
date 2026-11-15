import type { HTMLAttributes, ReactNode } from 'react'
import { cx } from './cx'

export type PanelTone = 'default' | 'green' | 'amber' | 'red' | 'cyan' | 'mint'

const TONE: Record<PanelTone, string> = {
  default: '',
  cyan: '!border-mint/45',
  mint: '!border-mint/45',
  green: '!border-green/40',
  amber: '!border-amber/45',
  red: '!border-red/50',
}

export interface PanelProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: ReactNode
  /** small dim text under the title (e.g. "100 x 100 x 300 mm") */
  subtitle?: ReactNode
  /** content aligned right in the title row (segmented toggle, "2 issues", "Configure ->") */
  right?: ReactNode
  /** border tint; 'cyan' is the legacy name of 'mint' */
  tone?: PanelTone
  /** remove inner padding of the body (default false) */
  flush?: boolean
  /** hairline under the title row, as in the report panels (default false) */
  divided?: boolean
  /** body className (the root takes `className`) */
  bodyClassName?: string
}

/** Glass panel: translucent fill, 22px backdrop blur, 1px hairline, 20px radius, optional title row. */
export function Panel({
  title,
  subtitle,
  right,
  tone = 'default',
  flush = false,
  divided = false,
  className,
  bodyClassName,
  children,
  ...rest
}: PanelProps) {
  const hasHead = title != null || right != null
  return (
    <section className={cx('glass flex min-h-0 flex-col', TONE[tone], className)} {...rest}>
      {hasHead && (
        <header
          className={cx(
            'flex shrink-0 items-start justify-between gap-3 px-[22px] pt-[18px]',
            divided && 'mx-[10px] border-b border-hairline px-3 pb-3.5',
          )}
        >
          <div className="min-w-0">
            {title != null && <h2 className="text-xl leading-tight font-medium text-text">{title}</h2>}
            {subtitle != null && <p className="mt-1 text-sm text-text-dim">{subtitle}</p>}
          </div>
          {right != null && <div className="flex shrink-0 items-center gap-2 text-sm text-text-dim">{right}</div>}
        </header>
      )}
      <div className={cx('min-h-0 flex-1', !flush && 'p-[22px]', hasHead && !flush && 'pt-3.5', bodyClassName)}>
        {children}
      </div>
    </section>
  )
}
