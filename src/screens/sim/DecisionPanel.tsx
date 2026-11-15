import { useEffect, useRef } from 'react'
import { Icon, cx, type IconName } from '../../components'
import type { DecisionEventId } from '../../data'
import { decisionOwner, fmtMoney, playerLabel, playerOf, ROLE_NAME, type PendingDecision, type RoleId, type TeamState } from '../../engine'
import type { OptionId } from '../../data'

const EVENT_ICON: Record<DecisionEventId, IconName> = {
  deploy: 'sun',
  glitch: 'pulse',
  flare: 'radiation',
  outage: 'antenna',
  dsn_busy: 'antenna',
  wheel: 'orbit',
  insertion: 'rocket',
  aerobrake: 'orbit',
}

/** Splits engine cost text "Lower risk · −50% science this month" into tag and the rest. */
function splitCost(text: string): [string, string] {
  const i = text.indexOf(' · ')
  return i < 0 ? ['', text] : [text.slice(0, i), text.slice(i + 3)]
}

/** Team mode: who decides, and what the other roles recommend (Science pushes for data, the rest for safety). */
function teamAdvice(team: TeamState, pending: PendingDecision): { owner: string; hints: string[] } {
  const ownerRole = decisionOwner(pending.eventId)
  const ownerP = playerOf(team, ownerRole)
  const usable = pending.options.filter((o) => !o.disabled)
  const safe = usable.find((o) => o.protective) ?? usable[0]
  const bold = usable.find((o) => !o.protective) ?? usable[0]
  const order: RoleId[] = ['science', 'manager', 'comms', 'systems']
  const hints: string[] = []
  const seen = new Set([ownerP])
  for (const r of order) {
    const p = playerOf(team, r)
    if (seen.has(p) || hints.length >= 2) continue
    seen.add(p)
    const pick = r === 'science' ? bold : safe
    if (pick) hints.push(`${ROLE_NAME[r]} suggests “${pick.label}”`)
  }
  return { owner: playerLabel(ownerP), hints }
}

/**
 * Event window (GAME_DESIGN 7.3), styled as the 05 decision card: floating glass layer with an amber accent line
 * (same look as `Modal tone="amber"`) that sits inside the scene panel, so telemetry and log stay readable.
 */
export function DecisionPanel({
  pending,
  onDecide,
  team,
}: {
  pending: PendingDecision
  onDecide: (id: OptionId) => void
  team?: TeamState | null
}) {
  const advice = team ? teamAdvice(team, pending) : null
  const firstBtn = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    firstBtn.current?.focus({ preventScroll: true })
  }, [pending])

  const focusIndex = pending.options.findIndex((o) => !o.disabled)
  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="sim-decision-title"
      className="glass-strong animate-rise-in relative w-full max-w-[660px] rounded-panel px-7 pt-6 pb-4"
    >
      <span className="absolute top-0 right-6 left-6 h-[3px] rounded-b-full bg-amber" aria-hidden="true" />
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber/15 text-amber">
          <Icon name={EVENT_ICON[pending.eventId]} size={28} />
        </span>
        <div className="min-w-0">
          <h2 id="sim-decision-title" className="text-2xl leading-tight font-medium text-text">
            {pending.title}
          </h2>
          <p className="mt-1 text-base leading-snug text-text-dim">{pending.what}</p>
        </div>
      </div>

      {advice && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-hairline pt-2.5 text-sm">
          <span className="flex items-center gap-1.5 text-text">
            <Icon name="user" size={16} className="text-mint" />
            Decision owner: {advice.owner}
          </span>
          {advice.hints.map((h) => (
            <span key={h} className="text-text-dim">
              {h}
            </span>
          ))}
        </div>
      )}

      {pending.signalDelayLine && (
        <p className="glass-inset mt-3 flex items-center gap-2 px-3 py-1.5 text-sm text-text">
          <Icon name="antenna" size={18} className="shrink-0 text-purple" />
          {pending.signalDelayLine}
        </p>
      )}

      <div className="mt-4 grid gap-4" style={{ gridTemplateColumns: `repeat(${pending.options.length}, minmax(0, 1fr))` }}>
        {pending.options.map((o, i) => {
          const [tag, rest] = splitCost(o.costText)
          const primary = i === 0
          const focus = i === focusIndex
          return (
            <div key={o.id} className={cx('flex flex-col', i > 0 && 'border-l border-hairline pl-4')}>
              <p className="min-h-[44px] text-sm leading-snug text-text-dim">
                {tag && <span className="font-medium text-text">{tag}</span>}
                {tag && ' · '}
                {rest}
              </p>
              <button
                ref={focus ? firstBtn : undefined}
                type="button"
                disabled={o.disabled}
                onClick={() => onDecide(o.id)}
                className={cx(
                  'mt-2 h-12 rounded-control px-3 text-lg leading-tight font-medium transition outline-none focus-visible:ring-2 focus-visible:ring-text',
                  o.disabled
                    ? 'cursor-not-allowed border border-hairline text-text-faint'
                    : primary
                      ? 'mint-fill hover:brightness-105'
                      : 'border border-white/20 bg-white/[0.04] text-text hover:bg-white/[0.09]',
                )}
              >
                {o.label}
              </button>
              {o.disabled && o.disabledReason && (
                <p className="mt-1.5 flex items-center gap-1.5 text-sm text-red">
                  <Icon name="lock" size={16} className="shrink-0" />
                  {o.disabledReason}
                </p>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-hairline pt-3 text-sm text-text-dim">
        <span className="flex items-center gap-2">
          <Icon name="pause" size={16} />
          {pending.pauseText}.
        </span>
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <Icon name="coins" size={16} />
          In-flight reserve <span className="num text-text">{fmtMoney(Math.max(0, pending.reserveM))}</span>
        </span>
      </div>
    </div>
  )
}
