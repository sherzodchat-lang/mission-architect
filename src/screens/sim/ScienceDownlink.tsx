import { useMemo, useState } from 'react'
import { Icon, Modal, cx } from '../../components'
import type { Mission } from '../../data'
import type { SimState } from '../../engine'
import { buildFrames, monthLabel } from '../../nasa/frames'
import { FrameViewer } from '../../nasa/FrameViewer'
import { NOTE_DOT } from '../../nasa/ui'
import { ScienceImage } from '../../nasa/ScienceImage'

/**
 * Small card over the mission view: the latest real NASA frame the spacecraft returned on a contact step,
 * degraded by the design (pointing, storage, downlink, radiation). Hidden until the first frame arrives.
 */
export function ScienceDownlink({ sim, mission, className }: { sim: SimState; mission: Mission; className?: string }) {
  const frames = useMemo(() => buildFrames(sim, mission), [sim.telemetry, sim.decisions, sim.design, mission]) // eslint-disable-line react-hooks/exhaustive-deps
  const [open, setOpen] = useState(false)
  const latest = frames[frames.length - 1]
  if (!latest) return null
  const note = latest.notes.find((n) => n.tone === 'bad' || n.tone === 'warn') ?? latest.notes[0]

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cx(
          'glass-strong group animate-fade-in w-[264px] p-2 text-left transition-colors hover:border-white/25 focus-visible:outline-2 focus-visible:outline-mint',
          className,
        )}
        aria-label={`Science downlink: ${latest.instrumentName}, ${latest.target.name}. Open larger view`}
      >
        <div className="flex items-center justify-between px-1 pb-1.5">
          <span className="flex items-center gap-1.5 text-sm text-text">
            <Icon name="camera" size={16} className="text-mint" />
            Science downlink
          </span>
          <span className="num text-xs text-text-dim">
            {frames.length} {frames.length === 1 ? 'frame' : 'frames'}
          </span>
        </div>
        <ScienceImage key={latest.key} frame={latest} width={480} height={320} animate showQueued={false} />
        <div className="px-1 pt-1.5">
          <div className="truncate text-sm text-text">{latest.target.name}</div>
          <div className="truncate text-xs text-text-dim">
            {monthLabel(latest, sim.stepMonths)} · {latest.instrumentName}
          </div>
          {note && (
            <div className="mt-1 flex gap-1.5 text-xs leading-snug text-text-dim">
              <span className={cx('mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full', NOTE_DOT[note.tone])} aria-hidden="true" />
              <span className="line-clamp-2">{note.text}</span>
            </div>
          )}
          <div className="mt-1 truncate text-xs text-text-faint">Source: {latest.layer.credit}</div>
        </div>
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Science downlink · real NASA data" width={1120}>
        <FrameViewer frames={frames} initialKey={latest.key} stepMonths={sim.stepMonths} />
      </Modal>
    </>
  )
}
