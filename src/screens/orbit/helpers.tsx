import type { ReactNode } from 'react'
import { Icon, Term, type TooltipPlacement } from '../../components'
import { GLOSSARY, type NasaRef } from '../../data'

/** Quiet "NASA ref" block appended to an option tooltip (progressive disclosure: only visible on hover/focus). */
export function NasaRefTip({ nref }: { nref?: NasaRef }) {
  if (!nref) return null
  return (
    <span className="mt-2 block border-t border-hairline pt-2 text-xs leading-snug">
      <span className="flex items-center gap-1 text-text-faint">
        <Icon name="book" size={13} />
        NASA ref · {nref.source}
      </span>
      <span className="mt-0.5 block text-text-dim">{nref.text}</span>
    </span>
  )
}

/** Glossary-backed inline term (dotted underline + "?" with the one-sentence explanation). */
export function GTerm({
  id,
  children,
  placement,
  className,
}: {
  id: string
  children?: ReactNode
  placement?: TooltipPlacement
  className?: string
}) {
  const g = GLOSSARY[id]
  if (!g) return <span className={className}>{children}</span>
  return (
    <Term term={g.term} definition={g.text} placement={placement} className={className}>
      {children ?? g.term}
    </Term>
  )
}

/** sessionStorage key the builder can read to open on a given catalog tab (set before `goTo('builder')`). */
export const BUILDER_TAB_KEY = 'ma_builder_tab'

export function openBuilderTab(tab: string): void {
  try {
    sessionStorage.setItem(BUILDER_TAB_KEY, tab)
  } catch {
    /* storage unavailable: the builder simply opens on its first tab */
  }
}
