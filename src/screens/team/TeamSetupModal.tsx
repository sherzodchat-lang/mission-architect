import { useEffect, useState } from 'react'
import { Button } from '../../components/Button'
import { Modal } from '../../components/Modal'
import { Tabs } from '../../components/Tabs'
import { assignRoles, playerRoleLabel } from '../../engine'
import { useGameStore } from '../../store/gameStore'

type Count = '2' | '3' | '4'

/** Team mode setup (GAME_DESIGN 9): 2-4 players on one device, optional names, automatic roles. */
export function TeamSetupModal({ open, onClose, onStarted }: { open: boolean; onClose: () => void; onStarted?: () => void }) {
  const team = useGameStore((s) => s.team)
  const startTeam = useGameStore((s) => s.startTeam)
  const endTeam = useGameStore((s) => s.endTeam)
  const [count, setCount] = useState<Count>('4')
  const [names, setNames] = useState<string[]>(['', '', '', ''])

  useEffect(() => {
    if (!open) return
    if (team) {
      setCount(String(team.players.length) as Count)
      setNames([0, 1, 2, 3].map((i) => team.players[i]?.name ?? ''))
    }
  }, [open, team])

  const n = Number(count)
  const roles = assignRoles(n)

  const start = () => {
    startTeam(names.slice(0, n))
    onClose()
    onStarted?.()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={team ? 'Team mode' : 'Set up team mode'}
      width={620}
      tone="mint"
      footer={
        <>
          {team ? (
            <Button
              variant="ghost"
              onClick={() => {
                endTeam()
                onClose()
              }}
            >
              Back to solo
            </Button>
          ) : (
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          )}
          <Button iconRight="arrowRight" onClick={start}>
            {team ? 'Update team' : 'Start team session'}
          </Button>
        </>
      }
    >
      <p className="text-base text-text-dim">
        Take turns on this device. Each role controls its own part of the spacecraft and has a personal goal; the team
        reviews the design together before launch.
      </p>

      <div className="mt-5 flex items-center justify-between gap-4">
        <span className="text-base text-text">Players</span>
        <Tabs<Count>
          variant="segmented"
          size="sm"
          aria-label="Number of players"
          tabs={[
            { id: '2', label: '2' },
            { id: '3', label: '3' },
            { id: '4', label: '4' },
          ]}
          value={count}
          onChange={setCount}
        />
      </div>

      <ul className="mt-4 flex flex-col gap-2">
        {roles.map((r, i) => (
          <li key={i} className="glass-inset flex items-center gap-3 px-3.5 py-2.5">
            <span className="num w-6 shrink-0 text-sm text-text-dim">{i + 1}</span>
            <input
              value={names[i]}
              maxLength={24}
              onChange={(e) => setNames((prev) => prev.map((v, k) => (k === i ? e.target.value : v)))}
              placeholder={`Player ${i + 1} (optional)`}
              aria-label={`Player ${i + 1} name`}
              className="h-9 w-[190px] shrink-0 rounded-[9px] border border-white/[0.11] bg-white/[0.035] px-3 text-sm text-text outline-none placeholder:text-text-faint focus:border-mint/50"
            />
            <span className="min-w-0 flex-1 truncate text-sm text-text">{playerRoleLabel({ name: '', roles: r })}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-text-dim">
        {n === 4
          ? 'One role each.'
          : n === 3
            ? 'Mission Manager is merged into Systems Engineer.'
            : 'Two pairs: Science + Comms and Systems + Manager.'}{' '}
        The 4th score category becomes Teamwork: personal goals met, minus 3 per Manager override.
      </p>
    </Modal>
  )
}
