// Scoring and report (GAME_DESIGN.md section 8). Pure functions, no React.

import type { Analog, AnalogOutcome, Band, OrbitClass, PointingClass, PropulsionClass, ScienceType, SizeClass } from '../data/analogs';
import { ANALOG_LIST, BAND_LABEL, INSTRUMENT_SCIENCE, PROPULSION_LABEL, SCIENCE_LABEL } from '../data/analogs';
import type { Design, Mission, MissionId } from '../data/types';
import type { VoiceId } from '../data/voiceLines';
import { computeCore, resolveDesign } from './budget';
import type { CoreNumbers, ResolvedDesign } from './budget';
import { fmtGB, fmtGBmo, fmtMoney, fmtPct } from './format';
import type { DecisionRecord, SimState } from './simulate';
import { reserveM } from './simulate';

// ---------------------------------------------------------------------------
// Margin function and categories
// ---------------------------------------------------------------------------

/** f(margin) of section 8.1. */
export function marginFactor(m: number): number {
  if (m < 0) return 0;
  if (m < 0.05) return 0.7;
  if (m <= 0.25) return 1.0;
  if (m <= 0.4) return 0.8;
  return 0.5;
}

export type ScoreCategoryId = 'science' | 'efficiency' | 'reliability' | 'operations';

export interface EfficiencyPart {
  id: 'mass' | 'power' | 'budget' | 'time';
  label: string;
  weight: number;
  margin: number;
  factor: number;
  points: number;
}

export interface ScoreCategory {
  id: ScoreCategoryId;
  /** 'Science return' | 'Resource efficiency' | 'Reliability' | 'Operations' (or 'Teamwork'). */
  label: string;
  points: number;
  max: number;
  /** Short formula explanation. */
  detail: string;
}

export interface ScoreBreakdown {
  categories: ScoreCategory[];
  efficiencyParts: EfficiencyPart[];
  /** Points subtracted for schedule overrun (2 per month). */
  penalty: number;
  /** Σ categories − penalty. */
  total: number;
}

export interface ScoreInputs {
  science: number;
  massKg: number;
  supplyW: number;
  demandW: number;
  costM: number;
  devMonths: number;
  overMonths: number;
  health: number;
  stepsOperated: number;
  returnedGB: number;
  generatedGB: number;
}

export function computeScore(mission: Mission, x: ScoreInputs, mode: 'solo' | 'team' = 'solo'): ScoreBreakdown {
  const L = mission.limits;
  const s1 = 30 * Math.min(1, x.science / mission.scienceTarget);
  const parts: EfficiencyPart[] = [
    { id: 'mass', label: 'Mass', weight: 5, margin: (L.massKg - x.massKg) / L.massKg, factor: 0, points: 0 },
    { id: 'power', label: 'Power', weight: 7, margin: x.supplyW > 0 ? (x.supplyW - x.demandW) / x.supplyW : -1, factor: 0, points: 0 },
    { id: 'budget', label: 'Budget', weight: 7, margin: (L.budgetM - x.costM) / L.budgetM, factor: 0, points: 0 },
    { id: 'time', label: 'Time', weight: 6, margin: (L.devMonths - x.devMonths) / L.devMonths, factor: 0, points: 0 },
  ];
  for (const p of parts) { p.factor = marginFactor(p.margin); p.points = p.weight * p.factor; }
  // Same summation order as balance_check.py: 5f + 7f + 7f + 6f
  const s2 = parts[0].points + parts[1].points + parts[2].points + parts[3].points;
  const s3 = 25 * (0.6 * x.health / 100 + 0.4 * x.stepsOperated / L.steps);
  const s4 = 20 * (x.generatedGB ? x.returnedGB / x.generatedGB : 0);
  const penalty = mission.overScorePenalty * x.overMonths;
  const total = s1 + s2 + s3 + s4 - penalty;
  return {
    categories: [
      { id: 'science', label: 'Science return', points: s1, max: 30, detail: `${Math.round(x.science)} of ${mission.scienceTarget} science points` },
      { id: 'efficiency', label: 'Resource efficiency', points: s2, max: 25, detail: parts.map((p) => `${p.label} ${fmtPct(p.margin)} spare`).join(' · ') },
      { id: 'reliability', label: 'Reliability', points: s3, max: 25, detail: `Health ${Math.round(x.health)}% · ${x.stepsOperated} of ${L.steps} steps operated` },
      { id: 'operations', label: mode === 'team' ? 'Teamwork' : 'Operations', points: s4, max: 20,
        detail: `${fmtGB(x.returnedGB)} of ${fmtGB(x.generatedGB)} generated data returned` },
    ],
    efficiencyParts: parts,
    penalty,
    total,
  };
}

// ---------------------------------------------------------------------------
// Deterministic forecast (port of tools/balance_check.py `evaluate`)
// ---------------------------------------------------------------------------

export interface Forecast {
  total: number;
  science: number;
  returned: number;
  generated: number;
  mass: number;
  cost: number;
  time: number;
  duty: number;
  /** Capacity, GB/mo. */
  cap: number;
  /** Generated, GB/mo. */
  gen: number;
  health: number;
  score: ScoreBreakdown;
  core: CoreNumbers;
}

/**
 * Expected result without random events, exactly as tools/balance_check.py computes it.
 * Returns null for a design the script would reject (cannot launch).
 */
