import type { ReactNode } from 'react'
import { cx } from './cx'
import { Tooltip, type TooltipPlacement } from './Tooltip'

export interface TermProps {
  /** glossary key / displayed term (used as content when no children) */
  term: string
  /** one-two sentence explanation; later looked up from src/data/glossary.ts by the caller */
  definition?: ReactNode
  children?: ReactNode
  placement?: TooltipPlacement
  className?: string
}

/** Inline glossary term: dotted underline + small "?" icon, definition on hover/focus. */
export function Term({ term, definition, children, placement = 'top', className }: TermProps) {
  if (!definition) return <span className={className}>{children ?? term}</span>
  return (
    <Tooltip
      placement={placement}
      bubbleClassName="w-64"
      content={
        <>
          <b className="mb-1 block font-medium text-mint">{term}</b>
          {definition}
        </>
      }
    >
      <span
        tabIndex={0}
        className={cx(
          'inline-flex cursor-help items-baseline gap-1 border-b border-dotted border-white/40 outline-offset-4 transition-colors hover:border-mint/70',
          className,
        )}
      >
        {children ?? term}
        <span
          aria-hidden="true"
          className="relative -top-px inline-flex h-4 w-4 items-center justify-center self-center rounded-full border border-white/35 text-[14px] leading-none font-medium text-text-dim"
        >
          ?
        </span>
      </span>
    </Tooltip>
  )
}
