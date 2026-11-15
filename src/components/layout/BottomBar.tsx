import type { ReactNode } from 'react'
import { cx, type Tone } from '../cx'
import { ActionBar } from './ActionBar'

export interface BottomBarProps {
  /** label of the Back button; omit onBack to hide it */
  backLabel?: string
  onBack?: () => void
  /** centre status text, e.g. "Resolve critical warnings before launch" */
  status?: ReactNode
  /** colour of status dot + text (green = OK, amber/red = problem) */
  statusTone?: Tone
  /** main action, usually <Button iconRight="arrowRight">Continue to orbit</Button> */
  action?: ReactNode
  className?: string
}

/**
 * @deprecated Legacy name. Renders `ActionBar` with the shell gutters (16px sides, 14px bottom). New code uses
 * `ActionBar` directly inside its own layout.
 */
export function BottomBar({ backLabel = 'Back', onBack, status, statusTone = 'neutral', action, className }: BottomBarProps) {
  return (
    <div className={cx('shrink-0 px-4 pt-2 pb-3.5', className)}>
      <ActionBar onBack={onBack} backLabel={backLabel} status={status} statusTone={statusTone} action={action} />
    </div>
  )
}
