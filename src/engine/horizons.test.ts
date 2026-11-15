import { describe, expect, it } from 'vitest';
import { MISSIONS } from '../data/missions';
import type { Design } from '../data/types';
import {
  HORIZONS_META, HORIZONS_RANGE, PROGRAMME_START, SPEED_OF_LIGHT_KMS, addMonths, devEndDate, fmtDate, helioPositions,
  marsDistanceKm, marsLightTimeMin, marsPhaseAngleDeg, marsScheduleCheck, marsWindows, monthsBetween, moonDistanceKm,
  moonLightTimeSec, nextMarsWindow, transferDistanceToMarsKm, windowAfter,
} from '../data/nasa/horizons';
import { SOURCES } from '../data/nasa/sources/horizons';
import { evaluateDesign } from './budget';
import { advance, createSim, runToEnd } from './simulate';

const MARS_GOOD: Design = { instruments: ['cam', 'radar'], solar: 'large', battery: 'bat_m', radio: 'ka3', computer: 'obc_rad', attitude: 'wheel', propulsion: 'biprop', burnWire: false, orbit: 'aerobrake', launcher: 'escape_share', stations: ['gold', 'madrid'], test: 'test_min' };
const LUNAR_GOOD: Design = { instruments: ['cam'], solar: 'fixed', battery: 'bat_m', radio: 'xband', computer: 'obc_std', attitude: 'wheel', propulsion: 'biprop', burnWire: false, orbit: 'llo', launcher: 'lunar_share', stations: ['gold', 'madrid', 'canb'], test: 'test_std' };

describe('Horizons snapshot and accessors', () => {
  it('has metadata with the queries and version', () => {
    expect(HORIZONS_META.horizonsVersion).toMatch(/^\d/);
    expect(HORIZONS_META.retrieved).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(HORIZONS_META.queries.length).toBeGreaterThanOrEqual(4);
    expect(HORIZONS_META.queries.every((q) => q.url.startsWith('https://ssd.jpl.nasa.gov/api/horizons.api'))).toBe(true);
  });

  it('Earth–Moon distance stays between perigee and apogee limits and light time is about 1.3 s', () => {
    for (let d = HORIZONS_RANGE.moon.start; d < HORIZONS_RANGE.moon.end; d = addMonths(d, 1)) {
      const km = moonDistanceKm(d);
      expect(km).toBeGreaterThan(355000);
      expect(km).toBeLessThan(407000);
      expect(moonLightTimeSec(d)).toBeGreaterThan(1.18);
      expect(moonLightTimeSec(d)).toBeLessThanOrEqual(1.36);
    }
  });

  it('Mars distance and Horizons light time are consistent (range / c) and in the real range', () => {
    for (let d = HORIZONS_RANGE.mars.start; d < HORIZONS_RANGE.mars.end; d = addMonths(d, 2)) {
      const km = marsDistanceKm(d);
      const lt = marsLightTimeMin(d);
      expect(Math.abs(lt - km / SPEED_OF_LIGHT_KMS / 60)).toBeLessThan(0.02);
      expect(km).toBeGreaterThan(55e6);
      expect(km).toBeLessThan(400e6);
    }
    // opposition of 2027-02-19 is about 0.68 AU; solar conjunction in late 2030 is the far point (about 2.6 AU)
    expect(marsDistanceKm('2027-02-19')).toBeLessThan(105e6);
    expect(marsLightTimeMin('2030-09-20')).toBeGreaterThan(19);
  });

  it('interpolates between days and clamps outside the snapshot', () => {
    const a = marsDistanceKm('2029-01-01'), b = marsDistanceKm('2029-01-02'), mid = marsDistanceKm(new Date('2029-01-01T12:00:00Z'));
    expect(mid).toBeGreaterThanOrEqual(Math.min(a, b) - 1);
    expect(mid).toBeLessThanOrEqual(Math.max(a, b) + 1);
    expect(marsDistanceKm('2000-01-01')).toBe(marsDistanceKm(HORIZONS_RANGE.mars.start));
  });

  it('heliocentric positions are about 1 AU for Earth and 1.38–1.67 AU for Mars', () => {
    for (const d of ['2026-12-01', '2028-11-23', '2030-06-15']) {
      const p = helioPositions(d);
      expect(Math.hypot(...p.earth)).toBeGreaterThan(0.98);
      expect(Math.hypot(...p.earth)).toBeLessThan(1.02);
      expect(Math.hypot(...p.mars)).toBeGreaterThan(1.37);
      expect(Math.hypot(...p.mars)).toBeLessThan(1.68);
    }
  });
});

