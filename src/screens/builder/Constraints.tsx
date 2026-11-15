import { useState } from 'react'
import { audio } from '../../audio/audioManager'
import { cx, Icon, Tooltip, WarningCard } from '../../components'
import type { CategoryId, Design, Mission, SlotKey } from '../../data'
import type { CoreNumbers, DesignEvaluation, Gauge as EngineGauge, GaugeId, Issue, IssueCode } from '../../engine'
import { fmtDv, fmtGB, fmtGBmo, fmtKg, fmtMoney, fmtPct, fmtW } from '../../engine'
import { categoryOfSlot, issueTab, selectedIds } from './util'

interface ConstraintsProps {
  mission: Mission
  design: Design
  evaluation: DesignEvaluation
  onOpenTab: (id: CategoryId) => void
}

const LABEL: Record<GaugeId, string> = {
  mass: 'Mass',
  power: 'Power',
  budget: 'Budget',
  data: 'Storage',
  comms: 'Downlink',
  time: 'Schedule',
  fuel: 'Fuel Δv',
}

/** A gauge whose supply side comes from a part that is not installed yet: "pending", not a violation. */
const SUPPLIER: Partial<Record<GaugeId, { slot: SlotKey; needs: string }>> = {
  power: { slot: 'solar', needs: 'needs panels' },
  data: { slot: 'computer', needs: 'needs computer' },
  comms: { slot: 'radio', needs: 'needs radio' },
  fuel: { slot: 'propulsion', needs: 'needs engine' },
}

const bySeverity = (a: Issue, b: Issue) => (a.severity === b.severity ? 0 : a.severity === 'critical' ? -1 : 1)

/** Right column (03 "System constraints"): thin gauges, warning cards, one calm build-progress note. */
export function Constraints({ mission, design, evaluation, onOpenTab }: ConstraintsProps) {
  const issues = evaluation.issues.filter((i) => i.scope === 'design')
  const missing = issues.filter((i) => i.code === 'missing_component')
  const other = issues.filter((i) => i.code !== 'missing_component').sort(bySeverity)
  const critical = other.some((i) => i.severity === 'critical')
  const missingSlots = new Set(missing.map((m) => m.slot))
  const pendingOf = (g: EngineGauge) => {
    const sup = SUPPLIER[g.id]
    return sup && missingSlots.has(sup.slot) && g.available <= 1e-9 ? sup.needs : null
  }
  // Accordion: with up to 2 issues every card is open; with 3 the most severe one is open; with 4+ all start as
  // one-line rows (a click opens one) so the whole list fits the panel at 1672x941 without scrolling.
  const [expanded, setExpanded] = useState<IssueCode | null>(null)
  const expandedCode = other.some((i) => i.code === expanded) ? expanded : other.length >= 4 ? null : other[0]?.code
  // many issues or a long gauge list: tighter gauge rhythm to leave room for the list
  const dense = other.length >= 3 || (other.length >= 2 && evaluation.gauges.length > 6)
  const go = (id: CategoryId | null) => {
    if (!id) return
    audio.playSfx('ui_click')
    onOpenTab(id)
  }

  return (
    <section className="glass flex min-h-0 flex-col" aria-label="System constraints">
      <header className="flex shrink-0 items-center justify-between gap-3 px-[22px] pt-[18px]">
        <h2 className="text-xl leading-tight font-medium whitespace-nowrap text-text">System constraints</h2>
        {other.length > 0 ? (
          <span className={cx('inline-flex items-center gap-1.5 text-sm whitespace-nowrap', critical ? 'text-red' : 'text-amber')}>
            <Icon name="warning" size={17} />
            {other.length} {other.length === 1 ? 'issue' : 'issues'}
          </span>
        ) : missing.length === 0 ? (
          <span className="inline-flex items-center gap-1.5 text-sm whitespace-nowrap text-text-dim">
            <Icon name="check" size={17} className="text-green" />
            Within limits
          </span>
        ) : null}
      </header>

      <div className={cx('mx-[22px] mt-3.5 flex shrink-0 flex-col border-t border-hairline pt-3.5', dense ? 'gap-2' : 'gap-[13px]')}>
        {evaluation.gauges.map((g) => (
          <ConstraintRow key={g.id} g={g} mission={mission} pending={pendingOf(g)} dense={dense} />
        ))}
      </div>

      <div className={cx('constraints-scroll flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-2', dense ? 'mt-3 gap-2' : 'mt-4 gap-2.5')}>
        {missing.length > 0 && <BuildProgress mission={mission} design={design} missing={missing} onGo={go} />}
        {other.map((issue) =>
          other.length <= 2 || issue.code === expandedCode ? (
            <IssueCard key={issue.code} issue={issue} mission={mission} design={design} core={evaluation.core} gauges={evaluation.gauges} onGo={go} />
          ) : (
            <IssueRow
              key={issue.code}
              dense={dense}
              issue={issue}
              value={cardText(issue, mission, design, evaluation.core, evaluation.gauges).value}
              onOpen={() => setExpanded(issue.code)}
            />
          ),
        )}
      </div>

      <p className="shrink-0 px-[22px] pt-1.5 pb-4 text-xs text-text-faint">Recalculated after each change · illustrative values</p>
      <style>{`.constraints-scroll{scrollbar-width:thin;scrollbar-color:rgb(255 255 255/.16) transparent}`}</style>
    </section>
  )
}

