import { Suspense, lazy, useState } from 'react'
import type { ReactNode } from 'react'
import { Icon, Panel, Tabs, Tooltip, cx } from '../../components'
import type { MissionId } from '../../data'
import type { AnalogMatch, AnalogResult, MissionReport, SimState } from '../../engine'
import { MATCH_WEIGHTS } from '../../engine'
import { AnalogPhoto } from '../../nasa/analogsPhoto'
import { authorLine, papersForAnalog } from '../../nasa/ntrs'

// Owned by the imagery feature; loaded lazily so the report never waits for (or breaks on) it.
const ScienceGallery = lazy(() => import('../../nasa/ScienceGallery'))

type Tab = 'analog' | 'images'

const WEIGHT_TIP = `Weighted similarity of your final design and flight to every real mission at the same target: instruments ${pct(MATCH_WEIGHTS.instruments)}, orbit ${pct(MATCH_WEIGHTS.orbit)}, pointing, comms, size, propulsion, power and outcome make up the rest. Facts the NASA sources do not state are left out.`

function pct(x: number) {
  return `${Math.round(x * 100)}%`
}

/** "Real-world analogue": live NASA photo, match %, shared traits and differences; details behind expanders. */
export function AnalogPanel({
  match,
  report,
  sim,
  missionId,
}: {
  match: AnalogResult
  report: MissionReport
  sim: SimState | null
  missionId: MissionId
}) {
  const [tab, setTab] = useState<Tab>('analog')
  return (
    <Panel
      title={tab === 'analog' ? 'Analogue' : 'Science'}
      divided
      className="h-full"
      bodyClassName="flex min-h-0 flex-col !p-0"
      right={
        <Tabs<Tab>
          size="sm"
          variant="segmented"
          value={tab}
          onChange={setTab}
          aria-label="Right panel view"
          tabs={[
            { id: 'analog', label: 'Real mission' },
            { id: 'images', label: 'Imagery' },
          ]}
        />
      }
    >
      {tab === 'analog' ? (
        <AnalogView match={match} />
      ) : (
        <div className="min-h-0 flex-1 p-3">
          <Suspense fallback={<div className="bg-grid h-full animate-pulse-soft rounded-card" />}>
            <ScienceGallery report={report} sim={sim} missionId={missionId} className="h-full" />
          </Suspense>
        </div>
      )}
    </Panel>
  )
}

