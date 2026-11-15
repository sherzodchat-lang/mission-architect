// Light helpers (no three.js import) — safe to use from the main bundle.
import { MISSIONS } from '../data/missions'
import type { CategoryId, Design, MissionId, SlotKey } from '../data/types'

/** Label shown next to each part group in the 3D view (mockup 03 wording). */
export const CATEGORY_LABEL: Record<CategoryId, string> = {
  instruments: 'Payload',
  computer: 'Flight computer',
  comms: 'Radio',
  attitude: 'Attitude control',
  power: 'Power module',
  propulsion: 'Propulsion',
}

export const SLOT_CATEGORY: Record<SlotKey, CategoryId> = {
  instruments: 'instruments',
  solar: 'power',
  battery: 'power',
  radio: 'comms',
  computer: 'computer',
  attitude: 'attitude',
  propulsion: 'propulsion',
}

const SLOTS: SlotKey[] = ['instruments', 'solar', 'battery', 'radio', 'computer', 'attitude', 'propulsion']

/** Which catalog slot a component id belongs to in a mission (ids are unique per mission). */
export function slotOf(missionId: MissionId, componentId: string): SlotKey | null {
  const cat = MISSIONS[missionId].catalog
  for (const s of SLOTS) if (cat[s].some((c) => c.id === componentId)) return s
  return null
}

/** A good-looking complete design for hero renders / previews. */
export function showcaseDesign(missionId: MissionId): Design {
  const base: Design = { instruments: [], solar: null, battery: null, radio: null, computer: null, attitude: null, propulsion: null, burnWire: false, orbit: null, launcher: null, stations: [], test: null }
  if (missionId === 'earth') return { ...base, instruments: ['imager', 'atmos'], solar: 'deploy', battery: 'bat_m', radio: 'sband', computer: 'obc_std', attitude: 'wheel', burnWire: true }
  if (missionId === 'lunar') return { ...base, instruments: ['cam', 'altim', 'neutron'], solar: 'track', battery: 'bat_m', radio: 'kaband', computer: 'obc_rad', attitude: 'wheel', propulsion: 'biprop' }
  return { ...base, instruments: ['cam', 'tracegas', 'fields'], solar: 'large', battery: 'bat_m', radio: 'x2', computer: 'obc_auto', attitude: 'wheel_red', propulsion: 'biprop' }
}

/** Stable key of the spacecraft-relevant part of a design (for memoisation / caching). */
export function designKey(d: Design): string {
  return [d.instruments.join('+'), d.solar, d.battery, d.radio, d.computer, d.attitude, d.propulsion, d.burnWire ? 'bw' : ''].join('|')
}

let webglOk: boolean | null = null
/** WebGL availability (cached). */
export function hasWebGL() {
  if (webglOk !== null) return webglOk
  try {
    const c = document.createElement('canvas')
    const g = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext | null
    webglOk = !!g
    ;(g?.getExtension('WEBGL_lose_context') as { loseContext?: () => void } | null)?.loseContext?.()
  } catch {
    webglOk = false
  }
  return webglOk
}
