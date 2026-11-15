#!/usr/bin/env node
// Refreshes src/data/nasa/horizons.json from the NASA/JPL Horizons API (https://ssd-api.jpl.nasa.gov/doc/horizons.html).
//   node tools/fetch_horizons.mjs
// No dependencies (Node >= 18, global fetch). Queries run sequentially with a small delay.
//
// What it saves (compact, rounded):
//   moon  - Earth-Moon distance, daily           (VECTORS, target 301, centre Earth 500@399)
//   mars  - Earth-Mars distance + one-way light time, daily (VECTORS, target 499, centre Earth)
//   helio - Earth and Mars heliocentric ecliptic positions, AU, 5-day steps (VECTORS, centre Sun 500@10)
//   windows - real Mars launch opportunities, found by a Lambert-transfer search over the daily heliocentric
//             states (minimum departure + arrival v-infinity, time of flight 190..280 days) and validated against the published
//             2020 and 2024 windows (the validation spans are used in memory only, not stored).
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const API = 'https://ssd.jpl.nasa.gov/api/horizons.api';
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../src/data/nasa/horizons.json');
const C_KMS = 299792.458;
const AU_KM = 149597870.7;
const DAY_MS = 86400000;

const MOON_START = '2025-11-01';
const MARS_START = '2026-10-01';
const SPAN_END = '2031-12-31';
const HELIO_STEP = 5;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const queries = [];
let horizonsVersion = 'unknown';

async function horizons(name, params) {
  const q = new URLSearchParams({ format: 'json', MAKE_EPHEM: 'YES', EPHEM_TYPE: 'VECTORS', CSV_FORMAT: 'YES', VEC_LABELS: 'NO', OBJ_DATA: 'NO', ...params });
  // Horizons wants string values in single quotes
  for (const k of ['COMMAND', 'CENTER', 'START_TIME', 'STOP_TIME', 'STEP_SIZE', 'OUT_UNITS', 'VEC_TABLE', 'REF_PLANE', 'REF_SYSTEM']) {
    if (q.has(k)) q.set(k, `'${q.get(k)}'`);
  }
  const url = `${API}?${q.toString()}`;
  let json;
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      json = await res.json();
      break;
    } catch (e) {
      if (attempt >= 3) throw new Error(`${name}: ${e.message}`);
      await sleep(3000 * attempt);
    }
  }
  if (json.signature?.version) horizonsVersion = json.signature.version;
  const text = json.result ?? '';
  const a = text.indexOf('$$SOE'), b = text.indexOf('$$EOE');
  if (a < 0 || b < 0) throw new Error(`${name}: no data block. ${text.slice(0, 400)}`);
  const rows = text.slice(a + 5, b).trim().split('\n').map((l) => l.split(',').map((x) => x.trim()));
  console.log(`  ${name}: ${rows.length} rows`);
  queries.push({ name, url });
  await sleep(1500);
  return rows;
}

const num = (rows, col) => rows.map((r) => Number(r[col]));
const round = (v, d) => Math.round(v * 10 ** d) / 10 ** d;
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const ms = (d) => Date.parse(d + 'T00:00:00Z');

// ---------------------------------------------------------------- Lambert (universal variables, prograde)
const MU = 0.01720209895 ** 2; // Sun GM, AU^3/day^2 (Gauss)
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => Math.sqrt(dot(a, a));
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const stumpC = (z) => (z > 1e-8 ? (1 - Math.cos(Math.sqrt(z))) / z : z < -1e-8 ? (Math.cosh(Math.sqrt(-z)) - 1) / -z : 0.5 - z / 24);
const stumpS = (z) => (z > 1e-8 ? (Math.sqrt(z) - Math.sin(Math.sqrt(z))) / Math.sqrt(z) ** 3 : z < -1e-8 ? (Math.sinh(Math.sqrt(-z)) - Math.sqrt(-z)) / Math.sqrt(-z) ** 3 : 1 / 6 - z / 120);

