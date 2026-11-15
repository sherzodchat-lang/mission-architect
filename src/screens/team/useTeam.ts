import { useMemo } from 'react'
import { roleGoals } from '../../engine'
import type { RoleGoal, RoleId, TeamPlayer, TeamState } from '../../engine'
import { useDesignEvaluation, useGameStore, useMission } from '../../store/gameStore'

/** Live personal goals of every role for the current design (section 9 / 13.2 thresholds). */
export function useRoleGoals(): Record<RoleId, RoleGoal> {
  const ev = useDesignEvaluation()
  const mission = useMission()
  return useMemo(() => roleGoals(ev.core, mission), [ev.core, mission])
}

export function useTeam(): TeamState | null {
  return useGameStore((s) => s.team)
}

export function activePlayer(team: TeamState | null): TeamPlayer | null {
  return team ? (team.players[team.active] ?? null) : null
}

/** Initials for the round avatar (never a photo): name initials, else role initials. */
export function initials(p: TeamPlayer): string {
  const src = p.name.trim()
  if (src) {
    const parts = src.split(/\s+/)
    return (parts.length > 1 ? parts[0][0] + parts[1][0] : src.slice(0, 2)).toUpperCase()
  }
  return p.roles.map((r) => r[0].toUpperCase()).join('')
}