export function forecastDesign(design: Design, mission: Mission): Forecast | null {
  const r = resolveDesign(design, mission);
  if (!r.instruments.length || !r.solar || !r.battery || !r.radio || !r.computer || !r.attitude || !r.launcher || !r.test || !r.stations.length) return null;
  if (mission.dvRefMass !== null && !r.propulsion) return null;
  if (!r.orbit.available || r.orbitAssumed) return null;
  const c = computeCore(design, mission);
  const L = r.launcher;
  if (!L.orbits.includes(r.orbit.id) || c.mass > L.capacityKg || c.mass > mission.limits.massKg) return null;
  if (c.overMonths && !mission.overAllowed) return null;
  if (c.costM > mission.limits.budgetM + 1e-9) return null;
  if (c.dvHave !== null && c.dvNeed !== null && c.dvHave < c.dvNeed) return null;
  if (c.supplyW < c.busLoadW) return null;

  let health = 100 - r.test.forecastHealthPenalty;
  if (c.batteryUndersized) health -= 10;
  if (c.storageGB < 0.5 * c.generatedPerMonth) health -= 5;
  const months = c.scienceMonths;
  const generated = c.generatedPerMonth * months;
  const returned = Math.min(c.generatedPerMonth, c.capacityPerMonth) * months;
  const science = returned * c.quality;
  const score = computeScore(mission, {
    science, massKg: c.mass, supplyW: c.supplyW, demandW: c.demandW, costM: c.costM, devMonths: c.timeMonths,
    overMonths: c.overMonths, health, stepsOperated: r.orbit.lastStep, returnedGB: returned, generatedGB: generated,
  });
  return {
    total: score.total, science, returned, generated, mass: c.mass, cost: c.costM, time: c.timeMonths, duty: c.duty,
    cap: c.capacityPerMonth, gen: c.generatedPerMonth, health, score, core: c,
  };
}

// ---------------------------------------------------------------------------
// Outcome and stars
// ---------------------------------------------------------------------------

export type Outcome = 'success' | 'partial' | 'failure';
export const OUTCOME_TITLE: Record<Outcome, string> = {
  success: 'Mission Success', partial: 'Partial Success', failure: 'Mission Failure',
};

export function computeOutcome(mission: Mission, returnedGB: number, survived: boolean): Outcome {
  const req = mission.limits.requiredGB;
  if (returnedGB >= req && survived) return 'success';
  if (returnedGB >= req / 2) return 'partial';
  return 'failure';
}

export function computeStars(total: number, outcome: Outcome): 0 | 1 | 2 | 3 {
  let stars: 0 | 1 | 2 | 3 = total >= 85 ? 3 : total >= 65 ? 2 : total >= 40 ? 1 : 0;
  if (outcome !== 'success' && stars > 2) stars = 2;
  if (outcome === 'failure' && stars > 1) stars = 1;
  return stars;
}

// ---------------------------------------------------------------------------
// Report cards ("What happened and why")
// ---------------------------------------------------------------------------

export type CardColor = 'good' | 'lesson' | 'loss';

export interface ChainNode {
  label: string;
  value: string;
  bottleneck: boolean;
}

export interface ReportCard {
  id: string;
  color: CardColor;
  title: string;
  text: string;
  /** 'Next time: …' (empty for good-decision cards). */
  nextTime: string;
  /** Mission months in which this happened (decision cards merged from several events). */
  months?: number[];
  /** Estimated score impact used for ordering. */
  impact: number;
}

/** "months 6 and 8" / "months 3, 6 and 9" / "month 6". */
function listMonths(months: number[]): string {
  const m = [...months].sort((a, b) => a - b);
  if (m.length === 1) return `month ${m[0]}`;
  return `months ${m.slice(0, -1).join(', ')} and ${m[m.length - 1]}`;
}

/** Cards with the same id become one card listing the months (impact adds up). */
function mergeCards(cards: ReportCard[]): ReportCard[] {
  const byId = new Map<string, ReportCard>();
  const order: ReportCard[] = [];
  for (const c of cards) {
    const prev = byId.get(c.id);
    if (!prev) {
      byId.set(c.id, c);
      order.push(c);
      continue;
    }
    prev.months = [...(prev.months ?? []), ...(c.months ?? [])];
    prev.impact += c.impact;
  }
  for (const c of order) {
    if (c.months && c.months.length > 1) c.text = `${c.text} Happened in ${listMonths(c.months)}.`;
  }
  return order;
}

