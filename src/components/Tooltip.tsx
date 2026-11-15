import { useId, useState, type ReactNode } from 'react'
import { cx } from './cx'

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right'

const POS: Record<TooltipPlacement, string> = {
  top: 'bottom-full left-1/2 mb-2 -translate-x-1/2',
  bottom: 'top-full left-1/2 mt-2 -translate-x-1/2',
  left: 'right-full top-1/2 mr-2 -translate-y-1/2',
  right: 'left-full top-1/2 ml-3 -translate-y-1/2',
}

export interface TooltipProps {
  content: ReactNode
  placement?: TooltipPlacement
  children: ReactNode
  /** disable the popover without changing the layout */
  disabled?: boolean
  className?: string
  /** classes for the popover bubble, e.g. "w-72" */
  bubbleClassName?: string
}

/** Hover/focus glass popover. Wraps children in an inline-flex span; no portal, so keep ancestors free of overflow-hidden. */
export function Tooltip({ content, placement = 'top', children, disabled, className, bubbleClassName }: TooltipProps) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const show = open && !disabled && content != null
  return (
    <span
      className={cx('relative inline-flex', className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
      aria-describedby={show ? id : undefined}
    >
      {children}
      {show && (
        <span
          id={id}
          role="tooltip"
          className={cx(
            'glass-strong pointer-events-none absolute z-40 w-max max-w-[300px] animate-fade-in rounded-control px-3.5 py-2.5 text-left text-sm leading-snug font-normal text-text',
            POS[placement],
            bubbleClassName,
          )}
        >
          {content}
        </span>
      )}
    </span>
  )
}
