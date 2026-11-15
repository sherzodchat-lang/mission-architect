// Step-based mission simulation (GAME_DESIGN.md section 7). Pure functions, no React.
//
// Usage (UI loop):
//   let s = createSim(design, mission, seed);
//   every 6 s (1x) / 1.5 s (4x), while s.status === 'running':  s = advance(s, mission);
//   if s.status === 'decision': show s.pending, wait for a click, then  s = decide(s, mission, optionId);
//   when s.status is 'complete' or 'lost': report = buildReport(s, mission).
// Every function returns a NEW state object (inputs are never mutated) — safe for Zustand.

import type { Design, Mission, MissionId, Pointing } from '../data/types';
import type { DecisionEventId, EventId, OptionId } from '../data/events';
import { DECISION_PAUSE_TEXT, EVENTS, signalDelayLine } from '../data/events';
import type { VoiceId } from '../data/voiceLines';
import { computeCore, evaluateDesign, resolveDesign } from './budget';
import type { CoreNumbers, ResolvedDesign } from './budget';
import { fmtDv, fmtMoney, fmtPct } from './format';
import { Rng } from './rng';
import type { IsoDate, MarsWindow } from '../data/nasa/horizons';
import {
  PROGRAMME_START, addDays, addMonths, dayNumber, devEndDate, fmtDate, marsDistanceKm, marsLightTimeMin, marsWindows,
  moonDistanceKm, moonLightTimeSec, nextMarsWindow, transferDistanceToMarsKm,
} from '../data/nasa/horizons';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SimStatus = 'running' | 'decision' | 'complete' | 'lost';
export type PhaseKind = 'launch' | 'cruise' | 'commissioning' | 'aerobraking' | 'science' | 'ended';
export type LinkStatus = 'nominal' | 'degraded' | 'offline';
export type LogTag = 'science' | 'systems';
export type LogLevel = 'info' | 'good' | 'warning' | 'critical';

export interface StepPhase {
  step: number;
  kind: PhaseKind;
  name: string;
  /** Science multiplier of this phase (0, 0.5 or 1). */
  scienceFactor: number;
}

export interface ScheduledEvent {
  id: DecisionEventId;
  step: number;
  resolved: boolean;
  /** Station affected (outage / dsn_busy). */
  stationId?: string;
}

export interface DecisionOption {
  id: OptionId;
  label: string;
  /** 'Lower risk' */
  tag: string;
  /** Full line under the button: 'Lower risk · −50% science this month'. */
  costText: string;
  /** Probability of the bad outcome shown to the player (null = no risk). */
  riskChance: number | null;
  /** Money this option costs from the in-flight reserve. */
  costM: number;
  disabled: boolean;
  disabledReason?: string;
  protective: boolean;
}

export interface PendingDecision {
  eventId: DecisionEventId;
  step: number;
  title: string;
  what: string;
  options: DecisionOption[];
  /** Mars without autonomous computer: 'Signal delay: 14 min — …'. */
  signalDelayLine?: string;
  /** Real one-way light time at `date`, minutes, rounded to 0.1 (Mars only, same number as in signalDelayLine). */
  signalDelayMin?: number;
  /** Calendar date (ISO) of this step. */
  date?: IsoDate;
  pauseText: string;
  /** Voice lines to queue when the window opens. */
  voices: VoiceId[];
  sfx?: string;
  /** Remaining reserve, $M. */
  reserveM: number;
}

export interface DecisionRecord {
  eventId: DecisionEventId;
  step: number;
  optionId: OptionId;
  optionLabel: string;
  riskChance: number | null;
  outcome: 'good' | 'neutral' | 'bad';
  summary: string;
}

export interface LogEntry {
  id: number;
  step: number;
  /** Mission month at the end of this step (step × stepMonths). */
  month: number;
  tag: LogTag;
  level: LogLevel;
  title: string;
  text: string;
  eventId?: EventId;
  voice?: VoiceId;
  sfx?: string;
  /** Calendar date (ISO 'YYYY-MM-DD') at the end of this step; step 0 = launch day. See SimState.launchDate. */
  date: IsoDate;
}

export interface TelemetryPoint {
  step: number;
  month: number;
  phase: PhaseKind;
  phaseName: string;
  /** Cosmetic minimum state of charge this step, %. */
  batteryPct: number;
  storedGB: number;
  /** Downlinked this step. */
  downlinkedGB: number;
  /** Generated this step. */
  generatedGB: number;
  returnedTotalGB: number;
  generatedTotalGB: number;
  lostTotalGB: number;
  scienceTotal: number;
  solarInputW: number;
  payloadDrawW: number;
  /** Cosmetic. */
  coreTempC: number;
  link: LinkStatus;
  linkText: string;
  /** GB this step the link could carry. */
  capacityGB: number;
  duty: number;
  health: number;
  /** Remaining fuel % (null without propulsion). */
  fuelPct: number | null;
  /** During cruise: distance to the target body (null otherwise). Scaled from the real Earth–target distance of that date. */
  distanceToTargetKm: number | null;
  /** Calendar date (ISO) at the end of this step. */
  date: IsoDate;
  /** Real Earth–Moon / Earth–Mars distance on that date, JPL Horizons (null on Earth missions). */
  earthTargetKm: number | null;
  /** Real one-way radio light time Earth–target on that date, seconds (Moon ≈ 1.3 s, Mars 290–1200 s; null on Earth). */
  lightTimeSec: number | null;
  /** Active (online) station ids this step. */
  activeStations: string[];
}

export type MarsWindowInfo = Pick<MarsWindow, 'id' | 'open' | 'optimal' | 'close' | 'tofDays' | 'arrival' | 'c3'>;

