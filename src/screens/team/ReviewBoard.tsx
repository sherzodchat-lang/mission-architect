import { useEffect, useState } from 'react'
import { audio } from '../../audio/audioManager'
import { Button, Icon, Modal, cx } from '../../components'
import { OVERRIDE_PENALTY, OVERRIDE_TOKENS, playerRoleLabel } from '../../engine'
import { useGameStore } from '../../store/gameStore'
import { Avatar } from './TeamBar'
import { useRoleGoals, useTeam } from './useTeam'

const REASONS = [
  'Power margin too thin',
  'Too close to the mass limit',
  'Not enough science',
  'Downlink cannot keep up',
  'Budget or schedule risk',
  'Orbit or rocket choice',
  'Needs more testing',
] as const

type Vote = { kind: 'approve' } | { kind: 'change'; reason: string } | null

/**
 * Review board (GAME_DESIGN 9) after Design and before launch: every role sees its goal status and votes
 * Approve / Request change. All approve -> continue; otherwise the Mission Manager may spend an Override token.
 */
export function ReviewBoard({
  open,
  stage,
  onClose,
  onProceed,
}: {
  open: boolean
  stage: 'design' | 'launch'
  onClose: () => void
  onProceed: () => void
}) {
  const team = useTeam()
  const goals = useRoleGoals()
  const spendOverride = useGameStore((s) => s.spendOverride)
  const [votes, setVotes] = useState<Vote[]>([])

  useEffect(() => {
    if (open && team) setVotes(team.players.map(() => null))
    // reset only when the board opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!team) return null
  const all = team.players.length
  const approved = votes.filter((v) => v?.kind === 'approve').length
  const changes = votes.filter((v) => v?.kind === 'change').length
  const allApproved = approved === all
  const tokensLeft = OVERRIDE_TOKENS - team.overridesUsed
  const manager = team.players.find((p) => p.roles.includes('manager'))
  const setVote = (i: number, v: Vote) => setVotes((prev) => prev.map((x, k) => (k === i ? v : x)))

  const proceedLabel = stage === 'design' ? 'Continue to orbit' : 'Confirm launch plan'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={stage === 'design' ? 'Review board · design' : 'Review board · launch'}
      width={900}
      tone={allApproved ? 'mint' : changes ? 'amber' : 'default'}
      footer={
        <>
          <span className="mr-auto self-center text-sm text-text-dim">
            <span className="num text-text">{approved}</span> of {all} approved
            {changes > 0 && (
              <>
                {' · '}
                <span className="text-amber">{changes} change{changes > 1 ? 's' : ''} requested</span>
              </>
            )}
          </span>
          <Button variant="secondary" onClick={onClose}>
            Back
          </Button>
          {!allApproved && (
            <Button
              variant="danger"
              icon="shield"
              disabled={tokensLeft <= 0}
              onClick={() => {
                if (spendOverride()) onProceed()
              }}
            >
              Override · {tokensLeft} left
            </Button>
          )}
          <Button iconRight="arrowRight" disabled={!allApproved} onClick={onProceed}>
            {proceedLabel}
          </Button>
        </>
      }
    >
      <p className="mb-4 text-base text-text-dim">
        Each role checks its personal goal and votes. The team moves on when everyone approves
        {manager ? `; the Mission Manager${manager.name ? ` (${manager.name})` : ''} can override instead, −${OVERRIDE_PENALTY} Teamwork each` : ''}.
      </p>
      <ul className="flex flex-col gap-2">
        {team.players.map((p, i) => {
          const v = votes[i] ?? null
          const met = p.roles.every((r) => goals[r].met)
          return (
            <li key={i} className="glass-inset flex items-start gap-4 px-4 py-3">
              <Avatar p={p} size={36} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-base text-text">{playerRoleLabel(p)}</span>
                  {p.name && <span className="text-sm text-text-dim">{p.name}</span>}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
                  {p.roles.flatMap((r) => goals[r].checks).map((c) => (
                    <span key={c.label} className="flex items-center gap-1.5 text-sm text-text-dim">
                      <span className={cx('h-2 w-2 rounded-full', c.ok ? 'bg-green' : 'bg-amber')} aria-hidden="true" />
                      {c.label} <span className={cx('num', c.ok ? 'text-text' : 'text-amber')}>{c.value}</span>
                    </span>
                  ))}
                </div>
                <div className={cx('mt-0.5 text-xs', met ? 'text-green' : 'text-text-faint')}>{met ? 'Goal met' : 'Goal not met yet'}</div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <div className="flex items-center gap-1 rounded-control border border-white/10 bg-white/[0.04] p-1" role="radiogroup" aria-label={`${playerRoleLabel(p)} vote`}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={v?.kind === 'approve'}
                    onClick={() => (audio.playSfx('ui_click'), setVote(i, { kind: 'approve' }))}
                    className={cx(
                      'inline-flex h-8 items-center gap-1.5 rounded-[9px] px-3 text-sm font-medium transition-colors',
                      v?.kind === 'approve' ? 'mint-fill' : 'text-text hover:bg-white/[0.06]',
                    )}
                  >
                    <Icon name="check" size={15} strokeWidth={2} />
                    Approve
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={v?.kind === 'change'}
                    onClick={() => (audio.playSfx('ui_click'), setVote(i, { kind: 'change', reason: v?.kind === 'change' ? v.reason : REASONS[0] }))}
                    className={cx(
                      'inline-flex h-8 items-center gap-1.5 rounded-[9px] px-3 text-sm font-medium transition-colors',
                      v?.kind === 'change' ? 'bg-amber/15 text-amber' : 'text-text hover:bg-white/[0.06]',
                    )}
                  >
                    Request change
                  </button>
                </div>
                {v?.kind === 'change' && (
                  <select
                    value={v.reason}
                    onChange={(e) => setVote(i, { kind: 'change', reason: e.target.value })}
                    aria-label="Reason"
                    className="h-8 w-[244px] rounded-[9px] border border-amber/30 bg-panel px-2 text-sm text-text outline-none focus:border-amber/60"
                  >
                    {REASONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </Modal>
  )
}
