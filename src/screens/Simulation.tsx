import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { audio } from '../audio/audioManager'
import { SFX, type SfxId } from '../audio/audioManifest'
import { ActionBar, Button, Icon, Modal, PageHeader, Tabs, cx } from '../components'
import { MISSIONS } from '../data'
import { fmtGB, getTimeline, phaseOf, type SimState } from '../engine'
import { demoStartsFast } from '../store/demo'
import { useGameStore } from '../store/gameStore'
import { DecisionPanel } from './sim/DecisionPanel'
import { MissionLog } from './sim/MissionLog'
import { CountdownOverlay, EndOverlay } from './sim/Overlays'
import { SceneView } from './sim/SceneView'
import { ScienceDownlink } from './sim/ScienceDownlink'
import { TelemetryPanel } from './sim/TelemetryPanel'
import { TimelinePanel } from './sim/TimelinePanel'
import { useFrameValue, useSimClock } from './sim/useSimClock'

type Speed = '1x' | '4x'
const STEP_MS: Record<Speed, number> = { '1x': 6000, '4x': 1500 }
const COUNTDOWN_FROM = 5
const END_DELAY_MS = 4500

/** Screen 05 — Mission simulation (GAME_DESIGN 7). */
export default function Simulation() {
  const sim = useGameStore((s) => s.sim)
  const goTo = useGameStore((s) => s.goTo)
  if (!sim) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-5">
        <p className="text-2xl text-text">No mission in flight.</p>
        <Button icon="arrowLeft" onClick={() => goTo('orbit')}>
          Back to launch plan
        </Button>
      </div>
    )
  }
  return <SimulationScreen sim={sim} />
}