/** Where the points were lost: the biggest lost score component, or the tightest margin when nothing was lost. */
function improvementCard(score: ScoreBreakdown, s: SimState, mission: Mission): ReportCard {
  const cat = (id: ScoreCategoryId) => score.categories.find((c) => c.id === id)!;
  interface Cand { id: string; lost: number; title: string; text: string; nextTime: string }
  const cands: Cand[] = [];
  const sci = cat('science');
  cands.push({
    id: 'science', lost: sci.max - sci.points, title: 'Science return left points behind',
    text: `Science return scored ${Math.round(sci.points)} of ${sci.max}: ${Math.round(s.science)} of ${mission.scienceTarget} science points.`,
    nextTime: 'Choose higher-value instruments and sharper pointing.',
  });
  const TIGHT: Record<EfficiencyPart['id'], string> = {
    mass: 'Swap a heavy part to keep 5–25% spare mass.',
    power: 'Add solar capacity or trim loads to keep 5–25% spare.',
    budget: 'Pick cheaper parts or less testing to keep 5–25% spare.',
    time: 'Choose parts with shorter development to keep 5–25% spare.',
  };
  const IDLE: Record<EfficiencyPart['id'], string> = {
    mass: 'Spend the spare mass on better science.',
    power: 'Use the spare power for another instrument.',
    budget: 'Spend the spare budget on science or testing.',
    time: 'Use the spare time for a more capable design.',
  };
  for (const p of score.efficiencyParts) {
    const lost = p.weight - p.points;
    const tight = p.margin < 0.05;
    const idle = p.margin > 0.25;
    cands.push({
      id: `margin_${p.id}`, lost,
      title: tight ? `${p.label} margin was too thin` : idle ? `${p.label} was left unused` : `${p.label} margin was the tightest`,
      text: tight
        ? `Only ${fmtPct(p.margin)} ${p.label.toLowerCase()} spare, which cost ${lost.toFixed(1)} of ${p.weight} efficiency points.`
        : idle
          ? `${fmtPct(p.margin)} of the ${p.label.toLowerCase()} limit sat idle, which cost ${lost.toFixed(1)} of ${p.weight} efficiency points.`
          : `${fmtPct(p.margin)} ${p.label.toLowerCase()} spare: inside the 5–25% sweet spot, but the closest to its limit.`,
      nextTime: tight ? TIGHT[p.id] : idle ? IDLE[p.id] : `Add science and keep ${p.label.toLowerCase()} at 5–25% spare.`,
    });
  }
  const rel = cat('reliability');
  cands.push({
    id: 'reliability', lost: rel.max - rel.points, title: 'Reliability left points behind',
    text: `Reliability scored ${Math.round(rel.points)} of ${rel.max}: ${rel.detail}.`,
    nextTime: s.stepsOperated < s.totalSteps ? 'Choose a higher orbit so the mission runs its full term.' : 'More testing and protective choices keep health high.',
  });
  const ops = cat('operations');
  cands.push({
    id: 'operations', lost: ops.max - ops.points, title: 'Operations left points behind',
    text: `Operations scored ${Math.round(ops.points)} of ${ops.max}: ${ops.detail}.`,
    nextTime: 'Upgrade the radio or add ground contacts.',
  });
  let best = cands.reduce((a, b) => (b.lost > a.lost ? b : a));
  if (best.lost < 0.5) {
    // Nothing was lost: point at the resource that came closest to its limit.
    const tightest = score.efficiencyParts.reduce((a, b) => (b.margin < a.margin ? b : a));
    best = cands.find((c) => c.id === `margin_${tightest.id}`)!;
  }
  return { id: `improve_${best.id}`, color: 'lesson', title: best.title, text: best.text, nextTime: best.nextTime, impact: 0 };
}

