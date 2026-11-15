import { cx } from '../../components'
import { EVENTS, type EventId, type Mission } from '../../data'
import type { SimState, TimelineStep } from '../../engine'

/** First event of a step that deserves the warning mark (a clean orbit insertion is good news, not an alert). */
function alertEvent(sim: SimState, step: number): EventId | undefined {
  return sim.log.find((l) => l.step === step && l.eventId && (l.eventId !== 'insertion' || l.level !== 'good'))?.eventId
}

function dotName(s: TimelineStep, ev: EventId | undefined, isLast: boolean): string {
  if (ev) return EVENTS[ev].title
  if (s.kind === 'ended') return s.name
  if (isLast) return 'Mission end'
  if (s.kind === 'launch') return s.name === 'Launch & deployment' ? 'Launch' : s.name
  if (s.kind === 'commissioning') return s.name.startsWith('Orbit') ? 'Orbit insertion' : 'Commissioning'
  return s.name
}

export function TimelinePanel({
  sim,
  mission,
  timeline,
  activeStep,
}: {
  sim: SimState
  mission: Mission
  timeline: TimelineStep[]
  /** 1-based step currently being played (0 = none) */
  activeStep: number
}) {
  const n = timeline.length
  const finished = sim.status === 'complete' || sim.status === 'lost'
  // a finished mission (also after Skip to end) fills the whole rail
  const doneFrac = finished ? 1 : n > 1 ? Math.max(0, Math.min(1, (Math.max(activeStep, sim.step) - 1) / (n - 1))) : 0
  const monthNow = activeStep > 0 ? (activeStep - 1) * sim.stepMonths + 1 : sim.step * sim.stepMonths
  const totalMonths = sim.totalSteps * sim.stepMonths
  // first and last dot of the rail sit at the centre of the first / last column
  const inset = 50 / n

  return (
    <section className="glass flex items-stretch gap-6 px-6 py-3.5" aria-label={mission.timelineLabel}>
      <div className="flex w-[170px] shrink-0 flex-col justify-center">
        <h2 className="text-xl leading-tight font-medium text-text">Mission timeline</h2>
        <p className="num mt-1 text-sm text-text-dim">
          Month {monthNow} of {totalMonths}
        </p>
      </div>

      <div className="relative min-w-0 flex-1">
        {/* rail: faint for the future, mint for the past */}
        <div className="absolute top-[59px] h-0.5 rounded-full bg-white/[0.14]" style={{ left: `${inset}%`, right: `${inset}%` }} />
        <div
          className="absolute top-[59px] h-0.5 rounded-full bg-mint transition-[width] duration-700"
          style={{ left: `${inset}%`, width: `${doneFrac * (100 - 2 * inset)}%` }}
        />
        <ol className="relative grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
          {timeline.map((s, i) => {
            const shown = (j: number) => {
              const t = timeline[j]
              if (!t) return false
              return t.step === activeStep || alertEvent(sim, t.step) !== undefined || j === 0 || j === n - 1 || timeline[j - 1]?.kind !== t.kind
            }
            // a long name may spill into empty neighbour columns; between two labels it is set smaller instead of cut
            const roomy = !shown(i + 1) && !shown(i - 1)
            const current = s.step === activeStep
            const ev = alertEvent(sim, s.step)
            const alert = ev !== undefined
            const name = dotName(s, ev, i === n - 1)
            const prev = i > 0 ? timeline[i - 1] : null
            // label milestones only: first step of a phase, events, the end and the step in play
            const showName = current || alert || i === 0 || i === n - 1 || prev?.kind !== s.kind
            const accent = alert ? 'bg-amber' : 'bg-mint'
            return (
              <li
                key={s.step}
                title={name}
                className="flex min-w-0 flex-col items-center text-center"
                aria-current={current ? 'step' : undefined}
              >
                <span className={cx('h-5 truncate leading-5', roomy ? 'max-w-[190%] text-sm' : name.length > 11 ? 'max-w-full text-xs' : 'max-w-full text-sm', current ? 'text-text' : 'text-text-dim', !showName && 'invisible')}>
                  {name}
                </span>
                <span className="mt-1 flex h-4 items-center justify-center">
                  {showName && <span className={cx('h-2.5 w-2.5 rotate-45 rounded-[2px]', accent, !s.done && !current && 'opacity-60')} aria-hidden="true" />}
                </span>
                <span className="mt-1 flex h-8 items-center justify-center">
                  <span
                    className={cx(
                      'rounded-full',
                      current
                        ? cx('num flex h-8 w-8 items-center justify-center border-2 bg-[#0c1f27] text-sm text-text', alert ? 'border-amber' : 'border-mint')
                        : s.done
                          ? 'h-2.5 w-2.5 bg-mint'
                          : 'h-2 w-2 bg-text-faint',
                    )}
                  >
                    {current ? s.step : null}
                  </span>
                </span>
                <span className={cx('num mt-1 text-sm leading-none', current ? 'invisible' : s.done ? 'text-text' : 'text-text-dim')}>{s.step}</span>
                {mission.stepMonths > 1 && <span className="num mt-1 text-xs leading-tight text-text-faint">{s.label.replace(/^Months?\s*/, 'M')}</span>}
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
