import type * as THREE from 'three'
import type { MissionId } from '../../data/types'
import type { Detail, V3 } from '../core/builder'

/** Bus envelope the parts are built for (metres). CubeSat: long axis X. Bus: up = +Y. */
export interface BusSpec {
  kind: 'cubesat' | 'bus'
  size: V3
}

export interface PartCtx {
  missionId: MissionId
  detail: Detail
  /** texture tiling multiplier (bigger craft → coarser tiling) */
  texScale: number
  /** thumbnail / catalog rendering: shorten very long booms, show stowed extras next to the main body */
  preview: boolean
  bus: BusSpec
  /** Earth: redundant burn wire option */
  burnWire: boolean
}

/**
 * Where an extra piece is mounted on the bus.
 * - endDeck: CubeSat +X end plate (boresight +X)
 * - sideFace: CubeSat −Z long face at the slot's position (boresight −Z)
 * - top: bus top deck (+Y)
 * - mast: bus top deck on a short mast
 * - boom: bus side (−X) on a deployable boom
 * - lga: two low-gain antennas (top and bottom)
 * - corners: four copies at the lower bus corners, pointing outward
 * - trackers: bus side face (+Z upper corner), boresight tilted up
 */
export type MountKind = 'endDeck' | 'sideFace' | 'top' | 'mast' | 'boom' | 'lga' | 'corners' | 'trackers'

export interface Extra {
  object: THREE.Group
  mount: MountKind
}

/**
 * main: local frame per category —
 * instruments: boresight +Z, back at z = 0;
 * internal boxes (computer / radio / attitude / battery): footprint centred on XY, base z = 0, height +Z;
 * propulsion: module above z = 0 (thrust axis −Z, nozzle below z = 0);
 * solar: already in the bus frame (busFrame = true).
 */
export interface PartResult {
  main: THREE.Group
  extras: Extra[]
  busFrame?: boolean
}

export type PartFactory = (ctx: PartCtx) => PartResult