function buildCards(s: SimState, mission: Mission, r: ResolvedDesign, core: CoreNumbers, finalCostM: number, score: ScoreBreakdown): ReportCard[] {
  const cards: ReportCard[] = [];
  const ratio = s.generatedGB > 0 ? s.returnedGB / s.generatedGB : 1;

  if (s.generatedGB > 0 && ratio < 0.8) {
    const antenna = core.capacityPerMonth < core.generatedPerMonth;
    cards.push({
      id: 'antenna', color: 'loss', title: antenna ? 'Antenna too small' : 'Data stuck on board',
      text: `${fmtPct(1 - ratio)} of science data never reached Earth.`,
      nextTime: 'Upgrade the radio or add ground contacts.',
      impact: 20 * (1 - ratio) + 10,
    });
  }
  const avgDuty = s.dutyCount ? s.dutySum / s.dutyCount : core.duty;
  if (avgDuty < 0.9) {
    cards.push({ id: 'power', color: 'lesson', title: 'Power was tight',
      text: `Instruments ran only ${fmtPct(avgDuty)} of the time.`, nextTime: 'Add solar capacity or schedule the payload.', impact: 30 * (1 - avgDuty) });
  }
  if (core.batteryUndersized) {
    cards.push({ id: 'battery', color: 'lesson', title: 'Battery too small for eclipses',
      text: `Instruments switched off in shadow: the battery holds ${r.battery?.wh ?? 0} Wh, eclipses needed ${Math.round(core.batteryNeedWh)} Wh.`,
      nextTime: 'Add battery capacity.', impact: 8 });
  }
  const pq = r.instruments.length
    ? r.instruments.reduce((a, i) => a + i.gbPerMonth * i.quality[s.pointing], 0) / r.instruments.reduce((a, i) => a + i.gbPerMonth, 0)
    : 1;
  if (pq < 0.8) {
    cards.push({ id: 'blurry', color: 'lesson', title: 'Blurry science',
      text: `Your instruments need precise pointing; data quality was only ${fmtPct(pq)}.`, nextTime: 'Upgrade attitude control.', impact: 30 * (1 - pq) });
  }
  if (s.lostGB > 0.05) {
    cards.push({ id: 'overflow', color: 'loss', title: 'Storage overflow',
      text: `${fmtGB(s.lostGB)} was erased before it could be sent.`, nextTime: 'Bigger computer memory or more contacts.',
      impact: 3 + 20 * (s.generatedGB ? s.lostGB / s.generatedGB : 0) });
  }
  if (s.overMonths > 0) {
    const fee = mission.overFee * s.overMonths;
    cards.push({ id: 'overrun', color: 'lesson', title: 'Schedule overrun',
      text: `${s.overMonths} month${s.overMonths > 1 ? 's' : ''} late cost ${fmtMoney(fee)} and ${mission.overScorePenalty * s.overMonths} points${s.launchSlip ? ' (including a launch slip)' : ''}.`,
      nextTime: 'Fewer new developments or less testing.', impact: 3 + mission.overScorePenalty * s.overMonths });
  }
  const L = mission.limits;
  const margins: [string, number][] = [
    ['Mass', (L.massKg - core.mass) / L.massKg],
    ['Power', core.supplyW > 0 ? (core.supplyW - core.demandW) / core.supplyW : 0],
    ['Budget', (L.budgetM - finalCostM) / L.budgetM],
    ['Time', (L.devMonths - s.devMonths) / L.devMonths],
  ];
  const idle = margins.filter(([, m]) => m > 0.4);
  if (idle.length) {
    cards.push({ id: 'unused', color: 'lesson', title: 'Unused capacity',
      text: `${idle.map(([n, m]) => `${n} ${fmtPct(m)} unused`).join(', ')}.`, nextTime: 'Spend the margin on science.', impact: 2 * idle.length });
  }
  s.decisions.forEach((d: DecisionRecord) => {
    const month = d.step * mission.stepMonths;
    if (d.outcome === 'good') {
      cards.push({ id: `decision_good_${d.eventId}_${d.optionId}`, color: 'good', title: `Good decision: ${d.optionLabel.toLowerCase()}`, text: d.summary, nextTime: '', months: [month], impact: 4 });
    } else if (d.outcome === 'bad') {
      cards.push({ id: `decision_bad_${d.eventId}_${d.optionId}`, color: 'loss', title: 'Risk did not pay off', text: d.summary, nextTime: 'Protect the spacecraft first.', months: [month], impact: 7 });
    }
  });
  if (s.endReason === 'decayed') {
    cards.push({ id: 'decay', color: 'lesson', title: 'Orbit decayed',
      text: `Air drag ended the mission after month ${s.lastStep}: ${s.totalSteps - s.lastStep} ${s.totalSteps - s.lastStep === 1 ? 'month' : 'months'} of science lost.`, nextTime: 'Choose a higher orbit.', impact: 5 });
  }
  if (s.endReason === 'lost') {
    cards.push({ id: 'lost', color: 'loss', title: 'Spacecraft lost',
      text: `Health reached zero in step ${s.step}. Everything still on board was lost.`, nextTime: 'Protect the spacecraft first.', impact: 15 });
  }
  const merged = mergeCards(cards);
  merged.sort((a, b) => b.impact - a.impact);
  const top = merged.slice(0, 4);
  // Positive fillers so the block always shows at least three cards.
  const fillers: ReportCard[] = [];
  if (s.generatedGB > 0 && ratio >= 0.95) {
    fillers.push({ id: 'link_ok', color: 'good', title: 'The data made it home',
      text: `${fmtPct(ratio)} of the data the instruments produced reached Earth.`, nextTime: '', impact: 0 });
  }
  if (s.returnedGB >= mission.limits.requiredGB) {
    fillers.push({ id: 'required_ok', color: 'good', title: 'Science goal met',
      text: `${fmtGB(s.returnedGB)} returned against the ${mission.limits.requiredLabel} requirement.`, nextTime: '', impact: 0 });
  }
  if (s.overMonths === 0) {
    fillers.push({ id: 'schedule_ok', color: 'good', title: 'On schedule',
      text: `Ready to launch in ${s.devMonths} of ${mission.limits.devMonths} months.`, nextTime: '', impact: 0 });
  }
  if (s.health >= 90 && s.status !== 'lost') {
    fillers.push({ id: 'health_ok', color: 'good', title: 'Healthy spacecraft',
      text: `The spacecraft finished with ${Math.round(s.health)}% health.`, nextTime: '', impact: 0 });
  }
  for (const f of fillers) if (top.length < 3) top.push(f);
  if (!top.length) {
    top.push({ id: 'balanced', color: 'good', title: 'Well-balanced design', text: 'Every resource had a healthy margin and the data made it home.', nextTime: '', impact: 0 });
  }
  // At least one improvement card: replace the weakest card when the block is full.
  if (!top.some((c) => c.nextTime)) {
    if (top.length >= 4) top.pop();
    top.push(improvementCard(score, s, mission));
  }
  return top;
}

// ---------------------------------------------------------------------------
// Analog selection (8.4)
// ---------------------------------------------------------------------------

/** Instrument with the highest GB/mo × value (ties: catalog order). */
export function primaryInstrument(r: ResolvedDesign): string | null {
  let best: string | null = null;
  let bestV = -1;
  for (const i of r.instruments) {
    const v = i.gbPerMonth * i.value;
    if (v > bestV) { bestV = v; best = i.id; }
  }
  return best;
}

/** Best analog for a design (no flight outcome known). Kept for callers that only have a design. */
export function pickAnalog(design: Design, mission: Mission): Analog {
  return matchAnalogs(designProfile(design, mission), mission).top.analog;
}

// --- Feature-vector similarity -------------------------------------------------------------------

/** What the matcher knows about the player's spacecraft (design + how the flight ended). */
export interface DesignProfile {
  missionId: MissionId;
  /** Science types of the selected instruments, primary (highest GB/mo × value) first. */
  science: ScienceType[];
  /** Instrument display names, same order as `science`. */
  instrumentNames: string[];
  orbit: OrbitClass | null;
  orbitName: string | null;
  aerobraking: boolean | null;
  pointing: 0 | 1 | 2 | null;
  band: Band | null;
  propulsion: PropulsionClass | null;
  solar: 'body' | 'deployable' | null;
  massKg: number;
  /** null = design only (no flight yet). */
  outcome: 'success' | 'partial' | 'failure' | 'lost' | null;
}