/** Departure/arrival velocities of the prograde transfer r1 -> r2 in tof days (Curtis, algorithm 5.2), or null. */
function lambert(r1, r2, tof) {
  const n1 = norm(r1), n2 = norm(r2);
  let dth = Math.acos(Math.max(-1, Math.min(1, dot(r1, r2) / (n1 * n2))));
  if (r1[0] * r2[1] - r1[1] * r2[0] < 0) dth = 2 * Math.PI - dth; // prograde about +z
  const A = Math.sin(dth) * Math.sqrt((n1 * n2) / (1 - Math.cos(dth)));
  if (Math.abs(A) < 1e-9) return null;
  const y = (z) => n1 + n2 + (A * (z * stumpS(z) - 1)) / Math.sqrt(stumpC(z));
  const F = (z) => { const yy = y(z); return Math.pow(yy / stumpC(z), 1.5) * stumpS(z) + A * Math.sqrt(yy) - Math.sqrt(MU) * tof; };
  let lo = -50, hi = 4 * Math.PI * Math.PI - 1e-3;
  while (y(lo) < 0 && lo < hi) lo += 0.5; // y must be positive
  if (F(lo) > 0 && F(hi) > 0 || F(lo) < 0 && F(hi) < 0) return null;
  for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (F(mid) < 0) lo = mid; else hi = mid; }
  const z = (lo + hi) / 2, yy = y(z);
  if (yy < 0) return null;
  const f = 1 - yy / n1, g = (A * Math.sqrt(yy)) / Math.sqrt(MU);
  const gd = 1 - yy / n2;
  const v1 = [(r2[0] - f * r1[0]) / g, (r2[1] - f * r1[1]) / g, (r2[2] - f * r1[2]) / g];
  const v2 = [(gd * r2[0] - r1[0]) / g, (gd * r2[1] - r1[1]) / g, (gd * r2[2] - r1[2]) / g];
  return { v1, v2 };
}
const KMS2 = (AU_KM / 86400) ** 2; // (AU/day)^2 -> (km/s)^2

/** Daily Earth/Mars states: { t0 (ms), E: [[x,y,z,vx,vy,vz]], M: [...] } */
function parseStates(rows) { return rows.map((r) => [2, 3, 4, 5, 6, 7].map((c) => Number(r[c]))); }

/** Best transfer for each launch day: minimum of (departure v-infinity + arrival v-infinity), TOF 190..280 d (about 6-9 months). */
function porkchop(t0, E, M) {
  const out = [];
  for (let i = 0; i < E.length; i++) {
    let best = { cost: Infinity, c3: Infinity, tof: 0 };
    for (let tof = 190; tof <= 280; tof += 2) {
      const j = i + tof;
      if (j >= M.length) break;
      const sol = lambert(E[i].slice(0, 3), M[j].slice(0, 3), tof);
      if (!sol) continue;
      const dep = sub(sol.v1, E[i].slice(3)), arr = sub(sol.v2, M[j].slice(3));
      const vinfDep = Math.sqrt(dot(dep, dep) * KMS2), vinfArr = Math.sqrt(dot(arr, arr) * KMS2);
      const cost = vinfDep + vinfArr;
      if (cost < best.cost) best = { cost, c3: vinfDep * vinfDep, tof };
    }
    out.push({ date: iso(t0 + i * DAY_MS), ...best });
  }
  return out;
}

/** Launch windows: for each synodic cycle (run of days with a feasible transfer, departure C3 <= 30 km2/s2) the window is
 *  the days whose total v-infinity is within WINDOW_SLACK km/s of the cycle's best; optimal = the minimum. */
const WINDOW_SLACK = 0.4;
function findWindows(pc, cut = 30) {
  const runs = [];
  let cur = null;
  for (const p of pc) {
    if (p.c3 <= cut) { if (!cur) cur = []; cur.push(p); }
    else if (cur) { runs.push(cur); cur = null; }
  }
  if (cur && cur.length > 20) runs.push(cur);
  // merge runs of the same synodic cycle (gap < 120 days)
  const merged = [];
  for (const r of runs) {
    const last = merged[merged.length - 1];
    if (last && (ms(r[0].date) - ms(last[last.length - 1].date)) / DAY_MS < 120) last.push(...r);
    else merged.push([...r]);
  }
  return merged.filter((w) => w.length >= 5).map((run) => {
    const best = run.reduce((a, b) => (b.cost < a.cost ? b : a));
    const ok = run.filter((p) => p.cost <= best.cost + WINDOW_SLACK);
    return { open: ok[0].date, optimal: best.date, close: ok[ok.length - 1].date, c3: round(best.c3, 1), vInfTotalKms: round(best.cost, 2), tofDays: best.tof, arrival: iso(ms(best.date) + best.tof * DAY_MS) };
  });
}

