/**
 * Pure: turns the simulation state into the list of science frames the spacecraft sent home, with the image
 * effects that the player's design causes. No DOM here - rendering lives in renderFrame.ts.
 */
import type { Instrument, Mission, MissionId, Pointing } from '../data'
import type { SimState, TelemetryPoint } from '../engine'
import { layerFor, type ImageryLayer } from './layers'
import { inSeason, orbitReach, targetsFor, type OrbitReach, type Target } from './targets'

/* ------------------------------------------------------------------ */
/* Effects                                                             */
/* ------------------------------------------------------------------ */

export type FlareState = 'none' | 'safe' | 'observed' | 'damaged'

export interface EffectInput {
  /** instrument quality at none / coarse / fine pointing */
  quality: readonly [number, number, number]
  pointing: Pointing
  flare: FlareState
  /** this instrument was damaged by radiation in this or an earlier step */
  damaged: boolean
  /** computer susceptibility (0.05 rad-hard … 0.6 basic) */
  flareDamage: number
  /** share of this step's data erased because memory was full (0..1) */
  lostFrac: number
  /** share of the frame that reached Earth this step (0..1) */
  arrivedFrac: number
  health: number
  seed: number
}

export interface FrameEffects {
  pointing: Pointing
  /** instrument quality at this pointing (0..1) */
  quality: number
  /** pointing does not matter for this instrument */
  pointingFree: boolean
  /** gaussian blur radius in px at a 480 px wide frame */
  blur: number
  /** motion smear 0..1 (tumbling spacecraft) */
  smear: number
  jitterX: number
  jitterY: number
  rotation: number
  /** sensor noise 0..1 */
  noise: number
  deadColumns: number
  /** share of rows erased (storage overflow) */
  lost: number
  /** share of rows received (downlink) */
  arrived: number
  seed: number
}

function hash(...n: number[]): number {
  let h = 2166136261
  for (const v of n) {
    h ^= v | 0
    h = Math.imul(h, 16777619)
    h ^= h >>> 13
  }
  return h >>> 0
}
const unit = (h: number) => (h % 10000) / 10000

