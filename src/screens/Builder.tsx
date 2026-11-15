import { useEffect, useRef, useState } from 'react'
import { audio } from '../audio/audioManager'
import { ActionBar, Button, PageHeader, Tooltip } from '../components'
import type { CategoryId } from '../data'
import type { DesignEvaluation, IssueCode } from '../engine'
import { CATEGORY_OWNER, playerOf, ROLE_NAME } from '../engine'
import { prewarmThumbnails } from '../spacecraft3d'
import { selectCanRedo, selectCanUndo, useDesignEvaluation, useGameStore, useMission } from '../store/gameStore'
import { Catalog } from './builder/Catalog'
import { Constraints } from './builder/Constraints'
import { Hints } from './builder/Hints'
import { Viewport } from './builder/Viewport'
import { ReviewBoard } from './team/ReviewBoard'
import { TeamBar } from './team/TeamBar'

/** Screen 03: Spacecraft design (mockup Mission_Architect_Glassmorphism_6_Screens/03_Spacecraft_Design.png). */
export default function Builder() {
  const mission = useMission()
  const design = useGameStore((s) => s.design)
  const evaluation = useDesignEvaluation()
  const goTo = useGameStore((s) => s.goTo)
  const undo = useGameStore((s) => s.undo)
  const redo = useGameStore((s) => s.redo)
  const resetDesign = useGameStore((s) => s.resetDesign)
  const saveCurrentDesign = useGameStore((s) => s.saveCurrentDesign)
  const saves = useGameStore((s) => s.saves)
  const canUndo = useGameStore(selectCanUndo)
  const canRedo = useGameStore(selectCanRedo)
  const saved = useSavedLabel()
  const team = useGameStore((s) => s.team)
  const [review, setReview] = useState(false)

  const [tab, setTab] = useState<CategoryId>(() => {
    try {
      const t = sessionStorage.getItem('ma_builder_tab')
      sessionStorage.removeItem('ma_builder_tab')
      const hit = mission.categories.find((c) => c.id === t)
      if (hit) return hit.id
    } catch {
      /* storage unavailable */
    }
    return mission.categories[0].id
  })
  const [exploded, setExploded] = useState(true)

  // team mode: when the console changes hands, open the first tab the new player controls
  const activeRoles = team ? team.players[team.active]?.roles.join(',') : ''
  useEffect(() => {
    if (!team) return
    const roles = team.players[team.active]?.roles ?? []
    const own = mission.categories.find((c) => roles.includes(CATEGORY_OWNER[c.id]))
    if (own) setTab(own.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoles, mission])

  const lockHint = team
    ? (id: CategoryId) => {
        const owner = CATEGORY_OWNER[id]
        if (team.players[team.active]?.roles.includes(owner)) return null
        const p = playerOf(team, owner)
        const label = mission.categories.find((c) => c.id === id)?.label ?? id
        return `${ROLE_NAME[owner]}${p.name ? ` (${p.name})` : ''} controls ${label}`
      }
    : undefined

  const continueToOrbit = () => {
    audio.playSfx('ui_step')
    goTo('orbit')
  }

  useEffect(() => {
    prewarmThumbnails(mission.id)
  }, [mission.id])

  useIssueAudio(evaluation)

  const designIssues = evaluation.issues.filter((i) => i.scope === 'design')
  const designWarnings = designIssues.filter((i) => i.severity === 'warning').length
  const missingCount = designIssues.filter((i) => i.code === 'missing_component').length
  const realCriticals = designIssues.filter((i) => i.severity === 'critical' && i.code !== 'missing_component').length
  const status = realCriticals
    ? { text: 'Resolve critical constraints', tone: 'red' as const }
    : missingCount
      ? { text: `Install a part in every slot · ${missingCount} to go`, tone: 'neutral' as const }
      : !evaluation.designReady
        ? { text: 'Resolve critical constraints', tone: 'red' as const }
        : designWarnings
          ? { text: `${designWarnings} warning${designWarnings > 1 ? 's' : ''} · you can continue at your own risk`, tone: 'amber' as const }
          : { text: 'Design within limits', tone: 'green' as const }

  const sameAsLastSave =
    saves[0] != null && saves[0].missionId === mission.id && JSON.stringify(saves[0].design) === JSON.stringify(design)

  return (
    <div className="relative flex h-full flex-col">
      <PageHeader
        breadcrumb={[mission.name, 'Spacecraft builder']}
        title="Spacecraft design"
        subtitle={team ? undefined : 'Configure the payload. Resolve the constraints.'}
        below={team ? <TeamBar /> : undefined}
        step={[2, 5]}
        actions={
          <>
            <Button variant="secondary" icon="undo" onClick={undo} disabled={!canUndo}>
              Undo
            </Button>
            <Button variant="secondary" icon="redo" onClick={redo} disabled={!canRedo}>
              Redo
            </Button>
            <Button variant="secondary" icon="reset" onClick={resetDesign} disabled={isEmpty(design)}>
              Reset
            </Button>
            <Button
              variant="secondary"
              icon="save"
              disabled={isEmpty(design) || sameAsLastSave}
              onClick={() => saveCurrentDesign(`${mission.name} · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`)}
            >
              {sameAsLastSave ? 'Saved' : 'Save draft'}
            </Button>
          </>
        }
        actionsNote={saved ? `Saved ${saved}` : undefined}
      />

      <div className="grid min-h-0 flex-1 gap-[13px] px-4" style={{ gridTemplateColumns: '410px minmax(0,1fr) 408px' }}>
        <Catalog mission={mission} design={design} tab={tab} onTab={setTab} lockHint={lockHint} />
        <Viewport mission={mission} design={design} tab={tab} exploded={exploded} onExploded={setExploded} onOpenTab={setTab} />
        <Constraints mission={mission} design={design} evaluation={evaluation} onOpenTab={setTab} />
      </div>

      <div className="shrink-0 px-4 pt-3 pb-3.5">
        <ActionBar
          onBack={() => goTo('missions')}
          backLabel="Mission brief"
          status={status.text}
          statusTone={status.tone}
          action={
            <Tooltip
              content={
                evaluation.designReady
                  ? null
                  : realCriticals
                    ? 'Resolve the red constraints first.'
                    : 'Install a part in every slot first.'
              }
              placement="top"
            >
              <Button
                iconRight="arrowRight"
                disabled={!evaluation.designReady}
                onClick={() => (team ? (audio.playSfx('ui_click'), setReview(true)) : continueToOrbit())}
                silent
              >
                {team ? 'Review & continue' : 'Continue to orbit'}
              </Button>
            </Tooltip>
          }
        />
      </div>

      {team && (
        <ReviewBoard
          open={review}
          stage="design"
          onClose={() => setReview(false)}
          onProceed={() => {
            setReview(false)
            continueToOrbit()
          }}
        />
      )}

      <Hints hasParts={!isEmpty(design)} complete={missingCount === 0} tab={tab} />
    </div>
  )
}

/** "just now" / "N min ago" since the last autosave of the draft. */
function useSavedLabel(): string | null {
  const at = useGameStore((s) => s.lastAutosaveAt)
  const [, tick] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 30_000)
    return () => window.clearInterval(id)
  }, [])
  if (at == null) return null
  const mins = Math.floor((Date.now() - at) / 60_000)
  return mins < 1 ? 'just now' : `${mins} min ago`
}

