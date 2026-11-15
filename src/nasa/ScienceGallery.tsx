import { useMemo, useState } from 'react'
import { Icon, Modal, cx } from '../components'
import { MISSIONS, type MissionId } from '../data'
import type { MissionReport, SimState } from '../engine'
import { bestFrames, buildFrames, monthLabel } from './frames'
import { FrameStrip, FrameViewer } from './FrameViewer'
import { NOTE_DOT } from './ui'
import { ScienceImage } from './ScienceImage'
import { orbitReach, unreachableTargets } from './targets'

export interface ScienceGalleryProps {
  report?: MissionReport | null
  sim: SimState | null
  missionId?: MissionId
  className?: string
}

/**
 * "What your spacecraft saw": the best real NASA frame per instrument, degraded exactly as the player's design
 * degraded it, with captions and source credits. Self-contained glass block, fluid, ~420x300 and up.
 */
export default function ScienceGallery({ report, sim, missionId, className }: ScienceGalleryProps) {
  const mission = MISSIONS[missionId ?? sim?.missionId ?? 'earth']
  const frames = useMemo(() => (sim ? buildFrames(sim, mission) : []), [sim, mission])
  const best = useMemo(() => bestFrames(frames, 4), [frames])
  const [key, setKey] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const current = best.find((f) => f.key === key) ?? best[0]
  const stepMonths = sim?.stepMonths ?? mission.stepMonths

  const missed = useMemo(() => {
    if (!sim) return []
    return unreachableTargets(mission.id, sim.design.instruments, orbitReach(mission.id, sim.design.orbit))
  }, [sim, mission])
  const reachNote = sim ? orbitReach(mission.id, sim.design.orbit).reachNote : undefined

  if (!current) {
    const lost = (report?.stats.returnedGB ?? sim?.returnedGB ?? 0) <= 0
    return (
      <section className={cx('glass-inset flex h-full min-h-[200px] flex-col items-center justify-center gap-2 p-5 text-center', className)}>
        <Icon name="camera" size={26} className="text-text-faint" />
        <p className="text-base text-text">{lost ? 'No science reached Earth' : 'No imagery for this payload'}</p>
        <p className="max-w-[320px] text-sm text-text-dim">
          {lost
            ? 'Without a downlink there are no frames to show. A working radio and ground contact bring the data home.'
            : 'Your instruments returned data, but none of it maps to a NASA image layer.'}
        </p>
      </section>
    )
  }

  const top = current.notes.find((n) => n.tone !== 'good') ?? current.notes[0]
  return (
    <section
      className={cx('flex h-full min-h-[260px] min-w-0 flex-col gap-2', className)}
      aria-label="Science returned: real NASA imagery"
    >
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative min-h-[150px] flex-1 overflow-hidden rounded-card border border-hairline text-left focus-visible:outline-2 focus-visible:outline-mint"
        aria-label={`Open ${current.instrumentName} frame of ${current.target.name}`}
      >
        <ScienceImage key={current.key} frame={current} fit="cover" showQueued={false} lazy className="!rounded-none" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#050c10]/95 via-[#050c10]/70 to-transparent px-3.5 pt-8 pb-2.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-base font-medium text-text">{current.target.name}</span>
            <span className="num shrink-0 text-xs text-text-dim">{monthLabel(current, stepMonths)}</span>
          </div>
          <div className="truncate text-sm text-text-dim">
            {current.instrumentName} · {current.layer.name}
          </div>
          {top && (
            <div className="mt-1 flex gap-2 text-xs leading-snug text-text-dim">
              <span className={cx('mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full', NOTE_DOT[top.tone])} aria-hidden="true" />
              <span className="line-clamp-2">{top.text}</span>
            </div>
          )}
          <div className="mt-1 text-xs text-text-faint">Source: {current.layer.credit}</div>
        </div>
        <span className="glass-strong absolute top-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-full opacity-80 transition-opacity group-hover:opacity-100">
          <Icon name="expand" size={16} />
        </span>
      </button>

      {(best.length > 1 || missed.length > 0) && (
        <div className="flex shrink-0 items-center gap-3">
          {best.length > 1 && (
            <FrameStrip frames={best} value={current.key} onChange={setKey} stepMonths={stepMonths} size={64} />
          )}
          {missed.length > 0 && (
            <p className="min-w-0 flex-1 text-xs leading-snug text-text-dim">
              <span className="text-amber">Out of reach:</span> {missed.slice(0, 2).map((t) => t.name).join(', ')}
              {missed.length > 2 ? ` +${missed.length - 2}` : ''}. {reachNote}
            </p>
          )}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Science returned · real NASA data" width={1120}>
        <FrameViewer frames={frames} initialKey={current.key} stepMonths={stepMonths} />
      </Modal>
    </section>
  )
}
