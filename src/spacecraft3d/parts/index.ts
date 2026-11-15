// Part registry: (mission, slot, component id) → factory.
import type { MissionId, SlotKey } from '../../data/types'
import { DEEP_PARTS } from './deep'
import { EARTH_PARTS } from './earth'
import { SOLAR_PARTS } from './solar'
import type { PartFactory } from './types'

export function partFactory(missionId: MissionId, slot: SlotKey, id: string): PartFactory | null {
  if (slot === 'solar') return SOLAR_PARTS[missionId]?.[id] ?? null
  if (missionId === 'earth') return EARTH_PARTS[id] ?? null
  return DEEP_PARTS[id] ?? null
}

export type { BusSpec, Extra, MountKind, PartCtx, PartFactory, PartResult } from './types'
