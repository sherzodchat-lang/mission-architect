import { useEffect } from 'react'
import { create } from 'zustand'
import { useSubtitleStore, type SubtitleLine } from '../../audio/subtitleStore'
import { useGameStore } from '../../store/gameStore'
import { cx } from '../cx'

/**
 * Mission-control subtitles never cover primary content:
 * - every screen with an `ActionBar` shows the line INSIDE the bar's centre slot (the status text fades out for the
 *   few seconds the line is visible) - see `ActionBarSubtitle`;
 * - the Overview (no action bar) gets a compact toast in the open sky above the hero spacecraft, between the title
 *   and the orbit callout.
 * `ActionBar` registers itself as the host while mounted, so the floating toast is skipped there.
 */
const useHost = create<{ hosts: number; add: () => void; remove: () => void }>((set) => ({
  hosts: 0,
  add: () => set((s) => ({ hosts: s.hosts + 1 })),
  remove: () => set((s) => ({ hosts: Math.max(0, s.hosts - 1) })),
}))

/** Called by ActionBar: while mounted it hosts the subtitle line. Returns the current line (or null). */
export function useSubtitleHost(): SubtitleLine | null {
  const add = useHost((s) => s.add)
  const remove = useHost((s) => s.remove)
  useEffect(() => {
    add()
    return remove
  }, [add, remove])
  return useSubtitleStore((s) => s.current)
}

function Line({ line, compact }: { line: SubtitleLine; compact?: boolean }) {
  return (
    <span className={cx('flex min-w-0 items-start gap-2.5 leading-snug text-text', compact ? 'text-sm' : 'text-base')}>
      <span className={cx('shrink-0 rounded-full bg-mint', compact ? 'mt-[7px] h-1.5 w-1.5' : 'mt-[8px] h-2 w-2')} aria-hidden="true" />
      <span className="line-clamp-2 min-w-0">
        <span className="mr-1.5 font-medium text-mint">Mission control</span>
        {line.text}
      </span>
    </span>
  )
}

/** Inline subtitle for the ActionBar centre slot (two lines max). */
export function ActionBarSubtitle({ line }: { line: SubtitleLine }) {
  return (
    <div key={line.id} className="absolute inset-0 flex animate-fade-in items-center justify-center px-6" role="status" aria-live="polite">
      <Line line={line} compact />
    </div>
  )
}

/** Floating fallback toast, rendered once inside the stage (App.tsx). Hidden while an ActionBar hosts the line. */
export function Subtitles() {
  const line = useSubtitleStore((s) => s.current)
  const hosted = useHost((s) => s.hosts > 0)
  // keep the store subscription so the toast re-renders on screen changes
  useGameStore((s) => s.screen)
  if (!line || hosted) return null
  return (
    <div className="pointer-events-none absolute top-5 left-[820px] z-[60] w-max max-w-[540px]" role="status" aria-live="polite">
      <div key={line.id} className="glass-strong animate-rise-in rounded-card px-4 py-3">
        <Line line={line} />
      </div>
    </div>
  )
}
