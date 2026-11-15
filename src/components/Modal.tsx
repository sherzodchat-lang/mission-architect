import { useContext, useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cx } from './cx'
import { Icon } from './Icon'
import { StageRootContext } from './layout/stageContext'

export interface ModalProps {
  open: boolean
  onClose?: () => void
  title?: ReactNode
  children?: ReactNode
  /** buttons row at the bottom */
  footer?: ReactNode
  /** width in px (default 640) */
  width?: number
  /** click on the dim backdrop / Esc closes (default true; set false for forced decisions) */
  dismissible?: boolean
  /** show the X button (default = dismissible) */
  showClose?: boolean
  /** thin coloured accent line along the top edge (05 decision card uses amber) */
  tone?: 'default' | 'mint' | 'amber' | 'red'
  className?: string
}

const ACCENT = { mint: 'bg-mint', amber: 'bg-amber', red: 'bg-red' } as const

/** Glass dialog rendered into the ScaledStage canvas (portal) so it scales with the game. */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = 640,
  dismissible = true,
  showClose,
  tone = 'default',
  className,
}: ModalProps) {
  const stageRoot = useContext(StageRootContext)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    ref.current?.focus()
    if (!dismissible) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, dismissible, onClose])

  if (!open) return null
  const withClose = showClose ?? dismissible
  const node = (
    <div
      className={cx(stageRoot ? 'absolute' : 'fixed', 'inset-0 z-50 flex items-center justify-center bg-[#061217]/55 backdrop-blur-[3px]')}
      onMouseDown={(e) => e.target === e.currentTarget && dismissible && onClose?.()}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        style={{ width }}
        className={cx(
          'glass-strong relative max-h-[88%] animate-rise-in overflow-auto rounded-panel p-7 outline-none',
          className,
        )}
      >
        {tone !== 'default' && (
          <span className={cx('absolute top-0 right-6 left-6 h-[3px] rounded-b-full', ACCENT[tone])} aria-hidden="true" />
        )}
        {(title || withClose) && (
          <div className="mb-3 flex items-start justify-between gap-4">
            <h2 className="text-2xl font-medium text-text">{title}</h2>
            {withClose && (
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="-mt-1 -mr-2 rounded-[10px] p-2 text-text-dim transition-colors hover:bg-white/[0.07] hover:text-text"
              >
                <Icon name="cross" size={20} />
              </button>
            )}
          </div>
        )}
        <div className="text-base text-text">{children}</div>
        {footer && <div className="mt-6 flex flex-wrap justify-end gap-3">{footer}</div>}
      </div>
    </div>
  )
  return createPortal(node, stageRoot ?? document.body)
}
