import { useState } from 'react'
import { Icon, cx } from '../components'
import { fmtLatLon, monthLabel, type FrameNote, type ScienceFrame } from './frames'
import { fmtFrameDate, NOTE_DOT } from './ui'
import { SERVICE_URL } from './layers'
import { ScienceImage } from './ScienceImage'

export function NoteList({ notes, max, className }: { notes: FrameNote[]; max?: number; className?: string }) {
  const list = max ? notes.slice(0, max) : notes
  return (
    <ul className={cx('flex flex-col gap-1.5', className)}>
      {list.map((n, i) => (
        <li key={i} className="flex gap-2 text-sm leading-snug text-text-dim">
          <span className={cx('mt-[7px] h-2 w-2 shrink-0 rounded-full', NOTE_DOT[n.tone])} aria-hidden="true" />
          <span>{n.text}</span>
        </li>
      ))}
    </ul>
  )
}

export function SourceLine({ frame, className }: { frame: ScienceFrame; className?: string }) {
  return (
    <span className={cx('text-xs text-text-faint', className)}>
      Source: {frame.layer.credit}
    </span>
  )
}

/** Thumbnails strip; `value` = selected key. */
export function FrameStrip({
  frames,
  value,
  onChange,
  stepMonths,
  size = 76,
}: {
  frames: ScienceFrame[]
  value: string
  onChange: (key: string) => void
  stepMonths: number
  size?: number
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1" role="listbox" aria-label="Returned frames">
      {frames.map((f) => (
        <button
          key={f.key}
          type="button"
          role="option"
          aria-selected={f.key === value}
          title={`${monthLabel(f, stepMonths)} · ${f.instrumentName} · ${f.target.name}`}
          onClick={() => onChange(f.key)}
          className={cx(
            'shrink-0 overflow-hidden rounded-[8px] border transition-colors focus-visible:outline-2 focus-visible:outline-mint',
            f.key === value ? 'border-mint' : 'border-hairline hover:border-white/30',
          )}
          style={{ width: size }}
        >
          <ScienceImage frame={f} width={192} height={128} lazy showQueued={false} className="!rounded-none" />
        </button>
      ))}
    </div>
  )
}

/** Large view: image, full caption, every effect explained, all frames to browse. */
export function FrameViewer({
  frames,
  initialKey,
  stepMonths,
}: {
  frames: ScienceFrame[]
  initialKey?: string
  stepMonths: number
}) {
  const [key, setKey] = useState(initialKey ?? frames[frames.length - 1]?.key ?? '')
  const [loaded, setLoaded] = useState<{ key: string; date: string | null; layerName: string } | null>(null)
  const f = frames.find((x) => x.key === key) ?? frames[frames.length - 1]
  if (!f) return null
  const shownDate = loaded && loaded.key === f.key ? loaded.date : f.date
  const date = fmtFrameDate({ ...f, date: shownDate })
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-5" style={{ gridTemplateColumns: 'minmax(0,1.55fr) minmax(0,1fr)' }}>
        <ScienceImage key={f.key} frame={f} width={720} height={480} onLoaded={(r) => setLoaded({ key: f.key, ...r })} />
        <div className="flex min-w-0 flex-col gap-3">
          <div>
            <div className="text-sm text-text-dim">{monthLabel(f, stepMonths)} · {f.instrumentName}</div>
            <div className="mt-0.5 text-xl font-medium text-text">{f.target.name}</div>
            <div className="num mt-0.5 text-sm text-text-dim">
              {fmtLatLon(f.target.lat, f.target.lon)}
              {date ? ` · ${date}` : ''}
            </div>
            <p className="mt-1.5 text-sm leading-snug text-text-dim">{f.target.why}</p>
          </div>
          <div className="glass-inset px-3.5 py-2.5">
            <div className="text-sm text-text">{loaded?.key === f.key ? loaded.layerName : f.layer.name}</div>
            <p className="mt-0.5 text-sm leading-snug text-text-dim">{f.layer.legend}</p>
            {f.layer.proxy && <p className="mt-1 text-xs leading-snug text-text-faint">Stand-in: {f.layer.proxy}</p>}
          </div>
          <NoteList notes={f.notes} />
          <a
            href={SERVICE_URL[f.layer.service]}
            target="_blank"
            rel="noreferrer"
            className="mt-auto inline-flex items-center gap-1.5 text-xs text-text-dim underline-offset-2 hover:text-text hover:underline"
          >
            Source: {f.layer.credit} <Icon name="external" size={14} />
          </a>
        </div>
      </div>
      {frames.length > 1 && <FrameStrip frames={frames} value={f.key} onChange={setKey} stepMonths={stepMonths} />}
    </div>
  )
}
