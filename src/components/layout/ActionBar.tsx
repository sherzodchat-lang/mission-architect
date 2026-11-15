import type { ReactNode } from 'react'
import { cx, type Tone } from '../cx'
import { Button } from '../Button'
import { ActionBarSubtitle, useSubtitleHost } from './Subtitles'

const DOT: Record<Tone, string> = {
  green: 'bg-green',
  amber: 'bg-amber',
  red: 'bg-red',
  cyan: 'bg-mint',
  blue: 'bg-blue',
  purple: 'bg-purple',
  neutral: '',
}
const TEXT: Record<Tone, string> = {
  green: 'text-text',
  amber: 'text-amber',
  red: 'text-red',
  cyan: 'text-text',
  blue: 'text-text',
  purple: 'text-text',
  neutral: 'text-text-dim',
}

export interface ActionBarProps {
  /** left slot; overrides `onBack` */
  left?: ReactNode
  /** convenience Back button (secondary, arrow-left) */
  onBack?: () => void
  backLabel?: string
  /** centre status line, e.g. "Resolve critical constraints" */
  status?: ReactNode
  /** dot + text colour of the status (neutral = dim text, no dot) */
  statusTone?: Tone
  /** free centre content instead of `status` (e.g. "Science collected 58 GB | Data returned 22 GB") */
  center?: ReactNode
  /** right slot: the primary action, usually <Button iconRight="arrowRight">Continue to orbit</Button> */
  action?: ReactNode
  className?: string
}

/**
 * Glass bottom action bar (03/04/05): Back on the left, status in the centre between hairline dividers, primary
 * action on the right. 68px high; place it as the last row of a screen with 16px side gutters. While mission control
 * speaks, the subtitle line replaces the centre content (so subtitles never cover the screen above).
 */
export function ActionBar({
  left,
  onBack,
  backLabel = 'Back',
  status,
  statusTone = 'neutral',
  center,
  action,
  className,
}: ActionBarProps) {
  const line = useSubtitleHost()
  const leftNode =
    left ??
    (onBack && (
      <Button variant="secondary" icon="arrowLeft" onClick={onBack}>
        {backLabel}
      </Button>
    ))
  const mid =
    center ??
    (status != null && (
      <span className={cx('flex items-center gap-3 text-lg', TEXT[statusTone])} role="status">
        {statusTone !== 'neutral' && <span className={cx('h-2.5 w-2.5 shrink-0 rounded-full', DOT[statusTone])} />}
        {status}
      </span>
    ))
  return (
    <footer className={cx('glass flex h-[68px] shrink-0 items-center gap-4 !rounded-[18px] px-4', className)}>
      <div className="flex min-w-[240px] shrink-0 items-center gap-3">{leftNode}</div>
      <div className="relative flex h-11 min-w-0 flex-1 items-center justify-center border-x border-hairline">
        <div className={cx('flex h-full max-w-full min-w-0 items-center justify-center px-6 transition-opacity duration-300', line && 'opacity-0')} aria-hidden={line ? true : undefined}>
          {mid}
        </div>
        {line && <ActionBarSubtitle line={line} />}
      </div>
      <div className="flex min-w-[240px] shrink-0 items-center justify-end gap-3">{action}</div>
    </footer>
  )
}
