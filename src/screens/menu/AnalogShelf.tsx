import { useState } from 'react'
import { ANALOG_COUNT, ANALOG_LIST, ANALOGS } from '../../data'
import type { Analog, MissionId } from '../../data'
import { AiMark, Icon, ImageSlot, cx } from '../../components'
import { AnalogPhoto } from '../../nasa/analogsPhoto'

const GROUPS: { id: MissionId; title: string }[] = [
  { id: 'earth', title: 'Earth missions' },
  { id: 'lunar', title: 'Moon missions' },
  { id: 'mars', title: 'Mars missions' },
]

/** Selected discovered mission: real NASA photo plus the key facts. */
function Detail({ a }: { a: Analog }) {
  const f = a.facts
  const rows: [string, string | null][] = [
    ['Orbit', f.orbit?.text ?? null],
    ['Instruments', f.instruments.slice(0, 3).map((i) => i.name).join('; ')],
    ['Outcome', f.outcome?.text ?? null],
  ]
  return (
    <div className="glass-inset mt-4 flex gap-5 p-3" aria-live="polite">
      <AnalogPhoto analog={a} className="h-[150px] w-[266px] shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-3">
          <h4 className="truncate text-xl font-medium text-text">{a.name}</h4>
          <span className="shrink-0 text-sm text-text-dim">{a.tagline}</span>
        </div>
        <p className="mt-1 line-clamp-2 text-sm leading-snug text-text-dim">{a.text}</p>
        <dl className="mt-1.5 grid grid-cols-[96px_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-sm leading-snug">
          {rows
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-text-dim">{k}</dt>
                <dd className="truncate text-text" title={v ?? undefined}>
                  {v}
                </dd>
              </div>
            ))}
        </dl>
        <a
          href={a.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-mint hover:text-mint-hi"
        >
          Explore the real mission
          <Icon name="arrowUpRight" size={16} />
        </a>
      </div>
    </div>
  )
}

/** Real analog missions the player has discovered, grouped by planet (locked tiles hint at a topic). */
export function AnalogShelf({ discovered }: { discovered: string[] }) {
  const found = new Set(discovered.filter((id) => ANALOGS[id]))
  const count = found.size
  const latest = [...discovered].reverse().find((id) => ANALOGS[id]) ?? null
  const [sel, setSel] = useState<string | null>(latest)
  const selected = sel && found.has(sel) ? ANALOGS[sel] : null
  return (
    <section aria-label="Real missions discovered">
      <div className="flex items-baseline gap-4">
        <h3 className="text-xl font-medium text-text">Real missions discovered</h3>
        <span className="text-base text-text-dim">
          <span className="num">{count}</span> of <span className="num">{ANALOG_COUNT}</span>
        </span>
      </div>
      <p className="mt-1 text-sm text-text-dim">
        Finish a mission to meet the real one your design resembles. Photos come live from the NASA Image and Video Library.
      </p>
      {selected && <Detail a={selected} />}
      <div className="mt-4 flex flex-col gap-4">
        {GROUPS.map((g) => {
          const list = ANALOG_LIST.filter((a) => a.mission === g.id)
          const n = list.filter((a) => found.has(a.id)).length
          return (
            <div key={g.id}>
              <div className="flex items-center gap-3">
                <h4 className="text-base font-medium text-text">{g.title}</h4>
                <span className="num text-sm text-text-dim">
                  {n} / {list.length}
                </span>
                <span className="h-px flex-1 bg-hairline" />
              </div>
              <div className="mt-2 grid grid-cols-8 gap-2.5">
                {list.map((a) => {
                  const open = found.has(a.id)
                  const active = selected?.id === a.id
                  const tile = open ? (
                    <AnalogPhoto analog={a} credit="none" className={cx('aspect-[4/3] w-full border', active ? 'border-mint' : 'border-mint/40')}>
                      <span className="mint-fill absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full !shadow-none">
                        <Icon name="check" size={13} strokeWidth={2.6} />
                      </span>
                    </AnalogPhoto>
                  ) : (
                    <div className="relative">
                      <ImageSlot aspect="collection" id={`collection_${a.mission}_locked`} className="opacity-70" />
                      <AiMark corner="bl" className="!top-auto !bottom-1 !left-1" />
                      <span className="absolute inset-0 flex items-center justify-center text-text-dim">
                        <Icon name="lock" size={20} />
                      </span>
                    </div>
                  )
                  const label = (
                    <div className={cx('mt-1 leading-tight', open ? 'truncate text-sm text-text' : 'line-clamp-2 text-xs text-text-dim')}>
                      {open ? a.short : a.teaser}
                    </div>
                  )
                  return open ? (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setSel(a.id)}
                      aria-pressed={active}
                      title={`${a.name} · ${a.tagline}`}
                      className="min-w-0 rounded-card text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint"
                    >
                      {tile}
                      {label}
                    </button>
                  ) : (
                    <div key={a.id} className="min-w-0" title={a.teaser}>
                      {tile}
                      {label}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
