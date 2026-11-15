// (1) The TS engine reproduces tools/balance_check.py.
// Expected values were produced by running the Python script's evaluate() on these designs
// (scratch harness, script itself unmodified). Regenerated after the NASA calibration (src/data/nasa/calibration.md). Python tuple: (ins, sol, bat, rad, obc, adc, prop, orb, lv, gs, test).

import { describe, expect, it } from 'vitest';
import { MISSIONS } from '../data/missions';
import type { Design, MissionId } from '../data/types';
import { forecastDesign } from './scoring';

type PyDesign = [string[], string, string, string, string, string, string, string, string, string[], string];
interface PyResult { total: number; science: number; returned: number; mass: number; cost: number; time: number; duty: number; cap: number; gen: number }
const FIXTURE: Record<MissionId, { d: PyDesign; r: PyResult | null }[]> = {"earth": [{"d": [["thermal", "spectro"], "track", "bat_m", "sband", "obc_basic", "wheel", "none", "sso", "medium", ["wal", "fai"], "test_min"], "r": {"total": 93.39999999999999, "science": 101.85, "returned": 84.0, "mass": 4.829999999999999, "cost": 4.779999999999999, "time": 12, "duty": 1, "cap": 11.399999999999999, "gen": 8.0}}, {"d": [["imager"], "deploy", "bat_m", "sband", "obc_basic", "wheel", "none", "sso", "medium", ["wal", "fai"], "test_std"], "r": {"total": 86.91000000000001, "science": 81.20000000000002, "returned": 81.20000000000002, "mass": 4.2299999999999995, "cost": 3.9800000000000004, "time": 11, "duty": 0.9666666666666668, "cap": 11.399999999999999, "gen": 7.733333333333334}}, {"d": [["atmos", "spectro"], "deploy", "bat_m", "sband", "obc_basic", "torq", "none", "sso", "dedicated", ["fai"], "test_full"], "r": {"total": 91.03739999999999, "science": 73.45799999999998, "returned": 57.75, "mass": 3.73, "cost": 4.7299999999999995, "time": 10, "duty": 1, "cap": 7.98, "gen": 5.5}}, {"d": [["imager", "thermal"], "deploy", "bat_s", "uhf", "obc_std", "mag", "none", "leo", "medium", ["wal", "san"], "test_min"], "r": {"total": 42.17434925027871, "science": 1.500525, "returned": 6.0021, "mass": 4.62, "cost": 3.95, "time": 10, "duty": 0.552, "cap": 0.6318, "gen": 5.5972800000000005}}, {"d": [["atmos"], "body", "bat_s", "uhf", "obc_basic", "mag", "none", "leo", "light", ["wal"], "test_min"], "r": {"total": 39.14089094736842, "science": 4.031040000000001, "returned": 3.3592000000000004, "mass": 2.37, "cost": 1.5299999999999998, "time": 4, "duty": 0.7600000000000001, "cap": 0.3536, "gen": 1.1856000000000002}}, {"d": [["imager", "atmos", "spectro"], "track", "bat_l", "xband", "obc_rad", "wheel", "none", "sso", "medium", ["sva"], "test_std"], "r": null}, {"d": [["thermal", "spectro"], "track", "bat_m", "sband", "obc_basic", "wheel", "none", "sso", "medium", ["sva"], "test_min"], "r": {"total": 95.5, "science": 101.85, "returned": 84.0, "mass": 4.829999999999999, "cost": 4.68, "time": 12, "duty": 1, "cap": 11.76, "gen": 8.0}}], "lunar": [{"d": [["cam"], "fixed", "bat_m", "xband", "obc_std", "wheel", "biprop", "llo", "lunar_share", ["gold", "madrid", "canb"], "test_std"], "r": {"total": 94.3, "science": 630.0, "returned": 630.0, "mass": 246, "cost": 21.700000000000003, "time": 22, "duty": 1, "cap": 80.1, "gen": 60.0}}, {"d": [["cam", "mapper"], "wings", "bat_m", "xband", "obc_std", "wheel", "mono_l", "frozen", "lunar_share", ["gold", "madrid", "canb"], "test_min"], "r": {"total": 92.0, "science": 758.5199999999999, "returned": 705.5999999999999, "mass": 244, "cost": 23.3, "time": 24, "duty": 1, "cap": 81.0, "gen": 67.19999999999999}}, {"d": [["mapper"], "fixed", "bat_m", "xband", "obc_std", "wheel", "mono_l", "llo", "dedicated", ["gold", "madrid"], "test_std"], "r": null}, {"d": [["neutron"], "fixed", "bat_s", "sband", "obc_std", "thr", "mono_l", "nrho", "gto", ["com"], "test_min"], "r": {"total": 61.0875, "science": 35.699999999999996, "returned": 8.924999999999999, "mass": 174.5, "cost": 11.700000000000001, "time": 15, "duty": 1, "cap": 3.18, "gen": 1.0499999999999998}}, {"d": [["altim", "neutron"], "wings", "bat_s", "kaband", "obc_rad", "thr", "mono_l", "frozen", "dedicated", ["gold", "com"], "test_full"], "r": null}], "mars": [{"d": [["cam", "radar"], "large", "bat_m", "ka3", "obc_rad", "wheel", "sep", "direct", "gto", ["gold", "madrid"], "test_min"], "r": null}, {"d": [["cam", "radar"], "large", "bat_m", "ka3", "obc_rad", "wheel", "biprop", "aerobrake", "escape_share", ["gold", "madrid"], "test_min"], "r": {"total": 89.5, "science": 2178.0, "returned": 1650.0, "mass": 544, "cost": 57.9, "time": 32, "duty": 1, "cap": 196.20000000000002, "gen": 150.0}}, {"d": [["tracegas", "radar"], "large", "bat_m", "x2", "obc_rad", "wheel", "sep", "direct", "gto", ["gold", "madrid", "canb"], "test_min"], "r": null}, {"d": [["fields"], "wings", "bat_s", "x1", "obc_rad", "thr", "biprop", "capture", "escape_share", ["gold"], "test_std"], "r": {"total": 64.11666666666667, "science": 150.0, "returned": 30.0, "mass": 421, "cost": 41.6, "time": 22, "duty": 1, "cap": 13.0, "gen": 2.0}}, {"d": [["fields", "tracegas"], "large", "bat_s", "x2", "obc_auto", "wheel", "biprop", "capture", "gto", ["gold"], "test_min"], "r": null}, {"d": [["cam", "radar"], "large", "bat_m", "ka3", "obc_rad", "wheel", "sep", "aerobrake", "gto", ["gold", "madrid"], "test_min"], "r": {"total": 87.2, "science": 1782.0, "returned": 1350.0, "mass": 454, "cost": 54.9, "time": 34, "duty": 1, "cap": 196.20000000000002, "gen": 150.0}}, {"d": [["radar", "fields"], "wings", "bat_s", "x2", "obc_rad", "wheel", "sep", "direct", "escape_share", ["gold", "madrid"], "test_std"], "r": {"total": 87.03888888888889, "science": 1664.0, "returned": 832.0, "mass": 393, "cost": 56.8, "time": 32, "duty": 1, "cap": 76.30000000000001, "gen": 64.0}}, {"d": [["cam", "radar"], "wings", "bat_s", "x2", "obc_rad", "wheel", "biprop", "capture", "escape_share", ["gold", "madrid", "canb"], "test_min"], "r": {"total": 85.3, "science": 1485.0, "returned": 1125.0, "mass": 505, "cost": 55.8, "time": 30, "duty": 1, "cap": 136.5, "gen": 75.0}}, {"d": [["cam", "radar", "fields"], "large", "bat_s", "ka3", "obc_rad", "wheel", "biprop", "aerobrake", "escape_share", ["gold", "madrid"], "test_min"], "r": {"total": 91.94444444444444, "science": 2398.0, "returned": 1694.0, "mass": 543, "cost": 59.8, "time": 34, "duty": 1, "cap": 196.20000000000002, "gen": 154.0}}]};