describe('Mars launch windows', () => {
  it('finds the late-2026, late-2028 and late-2030 windows, about 26 months apart', () => {
    const w = marsWindows();
    expect(w.map((x) => x.optimal.slice(0, 7))).toEqual(['2026-11', '2028-11', '2030-12']);
    for (let i = 1; i < w.length; i++) {
      const gap = monthsBetween(w[i - 1].optimal, w[i].optimal);
      expect(gap).toBeGreaterThan(24);
      expect(gap).toBeLessThan(28);
    }
    for (const x of w) {
      expect(x.open <= x.optimal && x.optimal <= x.close).toBe(true);
      expect(x.tofDays).toBeGreaterThanOrEqual(190); // 6.3–9.2 months
      expect(x.tofDays).toBeLessThanOrEqual(280);
      expect(x.c3).toBeGreaterThan(8);
      expect(x.c3).toBeLessThan(15);
      const phase = marsPhaseAngleDeg(x.optimal);
      // Mars leads Earth: 44° for a circular-orbit Hohmann transfer, 55–70° for these real 9-month transfers of the eccentric orbit
      expect(phase).toBeGreaterThan(40);
      expect(phase).toBeLessThan(85);
    }
  });

  it('validates against the published 2020 and 2018 windows', () => {
    for (const v of HORIZONS_META.validation) expect(v.launchInsideFoundWindow).toBe(true);
  });

  it('nextMarsWindow picks the first window on or after a date', () => {
    expect(nextMarsWindow('2026-11-15')!.optimal).toBe('2028-11-23');
    expect(nextMarsWindow('2028-11-23')!.optimal).toBe('2028-11-23');
    expect(nextMarsWindow('2028-11-24')!.optimal).toBe('2030-12-28');
    expect(nextMarsWindow('2031-06-01')).toBeNull();
    expect(windowAfter(marsWindows()[1])!.id).toBe(marsWindows()[2].id);
  });

  it('programme start puts the 36-month Mars development limit exactly on the 2028 window', () => {
    expect(addMonths(PROGRAMME_START, 36)).toBe('2028-11-23');
    expect(devEndDate(36)).toBe('2028-11-23');
    const ok = marsScheduleCheck(36, 36);
    expect(ok.missedByMonths).toBe(0);
    expect(ok.window!.optimal).toBe('2028-11-23');
    const late = marsScheduleCheck(38, 36);
    expect(late.missedByMonths).toBe(2);
    expect(late.window!.optimal).toBe('2030-12-28');
    expect(marsScheduleCheck(12, 36).window!.optimal).toBe('2028-11-23');
  });

  it('transfer arc ends at Mars', () => {
    const w = marsWindows()[1];
    expect(transferDistanceToMarsKm(w, w.arrival)).toBe(0);
    expect(transferDistanceToMarsKm(w, '2029-06-01')).toBeGreaterThan(5e6);
    expect(transferDistanceToMarsKm(w, '2029-08-20')).toBeLessThan(8e6);
  });
});

