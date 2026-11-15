import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { MISSIONS } from '../../data/missions'
import { emptyDesign } from '../../engine/budget'
import { loadDraft } from '../../store/persistence'
import { useDesignEvaluation, useGameStore, type Screen } from '../../store/gameStore'
import type { IconName } from '../Icon'

export type SectionId = 'overview' | 'mission' | 'design' | 'orbit' | 'sim' | 'report'

export interface Section {
  id: SectionId
  label: string
  /** short label for the rail tooltip */
  icon: IconName
  /** the store screen this section opens */
  screen: Screen
  /** reachable under the game rules */
  enabled: boolean
  /** why it is disabled (tooltip) */
  reason?: string
  /** the current screen belongs to this section */
  active: boolean
  /** navigate (no-op when disabled) */
  go: () => void
}

/** Which section a screen belongs to (How to Play lives under Overview). */
export const SCREEN_SECTION: Record<Screen, SectionId> = {
  menu: 'overview',
  howto: 'overview',
  nasa: 'overview',
  missions: 'mission',
  builder: 'design',
  orbit: 'orbit',
  sim: 'sim',
  report: 'report',
}

const IN_FLIGHT: Screen[] = ['builder', 'orbit', 'sim', 'report']

/**
 * The six shell sections with reachability per the game rules:
 * Overview / Mission always; Design once a mission is chosen and a design exists (in memory or as a draft, or
 * from the mission screen); Orbit & launch only when the design has no critical design-scope issue
 * (engine `designReady`); Simulation only while a sim exists; Report only when a report exists.
 */
export function useSections(): Section[] {
  const st = useGameStore(
    useShallow((s) => ({
      screen: s.screen,
      missionId: s.missionId,
      design: s.design,
      past: s.past,
      sim: s.sim,
      report: s.report,
      unlockAll: s.unlockAll,
      progress: s.progress,
      isUnlocked: s.isUnlocked,
      goTo: s.goTo,
      startDesign: s.startDesign,
      continueDraft: s.continueDraft,
      showReport: s.showReport,
    })),
  )
  const ev = useDesignEvaluation()
  const { screen, missionId, design, past, sim, report } = st

  // draft read once per screen change (localStorage), not on every render
  const draft = useMemo(() => (screen === 'menu' || screen === 'howto' || screen === 'nasa' ? loadDraft() : null), [screen])
  const designTouched = useMemo(
    () => JSON.stringify(design) !== JSON.stringify(emptyDesign(MISSIONS[missionId])),
    [design, missionId],
  )
  const inFlight = IN_FLIGHT.includes(screen)
  const hasDesign = inFlight || designTouched || past.length > 0 || !!sim || !!report
  const draftUsable = !!draft && !!MISSIONS[draft.missionId] && st.isUnlocked(draft.missionId)

  const designEnabled = hasDesign || screen === 'missions' || draftUsable
  const orbitEnabled = hasDesign && ev.designReady
  const active = SCREEN_SECTION[screen]

  const goDesign = () => {
    if (hasDesign) st.goTo('builder')
    else if (screen === 'missions') st.startDesign()
    else if (draftUsable) st.continueDraft()
  }

  const list: Omit<Section, 'active'>[] = [
    { id: 'overview', label: 'Overview', icon: 'home', screen: 'menu', enabled: true, go: () => st.goTo('menu') },
    { id: 'mission', label: 'Mission', icon: 'satellite', screen: 'missions', enabled: true, go: () => st.goTo('missions') },
    {
      id: 'design',
      label: 'Design',
      icon: 'cube',
      screen: 'builder',
      enabled: designEnabled,
      reason: 'Choose a mission first',
      go: goDesign,
    },
    {
      id: 'orbit',
      label: 'Orbit & launch',
      icon: 'target',
      screen: 'orbit',
      enabled: orbitEnabled,
      reason: hasDesign ? 'Resolve the critical design issues first' : 'Design a spacecraft first',
      go: () => st.goTo('orbit'),
    },
    {
      id: 'sim',
      label: 'Simulation',
      icon: 'pulse',
      screen: 'sim',
      enabled: !!sim,
      reason: 'Launch the mission to start the simulation',
      go: () => st.goTo('sim'),
    },
    {
      id: 'report',
      label: 'Report',
      icon: 'document',
      screen: 'report',
      enabled: !!report,
      reason: 'Finish a simulation to get the report',
      go: () => st.showReport(),
    },
  ]
  return list.map((s) => ({
    ...s,
    active: s.id === active,
    reason: s.enabled ? undefined : s.reason,
    go: () => {
      if (s.enabled && s.id !== active) s.go()
    },
  }))
}