function isEmpty(d: { instruments: string[]; solar: string | null; battery: string | null; radio: string | null; computer: string | null; attitude: string | null; propulsion: string | null; burnWire: boolean }) {
  return !d.instruments.length && !d.solar && !d.battery && !d.radio && !d.computer && !d.attitude && !d.propulsion && !d.burnWire
}

/**
 * Sounds for newly appearing design issues (GAME_DESIGN 14.3/14.4): `ui_critical` / `ui_warning` sfx when a new
 * issue appears, the issue's voice line at most once per visit of this step, `v06_design_ok` once when everything
 * turns green. Issues present when the screen opens are silent.
 */
function useIssueAudio(evaluation: DesignEvaluation) {
  const prev = useRef<Set<IssueCode> | null>(null)
  const spoken = useRef(new Set<string>())
  const wasOk = useRef<boolean | null>(null)

  const issues = evaluation.issues.filter((i) => i.scope === 'design')
  const key = issues.map((i) => i.code).join(',')
  const ok = evaluation.designReady && issues.length === 0 && evaluation.allGreen

  useEffect(() => {
    const now = new Set(issues.map((i) => i.code))
    if (prev.current == null) {
      prev.current = now
      wasOk.current = ok
      return
    }
    // missing parts are expected while building: no alarm for those
    const fresh = issues.filter((i) => !prev.current!.has(i.code) && i.code !== 'missing_component')
    prev.current = now
    if (fresh.length) {
      audio.playSfx(fresh.some((i) => i.severity === 'critical') ? 'ui_critical' : 'ui_warning')
      const voiced = fresh.find((i) => i.voice && !spoken.current.has(i.voice))
      if (voiced?.voice) {
        spoken.current.add(voiced.voice)
        audio.say(voiced.voice)
      }
    }
    if (ok && wasOk.current === false && !spoken.current.has('v06_design_ok')) {
      spoken.current.add('v06_design_ok')
      audio.say('v06_design_ok')
    }
    wasOk.current = ok
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ok])
}
