// Resource budget (GAME_DESIGN.md sections 4 and 6). Pure functions, no React.
// Summation order mirrors tools/balance_check.py so results match it bit for bit.

import type {
  Attitude, Battery, Computer, Design, Instrument, Launcher, Mission, Orbit, Pointing, Propulsion, Radio,
  SlotKey, SolarArray, Station, TestCampaign,
} from '../data/types';
import { POINTING_LABEL } from '../data/types';
import type { VoiceId } from '../data/voiceLines';
import { fmtDate, marsScheduleCheck, monthsBetween, windowAfter } from '../data/nasa/horizons';
import { fmtDv, fmtGB, fmtGBmo, fmtKg, fmtMoney, fmtMonths, fmtPct, fmtW } from './format';

const EPS = 1e-9;

/** Concrete schedule_window reason from the real JPL Horizons launch windows (Mars), or null when there is no data. */
function marsWindowWhy(devMonths: number, devLimitMonths: number): string | null {
  const c = marsScheduleCheck(devMonths, devLimitMonths);
  if (!c.targetWindow || c.missedByMonths <= 0) return null;
  const after = windowAfter(c.targetWindow);
  return `Next Mars launch window: ${fmtDate(c.targetWindow.optimal)} — you would miss it by ${fmtMonths(c.missedByMonths)}. `
    + `Development takes ${fmtMonths(devMonths)} (limit ${fmtMonths(devLimitMonths)})${after ? `; the window after it is ${fmtDate(after.optimal)}, ${Math.round(monthsBetween(c.targetWindow.optimal, after.optimal))} months later` : ''}.`;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GaugeId = 'mass' | 'power' | 'budget' | 'data' | 'comms' | 'time' | 'fuel';
export type GaugeStatus = 'green' | 'amber' | 'red';
export type Severity = 'critical' | 'warning';

export interface BreakdownItem {
  label: string;
  value: number;
  /** Pre-formatted, e.g. '6 W'. */
  text: string;
}

export interface Gauge {
  id: GaugeId;
  label: string;
  unit: string;
  used: number;
  available: number;
  /** (available − used) / available; −Infinity when available is 0 and used > 0. */
  margin: number;
  status: GaugeStatus;
  /** '4.35 kg / 5 kg'. */
  valueText: string;
  /** What makes up "used". */
  breakdown: BreakdownItem[];
  /** What makes up "available". */
  availableBreakdown: BreakdownItem[];
  /** One-line hover text: 'Power: Imager 6 W + Radio 2 W + … = 14 W of 20 W'. */
  tooltip: string;
}

export type IssueCode =
  | 'mass_limit' | 'mass_launcher' | 'budget' | 'power_bus' | 'missing_component' | 'orbit_unavailable'
  | 'no_launcher' | 'launcher_orbit' | 'no_station' | 'fuel' | 'schedule_window'
  | 'power_instruments' | 'battery_small' | 'comms_bottleneck' | 'storage_buffer' | 'schedule_over'
  | 'pointing_instrument' | 'pointing_radio';

export interface Issue {
  code: IssueCode;
  severity: Severity;
  /** 'design' = shown on the builder; 'launch' = orbit/launch screen only. */
  scope: 'design' | 'launch';
  what: string;
  why: string;
  fix: string;
  gauge?: GaugeId;
  /** For missing_component: which slot. */
  slot?: SlotKey;
  /** Voice line to play the first time this issue appears. */
  voice?: VoiceId;
}

export interface LauncherStatus {
  id: string;
  name: string;
  compatible: boolean;
  /** 'Compatible' or the reason, e.g. 'Spacecraft is 1.1 kg over capacity' / 'Does not fly to this orbit'. */
  reason: string;
  orbitPayloadKg: number;
  spacecraftKg: number;
  launchPriceM: number;
  flies: boolean;
  overCapacityKg: number;
}

export interface StationStatus {
  id: string;
  name: string;
  location: string;
  costM: number;
  selected: boolean;
  /** Contact units on the current orbit. */
  units: number;
  /** Display only: units × 30 min on Earth; units × 8 h (a third of the day, DSN) on Lunar/Mars. */
  minutesPerDay: number;
  usable: boolean;
  /** Tooltip, e.g. Svalbard on LEO. */
  note: string;
}

export interface OrbitStatus {
  id: string;
  name: string;
  available: boolean;
  reason?: string;
  selected: boolean;
}

export interface ResolvedDesign {
  instruments: Instrument[];
  solar?: SolarArray;
  battery?: Battery;
  radio?: Radio;
  computer?: Computer;
  attitude?: Attitude;
  propulsion?: Propulsion;
  orbit: Orbit;
  /** true when design.orbit is null and the mission default orbit is assumed. */
  orbitAssumed: boolean;
  launcher?: Launcher;
  stations: Station[];
  test?: TestCampaign;
}

/** All raw numbers of section 6. */
export interface CoreNumbers {
  mass: number;
  massLimit: number;
  /** min(mission limit, launcher capacity). */
  massAvailable: number;
  timeMonths: number;
  overMonths: number;
  costM: number;
  supplyW: number;
  busLoadW: number;
  instLoadW: number;
  demandW: number;
  /** Duty from power only (before the battery rule). */
  dutyPower: number;
  /** Final duty (battery rule applied). */
  duty: number;
  batteryUndersized: boolean;
  /** Battery Wh needed: k × demand. */
  batteryNeedWh: number;
  pointing: Pointing;
  coverage: number;
  contactUnits: number;
  generatedPerMonth: number;
  capacityPerMonth: number;
  bufferNeedGB: number;
  storageGB: number;
  /** Σ(GB × value × quality(p)) / Σ GB. */
  quality: number;
  /** Σ(GB × quality(p)) / Σ GB — pointing-only quality (no value weight). */
  pointingQuality: number;
  radioFactor: number;
  cruiseSteps: number;
  /** null for missions without propulsion. */
  dvHave: number | null;
  dvNeed: number | null;
  /** Steps with science-equivalent output (last − cruise − delay − 0.5). */
  scienceSteps: number;
  scienceMonths: number;
}

export interface DesignEvaluation {
  resolved: ResolvedDesign;
  core: CoreNumbers;
  gauges: Gauge[];
  issues: Issue[];
  criticals: Issue[];
  warnings: Issue[];
  /** No critical issue in any scope. */
  canLaunch: boolean;
  /** No critical issue with scope 'design' (builder → orbit screen). */
  designReady: boolean;
  allGreen: boolean;
  launchers: LauncherStatus[];
  stations: StationStatus[];
  orbits: OrbitStatus[];
  /** Short line for the bottom bar. */
  statusLine: string;
}

export interface CoreOptions {
  /** Extra development months (launch slip). */
  extraMonths?: number;
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

function byId<T extends { id: string }>(list: T[], id: string | null | undefined): T | undefined {
  return id ? list.find((x) => x.id === id) : undefined;
}

/** Map ids → objects; instruments and stations sorted in catalog order. */
export function resolveDesign(design: Design, mission: Mission): ResolvedDesign {
  const c = mission.catalog;
  const orbitSel = byId(mission.orbits, design.orbit);
  const orbit = orbitSel ?? byId(mission.orbits, mission.defaultOrbit)!;
  return {
    instruments: c.instruments.filter((i) => design.instruments.includes(i.id)),
    solar: byId(c.solar, design.solar),
    battery: byId(c.battery, design.battery),
    radio: byId(c.radio, design.radio),
    computer: byId(c.computer, design.computer),
    attitude: byId(c.attitude, design.attitude),
    propulsion: byId(c.propulsion, design.propulsion),
    orbit,
    orbitAssumed: !orbitSel,
    launcher: byId(mission.launchers, design.launcher),
    stations: mission.stations.filter((s) => design.stations.includes(s.id)),
    test: byId(mission.tests, design.test),
  };
}

export function burnWireOption(mission: Mission) {
  for (const cat of mission.categories) for (const o of cat.options) if (o.key === 'burnWire') return o;
  return undefined;
}

// ---------------------------------------------------------------------------
// Core formulas (section 6)
// ---------------------------------------------------------------------------

export function computeCore(design: Design, mission: Mission, opts: CoreOptions = {}): CoreNumbers {
  const r = resolveDesign(design, mission);
  const { instruments: I, solar: S, battery: B, radio: R, computer: C, attitude: A, propulsion: P, orbit: O, launcher: L, test: T } = r;
  const bw = design.burnWire ? burnWireOption(mission) : undefined;

  // mass — same order as Python: bus + Σins + S + B + R + C + A + P
  const insKg = I.reduce((s, i) => s + i.kg, 0);
  let mass = mission.platform.kg + insKg + (S?.kg ?? 0) + (B?.kg ?? 0) + (R?.kg ?? 0) + (C?.kg ?? 0) + (A?.kg ?? 0) + (P?.kg ?? 0);
  if (bw) mass += bw.kg;
  const massLimit = mission.limits.massKg;
  const massAvailable = L ? Math.min(massLimit, L.capacityKg) : massLimit;

  // time
  const insMo = I.reduce((s, i) => s + i.months, 0);
  const timeMonths = mission.baseTime + insMo + (S?.months ?? 0) + (R?.months ?? 0) + (C?.months ?? 0) + (A?.months ?? 0)
    + (P?.months ?? 0) + (L?.waitMonths ?? 0) + (T?.months ?? 0) + (opts.extraMonths ?? 0);
  const overMonths = Math.max(0, timeMonths - mission.limits.devMonths);

  // cost — bus + Σins + S + B + R + C + A + P + L + Σgs + T + fee × over
  const insCost = I.reduce((s, i) => s + i.costM, 0);
  const gsCost = r.stations.reduce((s, g) => s + g.costM, 0);
  let costM = mission.platform.costM + insCost + (S?.costM ?? 0) + (B?.costM ?? 0) + (R?.costM ?? 0) + (C?.costM ?? 0)
    + (A?.costM ?? 0) + (P?.costM ?? 0) + (L?.costM ?? 0) + gsCost + (T?.costM ?? 0) + mission.overFee * overMonths;
  if (bw) costM += bw.costM;

  // cruise & Δv
  const minTransfer = Math.min(...mission.launchers.map((l) => l.transferDv));
  const minCruise = Math.min(...mission.launchers.map((l) => l.cruiseSteps));
  const cruiseSteps = (L ? L.cruiseSteps : minCruise) + (P?.extraCruiseSteps ?? 0);
  let dvHave: number | null = null;
  let dvNeed: number | null = null;
  if (mission.dvRefMass) {
    dvHave = P ? (P.dvAtRef * mission.dvRefMass) / mass : 0;
    dvNeed = (L ? L.transferDv : minTransfer) + O.dvInsert + O.dvKeepPerStep * (O.lastStep - cruiseSteps);
  }

  // power
  const coverage = Math.min(1.1, O.coverage * (L?.coverageMult ?? 1));
  const pointing: Pointing = A?.pointing ?? 0;
  const supplyW = S ? S.sunWatts * O.sunFraction * mission.solarFactor : 0;
  const busLoadW = mission.platform.watts + (R?.watts ?? 0) + (C?.watts ?? 0) + (A?.watts ?? 0);
  const instLoadW = I.reduce((s, i) => s + i.watts, 0);
  const demandW = busLoadW + instLoadW;
  const dutyPower = instLoadW > 0 ? Math.max(0, Math.min(1, (supplyW - busLoadW) / instLoadW)) : 0;
  const batteryNeedWh = O.batteryK * demandW;
  const batteryUndersized = !!B && B.wh < batteryNeedWh;
  const duty = batteryUndersized ? dutyPower * O.sunFraction : dutyPower;

  // data
  const contactUnits = r.stations.reduce((s, g) => s + (O.contactUnits[g.id] ?? 0), 0);
  const radioFactor = R ? R.pointingFactor[pointing] : 0;
  const capacityPerMonth = R ? R.gbPerUnit * contactUnits * radioFactor : 0;
  const gbSum = I.reduce((s, i) => s + i.gbPerMonth, 0);
  const generatedPerMonth = gbSum * duty * coverage;
  const quality = gbSum > 0 ? I.reduce((s, i) => s + i.gbPerMonth * i.value * i.quality[pointing], 0) / gbSum : 0;
  const pointingQuality = gbSum > 0 ? I.reduce((s, i) => s + i.gbPerMonth * i.quality[pointing], 0) / gbSum : 0;
  const bufferNeedGB = 0.5 * generatedPerMonth;
  const storageGB = C?.storageGB ?? 0;

  const scienceSteps = Math.max(0, O.lastStep - cruiseSteps - O.scienceDelaySteps - 0.5);

  return {
    mass, massLimit, massAvailable, timeMonths, overMonths, costM,
    supplyW, busLoadW, instLoadW, demandW, dutyPower, duty, batteryUndersized, batteryNeedWh,
    pointing, coverage, contactUnits, generatedPerMonth, capacityPerMonth, bufferNeedGB, storageGB, quality, pointingQuality,
    radioFactor, cruiseSteps, dvHave, dvNeed, scienceSteps, scienceMonths: scienceSteps * mission.stepMonths,
  };
}

// ---------------------------------------------------------------------------
// Gauges
// ---------------------------------------------------------------------------

function marginOf(used: number, available: number): number {
  if (available > 0) return (available - used) / available;
  return used > 0 ? -Infinity : 0;
}

function joinTooltip(title: string, items: BreakdownItem[], totalText: string, ofText: string): string {
  const parts = items.filter((i) => i.value !== 0).map((i) => `${i.label} ${i.text}`);
  return `${title}: ${parts.length ? parts.join(' + ') : 'nothing yet'} = ${totalText} of ${ofText}`;
}

function gauge(
  id: GaugeId, label: string, unit: string, used: number, available: number,
  breakdown: BreakdownItem[], availableBreakdown: BreakdownItem[],
  fmt: (v: number) => string, red: boolean, amber: boolean,
): Gauge {
  const margin = marginOf(used, available);
  let status: GaugeStatus = 'green';
  if (red) status = 'red';
  else if (amber || margin < 0.05) status = 'amber';
  return {
    id, label, unit, used, available, margin, status,
    valueText: `${fmt(used)} / ${fmt(available)}`,
    breakdown, availableBreakdown,
    tooltip: joinTooltip(label, breakdown, fmt(used), fmt(available)),
  };
}

const item = (label: string, value: number, text: string): BreakdownItem => ({ label, value, text });

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

const MISSING_TEXT: Record<SlotKey, { what: string; fix: string }> = {
  instruments: { what: 'No instrument', fix: 'Add at least one instrument in the Instruments tab' },
  solar: { what: 'No solar panels', fix: 'Choose solar panels in the Power tab' },
  battery: { what: 'No battery', fix: 'Choose a battery in the Power tab' },
  radio: { what: 'No radio', fix: 'Choose a radio in the Comms tab' },
  computer: { what: 'No onboard computer', fix: 'Choose a computer in the Computer tab' },
  attitude: { what: 'No attitude control', fix: 'Choose an attitude control system' },
  propulsion: { what: 'No propulsion', fix: 'Choose an engine in the Propulsion tab' },
};

export function evaluateDesign(design: Design, mission: Mission, opts: CoreOptions = {}): DesignEvaluation {
  const r = resolveDesign(design, mission);
  const core = computeCore(design, mission, opts);
  const kg = (v: number) => fmtKg(v, mission);
  const issues: Issue[] = [];
  const hasProp = mission.categories.some((c) => c.id === 'propulsion');
  const bw = design.burnWire ? burnWireOption(mission) : undefined;

  // ---- missing components
  const required: SlotKey[] = ['instruments', 'solar', 'battery', 'radio', 'computer', 'attitude'];
  if (hasProp) required.push('propulsion');
  for (const key of required) {
    const missing = key === 'instruments' ? r.instruments.length === 0 : !r[key];
    if (missing) {
      issues.push({ code: 'missing_component', severity: 'critical', scope: 'design', slot: key,
        what: MISSING_TEXT[key].what, why: 'Every spacecraft needs this to fly', fix: MISSING_TEXT[key].fix });
    }
  }

  // ---- mass
  const massOverLimit = core.mass > core.massLimit;
  const massOverLauncher = !!r.launcher && core.mass > r.launcher.capacityKg;
  if (massOverLimit) {
    issues.push({ code: 'mass_limit', severity: 'critical', scope: 'design', gauge: 'mass', voice: 'v04_warning_mass',
      what: 'Over the mass limit', why: `Spacecraft is ${kg(core.mass)}, the mission limit is ${kg(core.massLimit)}`,
      fix: 'Pick lighter components or remove an instrument' });
  }
  if (massOverLauncher) {
    issues.push({ code: 'mass_launcher', severity: 'critical', scope: 'launch', gauge: 'mass', voice: 'v04_warning_mass',
      what: 'Too heavy for this rocket', why: `Spacecraft is ${kg(core.mass - r.launcher!.capacityKg)} over the ${r.launcher!.name} capacity of ${kg(r.launcher!.capacityKg)}`,
      fix: 'Choose a bigger launcher or remove mass' });
  }

  // ---- budget
  const overBudget = core.costM > mission.limits.budgetM + EPS;
  if (overBudget) {
    issues.push({ code: 'budget', severity: 'critical', scope: 'design', gauge: 'budget', voice: 'v05_warning_budget',
      what: 'Over budget', why: `Total cost is ${fmtMoney(core.costM)}, the limit is ${fmtMoney(mission.limits.budgetM)}`,
      fix: 'Choose cheaper parts, fewer stations or a cheaper launch' });
  }

  // ---- power
  const busShort = !!r.solar && core.supplyW < core.busLoadW;
  if (busShort) {
    issues.push({ code: 'power_bus', severity: 'critical', scope: 'design', gauge: 'power', voice: 'v03_warning_power',
      what: 'Power deficit', why: `Core systems need ${fmtW(core.busLoadW)}, panels supply ${fmtW(core.supplyW)}`,
      fix: 'Add solar capacity or choose lower-power systems' });
  } else if (r.solar && r.instruments.length && core.dutyPower < 1) {
    issues.push({ code: 'power_instruments', severity: 'warning', scope: 'design', gauge: 'power', voice: 'v03_warning_power',
      what: 'Power deficit',
      why: `Instruments need ${fmtW(core.instLoadW)}, only ${fmtW(Math.max(0, core.supplyW - core.busLoadW))} is left after core systems — they run ${fmtPct(core.dutyPower)} of the time`,
      fix: 'Add solar capacity or remove an instrument' });
  }
  if (core.batteryUndersized && r.battery) {
    issues.push({ code: 'battery_small', severity: 'warning', scope: 'design', gauge: 'power',
      what: 'Battery too small',
      why: `Eclipses need ${Math.round(core.batteryNeedWh)} Wh, the battery holds ${r.battery.wh} Wh — instruments switch off in shadow and the battery wears out`,
      fix: 'Choose a bigger battery' });
  }

  // ---- comms / data
  if (r.radio && r.instruments.length && r.stations.length && core.capacityPerMonth < core.generatedPerMonth - EPS) {
    issues.push({ code: 'comms_bottleneck', severity: 'warning', scope: 'design', gauge: 'comms',
      what: 'Downlink bottleneck',
      why: `Instruments make ${fmtGBmo(core.generatedPerMonth)}, the radio link sends ${fmtGBmo(core.capacityPerMonth)} — ${fmtPct(1 - core.capacityPerMonth / core.generatedPerMonth)} will never reach Earth`,
      fix: 'Upgrade the radio or add ground stations' });
  }
  if (r.computer && core.storageGB < core.bufferNeedGB - EPS) {
    issues.push({ code: 'storage_buffer', severity: 'warning', scope: 'design', gauge: 'data',
      what: 'Memory too small',
      why: `A missed contact needs a ${fmtGB(core.bufferNeedGB)} buffer, the computer stores ${fmtGB(core.storageGB)}`,
      fix: 'Choose a computer with more memory' });
  }

  // ---- schedule
  if (core.overMonths > 0) {
    if (mission.overAllowed) {
      issues.push({ code: 'schedule_over', severity: 'warning', scope: 'design', gauge: 'time',
        what: 'Schedule overrun',
        why: `Development takes ${fmtMonths(core.timeMonths)}, the plan is ${fmtMonths(mission.limits.devMonths)} — each extra month costs ${fmtMoney(mission.overFee)} and ${mission.overScorePenalty} points`,
        fix: 'Use fewer new developments or less testing' });
    } else {
      issues.push({ code: 'schedule_window', severity: 'critical', scope: 'design', gauge: 'time',
        what: 'Launch window missed',
        why: marsWindowWhy(core.timeMonths, mission.limits.devMonths)
          ?? `Development takes ${fmtMonths(core.timeMonths)}, the window closes at ${fmtMonths(mission.limits.devMonths)} — the next one is about 2 years later`,
        fix: 'Use fewer new developments or less testing' });
    }
  }

  // ---- pointing
  if (r.attitude && r.instruments.length) {
    const blurry = r.instruments.filter((i) => i.quality[core.pointing] < 1);
    if (blurry.length) {
      const need = blurry.some((i) => i.quality[1] < 1) ? 'fine' : 'coarse';
      issues.push({ code: 'pointing_instrument', severity: 'warning', scope: 'design',
        what: 'Pointing too coarse',
        why: `${blurry.map((i) => i.name).join(', ')} need${blurry.length === 1 ? 's' : ''} ${need} pointing; ${r.attitude.name} gives ${POINTING_LABEL[core.pointing].toLowerCase()} — data quality drops to ${fmtPct(core.pointingQuality)}`,
        fix: 'Upgrade attitude control' });
    }
  }
  if (r.attitude && r.radio && core.radioFactor < 1) {
    issues.push({ code: 'pointing_radio', severity: 'warning', scope: 'design', gauge: 'comms',
      what: 'Antenna not aimed',
      why: `${r.radio.name} needs better pointing; it sends only ${fmtPct(core.radioFactor)} of its rated data`,
      fix: 'Upgrade attitude control or choose a wider-beam radio' });
  }

  // ---- fuel
  const fuelShort = core.dvHave !== null && core.dvNeed !== null && !!r.propulsion && core.dvHave < core.dvNeed;
  if (fuelShort) {
    issues.push({ code: 'fuel', severity: 'critical', scope: 'design', gauge: 'fuel', voice: 'v23_fuel',
      what: 'Not enough fuel',
      why: `The trip needs ${fmtDv(core.dvNeed!)}, the engine gives ${fmtDv(core.dvHave!)} at ${kg(core.mass)}`,
      fix: 'Lose mass, add propellant, or pick a cheaper orbit or a launcher that goes farther' });
  }

  // ---- launch scope
  const orbitSel = design.orbit ? mission.orbits.find((o) => o.id === design.orbit) : undefined;
  if (orbitSel && !orbitSel.available) {
    issues.push({ code: 'orbit_unavailable', severity: 'critical', scope: 'launch',
      what: `${orbitSel.short} not available`, why: orbitSel.unavailableReason ?? 'This orbit cannot be used', fix: 'Choose another orbit' });
  }
  if (!r.launcher) {
    issues.push({ code: 'no_launcher', severity: 'critical', scope: 'launch', what: 'No launcher', why: 'The spacecraft needs a ride to space', fix: 'Choose a launcher' });
  } else if (!r.launcher.orbits.includes(r.orbit.id)) {
    issues.push({ code: 'launcher_orbit', severity: 'critical', scope: 'launch',
      what: 'Launcher cannot reach this orbit', why: `${r.launcher.name} does not fly to ${r.orbit.short}`, fix: 'Choose another launcher or orbit' });
  }
  if (r.stations.length === 0) {
    issues.push({ code: 'no_station', severity: 'critical', scope: 'launch', what: 'No ground station',
      why: 'Nobody on Earth can receive your data', fix: 'Select at least one ground station' });
  }

  // ---- gauges
  const comp = (c: { name: string; kg: number } | undefined) => (c ? [item(c.name, c.kg, kg(c.kg))] : []);
  const massBd: BreakdownItem[] = [
    item(mission.platform.name, mission.platform.kg, kg(mission.platform.kg)),
    ...r.instruments.map((i) => item(i.name, i.kg, kg(i.kg))),
    ...comp(r.solar), ...comp(r.battery), ...comp(r.radio), ...comp(r.computer), ...comp(r.attitude), ...comp(r.propulsion),
    ...(bw ? [item(bw.label, bw.kg, kg(bw.kg))] : []),
  ];
  const massAvBd = [item('Mission limit', core.massLimit, kg(core.massLimit))];
  if (r.launcher) massAvBd.push(item(`${r.launcher.name} capacity`, r.launcher.capacityKg, kg(r.launcher.capacityKg)));

  const w = (c: { name: string; watts: number } | undefined) => (c ? [item(c.name, c.watts, fmtW(c.watts))] : []);
  const powerBd: BreakdownItem[] = [
    ...r.instruments.map((i) => item(i.name, i.watts, fmtW(i.watts))),
    item(mission.platform.name, mission.platform.watts, fmtW(mission.platform.watts)),
    ...w(r.radio), ...w(r.computer), ...w(r.attitude),
  ];
  const powerAvBd: BreakdownItem[] = r.solar
    ? [item(r.solar.name, r.solar.sunWatts, fmtW(r.solar.sunWatts)),
       item(`× sunlight on ${r.orbit.short}`, r.orbit.sunFraction, fmtPct(r.orbit.sunFraction)),
       ...(mission.solarFactor !== 1 ? [item('× weak sunlight', mission.solarFactor, fmtPct(mission.solarFactor))] : [])]
    : [];

  const m = (c: { name: string; costM: number } | undefined) => (c ? [item(c.name, c.costM, fmtMoney(c.costM))] : []);
  const budgetBd: BreakdownItem[] = [
    item(mission.platform.name, mission.platform.costM, fmtMoney(mission.platform.costM)),
    ...r.instruments.map((i) => item(i.name, i.costM, fmtMoney(i.costM))),
    ...m(r.solar), ...m(r.battery), ...m(r.radio), ...m(r.computer), ...m(r.attitude), ...m(r.propulsion),
    ...(bw ? [item(bw.label, bw.costM, fmtMoney(bw.costM))] : []),
    ...(r.launcher ? [item(`Launch (${r.launcher.name})`, r.launcher.costM, fmtMoney(r.launcher.costM))] : []),
    ...r.stations.map((s) => item(s.name, s.costM, fmtMoney(s.costM))),
    ...(r.test ? [item(r.test.name, r.test.costM, fmtMoney(r.test.costM))] : []),
    ...(core.overMonths > 0 && mission.overFee > 0 ? [item(`Overrun ${core.overMonths} mo`, mission.overFee * core.overMonths, fmtMoney(mission.overFee * core.overMonths))] : []),
  ];

  const dataBd = [item('Half of monthly data', core.bufferNeedGB, fmtGB(core.bufferNeedGB))];
  const dataAvBd = r.computer ? [item(r.computer.name, core.storageGB, fmtGB(core.storageGB))] : [];

  const commsBd = r.instruments.map((i) => {
    const v = i.gbPerMonth * core.duty * core.coverage;
    return item(i.name, v, fmtGBmo(v));
  });
  const commsAvBd: BreakdownItem[] = r.radio
    ? [item(r.radio.name, r.radio.gbPerUnit, `${fmtGBmo(r.radio.gbPerUnit)} per unit`),
       item('× contact units', core.contactUnits, `${Math.round(core.contactUnits * 100) / 100}`),
       ...(core.radioFactor !== 1 ? [item('× pointing', core.radioFactor, fmtPct(core.radioFactor))] : [])]
    : [];

  const mo = (c: { name: string; months: number } | undefined) => (c && c.months ? [item(c.name, c.months, `${c.months} mo`)] : []);
  const timeBd: BreakdownItem[] = [
    item('Base development', mission.baseTime, `${mission.baseTime} mo`),
    ...r.instruments.filter((i) => i.months).map((i) => item(i.name, i.months, `${i.months} mo`)),
    ...mo(r.solar), ...mo(r.radio), ...mo(r.computer), ...mo(r.attitude), ...mo(r.propulsion),
    ...(r.launcher && r.launcher.waitMonths ? [item('Launch wait', r.launcher.waitMonths, `${r.launcher.waitMonths} mo`)] : []),
    ...(r.test && r.test.months ? [item(r.test.name, r.test.months, `${r.test.months} mo`)] : []),
    ...(opts.extraMonths ? [item('Launch slip', opts.extraMonths, `${opts.extraMonths} mo`)] : []),
  ];

  const gauges: Gauge[] = [
    gauge('mass', 'Mass', 'kg', core.mass, core.massAvailable, massBd, massAvBd, kg, massOverLimit || massOverLauncher, false),
    gauge('power', 'Power', 'W', core.demandW, core.supplyW, powerBd, powerAvBd, fmtW, busShort || !r.solar, core.dutyPower < 1 || core.batteryUndersized),
    gauge('budget', 'Budget', '$M', core.costM, mission.limits.budgetM, budgetBd, [item('Mission budget', mission.limits.budgetM, fmtMoney(mission.limits.budgetM))], fmtMoney, overBudget, false),
    gauge('data', 'Data', 'GB', core.bufferNeedGB, core.storageGB, dataBd, dataAvBd, fmtGB, false, core.storageGB < core.bufferNeedGB - EPS),
    gauge('comms', 'Comms', 'GB/mo', core.generatedPerMonth, core.capacityPerMonth, commsBd, commsAvBd, fmtGBmo, false, core.capacityPerMonth < core.generatedPerMonth - EPS),
    gauge('time', 'Time', 'months', core.timeMonths, mission.limits.devMonths, timeBd, [item('Development limit', mission.limits.devMonths, `${mission.limits.devMonths} mo`)],
      (v) => `${v} mo`, core.overMonths > 0 && !mission.overAllowed, core.overMonths > 0),
  ];
  if (core.dvHave !== null && core.dvNeed !== null) {
    const L = r.launcher;
    const fuelBd = [
      item(L ? `Transfer (${L.name})` : 'Transfer (best launcher)', L ? L.transferDv : core.dvNeed - r.orbit.dvInsert - r.orbit.dvKeepPerStep * (r.orbit.lastStep - core.cruiseSteps), ''),
      item(`Insertion into ${r.orbit.short}`, r.orbit.dvInsert, fmtDv(r.orbit.dvInsert)),
      ...(r.orbit.dvKeepPerStep ? [item(`Station keeping ${r.orbit.lastStep - core.cruiseSteps} × ${r.orbit.dvKeepPerStep}`, r.orbit.dvKeepPerStep * (r.orbit.lastStep - core.cruiseSteps), fmtDv(r.orbit.dvKeepPerStep * (r.orbit.lastStep - core.cruiseSteps)))] : []),
    ];
    fuelBd[0].text = fmtDv(fuelBd[0].value);
    const fuelAvBd = r.propulsion
      ? [item(r.propulsion.name, r.propulsion.dvAtRef, `${fmtDv(r.propulsion.dvAtRef)} at ${mission.dvRefMass} kg`),
         item(`× ${mission.dvRefMass} kg / ${kg(core.mass)}`, mission.dvRefMass! / core.mass, (mission.dvRefMass! / core.mass).toFixed(2))]
      : [];
    gauges.push(gauge('fuel', 'Fuel (Δv)', 'm/s', core.dvNeed, core.dvHave, fuelBd, fuelAvBd, fmtDv, fuelShort || !r.propulsion, false));
  }

  // ---- launchers / stations / orbits
  const launchers: LauncherStatus[] = mission.launchers.map((l) => {
    const flies = l.orbits.includes(r.orbit.id) && r.orbit.available;
    const over = core.mass - l.capacityKg;
    const compatible = flies && over <= 0;
    return {
      id: l.id, name: l.name, compatible, flies, overCapacityKg: Math.max(0, over),
      reason: !flies ? 'Does not fly to this orbit' : over > 0 ? `Spacecraft is ${kg(over)} over capacity` : 'Compatible',
      orbitPayloadKg: l.capacityKg, spacecraftKg: core.mass, launchPriceM: l.costM,
    };
  });
  const stations: StationStatus[] = mission.stations.map((s) => {
    const units = r.orbit.contactUnits[s.id] ?? 0;
    return {
      id: s.id, name: s.name, location: s.location, costM: s.costM, selected: design.stations.includes(s.id),
      units, minutesPerDay: Math.round(units * (mission.id === 'earth' ? 30 : 480)), usable: units > 0,
      note: r.orbit.stationNotes[s.id] ?? mission.stationsNote,
    };
  });
  const orbits: OrbitStatus[] = mission.orbits.map((o) => ({
    id: o.id, name: o.name, available: o.available, reason: o.unavailableReason, selected: design.orbit === o.id,
  }));

  const criticals = issues.filter((i) => i.severity === 'critical');
  const warnings = issues.filter((i) => i.severity === 'warning');
  const designCriticals = criticals.filter((i) => i.scope === 'design');
  const statusLine = criticals.length
    ? 'Resolve critical warnings before launch'
    : warnings.length
      ? `${warnings.length} warning${warnings.length > 1 ? 's' : ''} — you can launch at your own risk`
      : 'Orbit and launch configuration compatible';

  return {
    resolved: r, core, gauges, issues, criticals, warnings,
    canLaunch: criticals.length === 0,
    designReady: designCriticals.length === 0,
    allGreen: gauges.every((g) => g.status === 'green'),
    launchers, stations, orbits, statusLine,
  };
}

/** An empty design for a mission (defaults for orbit, stations and test). */
export function emptyDesign(mission: Mission): Design {
  return {
    instruments: [], solar: null, battery: null, radio: null, computer: null, attitude: null, propulsion: null,
    burnWire: false, orbit: mission.defaultOrbit, launcher: null, stations: [...mission.defaultStations], test: mission.defaultTest,
  };
}
