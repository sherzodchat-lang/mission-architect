import { useMemo, type ReactNode } from 'react'
import { Icon, Tooltip, cx } from '../../components'
import { audio } from '../../audio/audioManager'
import type { Mission } from '../../data'
import { fmtGB, fmtKg, fmtMoney, fmtPct } from '../../engine'
import type { LauncherStatus, StationStatus } from '../../engine'
import { GTerm, NasaRefTip } from './helpers'

const click = () => audio.playSfx('ui_click')

/* ------------------------------------------------------------------ layout bits */

function Section({
  title,
  aside,
  note,
  locked,
  children,
}: {
  title: ReactNode
  aside?: ReactNode
  note?: ReactNode
  /** Team mode: "Mission Manager controls this" — the section stays visible but cannot be changed. */
  locked?: string | null
  children: ReactNode
}) {
  return (
    <section className="border-t border-hairline pt-4 first:border-t-0 first:pt-0">
      <header className="mb-2.5 flex items-baseline justify-between gap-4">
        <h2 className="flex items-center gap-2 text-base font-medium text-text">
          {title}
          {locked && (
            <span className="flex items-center gap-1 text-sm font-normal text-text-faint">
              <Icon name="lock" size={14} />
              {locked}
            </span>
          )}
        </h2>
        {aside && <div className="text-sm text-text-dim">{aside}</div>}
      </header>
      {locked ? (
        <div className="pointer-events-none opacity-60" aria-disabled="true">
          {children}
        </div>
      ) : (
        children
      )}
      {note && <div className="mt-2.5 text-sm leading-snug text-text-dim">{note}</div>}
    </section>
  )
}

const OPTION_BASE =
  'w-full rounded-control border text-left transition-[background-color,border-color,color] duration-200 outline-offset-2'
const OPTION_STATE = (selected: boolean, inert?: boolean) =>
  selected
    ? 'border-mint/50 bg-mint/[0.08]'
    : inert
      ? 'cursor-not-allowed border-white/[0.06] bg-transparent'
      : 'cursor-pointer border-white/[0.09] bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'

/** One of three side-by-side options: name over a single key number. */
function Tile({
  selected,
  disabled,
  label,
  value,
  tip,
  onClick,
}: {
  selected: boolean
  disabled?: boolean
  label: ReactNode
  value: ReactNode
  tip?: ReactNode
  onClick: () => void
}) {
  return (
    <Tooltip content={tip} placement="left" bubbleClassName="w-72 !max-w-72" className="flex">
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        aria-disabled={disabled || undefined}
        onClick={() => {
          if (disabled) return
          click()
          onClick()
        }}
        className={cx(OPTION_BASE, OPTION_STATE(selected, disabled), 'flex flex-col gap-0.5 px-3 py-2')}
      >
        <span className={cx('flex items-center gap-1.5 text-base', disabled ? 'text-text-faint' : 'text-text')}>
          {disabled && <Icon name="lock" size={16} className="shrink-0" />}
          {label}
        </span>
        <span className={cx('num text-sm leading-snug', disabled ? 'text-text-faint' : 'text-text-dim')}>{value}</span>
      </button>
    </Tooltip>
  )
}

function Tiles({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-3 gap-2">
      {children}
    </div>
  )
}

/* ------------------------------------------------------------------ contact timeline (tooltip) */

const STATION_COLORS = ['bg-mint', 'bg-blue', 'bg-amber', 'bg-purple'] as const

function fmtContact(min: number): string {
  return min >= 120 ? `${(min / 60).toFixed(1)} h` : `${Math.round(min)} min`
}