// ---------------------------------------------------------------------------

const money = (v: number) => {
  const a = Math.abs(v)
  return (a >= 10 ? a.toFixed(1) : a.toFixed(2)).replace(/\.?0+$/, '')
}

/**
 * Mono "used / available" plus the unit written once (03: "4.1 / 5 kg", "$4.7 / 5 M"); the unit is returned
 * separately so it can be set smaller and is never dropped (long pairs such as "1200 / 1206 m/s" still fit).
 */
function pairText(g: EngineGauge, mission: Mission): { num: string; unit: string } {
  const r = pairString(g, mission)
  const m = /^(.*\d)\s*([^\d\s][^\d]*)$/.exec(r)
  return m ? { num: m[1], unit: m[2] } : { num: r, unit: '' }
}

function pairString(g: EngineGauge, mission: Mission): string {
  if (g.id === 'budget') return `$${money(g.used)} / ${money(g.available)} M`
  if (g.id === 'time') return `${Math.round(g.used * 10) / 10} / ${Math.round(g.available * 10) / 10} mo`
  const f: (v: number) => string =
    g.id === 'mass' ? (v) => fmtKg(v, mission) : g.id === 'power' ? fmtW : g.id === 'data' ? fmtGB : g.id === 'comms' ? fmtGBmo : fmtDv
  const ua = f(g.used)
  const ub = f(g.available)
  const sa = ua.lastIndexOf(' ')
  const sb = ub.lastIndexOf(' ')
  if (sa > 0 && sb > 0 && ua.slice(sa) === ub.slice(sb)) return `${ua.slice(0, sa)} / ${ub}`
  return `${ua} / ${ub}`
}

const FILL = { green: 'bg-green/85', amber: 'bg-amber', red: 'bg-red' } as const
const VALUE = { green: 'text-text', amber: 'text-amber', red: 'text-red' } as const

/** Label left, mono "used / available" right, 6px bar below; colour only when amber or red. */
function ConstraintRow({ g, mission, pending, dense }: { g: EngineGauge; mission: Mission; pending: string | null; dense?: boolean }) {
  const ratio = g.available > 0 ? g.used / g.available : g.used > 0 ? 2 : 0
  const pct = Math.max(0, Math.min(1, ratio)) * 100
  const over = !pending && g.used > g.available + 1e-9
  const value = pending ? null : pairText(g, mission)

  const tip = (
    <>
      <b className="block font-medium text-text">
        {LABEL[g.id]} <span className="num font-normal text-text-dim">{g.valueText}</span>
      </b>
      <span className="mt-1.5 block text-xs text-text-faint">Used by</span>
      {g.breakdown.filter((b) => b.value !== 0).length ? (
        g.breakdown
          .filter((b) => b.value !== 0)
          .map((b, i) => (
            <span key={i} className="flex justify-between gap-4">
              <span className="text-text-dim">{b.label}</span>
              <span className="num">{b.text}</span>
            </span>
          ))
      ) : (
        <span className="block text-text-dim">Nothing yet</span>
      )}
      <span className="mt-1.5 block text-xs text-text-faint">Available</span>
      {g.availableBreakdown.length ? (
        g.availableBreakdown.map((b, i) => (
          <span key={i} className="flex justify-between gap-4">
            <span className="text-text-dim">{b.label}</span>
            <span className="num">{b.text}</span>
          </span>
        ))
      ) : (
        <span className="block text-text-dim">Nothing yet</span>
      )}
      <span className={cx('mt-1.5 block', pending ? 'text-text-dim' : g.status === 'green' ? 'text-text' : VALUE[g.status])}>
        {pending ? 'Waiting for a part' : Number.isFinite(g.margin) ? `Margin ${fmtPct(g.margin)}` : 'No supply'}
      </span>
    </>
  )

  return (
    <Tooltip content={tip} placement="left" bubbleClassName="w-80 !max-w-80 !top-0 !translate-y-0" className="w-full">
      <div tabIndex={0} role="group" aria-label={`${LABEL[g.id]} ${pending ?? g.valueText}`} className="w-full cursor-help rounded-sm outline-offset-4">
        <div className={cx('flex items-baseline justify-between gap-3', dense ? 'mb-1' : 'mb-[7px]')}>
          <span className="text-base text-text">{LABEL[g.id]}</span>
          {pending ? (
            <span className="text-sm text-text-faint">{pending}</span>
          ) : (
            <span className={cx('num text-[15px] whitespace-nowrap', VALUE[g.status])}>
              {value?.num}
              {value?.unit && <span className="ml-1 text-[13px] opacity-75">{value.unit}</span>}
            </span>
          )}
        </div>
        <div className={cx('relative h-1.5 rounded-full', pending ? 'bg-white/[0.07]' : 'bg-white/[0.12]')}>
          {!pending && (
            <div
              className={cx('absolute inset-y-0 left-0 rounded-full transition-[width,background-color] duration-500 ease-out', FILL[g.status])}
              style={{ width: `${pct}%` }}
            />
          )}
          {over && (
            <span className={cx('absolute -top-1 right-0 h-3.5 w-[3px] rounded-full shadow-[0_0_0_2px_rgb(10_26_33/0.8)]', FILL[g.status])} aria-hidden="true" />
          )}
        </div>
      </div>
    </Tooltip>
  )
}

