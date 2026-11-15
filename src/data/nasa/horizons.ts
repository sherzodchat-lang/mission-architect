// Typed accessors for the JPL Horizons snapshot in horizons.json (refresh: `node tools/fetch_horizons.mjs`).
// Dates are ISO calendar days 'YYYY-MM-DD' (UTC). Pure functions, no I/O, safe in the engine and in React.
import raw from './horizons.json';

export type IsoDate = string;
export type DateLike = IsoDate | Date;

export interface MarsWindow {
  id: string;
  /** First / best / last launch day of the window (min total v-infinity within 0.4 km/s). */
  open: IsoDate;
  optimal: IsoDate;
  close: IsoDate;
  /** Departure C3 at the optimal date, km2/s2. */
  c3: number;
  /** Time of flight of the optimal transfer, days (about 9 months). */
  tofDays: number;
  /** Arrival at Mars for a launch on the optimal date. */
  arrival: IsoDate;
  /** Earth-Mars one-way light time on the arrival date, minutes. */
  arrivalLightMin?: number;
  /** Mars heliocentric [x, y] (AU, ecliptic) on arrival. */
  marsAtArrival: [number, number];
  /** Heliocentric transfer arc [x, y] in AU, ~6-day spacing, from Earth at launch to Mars at arrival. */
  transfer: [number, number][];
}

export interface HorizonsMeta {
  source: string;
  api: string;
  horizonsVersion: string;
  retrieved: IsoDate;
  refreshScript: string;
  frame: string;
  windowMethod: string;
  queries: { name: string; url: string }[];
  validation: { name: string; launch: IsoDate; arrive: IsoDate; windowPublished: string; found: { open: IsoDate; optimal: IsoDate; close: IsoDate } | null; launchInsideFoundWindow: boolean }[];
}

interface HorizonsData {
  meta: HorizonsMeta;
  moon: { start: IsoDate; stepDays: number; km: number[] };
  mars: { start: IsoDate; stepDays: number; mkm: number[]; ltMin: number[] };
  helio: { start: IsoDate; stepDays: number; earth: [number, number][]; mars: [number, number][] };
  windows: MarsWindow[];
}

const DATA = raw as unknown as HorizonsData;

export const HORIZONS_META: HorizonsMeta = DATA.meta;
export const SPEED_OF_LIGHT_KMS = 299792.458;
export const AU_KM = 149597870.7;

// ---------------------------------------------------------------- calendar helpers
const DAY_MS = 86400000;

