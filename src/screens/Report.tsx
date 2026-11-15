import { useEffect, useState } from 'react'
import { audio } from '../audio/audioManager'
import { ActionBar, Button, Icon, PageHeader, StarRating, Tooltip, cx } from '../components'
import { MISSIONS } from '../data'
import type { MissionReport } from '../engine'
import { designProfile, fmtGB, fmtMoney, matchAnalogs } from '../engine'
import { useGameStore } from '../store/gameStore'
import { AnalogPanel } from './report/AnalogPanel'
import { CardsPanel } from './report/CardsPanel'
import { SaveDesignModal } from './report/SaveDesignModal'
import { ScorePanel } from './report/ScorePanel'

/** The report voice line and sting play once per report object. */
let announced: MissionReport | null = null

const OUTCOME = {
  success: {
    stroke: 'var(--color-mint)',
    dot: 'bg-mint',
    sub: 'Your spacecraft completed its mission. Review the trade-offs and improve your next design.',
  },
  partial: {
    stroke: 'var(--color-amber)',
    dot: 'bg-amber',
    sub: 'Some of the science came home, but not everything the mission needed. See what held it back.',
  },
  failure: {
    stroke: 'var(--color-red)',
    dot: 'bg-red',
    sub: 'The mission did not reach its goal. Read what happened and try a new design.',
  },
}

function ScoreRing({ value, stroke }: { value: number; stroke: string }) {
  const R = 64
  const C = 2 * Math.PI * R
  const pct = Math.max(0, Math.min(100, value)) / 100
  return (
    <div className="relative h-[128px] w-[128px] shrink-0" role="img" aria-label={`Score ${value} out of 100`}>
      <svg viewBox="0 0 152 152" className="h-full w-full -rotate-90">
        <circle cx="76" cy="76" r={R} fill="none" stroke="rgb(255 255 255 / 0.1)" strokeWidth="9" />
        <circle
          cx="76"
          cy="76"
          r={R}
          fill="none"
          stroke={stroke}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${C * pct} ${C}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[50px] leading-none font-light text-text">{value}</span>
        <span className="mt-1 text-sm text-text-dim tabular-nums">/ 100</span>
      </div>
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="min-w-0 flex-1 border-l border-hairline pl-6 first:border-l-0 first:pl-0">
      <div className="text-base text-text-dim">{label}</div>
      <div className="mt-0.5 text-[34px] leading-tight font-light whitespace-nowrap text-text tabular-nums">{value}</div>
      <div className="text-sm text-text-dim">{sub}</div>
    </div>
  )
}

export default function Report() {
  const report = useGameStore((s) => s.report)
  const newlyUnlocked = useGameStore((s) => s.newlyUnlocked)
  const redesign = useGameStore((s) => s.redesign)
  const goTo = useGameStore((s) => s.goTo)
  const sim = useGameStore((s) => s.sim)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!report || announced === report) return
    announced = report
    audio.playSfx(report.sfx)
    audio.say(report.voice)
  }, [report])

  if (!report) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-5">
        <p className="text-xl text-text">No mission report yet. Fly a mission to see how it went.</p>
        <Button size="lg" icon="home" onClick={() => goTo('menu')}>
          Main menu
        </Button>
      </div>
    )
  }

  const mission = MISSIONS[report.missionId]
  const st = report.stats
  const o = OUTCOME[report.outcome]
  const months = st.stepsOperated * mission.stepMonths
  const totalMonths = st.totalSteps * mission.stepMonths
  const status =
    st.endReason === 'lost'
      ? `Spacecraft lost, month ${months}`
      : st.endReason === 'decayed'
        ? `Orbit decayed, month ${months}`
        : report.outcome === 'success'
          ? 'Mission completed'
          : 'Operations ended'

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        breadcrumb={[mission.name, 'Mission report']}
        title="Mission assessment"
        subtitle={`${mission.name} · ${totalMonths}-month operations review`}
        step={[5, 5]}
        actions={
          <Button variant="secondary" iconRight="arrowUpRight" onClick={() => window.print()}>
            Export report
          </Button>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col gap-[13px] px-4">
        <section className="glass flex shrink-0 items-center gap-8 px-8 py-3" aria-label="Mission summary">
          <ScoreRing value={report.totalRounded} stroke={o.stroke} />
          <div className="w-[300px] shrink-0">
            <div className="flex items-center gap-2.5 text-base text-text">
              <span className={cx('h-2.5 w-2.5 rounded-full', o.dot)} aria-hidden="true" />
              {status}
            </div>
            <div className="mt-1 text-2xl leading-tight font-normal text-text">{report.outcomeTitle}</div>
            <StarRating value={report.stars} size={28} className="mt-2.5 gap-1.5" />
          </div>
          <div className="min-w-0 flex-1 self-stretch border-l border-hairline pl-8">
            <div className="flex">
              <Stat
                label="Science returned"
                value={fmtGB(st.returnedGB)}
                sub={`of ${mission.limits.requiredLabel} required`}
              />
              <Stat
                label="Budget used"
                value={fmtMoney(st.finalCostM)}
                sub={`of ${fmtMoney(mission.limits.budgetM)} budget`}
              />
              <Stat
                label="Duration"
                value={`${months} months`}
                sub={months >= totalMonths ? 'full mission term' : `of ${totalMonths} planned`}
              />
              <Stat label="Final health" value={`${Math.round(st.health)}%`} sub="spacecraft condition" />
            </div>
            <p className="mt-2 border-t border-hairline pt-2 text-base text-text-dim italic">{o.sub}</p>
          </div>
        </section>

        <div className="grid min-h-0 flex-1 gap-[13px]" style={{ gridTemplateColumns: '440px minmax(0,1fr) 460px' }}>
          <ScorePanel report={report} />
          <CardsPanel cards={report.cards} chain={report.chain} />
          <AnalogPanel
            match={report.analogMatch ?? matchAnalogs(designProfile(report.design, mission, report.outcome), mission)}
            report={report}
            sim={sim}
            missionId={report.missionId}
          />
        </div>
      </div>

      <div className="shrink-0 px-4 pt-3 pb-3.5">
        <ActionBar
          left={
            <Tooltip content={`Mission seed ${report.seed}`} placement="top">
              <span className="flex items-center gap-2.5 text-base text-text-dim" tabIndex={0}>
                <Icon name="check" size={18} className="text-mint" />
                Report generated · Final assessment
              </span>
            </Tooltip>
          }
          center={
            newlyUnlocked.length > 0 ? (
              <span className="flex items-center gap-2.5 text-base text-text">
                <Icon name="rocket" size={20} className="text-mint" />
                {newlyUnlocked.map((id) => MISSIONS[id].name).join(' and ')} unlocked
              </span>
            ) : (
              <span className="num text-sm text-text-dim">Seed {report.seed}</span>
            )
          }
          action={
            <>
              <Button iconRight="arrowRight" onClick={redesign}>
                Redesign &amp; relaunch
              </Button>
              <Button variant="secondary" icon="save" onClick={() => setSaving(true)}>
                Save design
              </Button>
              <Button variant="ghost" onClick={() => goTo('menu')}>
                Main menu
              </Button>
            </>
          }
        />
      </div>

      <SaveDesignModal open={saving} onClose={() => setSaving(false)} defaultName={`${mission.name} ${report.totalRounded}`} />
    </div>
  )
}