export function fromPy(d: PyDesign): Design {
  return {
    instruments: d[0], solar: d[1], battery: d[2], radio: d[3], computer: d[4], attitude: d[5],
    propulsion: d[6] === 'none' ? null : d[6], burnWire: false, orbit: d[7], launcher: d[8], stations: d[9], test: d[10],
  };
}

describe('engine matches tools/balance_check.py on control designs', () => {
  for (const id of ['earth', 'lunar', 'mars'] as MissionId[]) {
    FIXTURE[id].forEach(({ d, r }, n) => {
      it(`${id} #${n + 1} ${d[0].join('+')} ${d[7]} ${d[8]}`, () => {
        const f = forecastDesign(fromPy(d), MISSIONS[id]);
        if (r === null) {
          expect(f).toBeNull();
          return;
        }
        expect(f).not.toBeNull();
        expect(f!.total).toBeCloseTo(r.total, 9);
        expect(f!.science).toBeCloseTo(r.science, 9);
        expect(f!.returned).toBeCloseTo(r.returned, 9);
        expect(f!.mass).toBeCloseTo(r.mass, 9);
        expect(f!.cost).toBeCloseTo(r.cost, 9);
        expect(f!.time).toBe(r.time);
        expect(f!.duty).toBeCloseTo(r.duty, 9);
        expect(f!.cap).toBeCloseTo(r.cap, 9);
        expect(f!.gen).toBeCloseTo(r.gen, 9);
      });
    });
  }
});