export interface SimState {
  version: 1;
  missionId: MissionId;
  design: Design;
  seed: number;
  rng: number;
  totalSteps: number;
  /** Last operating step (LEO: 10). */
  lastStep: number;
  stepMonths: number;
  cruiseSteps: number;
  /** Completed steps. */
  step: number;
  /** Step whose automatic start events already ran. */
  startedStep: number;
  status: SimStatus;
  endReason: 'completed' | 'decayed' | 'lost' | null;
  pending: PendingDecision | null;
  schedule: ScheduledEvent[];

  /** Fixed calendar start of the programme (see PROGRAMME_START); development ends at start + devMonths. */
  programmeStart: IsoDate;
  /** Launch day (ISO). Mars: optimal day of the first real launch window after development ends. Others: development end. */
  launchDate: IsoDate;
  /** Arrival at the target (Moon: launch + cruise; Mars: real transfer arrival). null on Earth missions. */
  arrivalDate: IsoDate | null;
  /** Real Mars launch window used (Mars only). */
  launchWindow: MarsWindowInfo | null;
  launchSlip: boolean;
  devMonths: number;
  overMonths: number;
  preflightCostM: number;
  budgetLimitM: number;
  spentInFlightM: number;

  health: number;
  storedGB: number;
  returnedGB: number;
  generatedGB: number;
  lostGB: number;
  science: number;

  dvHave: number | null;
  dvNeed: number | null;
  dvUsed: number;

  panelFactor: number;
  pointing: Pointing;
  instrumentFactors: Record<string, number>;
  coverageMult: number;
  /** Aerobraking steps (0, 1 or 2). */
  aerobrakeSteps: number;
  glitchRecurring: boolean;
  glitchRepeats: number;
  batteryWearSteps: number;
  /** Modifiers for the step in progress. */
  current: { scienceMult: number; offlineStationId: string | null; extraUnits: number; flare: boolean };

  dutySum: number;
  dutyCount: number;
  stepsOperated: number;