// ---------------------------------------------------------------------------

interface CardText {
  value?: string
  why: string
  detail?: string
}

/** Short 03-style texts: "Power deficit · 5 W" / one-line explanation / mono "Demand 14 W / Available 9 W". */
function cardText(issue: Issue, mission: Mission, design: Design, core: CoreNumbers, gauges: EngineGauge[]): CardText {
  const g = gauges.find((x) => x.id === issue.gauge)
  const kg = (v: number) => fmtKg(v, mission)
  const mo = (v: number) => `${Math.round(v * 10) / 10} mo`
  switch (issue.code) {
    case 'power_bus':
      return {
        value: fmtW(core.busLoadW - core.supplyW),
        why: 'Core systems draw more than the panels supply.',
        detail: `Demand ${fmtW(core.busLoadW)} / Available ${fmtW(core.supplyW)}`,
      }
    case 'power_instruments':
      return {
        value: fmtW(Math.max(0, core.demandW - core.supplyW)),
        why: `Payload demand exceeds solar generation; instruments run ${fmtPct(core.dutyPower)} of the time.`,
        detail: `Demand ${fmtW(core.demandW)} / Available ${fmtW(core.supplyW)}`,
      }
    case 'battery_small':
      return {
        why: 'Instruments switch off in shadow and the battery wears out.',
        detail: `Eclipse ${Math.round(core.batteryNeedWh)} Wh / Battery ${mission.catalog.battery.find((b) => b.id === design.battery)?.wh ?? 0} Wh`,
      }
    case 'comms_bottleneck':
      return {
        value: fmtPct(1 - core.capacityPerMonth / core.generatedPerMonth),
        why: 'Part of the data will never reach Earth.',
        detail: `Data ${fmtGB(core.generatedPerMonth).replace(/ GB$/, '')} / Link ${fmtGBmo(core.capacityPerMonth)}`,
      }
    case 'storage_buffer':
      return {
        why: 'A missed ground contact would overflow the memory.',
        detail: `Buffer ${fmtGB(core.bufferNeedGB)} / Storage ${fmtGB(core.storageGB)}`,
      }
    case 'schedule_over':
      return {
        value: `+${mo(core.timeMonths - mission.limits.devMonths)}`,
        why: `Each extra month costs ${fmtMoney(mission.overFee)} and score.`,
        detail: `Build ${mo(core.timeMonths)} / Plan ${mo(mission.limits.devMonths)}`,
      }
    case 'schedule_window':
      return {
        value: `+${mo(core.timeMonths - mission.limits.devMonths)}`,
        why: 'The next launch window opens 26 months later.',
        detail: `Build ${mo(core.timeMonths)} / Window ${mo(mission.limits.devMonths)}`,
      }
    case 'mass_limit':
      return {
        value: `+${kg(core.mass - core.massLimit)}`,
        why: 'Pick lighter components or remove an instrument.',
        detail: `Mass ${kg(core.mass)} / Limit ${kg(core.massLimit)}`,
      }
    case 'budget':
      return {
        value: `+${fmtMoney(core.costM - mission.limits.budgetM)}`,
        why: 'Choose cheaper parts or fewer instruments.',
        detail: `Cost ${fmtMoney(core.costM)} / Budget ${fmtMoney(mission.limits.budgetM)}`,
      }
    case 'fuel':
      return core.dvNeed != null && core.dvHave != null
        ? {
            value: fmtDv(core.dvNeed - core.dvHave),
            why: 'The engine cannot carry this mass all the way.',
            detail: `Need ${fmtDv(core.dvNeed)} / Have ${fmtDv(core.dvHave)}`,
          }
        : { why: issue.why }
    default:
      return { why: issue.why, detail: g && g.used > g.available ? g.valueText : undefined }
  }
}