/** Whole days since 1970-01-01 (UTC) as a float for a Date or ISO string. */
export function dayNumber(d: DateLike): number {
  const t = typeof d === 'string' ? Date.parse(d.length <= 10 ? `${d}T00:00:00Z` : d) : d.getTime();
  return t / DAY_MS;
}
export function toIso(day: number): IsoDate {
  return new Date(Math.round(day) * DAY_MS).toISOString().slice(0, 10);
}
export function addDays(d: DateLike, days: number): IsoDate {
  return toIso(dayNumber(d) + days);
}
/** Calendar month addition (day of month kept, clamped to the month length). Whole months. */
export function addMonths(d: DateLike, months: number): IsoDate {
  const x = new Date(Math.round(dayNumber(d)) * DAY_MS);
  const day = x.getUTCDate();
  const t = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + months, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(day, last));
  return t.toISOString().slice(0, 10);
}
/** Signed whole-or-fractional months from a to b (30.4375-day months). */
export function monthsBetween(a: DateLike, b: DateLike): number {
  return (dayNumber(b) - dayNumber(a)) / 30.4375;
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** '23 Nov 2028' */
export function fmtDate(d: DateLike): string {
  const [y, m, dd] = toIso(dayNumber(d)).split('-').map(Number);
  return `${dd} ${MONTHS[m - 1]} ${y}`;
}
/** 'Nov 2028' */
export function fmtMonthYear(d: DateLike): string {
  const [y, m] = toIso(dayNumber(d)).split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/**
 * Fixed "programme start" so that everything is deterministic. It is chosen so that the Mars Probe development limit
 * (36 months, GAME_DESIGN 5B) ends exactly on the real late-2028 launch window (optimal day 2028-11-23):
 * programme start + 36 months = that window. Earth and Moon missions use the same start for their calendar.
 */
export const PROGRAMME_START: IsoDate = '2025-11-23';

/** Date a development of `devMonths` months ends (programme start + months). */
export function devEndDate(devMonths: number): IsoDate {
  return addMonths(PROGRAMME_START, Math.round(devMonths));
}

// ---------------------------------------------------------------- series sampling
function sample(series: number[], start: IsoDate, stepDays: number, d: DateLike): number {
  const f = (dayNumber(d) - dayNumber(start)) / stepDays;
  const x = Math.max(0, Math.min(series.length - 1, f)); // clamp outside the snapshot
  const i = Math.min(series.length - 2, Math.floor(x));
  return series[i] + (series[i + 1] - series[i]) * (x - i);
}

/** Calendar range covered by each series. */
export const HORIZONS_RANGE = {
  moon: { start: DATA.moon.start, end: addDays(DATA.moon.start, (DATA.moon.km.length - 1) * DATA.moon.stepDays) },
  mars: { start: DATA.mars.start, end: addDays(DATA.mars.start, (DATA.mars.mkm.length - 1) * DATA.mars.stepDays) },
};

/** Earth-Moon centre distance, km (JPL Horizons, linearly interpolated between daily samples). */
export function moonDistanceKm(d: DateLike): number {
  return Math.round(sample(DATA.moon.km, DATA.moon.start, DATA.moon.stepDays, d));
}
/** One-way Earth-Moon light time, seconds (about 1.2-1.36 s). */
export function moonLightTimeSec(d: DateLike): number {
  return Math.round((moonDistanceKm(d) / SPEED_OF_LIGHT_KMS) * 100) / 100;
}
/** Earth-Mars centre distance, km. */
export function marsDistanceKm(d: DateLike): number {
  return Math.round(sample(DATA.mars.mkm, DATA.mars.start, DATA.mars.stepDays, d) * 1e6);
}
/** One-way Earth-Mars light time, minutes (Horizons LT; about 4.3-24 min over the synodic cycle, 4.9-19.8 in the snapshot). */
export function marsLightTimeMin(d: DateLike): number {
  return Math.round(sample(DATA.mars.ltMin, DATA.mars.start, DATA.mars.stepDays, d) * 100) / 100;
}

// ---------------------------------------------------------------- launch windows
/** Real Earth-to-Mars launch windows inside the snapshot (late 2026, late 2028, late 2030). */
export function marsWindows(): MarsWindow[] {
  return DATA.windows;
}
/** First launch window whose optimal day is on or after `afterDate` (null beyond the snapshot). */
export function nextMarsWindow(afterDate: DateLike): MarsWindow | null {
  const t = Math.round(dayNumber(afterDate));
  return DATA.windows.find((w) => dayNumber(w.optimal) >= t) ?? null;
}
/** The window after `w` (about 26 months later), or null. */
export function windowAfter(w: MarsWindow): MarsWindow | null {
  const i = DATA.windows.findIndex((x) => x.id === w.id);
  return i >= 0 ? DATA.windows[i + 1] ?? null : null;
}

/**
 * Launch window a Mars development of `devMonths` months aims at and whether it is missed.
 * `window` = first real window on or after the end of development; `missedByMonths` > 0 only when the development ends
 * after the window the programme is built around (programme start + devLimitMonths).
 */
export function marsScheduleCheck(devMonths: number, devLimitMonths: number): { window: MarsWindow | null; targetWindow: MarsWindow | null; missedByMonths: number; devEnd: IsoDate } {
  const devEnd = devEndDate(devMonths);
  const targetWindow = nextMarsWindow(devEndDate(devLimitMonths));
  const window = nextMarsWindow(devEnd);
  const missedByMonths = targetWindow && window && window.id !== targetWindow.id ? Math.max(1, Math.round(monthsBetween(targetWindow.optimal, devEnd))) : 0;
  return { window, targetWindow, missedByMonths, devEnd };
}

// ---------------------------------------------------------------- positions for drawing
export interface HelioPositions { earth: [number, number]; mars: [number, number] }

/** Heliocentric ecliptic positions (AU) of Earth and Mars on a date (interpolated from 5-day samples). */
export function helioPositions(d: DateLike): HelioPositions {
  const { start, stepDays, earth, mars } = DATA.helio;
  const f = (dayNumber(d) - dayNumber(start)) / stepDays;
  const x = Math.max(0, Math.min(earth.length - 1, f));
  const i = Math.min(earth.length - 2, Math.floor(x));
  const t = x - i;
  const lerp = (a: [number, number][]): [number, number] => [a[i][0] + (a[i + 1][0] - a[i][0]) * t, a[i][1] + (a[i + 1][1] - a[i][1]) * t];
  return { earth: lerp(earth), mars: lerp(mars) };
}
/** Earth and Mars orbit tracks (AU) between two dates, for drawing paths. */
export function helioTrack(from: DateLike, to: DateLike): { date: IsoDate; earth: [number, number]; mars: [number, number] }[] {
  const { start, stepDays, earth, mars } = DATA.helio;
  const i0 = Math.max(0, Math.floor((dayNumber(from) - dayNumber(start)) / stepDays));
  const i1 = Math.min(earth.length - 1, Math.ceil((dayNumber(to) - dayNumber(start)) / stepDays));
  const out = [];
  for (let i = i0; i <= i1; i++) out.push({ date: addDays(start, i * stepDays), earth: earth[i], mars: mars[i] });
  return out;
}
/** Earth-Sun-Mars angle in degrees (heliocentric longitude of Mars minus Earth, 0..360). A transfer window opens near 44 deg. */
export function marsPhaseAngleDeg(d: DateLike): number {
  const p = helioPositions(d);
  const a = Math.atan2(p.mars[1], p.mars[0]) - Math.atan2(p.earth[1], p.earth[0]);
  return ((a * 180) / Math.PI + 360) % 360;
}

/** Spacecraft heliocentric [x, y] (AU) on a date along the window's transfer arc (clamped to launch/arrival). */
export function transferPosition(w: MarsWindow, d: DateLike): [number, number] {
  const arc = w.transfer;
  const last = arc.length - 1;
  const offset = (i: number) => (i === last ? w.tofDays : i * 6); // arc spacing: 6 days, final point = arrival
  const day = Math.max(0, Math.min(w.tofDays, dayNumber(d) - dayNumber(w.optimal)));
  let i = Math.min(last - 1, Math.floor(day / 6));
  while (i < last - 1 && offset(i + 1) <= day) i++;
  const t = (day - offset(i)) / (offset(i + 1) - offset(i));
  return [arc[i][0] + (arc[i + 1][0] - arc[i][0]) * t, arc[i][1] + (arc[i + 1][1] - arc[i][1]) * t];
}
/** Distance spacecraft–Mars (km) on a date during the transfer of window `w` (real geometry, ecliptic plane; 0 at arrival). */
export function transferDistanceToMarsKm(w: MarsWindow, d: DateLike): number {
  if (dayNumber(d) >= dayNumber(w.arrival)) return 0;
  const sc = transferPosition(w, d);
  const m = helioPositions(d).mars;
  return Math.round((Math.hypot(sc[0] - m[0], sc[1] - m[1]) * AU_KM) / 1000) * 1000;
}
