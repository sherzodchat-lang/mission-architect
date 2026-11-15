import { Icon, Panel, Term } from '../../components'
import type { MissionReport, ScoreCategoryId } from '../../engine'

const BAR: Record<ScoreCategoryId, string> = {
  science: 'bg-mint',
  efficiency: 'bg-blue',
  reliability: 'bg-purple',
  operations: 'bg-green',
}

function rating(total: number): { title: string; hint: string } {
  if (total >= 85) return { title: 'Outstanding mission', hint: 'Very little is left on the table.' }
  if (total >= 65) return { title: 'Strong mission', hint: 'Room to improve.' }
  if (total >= 40) return { title: 'Promising', hint: 'Keep iterating.' }
  return { title: 'Back to the drawing board', hint: 'Read the lessons and try again.' }
}

/** Four category bars, the overrun penalty and the overall assessment. */
export function ScorePanel({ report }: { report: MissionReport }) {
  const { categories, penalty } = report.score
  const r = rating(report.totalRounded)
  return (
    <Panel title="Performance breakdown" divided className="h-full" bodyClassName="flex min-h-0 flex-col !px-[22px] !pt-3 !pb-[16px]">
      <ul className="flex shrink-0 flex-col gap-3">
        {categories.map((c) => {
          const pct = Math.max(0, Math.min(100, (c.points / c.max) * 100))
          return (
            <li key={c.id}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-lg font-medium text-text">
                  {c.id === 'science' ? (
                    <Term term={c.label} definition="Science points reflect instrument value and data quality, not gigabytes.">
                      {c.label}
                    </Term>
                  ) : (
                    c.label
                  )}
                </span>
                <span className="num text-lg text-text">
                  {Math.round(c.points)}
                  <span className="text-text-dim"> / {c.max}</span>
                </span>
              </div>
              <p className="text-sm leading-snug text-text-dim">{c.detail}</p>
              <div
                className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10"
                role="progressbar"
                aria-label={c.label}
                aria-valuemin={0}
                aria-valuemax={c.max}
                aria-valuenow={Math.round(c.points)}
              >
                <div className={`h-full rounded-full ${BAR[c.id]}`} style={{ width: `${pct}%` }} />
              </div>
            </li>
          )
        })}
      </ul>

      {penalty > 0 && (
        <div className="glass-inset mt-3 flex items-center gap-3 px-4 py-2">
          <Icon name="calendar" size={22} className="text-red" />
          <span className="text-base text-text">
            Schedule overrun
            <span className="block text-sm text-text-dim">{report.stats.overMonths} extra months of development</span>
          </span>
          <span className="num ml-auto text-xl text-red">−{Math.round(penalty)}</span>
        </div>
      )}

      <div className="mt-auto border-t border-hairline pt-2.5">
        <div className="text-sm text-text-dim">Assessment</div>
        <div className="text-2xl leading-tight font-normal text-text">{r.title}</div>
        <p className="mt-0.5 text-sm text-text-dim">
          {r.hint}
        </p>
      </div>
    </Panel>
  )
}