function IssueCard({
  issue,
  mission,
  design,
  core,
  gauges,
  onGo,
}: {
  issue: Issue
  mission: Mission
  design: Design
  core: CoreNumbers
  gauges: EngineGauge[]
  onGo: (id: CategoryId | null) => void
}) {
  const tab = issueTab(issue, mission, design)
  const cat = mission.categories.find((c) => c.id === tab)
  const t = cardText(issue, mission, design, core, gauges)
  const label = cat ? (cat.id === 'instruments' ? 'payload' : cat.label.toLowerCase()) : null
  return (
    <WarningCard
      severity={issue.severity === 'critical' ? 'red' : 'amber'}
      what={issue.what}
      value={t.value}
      why={t.why}
      detail={t.detail}
      actionLabel={label ? `Review ${label} options` : undefined}
      onAction={tab ? () => onGo(tab) : undefined}
    />
  )
}

/** Collapsed issue: rail + "Schedule overrun · +4 mo"; click expands it into the full card. */
function IssueRow({ issue, value, onOpen, dense }: { issue: Issue; value?: string; onOpen: () => void; dense?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => {
        audio.playSfx('ui_click')
        onOpen()
      }}
      aria-expanded={false}
      className={cx(
        'glass-inset relative flex w-full shrink-0 items-center gap-3 !rounded-card pr-3.5 pl-[34px] text-left transition-colors duration-200 hover:bg-white/[0.06]',
        dense ? 'py-2.5' : 'py-3',
        issue.severity === 'critical' && '!border-red/25',
      )}
    >
      <span className={cx('absolute top-2.5 bottom-2.5 left-4 w-[3px] rounded-full', issue.severity === 'critical' ? 'bg-red' : 'bg-amber')} aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate text-base text-text">
        {issue.what}
        {value && (
          <>
            <span className="mx-1.5 text-text-dim">·</span>
            <span className="num">{value}</span>
          </>
        )}
      </span>
      <Icon name="chevronDown" size={18} className="shrink-0 text-text-dim" />
    </button>
  )
}

/** Missing parts: one neutral note with a thin progress line and quiet links (nothing is wrong yet). */
function BuildProgress({ mission, design, missing, onGo }: { mission: Mission; design: Design; missing: Issue[]; onGo: (id: CategoryId | null) => void }) {
  const groups = mission.categories.flatMap((c) => c.groups)
  const done = groups.filter((g) => selectedIds(design, g.key).length >= Math.max(1, g.min)).length
  return (
    <section aria-label="Build progress" className="glass-inset !rounded-card px-4 py-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-base text-text">
          <span className="num">{done}</span> of <span className="num">{groups.length}</span> parts installed
        </h3>
        <span className="text-sm text-text-dim">{missing.length} to go</span>
      </div>
      <div
        className="mt-2.5 h-1 rounded-full bg-white/[0.08]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={groups.length}
        aria-valuenow={done}
        aria-label="Parts installed"
      >
        <div className="h-full rounded-full bg-white/45 transition-[width] duration-500 ease-out" style={{ width: `${(done / groups.length) * 100}%` }} />
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {missing.map((m) => {
          const cat = m.slot ? categoryOfSlot(mission, m.slot) : undefined
          return (
            <button
              key={m.slot}
              type="button"
              onClick={() => onGo(cat?.id ?? issueTab(m, mission, design))}
              className="inline-flex items-center gap-1 text-sm text-text-dim underline decoration-white/25 underline-offset-4 transition-colors hover:text-text hover:decoration-white/60"
            >
              {m.what.replace(/^No /, '').replace(/^\w/, (ch) => ch.toUpperCase())}
            </button>
          )
        })}
      </div>
    </section>
  )
}