describe('Engine with real ephemerides', () => {
  it('Mars: launch date is the real window, delays are real light times at the step date', () => {
    const m = MISSIONS.mars;
    let found = 0;
    for (let seed = 1; seed <= 30 && found < 6; seed++) {
      let s = createSim(MARS_GOOD, m, seed);
      expect(s.launchDate).toBe('2028-11-23');
      expect(s.launchWindow!.id).toBe('mars-2028-11');
      expect(s.arrivalDate).toBe(s.launchWindow!.arrival);
      while (s.status === 'running') s = advance(s, m);
      if (s.status === 'decision' && s.pending!.signalDelayLine) {
        const p = s.pending!;
        expect(p.signalDelayMin).toBeCloseTo(Math.round(marsLightTimeMin(p.date!) * 10) / 10, 5);
        expect(p.signalDelayLine).toContain(`Signal delay: ${p.signalDelayMin} min`);
        expect(p.signalDelayMin).toBeGreaterThan(4);
        expect(p.signalDelayMin).toBeLessThan(24);
        found++;
      }
    }
    expect(found).toBeGreaterThan(0);
  });

  it('Mars: telemetry has calendar dates, real Earth–Mars distance and light time; cruise distance falls to 0', () => {
    const m = MISSIONS.mars;
    const s = runToEnd(createSim(MARS_GOOD, m, 5), m);
    let prev = s.launchDate;
    for (const t of s.telemetry) {
      expect(t.date > prev).toBe(true);
      prev = t.date;
      expect(t.earthTargetKm).toBe(marsDistanceKm(t.date));
      expect(t.lightTimeSec).toBe(Math.round(marsLightTimeMin(t.date) * 60));
    }
    const cruise = s.telemetry.filter((t) => t.phase === 'launch' || t.phase === 'cruise');
    expect(cruise).toHaveLength(s.cruiseSteps);
    expect(cruise[cruise.length - 1].distanceToTargetKm).toBe(0);
    expect(s.telemetry[s.cruiseSteps - 1].date).toBe(s.arrivalDate);
    expect(s.log.every((l) => /^\d{4}-\d{2}-\d{2}$/.test(l.date))).toBe(true);
    expect(s.log[0].text).toContain(fmtDate('2028-11-23'));
  });

  it('Moon: distance and ~1.3 s light time come from Horizons at the sim date', () => {
    const m = MISSIONS.lunar;
    const s = runToEnd(createSim(LUNAR_GOOD, m, 2), m);
    expect(s.launchDate).toBe(devEndDate(s.devMonths));
    for (const t of s.telemetry) {
      expect(t.earthTargetKm).toBe(moonDistanceKm(t.date));
      expect(t.lightTimeSec).toBe(moonLightTimeSec(t.date));
      expect(t.lightTimeSec!).toBeGreaterThan(1.1);
      expect(t.lightTimeSec!).toBeLessThan(1.4);
    }
    const first = s.telemetry[0];
    if (first.distanceToTargetKm !== null) expect(first.distanceToTargetKm).toBeLessThan(first.earthTargetKm!);
  });

  it('Earth: has calendar dates but no ephemeris values', () => {
    const m = MISSIONS.earth;
    const d: Design = { instruments: ['thermal', 'spectro'], solar: 'track', battery: 'bat_m', radio: 'sband', computer: 'obc_basic', attitude: 'wheel', propulsion: null, burnWire: true, orbit: 'sso', launcher: 'medium', stations: ['wal', 'fai'], test: 'test_min' };
    const s = runToEnd(createSim(d, m, 1), m, 'first');
    expect(s.arrivalDate).toBeNull();
    expect(s.telemetry.every((t) => t.earthTargetKm === null && t.lightTimeSec === null && !!t.date)).toBe(true);
  });

  it('is deterministic by seed with real delays', () => {
    for (const [m, d] of [[MISSIONS.mars, MARS_GOOD], [MISSIONS.lunar, LUNAR_GOOD]] as const) {
      const a = runToEnd(createSim(d, m, 11), m, 'risky');
      const b = runToEnd(createSim(d, m, 11), m, 'risky');
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      expect(JSON.stringify(runToEnd(createSim(d, m, 12), m, 'risky'))).not.toBe(JSON.stringify(a));
    }
  });

  it('Mars schedule blocking names the real window and the miss', () => {
    const ev = evaluateDesign({ ...MARS_GOOD, test: 'test_full' }, MISSIONS.mars);
    const issue = ev.criticals.find((c) => c.code === 'schedule_window')!;
    expect(issue).toBeTruthy();
    expect(issue.why).toMatch(/^Next Mars launch window: 23 Nov 2028 — you would miss it by 2 months\./);
    expect(evaluateDesign(MARS_GOOD, MISSIONS.mars).criticals.map((c) => c.code)).not.toContain('schedule_window');
  });

  it('registers its NASA source', () => {
    expect(SOURCES[0].id).toBe('jpl-horizons');
    expect(SOURCES[0].refreshScript).toBe('node tools/fetch_horizons.mjs');
  });
});