export type MatchFeature = 'instruments' | 'orbit' | 'aerobraking' | 'pointing' | 'comms' | 'propulsion' | 'size' | 'solar' | 'outcome';

/** Feature weights (sum 1). Instruments dominate: what you measure is what a mission is about. */
export const MATCH_WEIGHTS: Record<MatchFeature, number> = {
  instruments: 0.41, orbit: 0.16, pointing: 0.09, comms: 0.08, size: 0.09, propulsion: 0.06, aerobraking: 0.05, solar: 0.04, outcome: 0.02,
};

export interface FeatureScore {
  feature: MatchFeature;
  /** 0..1 */
  sim: number;
  weight: number;
}

export interface AnalogMatch {
  analog: Analog;
  /** 0–100 similarity. */
  percent: number;
  features: FeatureScore[];
  /** 3–4 strongest shared traits, plain English. */
  shared: string[];
  /** 1–2 key differences, plain English. */
  differences: string[];
}

export interface AnalogResult {
  top: AnalogMatch;
  runnersUp: AnalogMatch[];
}

const BAND_OF_RADIO: Record<string, Band> = { uhf: 'uhf', sband: 's', xband: 'x', x1: 'x', x2: 'x', kaband: 'ka', ka3: 'ka' };
const PROP_OF: Record<string, PropulsionClass> = { mono_s: 'mono', mono_l: 'mono', biprop: 'biprop', biprop_xl: 'biprop', sep: 'sep' };
const ORBIT_OF: Record<string, OrbitClass> = {
  leo: 'leo', sso: 'sso', llo: 'low_polar', frozen: 'low_elliptical_polar', nrho: 'nrho',
  capture: 'elliptical', aerobrake: 'low_polar', direct: 'low_polar',
};

export function designProfile(design: Design, mission: Mission, outcome: DesignProfile['outcome'] = null, massKg?: number): DesignProfile {
  const r = resolveDesign(design, mission);
  const primary = primaryInstrument(r);
  const instr = [...r.instruments].sort((a, b) => (a.id === primary ? -1 : b.id === primary ? 1 : 0));
  const science = instr.map((i) => INSTRUMENT_SCIENCE[i.id]).filter((x): x is ScienceType => !!x);
  const orbitId = design.orbit ?? null;
  const solarId = design.solar ?? null;
  return {
    missionId: mission.id,
    science,
    instrumentNames: instr.filter((i) => INSTRUMENT_SCIENCE[i.id]).map((i) => i.name),
    orbit: orbitId ? (ORBIT_OF[orbitId] ?? null) : null,
    orbitName: r.orbit?.name ?? null,
    aerobraking: mission.id === 'mars' && orbitId ? orbitId === 'aerobrake' : null,
    pointing: r.attitude ? r.attitude.pointing : null,
    band: design.radio ? (BAND_OF_RADIO[design.radio] ?? null) : null,
    propulsion: mission.dvRefMass === null ? null : design.propulsion ? (PROP_OF[design.propulsion] ?? null) : null,
    solar: !solarId ? null : solarId === 'body' || solarId === 'fixed' ? 'body' : 'deployable',
    massKg: massKg ?? computeCore(design, mission).mass,
    outcome,
  };
}

/** Partial credit between related science types (symmetric). */
const SCIENCE_NEAR: Partial<Record<ScienceType, Partial<Record<ScienceType, number>>>> = {
  thermal_ir: { ir_mapping: 0.5, imaging: 0.3 },
  ir_mapping: { thermal_ir: 0.5, spectrometer: 0.4, imaging: 0.3 },
  atmosphere: { trace_gas: 0.5, spectrometer: 0.4 },
  trace_gas: { atmosphere: 0.5, spectrometer: 0.6 },
  spectrometer: { trace_gas: 0.6, atmosphere: 0.4, ir_mapping: 0.4 },
  imaging: { thermal_ir: 0.3, ir_mapping: 0.3 },
};
function scienceSim(a: ScienceType, b: ScienceType): number {
  if (a === b) return 1;
  return SCIENCE_NEAR[a]?.[b] ?? SCIENCE_NEAR[b]?.[a] ?? 0;
}

const ORBIT_NEAR: [OrbitClass, OrbitClass, number][] = [
  ['leo', 'sso', 0.4],
  ['low_polar', 'low_elliptical_polar', 0.7], ['low_polar', 'high_elliptical_polar', 0.4], ['low_polar', 'low_equatorial', 0.5],
  ['low_elliptical_polar', 'high_elliptical_polar', 0.6], ['low_elliptical_polar', 'low_equatorial', 0.4], ['high_elliptical_polar', 'nrho', 0.3],
  ['low_polar', 'low_inclined', 0.8], ['low_polar', 'polar', 0.6], ['elliptical', 'polar', 0.6], ['low_inclined', 'polar', 0.5],
  ['elliptical', 'low_polar', 0.3], ['elliptical', 'low_inclined', 0.3],
];
function orbitSim(a: OrbitClass, b: OrbitClass): number {
  if (a === b) return 1;
  for (const [x, y, s] of ORBIT_NEAR) if ((x === a && y === b) || (x === b && y === a)) return s;
  return 0;
}