export function frameEffects(i: EffectInput): FrameEffects {
  const q = i.quality[i.pointing]
  const pointingFree = i.quality[0] >= 0.99 && i.quality[1] >= 0.99
  const r1 = unit(hash(i.seed, 1)) * 2 - 1
  const r2 = unit(hash(i.seed, 2)) * 2 - 1
  const r3 = unit(hash(i.seed, 3)) * 2 - 1
  const shake = pointingFree ? 0 : i.pointing === 0 ? 1 : i.pointing === 1 ? 0.35 : 0
  let noise = 0
  if (i.flare === 'observed') noise += 0.15 + 0.6 * i.flareDamage
  if (i.flare === 'damaged') noise += 0.35 + 0.5 * i.flareDamage
  if (i.damaged) noise += 0.12
  if (i.health < 40) noise += 0.1
  return {
    pointing: i.pointing,
    quality: q,
    pointingFree,
    blur: round1((1 - q) * 7),
    smear: i.pointing === 0 && !pointingFree ? 1 : 0,
    jitterX: Math.round(r1 * 26 * shake),
    jitterY: Math.round(r2 * 18 * shake),
    rotation: round1(r3 * 9 * shake),
    noise: Math.min(0.8, round2(noise)),
    deadColumns: i.damaged ? 3 + (hash(i.seed, 4) % 4) : 0,
    lost: clamp(round2(i.lostFrac), 0, 0.5),
    // at least a quarter of the frame is always shown so the player sees what the data is
    arrived: i.arrivedFrac >= 0.97 ? 1 : clamp(round2(i.arrivedFrac), 0.25, 1),
    seed: i.seed,
  }
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const round1 = (v: number) => Math.round(v * 10) / 10
const round2 = (v: number) => Math.round(v * 100) / 100

/* ------------------------------------------------------------------ */
/* Captions                                                            */
/* ------------------------------------------------------------------ */

export interface FrameNote {
  tone: 'good' | 'info' | 'warn' | 'bad'
  text: string
}

export interface NoteContext {
  instrumentName: string
  attitudeName: string
  radioName: string
  computerName: string
  storageGB: number
  lostGB: number
  pointingLostMonth: number | null
  damagedMonth: number | null
  distanceNote?: string
  missedTarget?: { name: string; reason: string }
  /** unclamped share of the data that got down (caption uses the true number) */
  arrivedRaw?: number
}

const pct = (v: number) => `${Math.round(v * 100)}%`

/** Plain-English explanation of every effect visible in the frame, worst first. */
export function explainEffects(e: FrameEffects, c: NoteContext): FrameNote[] {
  const notes: FrameNote[] = []
  if (e.lost > 0.01)
    notes.push({
      tone: 'bad',
      text: `Missing strips: memory full - ${c.lostGB.toFixed(1)} GB erased before it could be sent. The ${c.computerName} holds ${c.storageGB} GB; more storage or a faster radio fixes this.`,
    })
  if (e.arrived < 1)
    notes.push({
      tone: 'warn',
      text: `Partial frame: only ${pct(Math.max(0.01, c.arrivedRaw ?? e.arrived))} of the data got down this step - the ${c.radioName} and your ground stations are the bottleneck. The rest waits on board.`,
    })
  if (e.deadColumns > 0)
    notes.push({ tone: 'bad', text: `Dead columns: radiation damaged the ${c.instrumentName}${c.damagedMonth ? ` in month ${c.damagedMonth}` : ''}.` })
  else if (e.noise >= 0.3)
    notes.push({ tone: 'warn', text: `Speckled: a solar flare hit while observing. The ${c.computerName} let radiation noise into the data.` })
  else if (e.noise > 0.05)
    notes.push({ tone: 'info', text: 'Light speckle: radiation hits on the detector during a flare.' })
  if (e.pointingFree) {
    notes.push({ tone: 'info', text: `The ${c.instrumentName} is not an imager: pointing does not change its data.` })
  } else if (e.pointing === 0) {
    notes.push({
      tone: 'bad',
      text: `Smeared: ${c.attitudeName} cannot hold the spacecraft steady - the ${c.instrumentName} needs fine pointing.`,
    })
  } else if (e.pointing === 1 && e.quality < 1) {
    notes.push({
      tone: 'warn',
      text: c.pointingLostMonth
        ? `Blurred: a wheel fault in month ${c.pointingLostMonth} left only coarse pointing - the ${c.instrumentName} needs fine pointing.`
        : `Blurred: ${c.attitudeName} give only coarse pointing - the ${c.instrumentName} needs fine pointing.`,
    })
  } else if (e.pointing === 2) {
    notes.push({ tone: 'good', text: `Sharp: ${c.attitudeName} hold fine pointing.` })
  }
  if (c.distanceNote) notes.push({ tone: 'info', text: c.distanceNote })
  if (c.missedTarget) notes.push({ tone: 'warn', text: `Planned target ${c.missedTarget.name} was out of reach: ${c.missedTarget.reason.charAt(0).toLowerCase()}${c.missedTarget.reason.slice(1)}` })
  return notes
}

/* ------------------------------------------------------------------ */
/* Frames from the simulation                                          */
/* ------------------------------------------------------------------ */

export interface ScienceFrame {
  key: string
  step: number
  /** mission month at the end of the step */
  month: number
  instrumentId: string
  instrumentName: string
  layer: ImageryLayer
  target: Target
  /** request date for daily/monthly products (YYYY-MM-DD), null for static mosaics */
  date: string | null
  zoom: number
  effects: FrameEffects
  notes: FrameNote[]
  /** 0..1, for picking the best frames */
  score: number
}

/** Calendar date for a mission month: the mission is replayed on the most recent 12-24 months of real data. */
export function missionDate(month: number, totalMonths: number, now: Date, day = 15): { year: number; month: number; iso: string } {
  // latest month with complete monthly composites = two months before "now"; the last mission month lands there
  const end = now.getUTCFullYear() * 12 + now.getUTCMonth() - 2
  const m0 = end - Math.max(0, totalMonths - Math.max(1, Math.min(month, totalMonths)))
  const year = Math.floor(m0 / 12)
  const mon = (m0 % 12) + 1
  const dd = String(Math.max(1, Math.min(28, day))).padStart(2, '0')
  return { year, month: mon, iso: `${year}-${String(mon).padStart(2, '0')}-${dd}` }
}

function pickIndex(n: number, ...seed: number[]): number {
  return n <= 1 ? 0 : hash(...seed) % n
}

export interface FrameOptions {
  now?: Date
}

/** Science frames returned so far (one per contact step, instruments in rotation). */
export function buildFrames(sim: SimState, mission: Mission, opts: FrameOptions = {}): ScienceFrame[] {
  const now = opts.now ?? new Date()
  const missionId = mission.id as MissionId
  const d = sim.design
  const instruments = d.instruments
    .map((id) => mission.catalog.instruments.find((x) => x.id === id))
    .filter((x): x is Instrument => !!x && !!layerFor(missionId, x.id))
  if (!instruments.length) return []
  const attitude = mission.catalog.attitude.find((a) => a.id === d.attitude)
  const radio = mission.catalog.radio.find((r) => r.id === d.radio)
  const computer = mission.catalog.computer.find((c) => c.id === d.computer)
  const designPointing = (attitude?.pointing ?? 0) as Pointing
  const totalMonths = sim.totalSteps * sim.stepMonths

  // when pointing degraded (wheel fault) and which instrument radiation hit
  let pointingLostStep: number | null = null
  const damagedStep: Record<string, number> = {}
  const flareByStep: Record<number, FlareState> = {}
  for (const r of sim.decisions) {
    if (r.eventId === 'wheel' && (r.optionId === 'switch_backup' || (r.optionId === 'attempt_reset' && r.outcome === 'bad')))
      pointingLostStep = pointingLostStep ?? r.step
    if (r.eventId === 'flare') {
      if (r.optionId === 'safe_mode') flareByStep[r.step] = 'safe'
      else if (r.outcome === 'bad') {
        flareByStep[r.step] = 'damaged'
        const hit = instruments.find((i) => r.summary.includes(i.name))
        if (hit && damagedStep[hit.id] == null) damagedStep[hit.id] = r.step
      } else flareByStep[r.step] = 'observed'
    }
  }

  const frames: ScienceFrame[] = []
  const perInstrument: Record<string, number> = {}
  let prev: TelemetryPoint | null = null
  for (const t of sim.telemetry) {
    const p = prev
    prev = t
    if (t.downlinkedGB <= 0.005 || t.generatedTotalGB <= 0) continue
    const inst = instruments[frames.length % instruments.length]
    const layer = layerFor(missionId, inst.id)!
    const reach: OrbitReach = orbitReach(missionId, d.orbit, t.phase)
    const cal = missionDate(Math.max(1, t.month), totalMonths, now, 4 + (hash(sim.seed, t.step, 7) % 22))
    const calMonth = layer.temporal ? cal.month : null
    const { reachable, unreachable } = targetsFor(missionId, inst.id, reach, layer.latLimit)
    const seasonal = (ts: Target[]) => ts.filter((x) => inSeason(missionId, x, calMonth ?? cal.month))
    const wanted = [...seasonal(reachable), ...seasonal(unreachable)]
    const pool = seasonal(reachable).length ? seasonal(reachable) : reachable
    if (!pool.length) continue
    // walk through the target list per instrument (seeded start) so frames show different places
    const n = (perInstrument[inst.id] = (perInstrument[inst.id] ?? -1) + 1)
    const off = pickIndex(97, sim.seed, inst.id.length, inst.id.charCodeAt(0))
    const wish = wanted[(off + n) % Math.max(1, wanted.length)]
    let target = pool[(off + n) % pool.length]
    let missed: NoteContext['missedTarget']
    if (wish && Math.abs(wish.lat) > reach.maxLat) missed = { name: wish.name, reason: reach.reachNote ?? 'the orbit does not pass over it.' }
    else if (wish) target = wish

    const pointing = (pointingLostStep != null && t.step >= pointingLostStep ? Math.min(designPointing, 1) : designPointing) as Pointing
    const lostGB = Math.max(0, t.lostTotalGB - (p?.lostTotalGB ?? 0))
    const avail = (p?.storedGB ?? 0) + t.generatedGB
    const effects = frameEffects({
      quality: inst.quality,
      pointing,
      flare: flareByStep[t.step] ?? 'none',
      damaged: damagedStep[inst.id] != null && t.step >= damagedStep[inst.id],
      flareDamage: computer?.flareDamage ?? 0.3,
      lostFrac: t.generatedGB > 0 ? lostGB / Math.max(t.generatedGB, lostGB) : 0,
      arrivedFrac: avail > 0 ? t.downlinkedGB / avail : 1,
      health: t.health,
      seed: hash(sim.seed, t.step, inst.id.length, inst.id.charCodeAt(0)),
    })
    const notes = explainEffects(effects, {
      instrumentName: inst.name,
      attitudeName: attitude?.name ?? 'the attitude system',
      radioName: radio?.name ?? 'radio',
      computerName: computer?.name ?? 'computer',
      storageGB: computer?.storageGB ?? 0,
      lostGB,
      pointingLostMonth: pointingLostStep != null && t.step >= pointingLostStep ? pointingLostStep * sim.stepMonths : null,
      damagedMonth: damagedStep[inst.id] != null ? damagedStep[inst.id] * sim.stepMonths : null,
      distanceNote: reach.zoomOffset < 0 ? reach.distanceNote : undefined,
      missedTarget: missed,
      arrivedRaw: avail > 0 ? t.downlinkedGB / avail : 1,
    })
    const date = layer.temporal === 'monthly' ? `${cal.iso.slice(0, 8)}01` : layer.temporal ? cal.iso : null
    const score =
      effects.quality * effects.arrived * (1 - effects.lost) * (1 - 0.6 * effects.noise) * 0.82 ** Math.abs(Math.min(0, reach.zoomOffset))
    frames.push({
      key: `${sim.seed}-${t.step}-${inst.id}`,
      step: t.step,
      month: t.month,
      instrumentId: inst.id,
      instrumentName: inst.name,
      layer,
      target,
      date,
      zoom: layer.baseZoom + reach.zoomOffset,
      effects,
      notes,
      score: Math.round(score * 1000) / 1000,
    })
  }
  return frames
}

/** The best frame per instrument, best first (report gallery). */
export function bestFrames(frames: ScienceFrame[], max = 4): ScienceFrame[] {
  const best = new Map<string, ScienceFrame>()
  for (const f of frames) {
    const b = best.get(f.instrumentId)
    if (!b || f.score > b.score || (f.score === b.score && f.step > b.step)) best.set(f.instrumentId, f)
  }
  return [...best.values()].sort((a, b) => b.score - a.score).slice(0, max)
}

/** "Month 5" / "Months 5-6". */
export function monthLabel(f: Pick<ScienceFrame, 'month'>, stepMonths: number): string {
  return stepMonths > 1 ? `Months ${f.month - stepMonths + 1}-${f.month}` : `Month ${f.month}`
}

export function fmtLatLon(lat: number, lon: number): string {
  const a = `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'}`
  const b = `${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'W'}`
  return `${a} ${b}`
}