// ---------------------------------------------------------------- main
console.log('Querying JPL Horizons...');
const common = { CENTER: '500@399', STEP_SIZE: '1 d', OUT_UNITS: 'KM-S', VEC_TABLE: '3' };

const moonRows = await horizons('Earth-Moon distance (daily)', { COMMAND: '301', ...common, START_TIME: MOON_START, STOP_TIME: SPAN_END });
const marsRows = await horizons('Earth-Mars distance + light time (daily)', { COMMAND: '499', ...common, START_TIME: MARS_START, STOP_TIME: SPAN_END });
// columns with VEC_TABLE 3 (CSV): JD, calendar, X, Y, Z, VX, VY, VZ, LT, RG, RR
const helioCommon = { CENTER: '500@10', STEP_SIZE: '1 d', OUT_UNITS: 'AU-D', VEC_TABLE: '2', REF_PLANE: 'ECLIPTIC' };
const earthH = await horizons('Earth heliocentric (daily, ecliptic J2000, AU)', { COMMAND: '399', ...helioCommon, START_TIME: MARS_START, STOP_TIME: SPAN_END });
const marsH = await horizons('Mars heliocentric (daily, ecliptic J2000, AU)', { COMMAND: '499', ...helioCommon, START_TIME: MARS_START, STOP_TIME: SPAN_END });
const VAL_START = '2018-01-01', VAL_END = '2025-06-30';
const earthV = await horizons('Earth heliocentric validation span', { COMMAND: '399', ...helioCommon, START_TIME: VAL_START, STOP_TIME: VAL_END });
const marsV = await horizons('Mars heliocentric validation span', { COMMAND: '499', ...helioCommon, START_TIME: VAL_START, STOP_TIME: VAL_END });

// --- distances
const moonKm = num(moonRows, 9).map((v) => Math.round(v));
const marsMkm = num(marsRows, 9).map((v) => round(v / 1e6, 3));
const marsLtMin = num(marsRows, 8).map((v) => round(v / 60, 2));

// --- heliocentric, 5-day steps, x/y AU
const eS = parseStates(earthH), mS = parseStates(marsH);
const helioN = Math.floor((eS.length - 1) / HELIO_STEP) + 1;
const pick = (S) => Array.from({ length: helioN }, (_, k) => { const s = S[k * HELIO_STEP]; return [round(s[0], 4), round(s[1], 4)]; });

