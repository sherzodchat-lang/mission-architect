import { useEffect, useRef, useState } from 'react'
import { audio } from '../../audio/audioManager'
import { Panel, Tabs, cx } from '../../components'
import type { LogEntry, SimState } from '../../engine'

type Filter = 'all' | 'science' | 'systems'
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'science', label: 'Science' },
  { id: 'systems', label: 'Systems' },
]

const DOT: Record<LogEntry['level'], string> = {
  info: 'bg-mint',
  good: 'bg-green',
  warning: 'bg-amber',
  critical: 'bg-red',
}
const TITLE: Record<LogEntry['level'], string> = {
  info: 'text-text',
  good: 'text-text',
  warning: 'text-amber',
  critical: 'text-red',
}

function stamp(e: LogEntry, stepMonths: number): string {
  if (e.step === 0) return 'T−0'
  const a = (e.step - 1) * stepMonths + 1
  return stepMonths > 1 ? `M${a}–${e.step * stepMonths}` : `M${e.step}`
}

export function MissionLog({ sim }: { sim: SimState }) {
  const [filter, setFilter] = useState<Filter>('all')
  const listRef = useRef<HTMLOListElement>(null)
  const entries = sim.log.filter((e) => filter === 'all' || e.tag === filter)
  const waiting = sim.status === 'decision' && sim.pending

  // keep the newest entry (or the "NOW" card) in view; instant jump so it also holds for bursts (Skip to end)
  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const toEnd = () => el.scrollTo({ top: el.scrollHeight, behavior: 'auto' })
    toEnd()
    const raf = requestAnimationFrame(toEnd) // again after the new rows have been laid out
    return () => cancelAnimationFrame(raf)
  }, [entries.length, waiting, filter])

  return (
    <Panel
      title={<span className="whitespace-nowrap">Event log</span>}
      className="h-full min-h-0"
      right={
        <Tabs
          variant="underline"
          size="sm"
          aria-label="Log filter"
          tabs={FILTERS}
          value={filter}
          onChange={(f) => {
            if (filter !== f) audio.playSfx('ui_click')
            setFilter(f)
          }}
        />
      }
      divided
      bodyClassName="flex min-h-0 flex-col !p-0"
    >
      <ol ref={listRef} className="relative min-h-0 flex-1 overflow-y-auto px-[22px] py-4">
        {entries.length === 0 && !waiting && <li className="py-6 text-center text-sm text-text-dim">No entries yet.</li>}
        {entries.map((e, i) => (
          <li key={e.id} className="animate-fade-in relative flex gap-3 pb-4">
            <span className="num w-[58px] shrink-0 pt-px text-sm leading-snug text-text-dim">{stamp(e, sim.stepMonths)}</span>
            <span className="relative flex w-3 shrink-0 justify-center">
              <span className={cx('mt-1.5 h-2.5 w-2.5 rounded-full', DOT[e.level])} />
              {(i < entries.length - 1 || waiting) && (
                <span className="absolute top-5 -bottom-4 w-px bg-hairline" aria-hidden="true" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className={cx('text-base leading-snug font-medium', TITLE[e.level])}>{e.title}</div>
              <p className="text-sm leading-snug text-text-dim">{e.text}</p>
            </div>
          </li>
        ))}
        {waiting && (
          <li className="flex gap-3">
            <span className="num w-[58px] shrink-0 pt-px text-sm leading-snug text-text">Now</span>
            <span className="flex w-3 shrink-0 justify-center">
              <span className="animate-pulse-soft mt-1.5 h-2.5 w-2.5 rounded-full border-2 border-amber" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-base leading-snug font-medium text-amber">Awaiting decision</div>
              <p className="text-sm leading-snug text-text-dim">{sim.pending!.title}: choose an option to continue.</p>
            </div>
          </li>
        )}
      </ol>
    </Panel>
  )
}
