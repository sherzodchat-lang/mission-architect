import { useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { audio } from '../../audio/audioManager'
import { Button, Icon, Tooltip, cx } from '../../components'
import { StageRootContext } from '../../components/layout/stageContext'
import { playerRoleLabel, roleControls } from '../../engine'
import type { RoleGoal, RoleId, TeamPlayer } from '../../engine'
import { useGameStore, useMission } from '../../store/gameStore'
import { activePlayer, initials, useRoleGoals, useTeam } from './useTeam'

function Dot({ ok }: { ok: boolean }) {
  return <span className={cx('h-2 w-2 shrink-0 rounded-full', ok ? 'bg-green' : 'bg-amber')} aria-hidden="true" />
}

export function Avatar({ p, size = 32, active }: { p: TeamPlayer; size?: number; active?: boolean }) {
  return (
    <span
      className={cx(
        'num flex shrink-0 items-center justify-center rounded-full border text-xs text-text',
        active ? 'border-mint/60 bg-mint/[0.12]' : 'border-white/20 bg-white/[0.06]',
      )}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {initials(p)}
    </span>
  )
}

/** Goal checks of one player's roles, as calm "label value" chips. */
function GoalChecks({ roles, goals }: { roles: RoleId[]; goals: Record<RoleId, RoleGoal> }) {
  const checks = roles.flatMap((r) => goals[r].checks)
  return (
    <span className="flex min-w-0 items-center gap-3 overflow-hidden">
      {checks.map((c) => (
        <span key={c.label} className="flex shrink-0 items-center gap-1.5 text-sm whitespace-nowrap text-text-dim">
          <Dot ok={c.ok} />
          {c.label}
          <span className={cx('num', c.ok ? 'text-text' : 'text-amber')}>{c.value}</span>
        </span>
      ))}
    </span>
  )
}

/** Everyone's goals (team members see all goals, change only their own tabs). */
function TeamSummary({ goals }: { goals: Record<RoleId, RoleGoal> }) {
  const team = useTeam()
  const mission = useMission()
  if (!team) return null
  return (
    <span className="flex w-[380px] flex-col gap-2.5 text-left">
      {team.players.map((p, i) => (
        <span key={i} className="flex flex-col gap-0.5">
          <span className="flex items-center gap-2 text-text">
            <Dot ok={p.roles.every((r) => goals[r].met)} />
            {playerRoleLabel(p)}
            {p.name && <span className="text-text-dim">· {p.name}</span>}
            {i === team.active && <span className="ml-auto text-xs text-mint">at the console</span>}
          </span>
          {p.roles.map((r) => (
            <span key={r} className="pl-4 text-xs leading-snug text-text-dim">
              {goals[r].goal}. Controls {roleControls(r, mission).join(', ')}.
            </span>
          ))}
        </span>
      ))}
    </span>
  )
}

/**
 * Compact team strip under the page title (Design and Orbit & launch): who is at the console, their live
 * personal goal, team progress (hover for everyone's goals) and "Pass the console".
 */
export function TeamBar() {
  const team = useTeam()
  const passConsole = useGameStore((s) => s.passConsole)
  const goals = useRoleGoals()
  const [handoff, setHandoff] = useState(false)
  const p = activePlayer(team)
  if (!team || !p) return null
  const next = team.players[(team.active + 1) % team.players.length]
  const met = team.players.filter((x) => x.roles.every((r) => goals[r].met)).length

  return (
    <div className="glass-inset flex h-11 max-w-full items-center gap-3.5 !rounded-[12px] py-1 pr-1.5 pl-1.5" role="group" aria-label="Team console">
      <Avatar p={p} active />
      <span className="flex min-w-0 shrink-0 flex-col leading-tight">
        <span className="text-sm whitespace-nowrap text-text">{playerRoleLabel(p, true)}</span>
        <span className="text-xs whitespace-nowrap text-text-dim">{p.name || 'At the console'}</span>
      </span>
      <span className="h-6 w-px shrink-0 bg-hairline" aria-hidden="true" />
      <GoalChecks roles={p.roles} goals={goals} />
      <span className="h-6 w-px shrink-0 bg-hairline" aria-hidden="true" />
      <Tooltip content={<TeamSummary goals={goals} />} placement="bottom" bubbleClassName="!max-w-none">
        <span tabIndex={0} className="flex shrink-0 cursor-help items-center gap-1.5 text-sm whitespace-nowrap text-text-dim">
          <Icon name="users" size={17} />
          Goals <span className="num text-text">{met}/{team.players.length}</span>
        </span>
      </Tooltip>
      <Button
        variant="secondary"
        size="sm"
        iconRight="arrowRight"
        className="shrink-0"
        onClick={() => {
          passConsole()
          setHandoff(true)
        }}
      >
        Pass to {next.name || playerRoleLabel(next, true)}
      </Button>
      {handoff && <PassConsoleOverlay onDone={() => setHandoff(false)} />}
    </div>
  )
}

/** Full-screen glass interstitial "Pass the console to: <Role> (<name>)" with the v19 voice line. */
export function PassConsoleOverlay({ onDone }: { onDone: () => void }) {
  const stageRoot = useContext(StageRootContext)
  const team = useTeam()
  const mission = useMission()
  const goals = useRoleGoals()
  const p = activePlayer(team)

  const done = useRef(onDone)
  done.current = onDone
  useEffect(() => {
    audio.say('v19_pass_console')
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'Escape') done.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!p) return null
  const node = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pass the console"
      className={cx(stageRoot ? 'absolute' : 'fixed', 'inset-0 z-[60] flex animate-fade-in items-center justify-center bg-[#061217]/70 backdrop-blur-xl')}
    >
      <div className="glass-strong flex w-[640px] flex-col items-center rounded-panel px-10 pt-10 pb-8 text-center">
        <Avatar p={p} size={64} active />
        <p className="mt-5 text-lg text-text-dim">Pass the console to</p>
        <h2 className="mt-1 text-title leading-tight font-light text-text">{playerRoleLabel(p)}</h2>
        {p.name && <p className="mt-1 text-xl text-text">{p.name}</p>}
        <div className="mt-6 flex w-full flex-col gap-2 border-t border-hairline pt-5 text-left">
          {p.roles.map((r) => (
            <div key={r} className="flex flex-col gap-0.5">
              <span className="flex items-center gap-2 text-base text-text">
                <Dot ok={goals[r].met} />
                {goals[r].goal}
              </span>
              <span className="pl-4 text-sm text-text-dim">You control {roleControls(r, mission).join(', ')}.</span>
            </div>
          ))}
        </div>
        <Button size="lg" className="mt-7" iconRight="arrowRight" onClick={onDone}>
          {p.name ? `I'm ${p.name}, start my turn` : 'Start my turn'}
        </Button>
      </div>
    </div>
  )
  return createPortal(node, stageRoot ?? document.body)
}