function SimulationScreen({ sim }: { sim: SimState }) {
  const mission = MISSIONS[sim.missionId]
  const report = useGameStore((s) => s.report)
  const simAdvance = useGameStore((s) => s.simAdvance)
  const simDecide = useGameStore((s) => s.simDecide)
  const team = useGameStore((s) => s.team)
  const simSkipToEnd = useGameStore((s) => s.simSkipToEnd)
  const showReport = useGameStore((s) => s.showReport)

  const [paused, setPaused] = useState(false)
  const [speed, setSpeed] = useState<Speed>(() => (demoStartsFast() ? '4x' : '1x'))
  const [confirmSkip, setConfirmSkip] = useState(false)
  // countdown only for a fresh launch (re-entering a running sim continues directly)
  const [countdown, setCountdown] = useState(() =>
    sim.step === 0 && sim.status === 'running' ? COUNTDOWN_FROM : -1,
  )

  const finished = sim.status === 'complete' || sim.status === 'lost'
  const deciding = sim.status === 'decision' && sim.pending != null
  const running = sim.status === 'running' && !paused && countdown < 0

  /* ---------- countdown 5..1, Liftoff ---------- */
  useEffect(() => {
    if (countdown < 0) return
    const t = setTimeout(() => setCountdown((c) => c - 1), countdown === 0 ? 900 : 1000)
    return () => clearTimeout(t)
  }, [countdown])

  /* Space / Enter skips the countdown. The step clock starts by itself: `running` turns true as soon as countdown < 0. */
  const skipCountdown = useCallback(() => setCountdown(-1), [])
  useEffect(() => {
    if (countdown < 0) return
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || (e.key !== ' ' && e.key !== 'Enter')) return
      const el = e.target as HTMLElement | null
      // keep real controls (header buttons, sound toggle) working with their own Space/Enter
      if (el && el !== document.body && el.closest('button, a, input, select, textarea, [role="button"]')) return
      e.preventDefault()
      skipCountdown()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [countdown, skipCountdown])

  /* ---------- step clock ---------- */
  const progress = useSimClock({
    running,
    durationMs: STEP_MS[speed],
    stepKey: sim.step,
    restartKey: sim,
    onStepDone: simAdvance,
  })

  /* ---------- audio: ambient + lines attached to NEW log entries ---------- */
  const seenLogId = useRef(sim.step === 0 ? 0 : (sim.log[sim.log.length - 1]?.id ?? 0))
  const seenTelemetryStep = useRef(sim.step)
  const muteNext = useRef(false)

  useEffect(() => {
    audio.startAmbient()
  }, [])

  useEffect(() => {
    const fresh = sim.log.filter((e) => e.id > seenLogId.current)
    const tel = sim.telemetry[sim.telemetry.length - 1]
    const newStep = tel && tel.step > seenTelemetryStep.current
    if (fresh.length) seenLogId.current = fresh[fresh.length - 1].id
    if (tel) seenTelemetryStep.current = Math.max(seenTelemetryStep.current, tel.step)
    if (muteNext.current) {
      // skip-to-end: dozens of entries at once, keep it quiet
      muteNext.current = false
      return
    }
    let sfxPlayed = false
    for (const e of fresh) {
      if (e.sfx && e.sfx in SFX && !sfxPlayed) {
        audio.playSfx(e.sfx as SfxId)
        sfxPlayed = true
      }
      if (e.voice) audio.say(e.voice)
    }
    // data burst sound on contact steps, sparingly (every third step with a downlink)
    if (newStep && !sfxPlayed && tel.downlinkedGB > 0.01 && tel.step % 3 === 0) audio.playSfx('downlink')
  }, [sim.log, sim.telemetry])

  /* ---------- end: short overlay, then report ---------- */
  useEffect(() => {
    if (!finished || !report) return
    const t = setTimeout(showReport, END_DELAY_MS)
    return () => clearTimeout(t)
  }, [finished, report, showReport])

  const skipToEnd = useCallback(() => {
    setConfirmSkip(false)
    setCountdown(-1)
    muteNext.current = true
    simSkipToEnd('protective')
  }, [simSkipToEnd])

  /* ---------- derived ---------- */
  const timeline = useMemo(() => getTimeline(sim, mission), [sim, mission])
  const activeStep = finished ? 0 : Math.min(sim.totalSteps, sim.step + 1)
  const phase = phaseOf(sim, mission, Math.max(1, activeStep || sim.step))
  const deep = mission.dvRefMass !== null
  const cruise = !finished && deep && (phase.kind === 'cruise' || phase.kind === 'launch')
  const storageGB = useMemo(() => {
    const c = mission.catalog.computer.find((x) => x.id === sim.design.computer)
    return c?.storageGB ?? 0
  }, [mission, sim.design.computer])

  const status = finished
    ? sim.status === 'lost'
      ? { text: 'Spacecraft lost', tone: 'red' as const }
      : sim.endReason === 'decayed'
        ? { text: 'Orbit decayed', tone: 'amber' as const }
        : { text: 'Mission complete', tone: 'green' as const }
    : deciding
      ? { text: 'Decision required', tone: 'amber' as const }
      : countdown >= 0
        ? { text: 'Launch countdown', tone: 'cyan' as const }
        : paused
          ? { text: 'Paused', tone: 'neutral' as const }
          : { text: phase.name, tone: 'cyan' as const }
  const STATUS_TEXT = { red: 'text-red', green: 'text-green', amber: 'text-amber', cyan: 'text-mint', neutral: 'text-text-dim' }

  const orbit = mission.orbits.find((o) => o.id === sim.design.orbit)
  const healthTone = sim.health > 60 ? 'text-text' : sim.health > 30 ? 'text-amber' : 'text-red'

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        breadcrumb={[mission.name, 'Operations']}
        title="Mission operations"
        subtitle="Live systems, contact windows and mission events."
        step={[4, 5]}
        actions={
          <>
            <Tabs
              aria-label="Simulation speed"
              tabs={(['1x', '4x'] as const).map((s) => ({
                id: s,
                label: s === '1x' ? '1×' : '4×',
                disabled: finished,
              }))}
              value={speed}
              onChange={(s) => {
                setSpeed(s)
                setPaused(false)
              }}
            />
            <span className="h-9 w-px bg-hairline" aria-hidden="true" />
            <MissionClock sim={sim} progress={progress} animating={running} />
            <span className="h-9 w-px bg-hairline" aria-hidden="true" />
            <span className={cx('flex min-w-[150px] items-center gap-2 text-lg whitespace-nowrap', STATUS_TEXT[status.tone])} role="status">
              <span className={cx('h-2.5 w-2.5 shrink-0 rounded-full bg-current', deciding && 'animate-pulse-soft')} aria-hidden="true" />
              {status.text}
            </span>
          </>
        }
      />

      {/* main row */}
      <div
        className="grid min-h-0 flex-1 gap-[13px] px-4"
        style={{ gridTemplateColumns: 'minmax(340px,0.5fr) minmax(0,1.4fr) minmax(410px,0.6fr)' }}
      >
        <TelemetryPanel sim={sim} storageGB={storageGB} />

        <section className="glass relative min-h-0 overflow-hidden" aria-label="Mission view">
          <SceneView sim={sim} mission={mission} progress={progress} animating={running} cruise={cruise} orbit={orbit} />
          {countdown < 0 && <ScienceDownlink sim={sim} mission={mission} className="absolute top-[14px] right-[14px] z-[5]" />}
          {countdown >= 0 && <CountdownOverlay value={countdown} onSkip={skipCountdown} />}
          {deciding && !finished && (
            <div className="absolute inset-x-5 bottom-5 z-10 flex justify-center">
              <DecisionPanel pending={sim.pending!} onDecide={simDecide} team={team} />
            </div>
          )}
          {finished && <EndOverlay sim={sim} report={report} onReport={showReport} />}
        </section>

        <MissionLog sim={sim} />
      </div>

      <div className="shrink-0 px-4 pt-[13px]">
        <TimelinePanel sim={sim} mission={mission} timeline={timeline} activeStep={activeStep} />
      </div>

      <div className="shrink-0 px-4 pt-3 pb-3.5">
        <ActionBar
          left={
            <Button variant="secondary" iconRight="arrowRight" onClick={() => setConfirmSkip(true)} disabled={finished}>
              Skip to end
            </Button>
          }
          center={
            <div className={cx('flex items-center whitespace-nowrap', sim.lostGB > 0.05 ? 'gap-5 text-base' : 'gap-8 text-lg')}>
              <span className="text-text-dim">
                Science collected{' '}
                <span className="num ml-2 text-text">
                  {Math.round(sim.science)} <span className="text-text-dim">/ {mission.scienceTarget} pts</span>
                </span>
              </span>
              <span className="h-6 w-px bg-hairline" aria-hidden="true" />
              <span className="text-text-dim">
                Data returned{' '}
                <span className="num ml-2 text-text">
                  {fmtGB(sim.returnedGB)} <span className="text-text-dim">/ {mission.limits.requiredLabel}</span>
                </span>
              </span>
              <span className="h-6 w-px bg-hairline" aria-hidden="true" />
              <span className="text-text-dim">
                Health <span className={cx('num ml-2', healthTone)}>{Math.round(Math.max(0, sim.health))}%</span>
              </span>
              {sim.lostGB > 0.05 && (
                <>
                  <span className="h-6 w-px bg-hairline" aria-hidden="true" />
                  <span className="flex items-center gap-2 text-amber" title="Erased on board because memory was full">
                    <Icon name="warning" size={18} />
                    Lost <span className="num">{fmtGB(sim.lostGB)}</span>
                  </span>
                </>
              )}
            </div>
          }
          action={
            finished ? (
              <Button iconRight="arrowRight" onClick={showReport} disabled={!report}>
                View mission report
              </Button>
            ) : (
              <Button
                icon={paused ? 'play' : 'pause'}
                onClick={() => setPaused((p) => !p)}
                aria-pressed={paused}
              >
                {paused ? 'Resume simulation' : 'Pause'}
              </Button>
            )
          }
        />
      </div>

      <Modal
        open={confirmSkip}
        onClose={() => setConfirmSkip(false)}
        title="Skip to the end?"
        width={560}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmSkip(false)}>
              Keep flying
            </Button>
            <Button iconRight="arrowRight" onClick={skipToEnd}>
              Skip to end
            </Button>
          </>
        }
      >
        <p className="text-base text-text">
          The rest of the mission plays out instantly. Every remaining event is answered with the safe, protective
          option.
        </p>
      </Modal>
    </div>
  )
}

/** "Month 5 • Day 12": the day ticks with the step clock. */
function MissionClock({
  sim,
  progress,
  animating,
}: {
  sim: SimState
  progress: RefObject<number>
  animating: boolean
}) {
  const p = useFrameValue(progress, animating)
  const finished = sim.status === 'complete' || sim.status === 'lost'
  const monthsDone = sim.step * sim.stepMonths
  const elapsedMonths = finished ? monthsDone : monthsDone + Math.min(0.999, p) * sim.stepMonths
  const month = finished ? Math.max(1, monthsDone) : Math.floor(elapsedMonths) + 1
  const day = finished ? 30 : Math.floor((elapsedMonths % 1) * 30) + 1
  return (
    <span className="num flex min-w-[170px] items-center gap-2 text-lg whitespace-nowrap text-text">
      <Icon name="calendar" size={20} className="text-text-dim" />
      M{String(Math.min(month, sim.totalSteps * sim.stepMonths)).padStart(2, '0')} · D{String(day).padStart(2, '0')}
    </span>
  )
}