  telemetry: TelemetryPoint[];
  log: LogEntry[];
  decisions: DecisionRecord[];
  flags: { firstContact: boolean; firstScience: boolean; signalDelayVoiced: boolean; firstDecision: boolean };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clone<T>(v: T): T {
  return structuredClone(v);
}

/**
 * New state for the next step. Small mutable parts are deep-copied; `log` and `telemetry` are append-only and their
 * entries are never mutated, so they are copied shallowly (a full structuredClone per step was O(steps²) in log size).
 */
function cloneState(st: SimState): SimState {
  return {
    ...st,
    design: st.design, // never mutated after createSim
    schedule: clone(st.schedule),
    pending: st.pending ? clone(st.pending) : null,
    instrumentFactors: { ...st.instrumentFactors },
    current: { ...st.current },
    flags: { ...st.flags },
    decisions: st.decisions.map((d) => ({ ...d })),
    telemetry: st.telemetry.slice(),
    log: st.log.slice(),
  };
}

function ctx(state: SimState, mission: Mission): { r: ResolvedDesign; core: CoreNumbers } {
  const r = resolveDesign(state.design, mission);
  const core = computeCore(state.design, mission, { extraMonths: state.launchSlip ? 1 : 0 });
  return { r, core };
}

function addLog(s: SimState, mission: Mission, step: number, e: Omit<LogEntry, 'id' | 'step' | 'month' | 'date'>): void {
  s.log.push({ id: s.log.length + 1, step, month: step * mission.stepMonths, date: stepDate(s, mission, step), ...e });
}

/** Calendar date at the end of `step` (0 = launch day). Deep-space cruise ends on the arrival date. */
export function stepDate(s: Pick<SimState, 'launchDate' | 'arrivalDate' | 'cruiseSteps'>, mission: Mission, step: number): IsoDate {
  if (step <= 0) return s.launchDate;
  if (mission.dvRefMass !== null && s.arrivalDate) {
    if (step <= s.cruiseSteps) {
      return addDays(s.launchDate, Math.round(((dayNumber(s.arrivalDate) - dayNumber(s.launchDate)) * step) / s.cruiseSteps));
    }
    return addMonths(s.arrivalDate, (step - s.cruiseSteps) * mission.stepMonths);
  }
  return addMonths(s.launchDate, step * mission.stepMonths);
}

/** Real Earth–target distance (km) and one-way light time (s) for a mission on a date; null on Earth missions. */
export function targetGeometry(mission: Mission, date: IsoDate): { distanceKm: number; lightTimeSec: number } | null {
  if (mission.id === 'lunar') return { distanceKm: moonDistanceKm(date), lightTimeSec: moonLightTimeSec(date) };
  if (mission.id === 'mars') return { distanceKm: marsDistanceKm(date), lightTimeSec: Math.round(marsLightTimeMin(date) * 60) };
  return null;
}

const fmtKmShort = (km: number) => (km >= 1e7 ? `${(km / 1e6).toFixed(0)} million km` : `${Math.round(km).toLocaleString('en-US')} km`);
const fmtLight = (sec: number) => (sec >= 90 ? `${(sec / 60).toFixed(1)} min` : `${sec.toFixed(1)} s`);

/** Launch day, arrival day and (Mars) the real window for a development of `devMonths` months. */
function planCalendar(mission: Mission, devMonths: number, cruiseSteps: number): { launchDate: IsoDate; arrivalDate: IsoDate | null; window: MarsWindowInfo | null } {
  const devEnd = devEndDate(devMonths);
  if (mission.id === 'mars') {
    const all = marsWindows();
    const w = nextMarsWindow(devEnd) ?? all[all.length - 1];
    return { launchDate: w.optimal, arrivalDate: w.arrival, window: { id: w.id, open: w.open, optimal: w.optimal, close: w.close, tofDays: w.tofDays, arrival: w.arrival, c3: w.c3 } };
  }
  return { launchDate: devEnd, arrivalDate: mission.dvRefMass !== null ? addMonths(devEnd, cruiseSteps * mission.stepMonths) : null, window: null };
}

function delayRule(mission: Mission, r: ResolvedDesign): { extraRisk: number; protectMult: number; active: boolean } {
  const active = mission.signalDelay && !r.computer?.autonomous;
  return { active, extraRisk: active ? 0.2 : 0, protectMult: active ? 1.5 : 1 };
}

const pct = (p: number) => fmtPct(Math.max(0, Math.min(1, p)));

export function reserveM(s: SimState): number {
  return s.budgetLimitM - s.preflightCostM - s.spentInFlightM;
}

/** Phase of a step for this state (aerobraking length may change during flight). */
export function phaseOf(s: SimState, mission: Mission, step: number): StepPhase {
  const deep = mission.dvRefMass !== null;
  if (step > s.lastStep) return { step, kind: 'ended', name: s.lastStep < s.totalSteps ? 'Re-entered' : 'Ended', scienceFactor: 0 };
  if (step <= s.cruiseSteps) {
    if (!deep) return { step, kind: 'launch', name: 'Launch & deployment', scienceFactor: 0 };
    return step === 1 ? { step, kind: 'launch', name: 'Launch', scienceFactor: 0 } : { step, kind: 'cruise', name: 'Cruise', scienceFactor: 0 };
  }
  if (step === s.cruiseSteps + 1) {
    return { step, kind: 'commissioning', name: deep ? 'Orbit insertion & commissioning' : 'Commissioning', scienceFactor: 0.5 };
  }
  if (step <= s.cruiseSteps + 1 + s.aerobrakeSteps) return { step, kind: 'aerobraking', name: 'Aerobraking', scienceFactor: 0 };
  return { step, kind: 'science', name: 'Science', scienceFactor: 1 };
}

export interface TimelineStep extends StepPhase {
  /** 'Month 3' or 'Months 5–6'. */
  label: string;
  /** Events that already happened at this step. */
  events: EventId[];
  current: boolean;
  done: boolean;
}

/** 12 dots for the bottom timeline. Future events are not revealed. */
export function getTimeline(s: SimState, mission: Mission): TimelineStep[] {
  const out: TimelineStep[] = [];
  for (let step = 1; step <= s.totalSteps; step++) {
    const ph = phaseOf(s, mission, step);
    const a = (step - 1) * mission.stepMonths + 1;
    const b = step * mission.stepMonths;
    const events = new Set<EventId>();
    for (const l of s.log) if (l.step === step && l.eventId) events.add(l.eventId);
    out.push({
      ...ph, label: a === b ? `Month ${a}` : `Months ${a}–${b}`, events: [...events],
      current: step === s.step + (s.status === 'decision' ? 1 : 0) && s.step < s.totalSteps,
      done: step <= s.step,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Creation & event schedule
// ---------------------------------------------------------------------------

export class SimDesignError extends Error {}

export function createSim(design: Design, mission: Mission, seed: number): SimState {
  const ev = evaluateDesign(design, mission);
  if (!ev.canLaunch) {
    throw new SimDesignError(`Design cannot launch: ${ev.criticals.map((c) => c.what).join('; ')}`);
  }
  const rng = new Rng(seed);
  const r = ev.resolved;
  const launchSlip = !!r.launcher?.canSlip && rng.chance(0.25);
  const core = computeCore(design, mission, { extraMonths: launchSlip ? 1 : 0 });
  const cal = planCalendar(mission, core.timeMonths, core.cruiseSteps);

  const s: SimState = {
    version: 1, missionId: mission.id, design: clone(design), seed: seed >>> 0, rng: 0,
    totalSteps: mission.limits.steps, lastStep: Math.min(mission.limits.steps, r.orbit.lastStep), stepMonths: mission.stepMonths,
    cruiseSteps: core.cruiseSteps, step: 0, startedStep: 0, status: 'running', endReason: null, pending: null, schedule: [],
    programmeStart: PROGRAMME_START, launchDate: cal.launchDate, arrivalDate: cal.arrivalDate, launchWindow: cal.window,
    launchSlip, devMonths: core.timeMonths, overMonths: core.overMonths, preflightCostM: core.costM,
    budgetLimitM: mission.limits.budgetM, spentInFlightM: 0,
    health: 100, storedGB: 0, returnedGB: 0, generatedGB: 0, lostGB: 0, science: 0,
    dvHave: core.dvHave, dvNeed: core.dvNeed, dvUsed: 0,
    panelFactor: 1, pointing: core.pointing,
    instrumentFactors: Object.fromEntries(r.instruments.map((i) => [i.id, 1])),
    coverageMult: 1, aerobrakeSteps: r.orbit.scienceDelaySteps, glitchRecurring: false, glitchRepeats: 0, batteryWearSteps: 0,
    current: { scienceMult: 1, offlineStationId: null, extraUnits: 0, flare: false },
    dutySum: 0, dutyCount: 0, stepsOperated: 0,
    telemetry: [], log: [], decisions: [],
    flags: { firstContact: false, firstScience: false, signalDelayVoiced: false, firstDecision: false },
  };

  if (launchSlip) {
    const e = EVENTS.launch_slip;
    addLog(s, mission, 0, {
      tag: 'systems', level: 'warning', title: e.title, eventId: 'launch_slip',
      text: `${e.what({})} Development is now ${core.timeMonths} months${core.overMonths > 0 && mission.overFee > 0 ? `, overrun fee ${fmtMoney(mission.overFee * core.overMonths)}` : ''}.`,
    });
  }
  const win = cal.window;
  addLog(s, mission, 0, {
    tag: 'systems', level: 'info', title: 'Countdown', voice: 'v08_countdown', sfx: 'launch',
    text: win
      ? `Launch on ${r.launcher!.name}, ${fmtDate(cal.launchDate)} — inside the real Mars launch window (${fmtDate(win.open)} – ${fmtDate(win.close)}). Arrival at Mars: ${fmtDate(win.arrival)}.`
      : `Launch on ${r.launcher!.name}, ${fmtDate(cal.launchDate)}.`,
  });

  s.schedule = buildSchedule(s, mission, r, core, rng);
  s.rng = rng.state;
  return s;
}

function buildSchedule(s: SimState, mission: Mission, r: ResolvedDesign, core: CoreNumbers, rng: Rng): ScheduledEvent[] {
  const last = s.lastStep;
  const taken = new Map<number, ScheduledEvent>();
  const put = (id: DecisionEventId, step: number, extra: Partial<ScheduledEvent> = {}, shift = true) => {
    let st = step;
    while (taken.has(st) && shift) st++;
    if (st > last || taken.has(st)) return;
    taken.set(st, { id, step: st, resolved: false, ...extra });
  };
  const deep = mission.dvRefMass !== null;

  // Fixed-step events first (no shifting).
  if (r.solar && r.solar.deployRisk > 0) {
    const risk = s.design.burnWire && r.solar.deployRiskRedundant !== undefined ? r.solar.deployRiskRedundant : r.solar.deployRisk;
    if (rng.chance(risk)) put('deploy', 1, {}, false);
  }
  if (deep && r.test && rng.chance(r.test.insertionProblemChance)) put('insertion', core.cruiseSteps + 1, {}, false);
  if (r.orbit.scienceDelaySteps > 0) put('aerobrake', core.cruiseSteps + 2, {}, false);

  // Random-step events (shift to the next free step).
  const flare1 = rng.int(4, 9);
  put('flare', flare1);
  if (r.test && rng.chance(r.test.glitchChance)) put('glitch', rng.int(2, 11));
  if (rng.chance(0.6)) {
    const lo = deep ? Math.max(3, core.cruiseSteps + 2) : 3;
    const station = rng.pick(r.stations);
    put(mission.outageEvent, rng.int(lo, 11), { stationId: station.id });
  }
  if (r.attitude && r.attitude.wheelFaultChance > 0 && rng.chance(r.attitude.wheelFaultChance)) put('wheel', rng.int(5, 11));
  if (rng.chance(r.orbit.secondFlareChance)) put('flare', rng.int(Math.min(flare1 + 1, 11), 11));

  return [...taken.values()].sort((a, b) => a.step - b.step);
}

// ---------------------------------------------------------------------------
// Step start (automatic events) and pending decision
// ---------------------------------------------------------------------------

function startStep(s: SimState, mission: Mission, step: number, rng: Rng): void {
  if (s.startedStep >= step) return;
  s.startedStep = step;
  s.current = { scienceMult: 1, offlineStationId: null, extraUnits: 0, flare: false };
  const { r, core } = ctx(s, mission);
  const deep = mission.dvRefMass !== null;
  const d = delayRule(mission, r);

  if (step === 1) {
    addLog(s, mission, step, { tag: 'systems', level: 'good', title: 'Spacecraft deployed', text: 'Separation confirmed. Spacecraft deployed.', voice: 'v09_deployed' });
    if (deep) addLog(s, mission, step, { tag: 'systems', level: 'info', title: 'Cruise', text: `On the way to ${mission.body.name === 'Moon' ? 'the Moon' : mission.body.name}: ${s.cruiseSteps} step${s.cruiseSteps > 1 ? 's' : ''} of cruise.`, voice: 'v20_cruise' });
  }

  // Orbit insertion without a problem.
  if (deep && step === s.cruiseSteps + 1 && !s.schedule.some((e) => e.id === 'insertion')) {
    s.dvUsed += (core.dvNeed ?? 0) - r.orbit.dvKeepPerStep * (r.orbit.lastStep - s.cruiseSteps);
    addLog(s, mission, step, { tag: 'systems', level: 'good', title: 'Orbit insertion', eventId: 'insertion', text: `Burn complete: in ${r.orbit.name}.`, voice: 'v21_insertion', sfx: 'engine_burn' });
  }
  if (deep && step > s.cruiseSteps + 1) s.dvUsed += r.orbit.dvKeepPerStep;

  // LEO decay warning.
  if (s.lastStep < s.totalSteps && step === s.lastStep - 2) {
    addLog(s, mission, step, { tag: 'systems', level: 'warning', title: EVENTS.decay.title, eventId: 'decay', text: EVENTS.decay.what({}) });
  }

  // Battery wear.
  if (core.batteryUndersized && step >= 6) {
    s.batteryWearSteps++;
    if (s.batteryWearSteps === 1) {
      s.health -= 10;
      addLog(s, mission, step, { tag: 'systems', level: 'warning', title: EVENTS.battery_wear.title, eventId: 'battery_wear', text: `${EVENTS.battery_wear.what({})} (−5% run time per step, health −10)` });
    }
  }

  // Recurring software glitch.
  if (s.glitchRecurring) {
    if (rng.chance(Math.min(1, 0.3 + d.extraRisk))) {
      s.glitchRepeats++;
      s.current.scienceMult *= 0.7;
      s.health -= 3;
      addLog(s, mission, step, { tag: 'systems', level: 'warning', title: 'Glitch repeated', eventId: 'glitch', text: 'The unpatched bug crashed the software again: −30% science this step, health −3.' });
      const rec = [...s.decisions].reverse().find((x) => x.optionId === 'reboot_only');
      if (rec) { rec.outcome = 'bad'; rec.summary = `Rebooting without a patch: the bug came back ${s.glitchRepeats} time${s.glitchRepeats > 1 ? 's' : ''}.`; }
    }
  }
}

function buildPending(s: SimState, mission: Mission, ev: ScheduledEvent): PendingDecision {
  const { r } = ctx(s, mission);
  const d = delayRule(mission, r);
  const def = EVENTS[ev.id];
  const reserve = reserveM(s);
  const station = ev.stationId ? mission.stations.find((x) => x.id === ev.stationId) : undefined;
  const opt = (i: number, costText: string, riskChance: number | null, costM = 0): DecisionOption => {
    const o = def.options[i];
    const disabled = costM > 0 && reserve < costM - 1e-9;
    return {
      id: o.id, label: o.label, tag: o.tag, costText: `${o.tag} · ${costText}`, riskChance, costM, protective: o.protective,
      disabled, disabledReason: disabled ? `Needs ${fmtMoney(costM)}, reserve is ${fmtMoney(Math.max(0, reserve))}` : undefined,
    };
  };
  const loss = (base: number) => Math.min(1, base * d.protectMult);
  let options: DecisionOption[] = [];

  switch (ev.id) {
    case 'deploy': {
      const fail = Math.min(1, 0.5 + d.extraRisk);
      options = [opt(0, `${pct(fail)} chance it stays stuck (half power, health −5)`, fail), opt(1, 'half power for the rest of the mission', null)];
      break;
    }
    case 'glitch': {
      const rep = Math.min(1, 0.3 + d.extraRisk);
      options = [opt(0, `−${pct(loss(0.5))} science this month`, null), opt(1, `−10% science now, ${pct(rep)} chance each month it returns`, rep)];
      break;
    }
    case 'flare': {
      const risk = Math.min(1, (r.computer?.flareDamage ?? 0) + r.orbit.flareExtraDamage + d.extraRisk);
      options = [opt(0, `−${pct(loss(0.5))} science this month`, null), opt(1, `${pct(risk)} risk of hardware damage`, risk)];
      break;
    }
    case 'outage': {
      const c = mission.outageFixCostM;
      options = [opt(0, `${fmtMoney(c)} for +1 contact unit this month`, null, c), opt(1, 'data piles up in memory, extra is lost', null)];
      break;
    }
    case 'dsn_busy': {
      const c = mission.outageFixCostM;
      options = [opt(0, `${fmtMoney(c)}, the link stays up`, null, c), opt(1, `no contact through ${station?.name ?? 'this station'} this step`, null)];
      break;
    }
    case 'wheel': {
      const fail = Math.min(1, 0.4 + d.extraRisk);
      options = [opt(0, `${pct(fail)} chance of coarse pointing and health −10`, fail), opt(1, 'coarse pointing for the rest of the mission', null)];
      break;
    }
    case 'insertion': {
      const extra = 0.08 * (s.dvNeed ?? 0);
      const margin = (s.dvHave ?? 0) - (s.dvNeed ?? 0);
      const enough = margin >= extra;
      const risk = enough ? (d.extraRisk || null) : 1;
      options = [
        opt(0, enough ? `uses ${fmtDv(extra)} of your ${fmtDv(margin)} fuel margin${d.active ? `, ${pct(d.extraRisk)} risk it falls short` : ''}`
          : `needs ${fmtDv(extra)} but the margin is ${fmtDv(margin)} — orbit ends up higher (−30% coverage)`, risk),
        opt(1, '−15% coverage for the rest of the mission', null),
      ];
      break;
    }
    case 'aerobrake': {
      const risk = Math.min(1, 0.25 + d.extraRisk);
      options = [opt(0, `1 step instead of 2, ${pct(risk)} risk of overheating (health −20)`, risk), opt(1, '2 steps, no risk', null)];
      break;
    }
  }

  const voices: VoiceId[] = [];
  if (def.voice) voices.push(def.voice);
  let delayMin: number | undefined;
  const date = stepDate(s, mission, ev.step);
  if (d.active) {
    // Real one-way Earth–Mars light time (JPL Horizons) on the calendar date of this step.
    delayMin = Math.round(marsLightTimeMin(date) * 10) / 10;
    // v22 is generic ("Mind the signal delay..."), so it is voiced at the first decision with a delay; the log line keeps the real number.
    if (!s.flags.signalDelayVoiced) { voices.push('v22_signal_delay'); s.flags.signalDelayVoiced = true; }
  }
  return {
    eventId: ev.id, step: ev.step, title: def.title,
    what: def.what({ stationName: station?.name }),
    options, signalDelayLine: delayMin !== undefined ? signalDelayLine(delayMin) : undefined, signalDelayMin: delayMin, date,
    pauseText: DECISION_PAUSE_TEXT, voices, sfx: def.sfx, reserveM: reserve,
  };
}

// ---------------------------------------------------------------------------
// Decision effects
// ---------------------------------------------------------------------------

function applyDecision(s: SimState, mission: Mission, p: PendingDecision, o: DecisionOption, rng: Rng): void {
  const { r } = ctx(s, mission);
  const d = delayRule(mission, r);
  const ev = s.schedule.find((e) => e.step === p.step && e.id === p.eventId)!;
  const step = p.step;
  const record = (outcome: DecisionRecord['outcome'], summary: string) =>
    s.decisions.push({ eventId: p.eventId, step, optionId: o.id, optionLabel: o.label, riskChance: o.riskChance, outcome, summary });
  const log = (level: LogLevel, text: string, extra: Partial<LogEntry> = {}) =>
    addLog(s, mission, step, { tag: EVENTS[p.eventId].tag, level, title: `${p.title}: ${o.label}`, text, eventId: p.eventId, ...extra });
  const loss = (base: number) => Math.min(1, base * d.protectMult);

  if (o.costM > 0) s.spentInFlightM += o.costM;

  switch (o.id) {
    case 'retry_release':
      if (rng.chance(o.riskChance ?? 0)) {
        s.panelFactor = 0.5; s.health -= 5;
        log('critical', 'The panel stayed stuck: half power, health −5.');
        record('bad', 'Retrying the stuck panel failed: half power and health −5.');
      } else {
        s.panelFactor = 1;
        log('good', 'The panel swung open. Full power restored.');
        record('good', `Retrying the release restored full power (it had a ${pct(o.riskChance ?? 0)} chance to fail).`);
      }
      break;
    case 'accept_half_power':
      s.panelFactor = 0.5;
      log('warning', 'Flying on half power for the rest of the mission.');
      record('neutral', 'Accepted half power after the deployment anomaly.');
      break;
    case 'upload_patch':
      s.current.scienceMult *= 1 - loss(0.5);
      log('good', `Patch uploaded: the bug is gone. −${pct(loss(0.5))} science this month.`);
      record('good', 'Uploading a patch fixed the software bug for good.');
      break;
    case 'reboot_only':
      s.current.scienceMult *= 0.9;
      s.glitchRecurring = true;
      log('warning', 'Rebooted. The bug is still in the code.');
      record('neutral', 'Rebooted without a patch — the bug never came back.');
      break;
    case 'safe_mode':
      s.current.scienceMult *= 1 - loss(0.5);
      log('good', `Safe mode engaged: −${pct(loss(0.5))} science this month, no damage.`, { voice: 'v14_safe_mode', sfx: 'safe_mode' });
      record('good', `Safe mode avoided a ${pct(p.options[1].riskChance ?? 0)} chance of flare damage.`);
      break;
    case 'keep_observing':
      if (rng.chance(o.riskChance ?? 0)) {
        const ids = Object.keys(s.instrumentFactors);
        const hit = rng.pick(ids);
        s.instrumentFactors[hit] *= 0.5;
        s.health -= 25;
        const name = r.instruments.find((i) => i.id === hit)?.name ?? hit;
        log('critical', `Radiation damaged the ${name}: its data is halved for good, health −25.`);
        record('bad', `Observing through the flare damaged the ${name} (${pct(o.riskChance ?? 0)} risk): health −25 and half its data lost.`);
      } else {
        log('good', 'The electronics rode out the flare. Full science this month.');
        record('good', `Kept observing through the flare and dodged a ${pct(o.riskChance ?? 0)} damage risk.`);
      }
      break;
    case 'emergency_pass':
      s.current.offlineStationId = ev.stationId ?? null;
      s.current.extraUnits += 1;
      log('good', `Emergency pass bought for ${fmtMoney(o.costM)}: +1 contact unit this month.`);
      record('good', `Buying an emergency pass for ${fmtMoney(o.costM)} kept the data flowing during the outage.`);
      break;
    case 'wait_out':
      s.current.offlineStationId = ev.stationId ?? null;
      log('warning', 'Waiting it out: data piles up in memory.');
      record('neutral', 'Waited out the ground station outage.');
      break;
    case 'request_priority':
      log('good', `Priority time bought for ${fmtMoney(o.costM)}: the link stays up.`);
      record('good', `Paying ${fmtMoney(o.costM)} for priority antenna time kept the link up.`);
      break;
    case 'wait_dsn':
      s.current.offlineStationId = ev.stationId ?? null;
      log('warning', 'No contact through that antenna this step.');
      record('neutral', 'Waited while the antenna was reassigned.');
      break;
    case 'attempt_reset':
      if (rng.chance(o.riskChance ?? 0)) {
        s.pointing = Math.min(s.pointing, 1) as Pointing; s.health -= 10;
        log('critical', 'The reset failed: coarse pointing from now on, health −10.');
        record('bad', 'The wheel reset failed: coarse pointing for the rest of the mission and health −10.');
      } else {
        log('good', 'The wheel spun back up. Fine pointing restored.');
        record('good', `The wheel reset worked and kept fine pointing (${pct(o.riskChance ?? 0)} risk).`);
      }
      break;
    case 'switch_backup':
      s.pointing = Math.min(s.pointing, 1) as Pointing;
      log('warning', 'Switched to backup control: coarse pointing from now on.');
      record('neutral', 'Switched to backup attitude control (coarse pointing).');
      break;
    case 'burn_longer': {
      const extra = 0.08 * (s.dvNeed ?? 0);
      const baseUse = (s.dvNeed ?? 0) - r.orbit.dvKeepPerStep * (r.orbit.lastStep - s.cruiseSteps);
      const enough = (s.dvHave ?? 0) - (s.dvNeed ?? 0) >= extra;
      const fails = !enough || rng.chance(o.riskChance ?? 0);
      s.dvUsed += baseUse + (enough ? extra : Math.max(0, (s.dvHave ?? 0) - (s.dvNeed ?? 0)));
      if (fails) {
        s.coverageMult *= 0.7;
        log('critical', 'Not enough fuel to finish the burn: the orbit is higher than planned (−30% coverage).');
        record('bad', 'The longer burn ran short of fuel margin: coverage −30% for the rest of the mission.');
      } else {
        log('good', `Burn complete: planned orbit reached using ${fmtDv(extra)} extra fuel.`, { voice: 'v21_insertion' });
        record('good', `Burning longer reached the planned orbit for ${fmtDv(extra)} of fuel margin.`);
      }
      break;
    }
    case 'accept_orbit': {
      s.dvUsed += (s.dvNeed ?? 0) - r.orbit.dvKeepPerStep * (r.orbit.lastStep - s.cruiseSteps);
      s.coverageMult *= 0.85;
      log('warning', 'Accepted a higher orbit: −15% coverage, fuel saved.', { voice: 'v21_insertion' });
      record('neutral', 'Accepted a higher orbit after the weak insertion burn (−15% coverage).');
      break;
    }
    case 'aggressive':
      s.aerobrakeSteps = 1;
      if (rng.chance(o.riskChance ?? 0)) {
        s.health -= 20;
        log('critical', 'The spacecraft overheated on a deep pass: health −20. Aerobraking finishes in 1 step.');
        record('bad', `Aggressive aerobraking overheated the spacecraft (${pct(o.riskChance ?? 0)} risk): health −20.`);
      } else {
        log('good', 'Aggressive passes worked: aerobraking finishes in 1 step.');
        record('good', 'Aggressive aerobraking started science one step early without damage.');
      }
      break;
    case 'gentle':
      s.aerobrakeSteps = 2;
      log('info', 'Gentle passes: 2 steps of aerobraking, no risk.');
      record('neutral', 'Chose gentle aerobraking passes.');
      break;
  }
  ev.resolved = true;
}

// ---------------------------------------------------------------------------
// Step completion (section 7.2)
// ---------------------------------------------------------------------------

function finishStep(s: SimState, mission: Mission, step: number): void {
  const { r, core } = ctx(s, mission);
  const ph = phaseOf(s, mission, step);
  const O = r.orbit;

  // power & duty
  const supply = (r.solar?.sunWatts ?? 0) * O.sunFraction * mission.solarFactor * s.panelFactor;
  const bus = core.busLoadW;
  const inst = core.instLoadW;
  let duty = inst > 0 ? Math.max(0, Math.min(1, (supply - bus) / inst)) : 0;
  let brownout = false;
  if (supply < bus) {
    duty = 0; brownout = true;
    s.health -= 10;
    addLog(s, mission, step, { tag: 'systems', level: 'critical', title: 'Power-negative', text: `Panels give ${Math.round(supply)} W, core systems need ${Math.round(bus)} W: instruments off, health −10.` });
  }
  if (core.batteryUndersized) duty *= O.sunFraction;
  if (s.batteryWearSteps > 0) duty *= Math.max(0, 1 - 0.05 * s.batteryWearSteps);

  // generation
  const weighted = r.instruments.reduce((a, i) => a + i.gbPerMonth * (s.instrumentFactors[i.id] ?? 1), 0);
  const rate = weighted * duty * core.coverage * s.coverageMult;
  const generated = rate * mission.stepMonths * ph.scienceFactor * s.current.scienceMult;
  const quality = weighted > 0
    ? r.instruments.reduce((a, i) => a + i.gbPerMonth * (s.instrumentFactors[i.id] ?? 1) * i.value * i.quality[s.pointing], 0) / weighted
    : 0;

  // link
  const active = r.stations.filter((g) => g.id !== s.current.offlineStationId).map((g) => g.id);
  const units = active.reduce((a, id) => a + (O.contactUnits[id] ?? 0), 0) + s.current.extraUnits;
  const radioFactor = r.radio ? r.radio.pointingFactor[s.pointing] : 0;
  const capacity = (r.radio?.gbPerUnit ?? 0) * units * radioFactor * mission.stepMonths;

  // 7.2 steps 3–6
  s.storedGB += generated;
  const down = Math.min(s.storedGB, capacity);
  s.storedGB -= down;
  if (s.storedGB > core.storageGB) {
    const over = s.storedGB - core.storageGB;
    s.lostGB += over;
    s.storedGB = core.storageGB;
    if (over > 0.005) addLog(s, mission, step, { tag: 'science', level: 'warning', title: 'Storage overflow', text: `Memory full: ${over.toFixed(1)} GB erased before it could be sent.` });
  }
  s.generatedGB += generated;
  s.returnedGB += down;
  s.science += down * quality;
  if (ph.scienceFactor > 0) { s.dutySum += duty; s.dutyCount++; }

  if (!s.flags.firstContact && capacity > 0) {
    s.flags.firstContact = true;
    addLog(s, mission, step, { tag: 'systems', level: 'good', title: 'First contact', text: 'We have signal. First contact acquired.', voice: 'v10_first_contact' });
  }
  if (!s.flags.firstScience && down > 0) {
    s.flags.firstScience = true;
    addLog(s, mission, step, { tag: 'science', level: 'good', title: 'First science data', text: `Science data received: ${down.toFixed(1)} GB.`, voice: 'v15_science', sfx: 'downlink' });
  } else if (down > 0) {
    addLog(s, mission, step, { tag: 'science', level: 'info', title: 'Downlink', text: `${down.toFixed(1)} GB sent to Earth (${s.storedGB.toFixed(1)} GB still on board).` });
  }

  // telemetry
  s.health = Math.max(0, Math.min(100, s.health));
  const offline = capacity <= 0;
  const degraded = !offline && (s.current.offlineStationId !== null || radioFactor < 1);
  const battWh = r.battery?.wh ?? 0;
  const needRatio = battWh > 0 ? core.batteryNeedWh / battWh : 2;
  let batteryPct = Math.max(5, Math.min(98, 100 - 45 * needRatio)) - 4 * s.batteryWearSteps;
  if (brownout) batteryPct = 5;
  const date = stepDate(s, mission, step);
  const geo = targetGeometry(mission, date);
  const marsWin = mission.id === 'mars' && s.launchWindow ? marsWindows().find((w) => w.id === s.launchWindow!.id) : undefined;
  const distance = mission.dvRefMass !== null && step <= s.cruiseSteps
    // Mars: real spacecraft–Mars distance along the Lambert transfer; Moon: real Earth–Moon distance × remaining share
    ? marsWin ? transferDistanceToMarsKm(marsWin, date)
      : Math.round((geo?.distanceKm ?? mission.body.distanceKm) * (1 - step / (s.cruiseSteps + 1)))
    : null;
  if (geo && mission.dvRefMass !== null && step <= s.cruiseSteps && step > 1) {
    addLog(s, mission, step, {
      tag: 'systems', level: 'info', title: 'Cruise update',
      text: `${fmtDate(date)}: Earth–${mission.body.name} distance ${fmtKmShort(geo.distanceKm)}, one-way signal time ${fmtLight(geo.lightTimeSec)}${distance ? `, ${fmtKmShort(distance)} to go` : ''}.`,
    });
  }
  s.telemetry.push({
    step, month: step * mission.stepMonths, phase: ph.kind, phaseName: ph.name,
    batteryPct: Math.max(5, Math.round(batteryPct)),
    storedGB: s.storedGB, downlinkedGB: down, generatedGB: generated,
    returnedTotalGB: s.returnedGB, generatedTotalGB: s.generatedGB, lostTotalGB: s.lostGB, scienceTotal: s.science,
    solarInputW: supply, payloadDrawW: inst * duty,
    coreTempC: Math.round((18 + 8 * duty + (s.current.flare ? 9 : 0) + Math.sin(step * 1.7) * 1.5) * 10) / 10,
    link: offline ? 'offline' : degraded ? 'degraded' : 'nominal',
    linkText: offline ? 'No contact' : degraded ? 'Degraded' : ph.kind === 'cruise' ? 'Deep space link' : 'Nominal',
    capacityGB: capacity, duty, health: s.health,
    fuelPct: s.dvHave ? Math.max(0, Math.round((1 - s.dvUsed / s.dvHave) * 100)) : null,
    distanceToTargetKm: distance, activeStations: active,
    date, earthTargetKm: geo?.distanceKm ?? null, lightTimeSec: geo?.lightTimeSec ?? null,
  });

  s.step = step;
  s.stepsOperated = step;

  // end conditions
  if (s.health <= 0) {
    s.status = 'lost'; s.endReason = 'lost'; s.stepsOperated = step - 1;
    addLog(s, mission, step, { tag: 'systems', level: 'critical', title: 'Spacecraft lost', text: 'Contact lost. The spacecraft did not survive.', sfx: 'report_fail' });
    return;
  }
  if (step >= s.lastStep) {
    s.status = 'complete';
    if (s.lastStep < s.totalSteps) {
      s.endReason = 'decayed';
      addLog(s, mission, step, { tag: 'systems', level: 'warning', title: 'Re-entry', eventId: 'decay', text: `Air drag pulled the satellite into the atmosphere after month ${s.lastStep}. Mission over.` });
    } else {
      s.endReason = 'completed';
      addLog(s, mission, step, { tag: 'systems', level: 'good', title: 'Mission complete', text: 'Primary mission complete.' });
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Play the next step. If a decision event is scheduled there, returns with status 'decision'
 * and `pending` set (the step is not finished yet). Otherwise finishes the step.
 * No-op unless status is 'running'.
 */
export function advance(state: SimState, mission: Mission): SimState {
  if (state.status !== 'running') return state;
  const s = cloneState(state);
  const rng = new Rng(s.rng);
  const step = s.step + 1;
  startStep(s, mission, step, rng);
  if (s.health <= 0) {
    finishStep(s, mission, step);
    s.rng = rng.state;
    return s;
  }
  const ev = s.schedule.find((e) => e.step === step && !e.resolved);
  if (ev) {
    if (ev.id === 'flare') s.current.flare = true;
    s.pending = buildPending(s, mission, ev);
    s.status = 'decision';
    addLog(s, mission, step, {
      tag: EVENTS[ev.id].tag, level: 'warning', title: EVENTS[ev.id].title, text: s.pending.what, eventId: ev.id,
      voice: s.pending.voices[0], sfx: s.pending.sfx,
    });
    if (s.pending.signalDelayLine) {
      addLog(s, mission, step, {
        tag: 'systems', level: 'info', title: 'Signal delay', text: s.pending.signalDelayLine,
        voice: s.pending.voices.includes('v22_signal_delay') ? 'v22_signal_delay' : undefined,
      });
    }
    s.rng = rng.state;
    return s;
  }
  finishStep(s, mission, step);
  s.rng = rng.state;
  return s;
}

/** Resolve the pending decision and finish the step. Throws on an unknown or disabled option. */
export function decide(state: SimState, mission: Mission, optionId: OptionId): SimState {
  if (state.status !== 'decision' || !state.pending) return state;
  const o = state.pending.options.find((x) => x.id === optionId);
  if (!o) throw new Error(`Unknown option ${optionId}`);
  if (o.disabled) throw new Error(`Option ${optionId} is not available: ${o.disabledReason}`);
  const s = cloneState(state);
  const rng = new Rng(s.rng);
  const p = s.pending!;
  applyDecision(s, mission, p, o, rng);
  s.pending = null;
  s.status = 'running';
  finishStep(s, mission, p.step);
  s.rng = rng.state;
  return s;
}

export type DecisionPolicy = 'first' | 'protective' | 'risky' | ((p: PendingDecision) => OptionId);

/** Run to the end automatically (tests, "skip"). */
export function runToEnd(state: SimState, mission: Mission, policy: DecisionPolicy = 'protective'): SimState {
  let s = state;
  for (let guard = 0; guard < 100 && (s.status === 'running' || s.status === 'decision'); guard++) {
    if (s.status === 'decision' && s.pending) {
      const enabled = s.pending.options.filter((o) => !o.disabled);
      let id: OptionId;
      if (typeof policy === 'function') id = policy(s.pending);
      else if (policy === 'first') id = enabled[0].id;
      else if (policy === 'protective') id = (enabled.find((o) => o.protective) ?? enabled[0]).id;
      else id = (enabled.find((o) => !o.protective) ?? enabled[0]).id;
      s = decide(s, mission, id);
    } else {
      s = advance(s, mission);
    }
  }
  return s;
}

export function isFinished(s: SimState): boolean {
  return s.status === 'complete' || s.status === 'lost';
}
