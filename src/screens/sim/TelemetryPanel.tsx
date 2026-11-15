import { Panel, Sparkline, TONE_HEX, TONE_TEXT, cx, type Tone } from '../../components'
import type { SimState, TelemetryPoint } from '../../engine'
import { fmtGB } from '../../engine'

/** Round an axis maximum up to 1 / 2 / 2.5 / 5 × 10^n. */
function niceMax(v: number): number {
  if (v <= 0) return 1
  const p = 10 ** Math.floor(Math.log10(v))
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p
  return 10 * p
}

const fmtAxisGB = (v: number) => (v >= 1000 ? `${+(v / 1000).toFixed(1)} TB` : `${+v.toFixed(1)} GB`)

interface ChartProps {
  title: string
  tone: Tone
  value: string
  values: number[]
  max: number
  fmtTick: (v: number) => string
  xLabels: string[]
}

function TelemetryChart({ title, tone, value, values, max, fmtTick, xLabels, showX }: ChartProps & { showX?: boolean }) {
  const ticks = [max, max / 2, 0]
  return (
    <div className="glass-inset flex min-h-0 flex-1 flex-col px-3.5 pt-2.5 pb-2">
      <div className="flex items-baseline justify-between">
        <span className="text-base text-text">{title}</span>
        <span className="num text-lg" style={{ color: TONE_HEX[tone] }}>
          {value}
        </span>
      </div>
      <div className="mt-1 flex min-h-0 flex-1 gap-2">
        <div className="num flex w-[64px] shrink-0 flex-col justify-between py-0.5 text-right text-xs leading-none whitespace-nowrap text-text-dim">
          {ticks.map((t) => (
            <span key={t}>{fmtTick(t)}</span>
          ))}
        </div>
        <div className="min-h-[44px] min-w-0 flex-1">
          <Sparkline values={values} color={TONE_HEX[tone]} min={0} max={max} width={240} height={60} className="h-full" />
        </div>
      </div>
      {showX && (
        <div className="num mt-1 flex justify-between pl-[72px] text-xs leading-none text-text-dim">
          {xLabels.map((l, i) => (
            <span key={i}>{l}</span>
          ))}
        </div>
      )}
    </div>
  )
}

function Tile({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: Tone }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-1">
      <span className="text-sm whitespace-nowrap text-text-dim">{label}</span>
      <span className={cx('num text-right text-base', TONE_TEXT[tone])}>{value}</span>
    </div>
  )
}

const LINK_TONE: Record<TelemetryPoint['link'], Tone> = { nominal: 'green', degraded: 'amber', offline: 'red' }

export function TelemetryPanel({ sim, storageGB }: { sim: SimState; storageGB: number }) {
  const tel = sim.telemetry
  const last = tel[tel.length - 1]
  // series start with the state at launch so the first step already draws a line
  const battery = [100, ...tel.map((t) => t.batteryPct)]
  const stored = [0, ...tel.map((t) => t.storedGB)]
  const returned = [0, ...tel.map((t) => t.returnedTotalGB)]
  const m = sim.stepMonths
  const total = sim.totalSteps * m
  const xLabels = ['Launch', `M${Math.round(total / 3)}`, `M${Math.round((2 * total) / 3)}`, `M${total}`]

  const storedMax = niceMax(Math.max(storageGB, ...stored) || 1)
  const returnedMax = niceMax(Math.max(...returned, 1) * 1.15)

  return (
    <Panel
      title="Telemetry"
      className="h-full min-h-0"
      right={<span>{sim.stepMonths === 2 ? '2-month steps' : 'Monthly steps'}</span>}
      bodyClassName="flex min-h-0 flex-col gap-2 !px-[14px] !pt-3 !pb-3"
    >
      <TelemetryChart
        title="Battery"
        tone="green"
        value={`${Math.round(battery[battery.length - 1])}%`}
        values={battery}
        max={100}
        fmtTick={(v) => `${v}%`}
        xLabels={xLabels}
      />
      <TelemetryChart
        title="Stored data"
        tone="cyan"
        value={fmtGB(stored[stored.length - 1])}
        values={stored}
        max={storedMax}
        fmtTick={fmtAxisGB}
        xLabels={xLabels}
      />
      <TelemetryChart
        title="Downlinked"
        tone="purple"
        value={fmtGB(returned[returned.length - 1])}
        values={returned}
        max={returnedMax}
        fmtTick={fmtAxisGB}
        xLabels={xLabels}
        showX
      />
      <div className="shrink-0 divide-y divide-white/10 px-2">
        <Tile label="Solar input" value={last ? `${Math.round(last.solarInputW)} W` : '—'} />
        <Tile label="Payload draw" value={last ? `${Math.round(last.payloadDrawW)} W` : '—'} />
        <Tile label="Core temperature" value={last ? `${Math.round(last.coreTempC)}°C` : '—'} />
        <Tile label="Link status" value={last ? last.linkText : 'Standby'} tone={last ? LINK_TONE[last.link] : 'neutral'} />
      </div>
    </Panel>
  )
}