/** Schematic 24 h strip: each selected station gets its contact minutes split into a few passes. */
function ContactTimeline({ stations }: { stations: StationStatus[] }) {
  const segs = useMemo(() => {
    const out: { key: string; left: number; width: number; color: string }[] = []
    stations.forEach((s, idx) => {
      if (s.minutesPerDay <= 0) return
      const passes = Math.max(1, Math.min(6, Math.round(s.minutesPerDay / 12)))
      const each = s.minutesPerDay / passes
      for (let k = 0; k < passes; k++) {
        const start = (((idx * 211 + k * (1440 / passes) + idx * 97) % 1440) + 1440) % 1440
        out.push({
          key: `${s.id}-${k}`,
          left: (start / 1440) * 100,
          width: Math.max(0.5, (Math.min(each, 1440 - start) / 1440) * 100),
          color: STATION_COLORS[idx % STATION_COLORS.length],
        })
      }
    })
    return out
  }, [stations])
  return (
    <div className="w-full">
      <div className="mb-2 text-text">Daily contact windows (UTC)</div>
      <div className="relative h-2 rounded-full bg-white/[0.13]">
        {segs.map((g) => (
          <span
            key={g.key}
            className={cx('absolute top-0 h-full rounded-full', g.color)}
            style={{ left: `${g.left}%`, width: `${g.width}%` }}
          />
        ))}
      </div>
      <div className="num mt-1.5 flex justify-between text-xs text-text-dim">
        {['00', '06', '12', '18', '24'].map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {stations.map((s, idx) => (
          <span key={s.id} className="flex items-center gap-1.5 text-text-dim">
            <span className={cx('h-2 w-2 rounded-full', STATION_COLORS[idx % STATION_COLORS.length])} />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ the panel */

export interface FlightPlanProps {
  mission: Mission
  orbitId: string | null
  launcherId: string | null
  testId: string | null
  launchers: LauncherStatus[]
  stations: StationStatus[]
  capacityPerMonthGB: number
  onOrbit: (id: string) => void
  onLauncher: (id: string | null) => void
  onToggleStation: (id: string) => void
  onHoverStation: (id: string | null) => void
  onTest: (id: string) => void
  /** Team mode: lock hint per section (null = the player at the console controls it). */
  lockHint?: (section: 'orbit' | 'launcher' | 'stations' | 'test') => string | null
  className?: string
}

/** The four flight decisions as one calm vertical flow: Orbit · Launch vehicle · Ground stations · Testing. */
export function FlightPlan(p: FlightPlanProps) {
  const { mission } = p
  const deep = mission.id !== 'earth'

  const launcher = p.launchers.find((l) => l.id === p.launcherId)
  const craftKg = p.launchers[0]?.spacecraftKg

  const chosen = p.stations.filter((s) => s.selected)
  const contact = Math.min(1440, chosen.reduce((a, s) => a + s.minutesPerDay, 0))
  const stationCost = chosen.reduce((a, s) => a + s.costM, 0)
  const atMax = chosen.length >= mission.stationsMax
  const enough = chosen.length >= mission.stationsMin
  const stationCols = p.stations.length === 3 ? 3 : 2

  const test = mission.tests.find((t) => t.id === p.testId)

  return (
    <aside className={cx('glass flex min-h-0 flex-col justify-between gap-4 px-6 py-5', p.className)} aria-label="Flight plan">
      {/* ---------------- Orbit */}
      <Section title="Orbit" locked={p.lockHint?.('orbit')}>
        <Tiles label="Orbit">
          {mission.orbits.map((o) => (
            <Tile
              key={o.id}
              selected={o.id === p.orbitId}
              disabled={!o.available}
              label={o.short}
              value={o.available ? (o.altitude ?? '—').replace(/ km$/, '\u00a0km') : 'Not available'}
              tip={
                o.available ? (
                  <>
                    <b className="mb-0.5 block font-medium">{o.name}</b>
                    <span className="text-text-dim">{o.description}</span>
                    <NasaRefTip nref={o.nasaRef} />
                  </>
                ) : (
                  o.unavailableReason
                )
              }
              onClick={() => p.onOrbit(o.id)}
            />
          ))}
        </Tiles>
      </Section>

      {/* ---------------- Launch vehicle */}
      <Section
        locked={p.lockHint?.('launcher')}
        title="Launch vehicle"
        aside={
          craftKg != null && (
            <>
              Your spacecraft <span className="num text-text">{fmtKg(craftKg, mission)}</span>
            </>
          )
        }
        note={
          launcher && !launcher.compatible ? (
            <span className="flex items-start gap-2 text-red">
              <Icon name="warning" size={16} className="mt-0.5 shrink-0" />
              {launcher.reason}
            </span>
          ) : !launcher ? (
            'Choose a vehicle that can carry your spacecraft to this orbit.'
          ) : undefined
        }
      >
        <div role="radiogroup" aria-label="Launch vehicle" className="flex flex-col gap-1.5">
          {p.launchers.map((s) => {
            const info = mission.launchers.find((l) => l.id === s.id)
            const selected = s.id === p.launcherId
            return (
              <Tooltip
                key={s.id}
                placement="left"
                bubbleClassName="w-72 !max-w-72"
                className="flex"
                content={
                  <>
                    {!s.compatible && <b className="mb-1 block font-medium text-red">{s.reason}</b>}
                    <span className="text-text-dim">{info?.note}</span>
                    <NasaRefTip nref={info?.nasaRef} />
                  </>
                }
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => {
                    click()
                    p.onLauncher(selected ? null : s.id)
                  }}
                  className={cx(OPTION_BASE, OPTION_STATE(selected), 'flex h-10 items-center gap-3 px-3.5')}
                >
                  <span
                    className={cx(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                      selected ? 'border-mint' : 'border-white/30',
                    )}
                    aria-hidden="true"
                  >
                    {selected && <span className="h-2 w-2 rounded-full bg-mint" />}
                  </span>
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <span className={cx('truncate text-base', s.compatible ? 'text-text' : 'text-text-dim')}>{s.name}</span>
                    {!s.compatible && <Icon name="warning" size={16} className="shrink-0 text-red/80" aria-label="Not compatible" />}
                  </span>
                  <span className={cx('num w-[76px] shrink-0 text-right text-sm', s.compatible ? 'text-text' : 'text-text-dim')}>
                    {fmtKg(s.orbitPayloadKg, mission)}
                  </span>
                  <span className="num w-[68px] shrink-0 text-right text-sm text-text-dim">{fmtMoney(s.launchPriceM)}</span>
                </button>
              </Tooltip>
            )
          })}
        </div>
      </Section>

      {/* ---------------- Ground stations */}
      <Section
        locked={p.lockHint?.('stations')}
        title={<GTerm id="ground_station">Ground stations</GTerm>}
        aside={
          <Tooltip content={mission.stationsNote} placement="left" bubbleClassName="w-80 !max-w-80">
            <span tabIndex={0} className="inline-flex cursor-help items-center gap-1.5">
              {deep && (
                <>
                  <GTerm id="dsn">DSN</GTerm>
                  <span aria-hidden="true">·</span>
                </>
              )}
              Select {mission.stationsMin}–{mission.stationsMax}
              <Icon name="info" size={16} />
            </span>
          </Tooltip>
        }
        note={
          !enough ? (
            <span className="flex items-center gap-2 text-red">
              <Icon name="warning" size={16} className="shrink-0" />
              Select at least {mission.stationsMin} {mission.stationsMin === 1 ? 'station' : 'stations'}
            </span>
          ) : (
            <Tooltip content={<ContactTimeline stations={chosen} />} placement="left" bubbleClassName="w-80 !max-w-80">
              <span tabIndex={0} className="inline-flex cursor-help items-center gap-1.5">
                <span>
                  Contact <span className="num text-text">{fmtContact(contact)}</span>/day
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  downlink <span className="num text-text">{fmtGB(p.capacityPerMonthGB / 30)}</span>/day
                </span>
                <span aria-hidden="true">·</span>
                <span className="num">{fmtMoney(stationCost)}</span>
                <Icon name="clock" size={16} className="ml-0.5" />
              </span>
            </Tooltip>
          )
        }
      >
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${stationCols}, minmax(0, 1fr))` }}>
          {p.stations.map((s) => {
            const info = mission.stations.find((x) => x.id === s.id)
            const blocked = !s.selected && atMax
            return (
              <Tooltip
                key={s.id}
                placement="left"
                bubbleClassName="w-72 !max-w-72"
                className="flex"
                content={
                  <>
                    <b className="mb-0.5 block font-medium">
                      {s.name} <span className="num font-normal text-text-dim">· {fmtMoney(s.costM)}</span>
                    </b>
                    <span className="text-text-dim">{blocked ? `Up to ${mission.stationsMax} stations.` : s.note || info?.description}</span>
                    {!blocked && <NasaRefTip nref={info?.nasaRef} />}
                  </>
                }
              >
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={s.selected}
                  aria-disabled={blocked || undefined}
                  onClick={() => {
                    if (blocked) return
                    click()
                    p.onToggleStation(s.id)
                  }}
                  onMouseEnter={() => p.onHoverStation(s.id)}
                  onMouseLeave={() => p.onHoverStation(null)}
                  onFocus={() => p.onHoverStation(s.id)}
                  onBlur={() => p.onHoverStation(null)}
                  className={cx(OPTION_BASE, OPTION_STATE(s.selected, blocked), 'flex h-10 items-center gap-2.5 px-3', blocked && 'opacity-50')}
                >
                  <span
                    className={cx(
                      'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border',
                      s.selected ? 'mint-fill border-transparent' : 'border-white/30 text-transparent',
                    )}
                    aria-hidden="true"
                  >
                    <Icon name="check" size={14} strokeWidth={2.4} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-base text-text">{s.name}</span>
                  {/* DSN: three equal complexes in one row - the per-station hours only matter when there are none */}
                  {(stationCols === 2 || s.units <= 0) && (
                    <span className={cx('num shrink-0 text-sm', s.units > 0 ? 'text-text-dim' : 'text-amber')}>
                      {s.units > 0 ? fmtContact(s.minutesPerDay) : 'none'}
                    </span>
                  )}
                </button>
              </Tooltip>
            )
          })}
        </div>
      </Section>

      {/* ---------------- Testing */}
      <Section
        locked={p.lockHint?.('test')}
        title="Testing"
        note={
          test && (
            <>
              Glitch chance in flight <span className="num text-text">{fmtPct(test.glitchChance)}</span>
              {deep && (
                <>
                  <span aria-hidden="true"> · </span>insertion problem <span className="num text-text">{fmtPct(test.insertionProblemChance)}</span>
                </>
              )}
            </>
          )
        }
      >
        <Tiles label="Test campaign">
          {mission.tests.map((t) => (
            <Tile
              key={t.id}
              selected={t.id === p.testId}
              label={t.name.split(' ')[0]}
              value={
                <>
                  {t.costM > 0 ? fmtMoney(t.costM) : 'Free'} · {t.months} mo
                </>
              }
              tip={
                <>
                  <b className="mb-0.5 block font-medium">{t.name}</b>
                  <span className="text-text-dim">{t.description}</span>
                </>
              }
              onClick={() => p.onTest(t.id)}
            />
          ))}
        </Tiles>
      </Section>
    </aside>
  )
}