function AnalogView({ match }: { match: AnalogResult }) {
  const all = [match.top, ...match.runnersUp]
  const [id, setId] = useState(match.top.analog.id)
  const m = all.find((x) => x.analog.id === id) ?? match.top
  const a = m.analog
  const isTop = m === match.top
  const others = all.filter((x) => x !== m)
  return (
    <div
      className="min-h-0 flex-1 overflow-y-auto px-[10px] pt-3 pb-4"
      style={{ maskImage: 'linear-gradient(to bottom, #000 calc(100% - 18px), transparent)' }}
    >
      <AnalogPhoto analog={a} className="h-[172px] shrink-0">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg via-bg/30 to-transparent" aria-hidden="true" />
        <div className="absolute inset-x-4 bottom-2.5">
          <div className="text-sm text-text-dim">{isTop ? 'Closest real mission' : 'Also similar'}</div>
          <h3 className="truncate text-xl leading-tight font-medium text-text" title={a.name}>{a.name}</h3>
        </div>
        <Tooltip content={WEIGHT_TIP} placement="left" bubbleClassName="max-w-[300px]">
          <span
            tabIndex={0}
            className="glass-strong absolute top-2.5 right-2.5 flex items-baseline gap-1 rounded-full px-3 py-1"
            aria-label={`${m.percent}% similar`}
          >
            <span className="num text-lg leading-none text-mint">{m.percent}%</span>
            <span className="text-xs text-text-dim">match</span>
          </span>
        </Tooltip>
      </AnalogPhoto>

      <div className="px-3">
        <div className="mt-2.5 text-sm text-text">
          {a.agency} · {a.tagline}
        </div>

        <ul className="mt-2 flex flex-col gap-1.5" aria-label="What you share">
          {m.shared.slice(0, 3).map((s) => (
            <Trait key={s} line={s} kind="shared" />
          ))}
          {m.differences.map((s) => (
            <Trait key={s} line={s} kind="diff" />
          ))}
        </ul>

        <Facts match={m} />
        <Papers analogId={a.id} />

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <a
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 border-b border-mint/60 pb-0.5 text-base text-mint transition hover:border-mint hover:text-mint-hi"
          >
            Explore the real mission
            <Icon name="arrowUpRight" size={18} />
          </a>
        </div>

        <div className="mt-3.5 border-t border-hairline pt-2.5">
          <div className="text-sm text-text-dim">{isTop ? 'Runners-up' : 'Compare with'}</div>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {others.map((o) => (
              <button
                key={o.analog.id}
                type="button"
                onClick={() => setId(o.analog.id)}
                className="glass-inset flex items-baseline gap-2 !rounded-full px-3 py-1 text-sm text-text transition hover:border-mint/50 focus-visible:outline-2 focus-visible:outline-mint"
              >
                {o.analog.short}
                <span className="num text-xs text-text-dim">{o.percent}%</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/** A trait sentence; a trailing "(Name: detail)" is shown smaller and dimmer so the main point reads first. */
function Trait({ line, kind }: { line: string; kind: 'shared' | 'diff' }) {
  const m = /^(.*?)\s*\(([^()]+(?:\([^()]*\)[^()]*)*)\)\.?$/.exec(line)
  const main = m ? `${m[1]}.` : line
  const detail = m ? m[2] : null
  return (
    <li className={cx('flex gap-2.5 text-sm leading-snug', kind === 'shared' ? 'text-text' : 'text-text-dim')}>
      <Icon name={kind === 'shared' ? 'check' : 'minus'} size={17} className={cx('mt-0.5 shrink-0', kind === 'shared' ? 'text-mint' : 'text-amber')} />
      <span>
        {main}
        {detail && <span className="mt-0.5 block text-xs text-text-dim">{detail}</span>}
      </span>
    </li>
  )
}

function Expander({ label, count, children }: { label: string; count?: number; children: ReactNode }) {
  return (
    <details className="group mt-2.5 border-t border-hairline pt-2">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm text-text marker:hidden hover:text-mint">
        <Icon name="chevronDown" size={16} className="text-text-dim transition-transform group-open:rotate-180" />
        {label}
        {count != null && <span className="num text-xs text-text-dim">{count}</span>}
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  )
}

function Facts({ match }: { match: AnalogMatch }) {
  const a = match.analog
  const f = a.facts
  const rows: [string, string | null][] = [
    ['Goal', f.goal],
    ['Size', f.sizeText],
    ['Orbit', f.orbit?.text ?? null],
    ['Instruments', f.instruments.map((i) => i.name).join('; ')],
    ['Pointing', f.pointing?.text ?? null],
    ['Comms', f.comms?.text ?? null],
    ['Propulsion', f.propulsion?.text ?? null],
    ['Power', f.power ?? f.solar?.text ?? null],
    ['Outcome', f.outcome?.text ?? null],
  ]
  return (
    <Expander label="Mission facts and sources">
      <dl className="grid grid-cols-[92px_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm leading-snug">
        {rows
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-text-dim">{k}</dt>
              <dd className="text-text">{v}</dd>
            </div>
          ))}
      </dl>
      <div className="mt-2 text-xs text-text-dim">Sources</div>
      <ul className="mt-0.5 flex flex-col gap-0.5">
        {a.sources.map((s) => (
          <li key={s.url}>
            <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-sm text-text-dim underline decoration-hairline underline-offset-2 hover:text-mint">
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </Expander>
  )
}

function Papers({ analogId }: { analogId: string }) {
  const papers = papersForAnalog(analogId)
  if (!papers.length) return null
  return (
    <Expander label="NASA papers" count={papers.length}>
      <ul className="flex flex-col gap-2">
        {papers.map((p) => (
          <li key={p.id} className="text-sm leading-snug">
            <a
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className={cx('text-text underline decoration-hairline underline-offset-2 hover:text-mint')}
            >
              {p.title}
            </a>
            <div className="text-xs text-text-dim">
              <span className="num">{p.year ?? 'n.d.'}</span> · {p.type} · {authorLine(p)}
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-1.5 text-xs text-text-faint">From the NASA Technical Reports Server (ntrs.nasa.gov)</div>
    </Expander>
  )
}
