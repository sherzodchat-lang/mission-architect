import { useState } from 'react'
import { ActionBar, Button, Icon, Modal, PageHeader, WarningCard, cx } from '../components'
import { audio } from '../audio/audioManager'
import { useDesignEvaluation, useGameStore, useMission } from '../store/gameStore'
import { OrbitHero } from './orbit/OrbitHero'
import { FlightPlan } from './orbit/FlightPlan'
import { openBuilderTab } from './orbit/helpers'
import { issueTab } from './builder/util'
import type { CategoryId } from '../data'
import { FLIGHT_OWNER, playerOf, ROLE_NAME } from '../engine'
import type { FlightSection } from '../engine'
import { ReviewBoard } from './team/ReviewBoard'
import { TeamBar } from './team/TeamBar'

export default function OrbitLaunch() {
  const mission = useMission()
  const ev = useDesignEvaluation()
  const design = useGameStore((s) => s.design)
  const goTo = useGameStore((s) => s.goTo)
  const setOrbit = useGameStore((s) => s.setOrbit)
  const setLauncher = useGameStore((s) => s.setLauncher)
  const toggleStation = useGameStore((s) => s.toggleStation)
  const setTest = useGameStore((s) => s.setTest)
  const launch = useGameStore((s) => s.launch)

  const [hoverStation, setHoverStation] = useState<string | null>(null)
  const [riskOpen, setRiskOpen] = useState(false)
  const [issuesOpen, setIssuesOpen] = useState(false)
  const [review, setReview] = useState(false)
  const team = useGameStore((s) => s.team)
  const lockHint = team
    ? (sec: FlightSection) => {
        const owner = FLIGHT_OWNER[sec]
        if (team.players[team.active]?.roles.includes(owner)) return null
        const p = playerOf(team, owner)
        return `${ROLE_NAME[owner]}${p.name ? ` (${p.name})` : ''} controls this`
      }
    : undefined

  const issues = [...ev.issues].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'critical' ? -1 : 1))
  const hasCritical = issues.some((i) => i.severity === 'critical')
  const hasWarningsOnly = ev.canLaunch && ev.warnings.length > 0
  const statusTone = !ev.canLaunch ? 'red' : hasWarningsOnly ? 'amber' : 'green'

  const confirm = (acceptRisk?: boolean) => {
    const r = launch(acceptRisk ? { acceptRisk: true } : undefined)
    if (r.ok) {
      setRiskOpen(false)
      audio.say('v07_go_for_launch')
    } else if (r.reason === 'needs_confirmation') {
      setRiskOpen(true)
    }
  }

  const goFix = (tab: CategoryId) => {
    setIssuesOpen(false)
    openBuilderTab(tab)
    goTo('builder')
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        breadcrumb={[mission.name, 'Orbit & launch']}
        title="Plan the flight."
        subtitle={team ? undefined : 'Choose an orbit, reserve launch capacity and connect the ground segment.'}
        below={team ? <TeamBar /> : undefined}
        step={[3, 5]}
        actions={
          issues.length > 0 ? (
            <button
              type="button"
              onClick={() => setIssuesOpen(true)}
              aria-haspopup="dialog"
              className={cx(
                'flex h-10 max-w-[440px] min-w-0 items-center gap-2.5 rounded-control border border-white/[0.09] bg-white/[0.03] px-3.5 text-left transition-colors duration-200 hover:border-white/20 hover:bg-white/[0.06]',
              )}
            >
              <Icon name="warning" size={20} className={cx('shrink-0', hasCritical ? 'text-red' : 'text-amber')} />
              <span className="min-w-0 truncate text-sm text-text">{issues[0].what}</span>
              {issues.length > 1 && (
                <span className={cx('num shrink-0 text-sm', hasCritical ? 'text-red' : 'text-amber')}>+{issues.length - 1}</span>
              )}
              <span className="flex shrink-0 items-center gap-1 text-sm text-text-dim">
                Review
                <Icon name="arrowRight" size={16} />
              </span>
            </button>
          ) : undefined
        }
      />

      <div className="grid min-h-0 flex-1 gap-[13px] px-4" style={{ gridTemplateColumns: 'minmax(0,1fr) 560px' }}>
        <OrbitHero
          mission={mission}
          orbitId={design.orbit}
          stations={design.stations}
          activeStation={hoverStation}
          gauges={ev.gauges}
        />
        <FlightPlan
          mission={mission}
          orbitId={design.orbit}
          launcherId={design.launcher}
          testId={design.test}
          launchers={ev.launchers}
          stations={ev.stations}
          capacityPerMonthGB={ev.core.capacityPerMonth}
          onOrbit={setOrbit}
          onLauncher={setLauncher}
          onToggleStation={toggleStation}
          onHoverStation={setHoverStation}
          onTest={setTest}
          lockHint={lockHint}
        />
      </div>

      <div className="shrink-0 px-4 pt-3 pb-3.5">
        <ActionBar
          onBack={() => goTo('builder')}
          backLabel="Back to design"
          status={ev.statusLine}
          statusTone={statusTone}
          action={
            <Button iconRight="arrowRight" disabled={!ev.canLaunch} onClick={() => (team ? setReview(true) : confirm())}>
              {team ? 'Review & launch' : 'Confirm launch plan'}
            </Button>
          }
        />
      </div>

      <Modal
        open={issuesOpen}
        onClose={() => setIssuesOpen(false)}
        title={`${issues.length} ${issues.length === 1 ? 'issue' : 'issues'} with this plan`}
        width={760}
        tone={hasCritical ? 'red' : 'amber'}
        footer={<Button onClick={() => setIssuesOpen(false)}>Close</Button>}
      >
        <div className="flex max-h-[560px] flex-col gap-2.5 overflow-y-auto p-1">
          {issues.map((i, n) => {
            const tab = issueTab(i, mission, design)
            const label = mission.categories.find((c) => c.id === tab)?.label
            const critical = i.severity === 'critical'
            return (
              <WarningCard
                key={`${i.code}-${n}`}
                severity={critical ? 'red' : 'amber'}
                what={i.what}
                why={i.why}
                fix={i.fix}
                actionLabel={tab && label ? `Open ${label}` : undefined}
                onAction={tab && label ? () => goFix(tab) : undefined}
              />
            )
          })}
        </div>
      </Modal>

      {team && (
        <ReviewBoard
          open={review}
          stage="launch"
          onClose={() => setReview(false)}
          onProceed={() => {
            setReview(false)
            confirm()
          }}
        />
      )}

      <Modal
        open={riskOpen}
        onClose={() => setRiskOpen(false)}
        title="Launch with warnings?"
        width={720}
        tone="amber"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRiskOpen(false)}>
              Keep editing
            </Button>
            <Button variant="danger" icon="warning" onClick={() => confirm(true)}>
              Launch at your own risk
            </Button>
          </>
        }
      >
        <p className="mb-3 text-base text-text-dim">The spacecraft can fly, but these problems will cost you science or reliability:</p>
        <div className="flex flex-col gap-2.5">
          {ev.warnings.map((w, n) => (
            <WarningCard key={`${w.code}-${n}`} severity="amber" what={w.what} why={w.why} fix={w.fix} />
          ))}
        </div>
      </Modal>
    </div>
  )
}