/** Player pointing level vs analog pointing class. */
const POINTING_SIM: Record<0 | 1 | 2, Record<PointingClass, number>> = {
  0: { spin: 0.7, three_axis: 0.2, fine: 0 },
  1: { spin: 0.6, three_axis: 0.7, fine: 0.3 },
  2: { spin: 0.1, three_axis: 0.8, fine: 1 },
};
const BAND_ORDER: Band[] = ['uhf', 's', 'x', 'ka'];
function bandSim(player: Band, bands: Band[]): number {
  if (bands.includes(player)) return 1;
  const i = BAND_ORDER.indexOf(player);
  return bands.some((b) => Math.abs(BAND_ORDER.indexOf(b) - i) === 1) ? 0.5 : 0.15;
}
function propSim(a: PropulsionClass, b: PropulsionClass): number {
  if (a === b) return 1;
  const pair = [a, b].sort().join('+');
  return ({ 'biprop+mono': 0.5, 'cold_gas+mono': 0.4, 'biprop+cold_gas': 0.2 } as Record<string, number>)[pair] ?? 0.2;
}
const SIZE_KG: Record<SizeClass, number> = { '3U': 4, '6U': 10, '12U': 25 };
function outcomeSim(p: NonNullable<DesignProfile['outcome']>, a: AnalogOutcome): number {
  const t: Record<string, number> = {
    'success+success': 1, 'success+partial': 0.5, 'partial+partial': 1, 'partial+success': 0.5,
    'failure+lost': 0.7, 'failure+partial': 0.4, 'lost+lost': 1, 'lost+partial': 0.3,
  };
  return t[`${p}+${a}`] ?? 0;
}

/** Instrument overlap: 70% "how much of your payload the analog shares", 30% "how much of the analog's game-relevant payload you share". */
function instrumentSim(p: DesignProfile, a: Analog, relevant: Set<ScienceType>): { sim: number; exact: ScienceType[] } {
  const types = a.facts.instruments.map((i) => i.type);
  if (!p.science.length || !types.length) return { sim: 0, exact: [] };
  const best = (t: ScienceType, pool: ScienceType[]) => pool.reduce((m, x) => Math.max(m, scienceSim(t, x)), 0);
  // The primary instrument counts double: it defines what the mission is for.
  const wts = p.science.map((_, i) => (i === 0 ? 2 : 1));
  const recall = p.science.reduce((s, t, i) => s + wts[i] * best(t, types), 0) / wts.reduce((s, w) => s + w, 0);
  const theirs = [...new Set(types.filter((t) => relevant.has(t)))];
  const precision = theirs.length ? theirs.reduce((s, t) => s + best(t, p.science), 0) / theirs.length : 0;
  const exact = [...new Set(p.science.filter((t) => types.includes(t)))];
  return { sim: 0.7 * recall + 0.3 * precision, exact };
}

function techDemoOnly(a: Analog): boolean {
  return a.facts.instruments.every((i) => i.type === 'navigation');
}

function scoreAnalog(p: DesignProfile, a: Analog, relevant: Set<ScienceType>): { percent: number; features: FeatureScore[]; exact: ScienceType[] } {
  const f = a.facts;
  const out: FeatureScore[] = [];
  const add = (feature: MatchFeature, sim: number | null) => {
    if (sim !== null) out.push({ feature, sim, weight: MATCH_WEIGHTS[feature] });
  };
  const inst = instrumentSim(p, a, relevant);
  // A pure technology demo (no science payload) is compared on everything else.
  if (!techDemoOnly(a)) add('instruments', inst.sim);
  add('orbit', p.orbit && f.orbit ? Math.max(...f.orbit.classes.map((c) => orbitSim(p.orbit!, c))) : null);
  add('aerobraking', p.aerobraking !== null && f.aerobraking !== null ? (p.aerobraking === f.aerobraking ? 1 : 0) : null);
  add('pointing', p.pointing !== null && f.pointing ? POINTING_SIM[p.pointing][f.pointing.cls] : null);
  add('comms', p.band && f.comms ? bandSim(p.band, f.comms.bands) : null);
  add('propulsion', p.propulsion && f.propulsion ? propSim(p.propulsion, f.propulsion.cls) : null);
  const theirKg = f.massKg ?? (f.size ? SIZE_KG[f.size] : null);
  if (theirKg) {
    // Earth: the game's spacecraft is always a 3U CubeSat; compare form factors there.
    const mine = p.missionId === 'earth' ? SIZE_KG['3U'] : Math.max(1, p.massKg);
    // within ±35 % mass the sim stays >= 0.7 ("Similar size"); a 2.7x difference scores 0
    add('size', Math.max(0, 1 - (Math.abs(Math.log(mine / theirKg)) / Math.log(1.35)) * 0.3));
  }
  add('solar', p.solar && f.solar ? (p.solar === f.solar.cls ? 1 : 0.3) : null);
  add('outcome', p.outcome && f.outcome ? outcomeSim(p.outcome, f.outcome.cls) : null);
  const known = out.reduce((s, x) => s + x.weight, 0);
  const total = Object.values(MATCH_WEIGHTS).reduce((s, w) => s + w, 0);
  const raw = known ? out.reduce((s, x) => s + x.weight * x.sim, 0) / known : 0;
  // Fewer verified facts = less confidence: sparse records cannot win on a single lucky feature.
  const coverage = 0.75 + 0.25 * (known / total);
  return { percent: Math.round(100 * raw * coverage), features: out, exact: inst.exact };
}

