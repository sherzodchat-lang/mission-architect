import { useState } from 'react'
import { Gauge, Icon, type GaugeProps } from '../../components'
import type { Gauge as EngineGauge } from '../../engine'

function toProps(g: EngineGauge): Omit<GaugeProps, 'orientation'> {
  return {
    label: g.id === 'fuel' ? 'Fuel' : g.label,
    unit: g.unit,
    used: g.used,
    available: g.available,
    status: g.status,
    tooltipTitle: g.tooltip,
    breakdown: [
      ...g.breakdown.map((b) => `${b.label}: ${b.text}`),
      ...(g.availableBreakdown.length ? ['Available:', ...g.availableBreakdown.map((b) => `${b.label}: ${b.text}`)] : []),
    ],
  }
}

/**
 * Quiet resource line: only the budgets that are amber/red are shown, the rest collapse into one sentence.
 * "All resources" expands the full row of gauges.
 */
export function ResourceSummary({ gauges }: { gauges: EngineGauge[] }) {
  const [all, setAll] = useState(false)
  const items = gauges.map(toProps)
  const problems = items.filter((g) => g.status !== 'green')
  // critical first; at most four so the line never crowds the view
  const shown = [...problems].sort((a, b) => (a.status === b.status ? 0 : a.status === 'red' ? -1 : 1)).slice(0, 4)

  const toggle = (
    <button
      type="button"
      onClick={() => setAll((v) => !v)}
      aria-expanded={all}
      className="ml-auto flex shrink-0 items-center gap-1 rounded-md px-1 py-0.5 text-sm text-text-dim transition-colors duration-200 hover:text-text"
    >
      {all ? 'Collapse' : problems.length ? `All ${items.length} resources` : 'Show all'}
      <Icon name={all ? 'chevronDown' : 'chevronUp'} size={16} />
    </button>
  )

  if (all) {
    return (
      <div className="flex items-start gap-8">
        <div
          className="grid min-w-0 flex-1 animate-fade-in gap-x-8 gap-y-4"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' }}
        >
          {items.map((g) => (
            <Gauge key={g.label} {...g} orientation="horizontal" stacked />
          ))}
        </div>
        {toggle}
      </div>
    )
  }

  return (
    <div className="flex min-h-[44px] items-center gap-8">
      {problems.length === 0 ? (
        <span className="flex items-center gap-2 text-base text-text">
          <Icon name="check" size={18} className="shrink-0 text-green" />
          All resources within limits
        </span>
      ) : (
        <div className="grid min-w-0 flex-1 gap-8" style={{ gridTemplateColumns: `repeat(${shown.length}, minmax(0, 220px))` }}>
          {shown.map((g) => (
            <Gauge key={g.label} {...g} orientation="horizontal" stacked />
          ))}
        </div>
      )}
      {problems.length > 0 && shown.length <= 2 && (
        <span className="text-sm whitespace-nowrap text-text-dim">Everything else within limits</span>
      )}
      {toggle}
    </div>
  )
}
