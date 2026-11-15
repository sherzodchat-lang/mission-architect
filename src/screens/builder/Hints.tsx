import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { audio } from '../../audio/audioManager'
import { cx, Icon } from '../../components'
import type { CategoryId } from '../../data'
import { useSettingsStore } from '../../store/settingsStore'

interface HintDef {
  title: string
  text: string
  /** bubble position inside the main area (design px) */
  style: CSSProperties
  arrow: 'left' | 'right' | 'up' | 'down'
}

const HINTS: HintDef[] = [
  {
    title: 'Pick your parts',
    text: 'Each card shows what a part weighs, draws and costs. Press + or Select to install it.',
    // just right of the Components column, pointing at the first card
    style: { left: 442, top: 300, width: 290 },
    arrow: 'left',
  },
  {
    title: 'Watch it come together',
    text: 'Installed parts appear on the 3D model. Click any part or label to jump to its tab.',
    // top-left corner of the 3D view, pointing at the model
    style: { left: 452, top: 230, width: 290 },
    arrow: 'right',
  },
  {
    title: 'Stay inside the limits',
    text: 'Every bar must stay within its limit. Hover a bar to see what uses it. Resolve red warnings to continue.',
    style: { right: 450, top: 230, width: 300 },
    arrow: 'right',
  },
]

interface HintsProps {
  /** at least one part is installed */
  hasParts: boolean
  /** every slot holds a part */
  complete: boolean
  /** current catalog tab (changes when a slot or tab is clicked) */
  tab: CategoryId
}

/**
 * First-run three-step hints: catalog → schematic → resources. They advance by themselves: the first install moves
 * to hint 2, opening another tab / slot (or a complete design) moves to hint 3. Dismissible, persisted.
 */
export function Hints({ hasParts, complete, tab }: HintsProps) {
  const dismissed = useSettingsStore((s) => s.hintsDismissed)
  const setDismissed = useSettingsStore((s) => s.setHintsDismissed)
  const [i, setI] = useState(0)
  const tabAtHint2 = useRef(tab)

  useEffect(() => {
    if (dismissed) return
    if (i === 0 && complete) setI(2)
    else if (i === 0 && hasParts) {
      tabAtHint2.current = tab
      setI(1)
    } else if (i === 1 && (complete || tab !== tabAtHint2.current)) setI(2)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasParts, complete, tab, i, dismissed])

  if (dismissed) return null
  const h = HINTS[i]
  const last = i === HINTS.length - 1
  const close = () => {
    audio.playSfx('ui_click')
    setDismissed(true)
  }

  return (
    <div
      key={i}
      className="glass-strong pointer-events-auto absolute z-30 animate-fade-in rounded-card !border-mint/35 p-4"
      style={h.style}
      role="dialog"
      aria-label={`Hint ${i + 1} of ${HINTS.length}`}
    >
      <Arrow dir={h.arrow} />
      <div className="flex items-center justify-between">
        <span className="num text-xs text-mint">
          {i + 1} / {HINTS.length}
        </span>
        <button type="button" onClick={close} aria-label="Dismiss hints" className="text-text-dim hover:text-text">
          <Icon name="cross" size={18} />
        </button>
      </div>
      <h3 className="mt-1 text-lg font-medium text-text">{h.title}</h3>
      <p className="mt-1 text-sm leading-snug text-text-dim">{h.text}</p>
      <div className="mt-3 flex items-center justify-between">
        <button type="button" onClick={close} className="text-sm text-text-dim underline-offset-4 hover:text-text hover:underline">
          Skip hints
        </button>
        <button
          type="button"
          onClick={() => {
            if (last) close()
            else {
              audio.playSfx('ui_click')
              setI(i + 1)
            }
          }}
          className="mint-fill inline-flex h-9 items-center gap-1.5 rounded-[9px] px-4 text-sm font-medium transition hover:brightness-105"
        >
          {last ? 'Got it' : 'Next'}
          {!last && <Icon name="arrowRight" size={16} />}
        </button>
      </div>
    </div>
  )
}

/** Pointing arrow with a gentle 1.6s nudge in its own direction; static under prefers-reduced-motion. */
function Arrow({ dir }: { dir: 'left' | 'right' | 'up' | 'down' }) {
  const pos = {
    left: '-left-11 top-8',
    right: '-right-11 top-8',
    up: 'left-9 -top-11',
    down: 'left-1/2 -ml-4 -bottom-10',
  }[dir]
  const rot = { left: 'rotate-180', right: '', up: '-rotate-90', down: 'rotate-90' }[dir]
  const nudge = { left: '-6px 0', right: '6px 0', up: '0 -6px', down: '0 6px' }[dir]
  return (
    <span className={cx('hint-nudge absolute text-mint', pos)} style={{ '--nudge': nudge } as CSSProperties} aria-hidden="true">
      <style>{`@media (prefers-reduced-motion: no-preference){.hint-nudge{animation:hint-nudge 1.6s cubic-bezier(.16,1,.3,1) infinite}}@keyframes hint-nudge{0%,60%,100%{translate:0 0}25%{translate:var(--nudge)}}`}</style>
      <span className={cx('block', rot)}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12h16M13 5.5 19.5 12 13 18.5" />
        </svg>
      </span>
    </span>
  )
}