// --- windows
console.log('Searching Mars launch windows (Lambert)...');
const windows = findWindows(porkchop(ms(MARS_START), eS, mS));
const valPc = porkchop(ms(VAL_START), parseStates(earthV), parseStates(marsV));
const valWins = findWindows(valPc);
// transfer arcs for drawing: heliocentric conic points along the optimal transfer
const tIdx = (d) => Math.round((ms(d) - ms(MARS_START)) / DAY_MS);
for (const w of windows) {
  const i = tIdx(w.optimal);
  const v1 = lambert(eS[i].slice(0, 3), mS[i + w.tofDays].slice(0, 3), w.tofDays).v1;
  // propagate the Kepler orbit numerically (RK4, 1-day steps) from (r1, v1)
  let r = eS[i].slice(0, 3), v = v1;
  const arc = [[round(r[0], 3), round(r[1], 3)]];
  const acc = (p) => { const d = norm(p) ** 3; return [-MU * p[0] / d, -MU * p[1] / d, -MU * p[2] / d]; };
  for (let d = 1; d <= w.tofDays; d++) {
    const h = 1, k1v = acc(r), k1r = v;
    const r2 = r.map((x, q) => x + 0.5 * h * k1r[q]), v2 = v.map((x, q) => x + 0.5 * h * k1v[q]), k2v = acc(r2);
    const r3 = r.map((x, q) => x + 0.5 * h * v2[q]), v3 = v.map((x, q) => x + 0.5 * h * k2v[q]), k3v = acc(r3);
    const r4 = r.map((x, q) => x + h * v3[q]), v4 = v.map((x, q) => x + h * k3v[q]), k4v = acc(r4);
    r = r.map((x, q) => x + (h / 6) * (k1r[q] + 2 * v2[q] + 2 * v3[q] + v4[q]));
    v = v.map((x, q) => x + (h / 6) * (k1v[q] + 2 * k2v[q] + 2 * k3v[q] + k4v[q]));
    if (d % 6 === 0 || d === w.tofDays) arc.push([round(r[0], 3), round(r[1], 3)]);
  }
  w.transfer = arc;
  w.marsAtArrival = [round(mS[i + w.tofDays][0], 3), round(mS[i + w.tofDays][1], 3)];
  // Earth-Mars light time on arrival day (min) from the Mars geocentric series
  const k = Math.round((ms(w.arrival) - ms(MARS_START)) / DAY_MS);
  if (k >= 0 && k < marsLtMin.length) w.arrivalLightMin = marsLtMin[k];
  w.id = `mars-${w.optimal.slice(0, 7)}`;
}

// Published reference windows (NASA mission pages): Mars 2020 launched 2020-07-30 (arrived 2021-02-18);
// 2018-05 InSight launched 2018-05-05 (arrived 2018-11-26); ExoMars/Hope/Tianwen-1 2020-07 as well.
const published = [
  { name: 'Mars 2020 / Perseverance', launch: '2020-07-30', arrive: '2021-02-18', windowPublished: '2020-07-17 .. 2020-08-11' },
  { name: 'InSight', launch: '2018-05-05', arrive: '2018-11-26', windowPublished: '2018-05-05 .. 2018-06-08' },
];
const validation = published.map((p) => {
  const w = valWins.find((x) => x.open <= p.launch && p.launch <= x.close) ?? null;
  return { ...p, found: w ? { open: w.open, optimal: w.optimal, close: w.close, c3: w.c3, tofDays: w.tofDays } : null, launchInsideFoundWindow: !!w };
});
for (const w of valWins) console.log(`  validation window ${w.open} .. ${w.close}  opt ${w.optimal} C3 ${w.c3} tof ${w.tofDays}`);
for (const w of windows) console.log(`  window ${w.open} .. ${w.close}  opt ${w.optimal} C3 ${w.c3} tof ${w.tofDays} -> arrive ${w.arrival}`);
for (const v of validation) console.log(`  validate ${v.name}: launch ${v.launch} inside found window: ${v.launchInsideFoundWindow}`);

const data = {
  meta: {
    source: 'NASA/JPL Horizons on-line solar system data and ephemeris computation service',
    api: API,
    horizonsVersion,
    retrieved: new Date().toISOString().slice(0, 10),
    refreshScript: 'node tools/fetch_horizons.mjs',
    frame: 'Ecliptic of J2000.0, geometric states; distances Earth-centred (500@399); heliocentric positions centred on the Sun (500@10)',
    units: { moonKm: 'km, daily', marsMkm: '10^6 km, daily', marsLtMin: 'minutes one-way light time (Horizons LT), daily', helio: 'AU [x,y] ecliptic, every 5 days' },
    queries,
    windowMethod: 'Lambert (universal variables) search, launch day x TOF 190-280 d, minimising departure + arrival v-infinity; window = days within 0.4 km/s of the cycle optimum',
    validation,
  },
  moon: { start: MOON_START, stepDays: 1, km: moonKm },
  mars: { start: MARS_START, stepDays: 1, mkm: marsMkm, ltMin: marsLtMin },
  helio: { start: MARS_START, stepDays: HELIO_STEP, earth: pick(eS), mars: pick(mS) },
  windows,
};
mkdirSync(dirname(OUT), { recursive: true });
const json = JSON.stringify(data);
writeFileSync(OUT, json);
console.log(`Wrote ${OUT} (${(json.length / 1024).toFixed(0)} KB)`);