function list(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
const POINTING_TEXT = { 0: 'no active pointing', 1: 'coarse pointing', 2: 'fine pointing with reaction wheels and a star tracker' } as const;

/** Plain-English sentence for one feature, shared (`same`) or different. */
function describe(feature: MatchFeature, same: boolean, p: DesignProfile, a: Analog, exact: ScienceType[]): string | null {
  const f = a.facts;
  const n = a.short;
  switch (feature) {
    case 'instruments': {
      if (same) {
        const types = exact.length ? exact : p.science.slice(0, 1);
        const theirs = f.instruments.filter((i) => types.includes(i.type)).map((i) => i.name);
        return `Like ${n}, you fly ${list(types.map((t) => SCIENCE_LABEL[t]))}${theirs.length ? ` (${n}: ${list(theirs.slice(0, 2))})` : ''}.`;
      }
      const theirs = f.instruments.slice(0, 2).map((i) => i.name);
      return `${n} carried ${list(theirs)}; your payload is ${list(p.instrumentNames.map((x) => x.toLowerCase())) || 'empty'}.`;
    }
    case 'orbit':
      if (!f.orbit) return null;
      return same
        ? `Same kind of orbit as ${n} (${f.orbit.text}).`
        : `${n}'s orbit: ${f.orbit.text}; you chose ${p.orbitName ? p.orbitName.replace(' · ', ', ').toLowerCase() : 'another orbit'}.`;
    case 'aerobraking':
      return same
        ? p.aerobraking ? `Like ${n}, you aerobrake through the upper atmosphere to reach a low orbit.` : `Like ${n}, you skip aerobraking.`
        : p.aerobraking ? `${n} did not aerobrake; you dip into the atmosphere to lower your orbit.` : `${n} aerobraked down to its science orbit; you do not.`;
    case 'pointing':
      if (!f.pointing || p.pointing === null) return null;
      return same
        ? `Like ${n}, you rely on ${POINTING_TEXT[p.pointing]} (${n}: ${f.pointing.text}).`
        : `Unlike ${n} (${f.pointing.text}), your spacecraft uses ${POINTING_TEXT[p.pointing]}.`;
    case 'comms':
      if (!f.comms || !p.band) return null;
      return same
        ? `You both send data home on ${BAND_LABEL[p.band]} (${n}: ${f.comms.text}).`
        : `${n} used ${f.comms.text}; your radio is ${BAND_LABEL[p.band]}.`;
    case 'propulsion':
      if (!f.propulsion || !p.propulsion) return null;
      return same
        ? `Like ${n}, you steer with ${PROPULSION_LABEL[p.propulsion]} (${n}: ${f.propulsion.text}).`
        : `${n} used ${f.propulsion.text}; you chose ${PROPULSION_LABEL[p.propulsion]}.`;
    case 'size':
      if (p.missionId === 'earth') return same ? `Similar size: ${n} is a ${f.sizeText}; yours is a 3U CubeSat.` : `${n} is a ${f.sizeText}; yours is a 3U CubeSat.`;
      return same
        ? `Similar size: ${n} is ${f.sizeText}; yours is ${Math.round(p.massKg)} kg.`
        : `${n} is ${f.sizeText}; yours is ${Math.round(p.massKg)} kg.`;
    case 'solar':
      if (!f.solar || !p.solar) return null;
      return same ? `Same power layout: ${f.solar.text}.` : `${n} had ${f.solar.text}; your panels are ${p.solar === 'body' ? 'fixed to the body' : 'deployable'}.`;
    case 'outcome':
      if (!f.outcome || !p.outcome) return null;
      if (same) {
        if (f.outcome.cls === 'lost') return `Like ${n}, your spacecraft was lost (${n}: ${f.outcome.text.replace(/\.$/, '')}).`;
        return `${p.outcome === 'success' ? 'Both missions met their goals' : `Like ${n}, you returned only part of the science`} (${n}: ${f.outcome.text.replace(/\.$/, '')}).`;
      }
      return `${n}: ${f.outcome.text}`;
  }
}

function buildMatch(p: DesignProfile, a: Analog, relevant: Set<ScienceType>): AnalogMatch {
  const s = scoreAnalog(p, a, relevant);
  const byShared = [...s.features].filter((x) => x.sim >= 0.7).sort((x, y) => y.weight * y.sim - x.weight * x.sim);
  const byDiff = [...s.features].filter((x) => x.sim <= 0.45).sort((x, y) => y.weight * (1 - y.sim) - x.weight * (1 - x.sim));
  const shared = byShared.map((x) => describe(x.feature, true, p, a, s.exact)).filter((x): x is string => !!x).slice(0, 4);
  const differences = byDiff.map((x) => describe(x.feature, false, p, a, s.exact)).filter((x): x is string => !!x).slice(0, 2);
  if (techDemoOnly(a) && p.science.length) {
    differences.unshift(`${a.short} carried no science instruments: it tested ${a.facts.instruments[0].name}.`);
    differences.splice(2);
  }
  if (!shared.length) {
    const best = [...s.features].sort((x, y) => y.weight * y.sim - x.weight * x.sim)[0];
    const line = best && best.sim > 0 ? describe(best.feature, true, p, a, s.exact) : null;
    if (line) shared.push(line);
  }
  return { analog: a, percent: s.percent, features: s.features, shared, differences };
}

/**
 * Weighted feature-vector similarity between the player's spacecraft and every real mission to the same body.
 * Deterministic: ties break by catalog order. Facts the sources do not state are skipped (see analogs.ts).
 */
export function matchAnalogs(profile: DesignProfile, mission: Mission): AnalogResult {
  const relevant = new Set(mission.catalog.instruments.map((i) => INSTRUMENT_SCIENCE[i.id]).filter(Boolean));
  const ranked = ANALOG_LIST.filter((a) => a.mission === mission.id)
    .map((a) => buildMatch(profile, a, relevant))
    .map((m, i) => ({ m, i }))
    .sort((x, y) => y.m.percent - x.m.percent || x.i - y.i)
    .map((x) => x.m);
  return { top: ranked[0], runnersUp: ranked.slice(1, 3) };
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

export interface MissionReport {
  /** Sensor → Onboard storage → Antenna → Earth; the limiting node has `bottleneck: true` (none when all data arrived). */
  chain: ChainNode[];
  missionId: MissionId;
  seed: number;
  design: Design;
  outcome: Outcome;
  outcomeTitle: string;
  stars: 0 | 1 | 2 | 3;
  score: ScoreBreakdown;
  /** Rounded total for display. */
  totalRounded: number;
  stats: {
    science: number;
    scienceTarget: number;
    returnedGB: number;
    requiredGB: number;
    generatedGB: number;
    lostGB: number;
    health: number;
    stepsOperated: number;
    totalSteps: number;
    finalCostM: number;
    spentInFlightM: number;
    reserveLeftM: number;
    devMonths: number;
    overMonths: number;
    launchSlip: boolean;
    endReason: SimState['endReason'];
  };
  cards: ReportCard[];
  /** Best real-mission match (same as `analogMatch.top.analog`; its id goes into the collection). */
  analog: Analog;
  /** Top match + 2 runners-up with % similarity, shared traits and differences. */
  analogMatch: AnalogResult;
  voice: VoiceId;
  sfx: 'report_success' | 'report_fail';
}

function buildChain(s: SimState, core: CoreNumbers): ChainNode[] {
  const lossy = s.generatedGB > 0 && s.returnedGB < s.generatedGB * 0.995;
  const commsLimited = core.capacityPerMonth < core.generatedPerMonth;
  const storage = lossy && !commsLimited && s.lostGB > 0.05;
  const antenna = commsLimited || (lossy && !storage);
  return [
    { label: 'Sensor', value: fmtGB(s.generatedGB) + ' made', bottleneck: false },
    { label: 'Onboard storage', value: storage ? fmtGB(s.lostGB) + ' erased' : fmtGB(core.storageGB) + ' memory', bottleneck: storage },
    { label: 'Antenna', value: fmtGBmo(core.capacityPerMonth), bottleneck: antenna },
    { label: 'Earth', value: fmtGB(s.returnedGB) + ' received', bottleneck: false },
  ];
}

/**
 * Report voice. v18_failure ("We've lost the spacecraft") only plays when the spacecraft was really lost;
 * a spacecraft that survived but returned too little data gets v18b_low_data (failure) or v17_partial (partial).
 */
export function reportVoice(outcome: Outcome, survived: boolean): VoiceId {
  if (!survived) return 'v18_failure';
  if (outcome === 'success') return 'v16_success';
  return outcome === 'partial' ? 'v17_partial' : 'v18b_low_data';
}

export function buildReport(s: SimState, mission: Mission, mode: 'solo' | 'team' = 'solo'): MissionReport {
  const r = resolveDesign(s.design, mission);
  const core = computeCore(s.design, mission, { extraMonths: s.launchSlip ? 1 : 0 });
  const finalCostM = s.preflightCostM + s.spentInFlightM;
  const survived = s.status !== 'lost';
  const score = computeScore(mission, {
    science: s.science, massKg: core.mass, supplyW: core.supplyW, demandW: core.demandW, costM: finalCostM,
    devMonths: s.devMonths, overMonths: s.overMonths, health: s.health, stepsOperated: s.stepsOperated,
    returnedGB: s.returnedGB, generatedGB: s.generatedGB,
  }, mode);
  const outcome = computeOutcome(mission, s.returnedGB, survived);
  const stars = computeStars(score.total, outcome);
  const flown = s.status === 'lost' || s.endReason === 'lost' ? 'lost' : outcome;
  const analogMatch = matchAnalogs(designProfile(s.design, mission, flown, core.mass), mission);
  return {
    missionId: mission.id, seed: s.seed, design: structuredClone(s.design), outcome, outcomeTitle: OUTCOME_TITLE[outcome], stars,
    score, totalRounded: Math.round(score.total),
    stats: {
      science: s.science, scienceTarget: mission.scienceTarget, returnedGB: s.returnedGB, requiredGB: mission.limits.requiredGB,
      generatedGB: s.generatedGB, lostGB: s.lostGB, health: s.health, stepsOperated: s.stepsOperated, totalSteps: s.totalSteps,
      finalCostM, spentInFlightM: s.spentInFlightM, reserveLeftM: reserveM(s), devMonths: s.devMonths, overMonths: s.overMonths,
      launchSlip: s.launchSlip, endReason: s.endReason,
    },
    cards: buildCards(s, mission, r, core, finalCostM, score),
    chain: buildChain(s, core),
    analog: analogMatch.top.analog,
    analogMatch,
    voice: reportVoice(outcome, survived),
    sfx: outcome === 'failure' ? 'report_fail' : 'report_success',
  };
}