/** Every design of a mission, in the same order as the Python enumeration. */
function* allDesigns(id: MissionId): Generator<Design> {
  const m = MISSIONS[id];
  const c = m.catalog;
  const ins = c.instruments.map((i) => i.id);
  const combos = (arr: string[], k: number): string[][] =>
    k === 0 ? [[]] : arr.flatMap((x, i) => combos(arr.slice(i + 1), k - 1).map((rest) => [x, ...rest]));
  const insSets = [1, 2, 3].flatMap((k) => combos(ins, k));
  const st = m.stations.map((s) => s.id);
  const gsSets = st.flatMap((_, k) => combos(st, k + 1));
  const props: (string | null)[] = c.propulsion.length ? c.propulsion.map((p) => p.id) : [null];
  for (const i of insSets) for (const sol of c.solar) for (const bat of c.battery) for (const rad of c.radio)
    for (const obc of c.computer) for (const adc of c.attitude) for (const prop of props)
      for (const orb of m.orbits.filter((o) => o.available)) for (const lv of m.launchers) for (const gs of gsSets) for (const t of m.tests)
        yield { instruments: i, solar: sol.id, battery: bat.id, radio: rad.id, computer: obc.id, attitude: adc.id, propulsion: prop,
          burnWire: false, orbit: orb.id, launcher: lv.id, stations: gs, test: t.id };
}

// Section 12 table: feasible / meets required / of them ≥ 85 / max score.
const ENUM: Record<MissionId, { feasible: number; meets: number; meets85: number; max: number }> = {
  earth: { feasible: 199813, meets: 17630, meets85: 1448, max: 95.5 },
  lunar: { feasible: 676658, meets: 1736, meets85: 172, max: 94.3 },
  mars: { feasible: 360256, meets: 1154, meets85: 93, max: 91.9 },
};

// Earth always runs (~4 s). Lunar (~17 s) and Mars (~11 s) run with FULL_BALANCE=1 npm test.
const FULL = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.FULL_BALANCE === '1';

describe('full enumeration matches the balance script', () => {
  for (const id of (FULL ? ['earth', 'lunar', 'mars'] : ['earth']) as MissionId[]) {
    it(`${id}: feasible designs, required-data designs and max score`, () => {
      const m = MISSIONS[id];
      let feasible = 0, meets = 0, meets85 = 0, max = -Infinity;
      for (const d of allDesigns(id)) {
        const f = forecastDesign(d, m);
        if (!f) continue;
        feasible++;
        if (f.returned >= m.limits.requiredGB) { meets++; if (f.total >= 85) meets85++; }
        if (f.total > max) max = f.total;
      }
      expect(feasible).toBe(ENUM[id].feasible);
      expect(meets).toBe(ENUM[id].meets);
      expect(meets85).toBe(ENUM[id].meets85);
      expect(Math.round(max * 10) / 10).toBe(ENUM[id].max);
    }, 300_000);
  }
});
