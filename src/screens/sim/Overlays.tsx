import { Button, Icon, StarRating, cx } from '../../components'
import { fmtGB, type MissionReport, type SimState } from '../../engine'

/** Big 5..1 countdown over the scene before step 1. */
export function CountdownOverlay({ value, onSkip }: { value: number; onSkip?: () => void }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#061217]/55 backdrop-blur-[2px]">
      <div className="text-xl text-text-dim">T minus</div>
      <div key={value} className="num animate-fade-in text-[150px] leading-none font-light text-mint">
        {value > 0 ? value : 'Liftoff'}
      </div>
      {onSkip && (
        <Button variant="secondary" className="pointer-events-auto mt-8" onClick={onSkip}>
          Skip countdown <span className="text-text-dim">(Space)</span>
        </Button>
      )}
    </div>
  )
}

const OUTCOME = {
  success: { line: 'bg-green', text: 'text-green' },
  partial: { line: 'bg-amber', text: 'text-amber' },
  failure: { line: 'bg-red', text: 'text-red' },
}

/** Short end card shown before the report opens. */
export function EndOverlay({
  sim,
  report,
  onReport,
}: {
  sim: SimState
  report: MissionReport | null
  onReport: () => void
}) {
  const lost = sim.status === 'lost'
  const outcome = report?.outcome ?? (lost ? 'failure' : 'partial')
  const headline =
    sim.endReason === 'decayed' ? 'Re-entry: mission over' : lost ? 'Spacecraft lost' : 'Mission complete'
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#061217]/60 backdrop-blur-[3px]">
      <div
        role="dialog"
        aria-label={headline}
        className="glass-strong animate-fade-in relative w-[min(560px,90%)] px-8 py-7 text-center"
      >
        <span className={cx('absolute top-0 right-6 left-6 h-[3px] rounded-b-full', OUTCOME[outcome].line)} aria-hidden="true" />
        <Icon name={lost ? 'warning' : 'flag'} size={40} className={cx('mx-auto', OUTCOME[outcome].text)} />
        <h2 className="mt-3 text-3xl font-medium text-text">{headline}</h2>
        {report && (
          <div className="mt-2 flex items-center justify-center gap-3 text-xl text-text-dim">
            {report.outcomeTitle}
            <StarRating value={report.stars} size={26} />
          </div>
        )}
        <div className="mt-4 flex justify-center gap-8 text-base text-text-dim">
          <span>
            Returned <span className="num ml-1 text-text">{fmtGB(sim.returnedGB)}</span>
          </span>
          <span>
            Science <span className="num ml-1 text-text">{Math.round(sim.science)} pts</span>
          </span>
          <span>
            Health <span className="num ml-1 text-text">{Math.round(Math.max(0, sim.health))}%</span>
          </span>
        </div>
        <Button className="mt-6" size="lg" iconRight="arrowRight" onClick={onReport} disabled={!report}>
          View mission report
        </Button>
        <p className="mt-3 text-sm text-text-dim">Opening the report…</p>
      </div>
    </div>
  )
}
