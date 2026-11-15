import { describe, expect, it } from 'vitest';
import { ANALOG_LIST, ANALOGS, INSTRUMENT_SCIENCE } from '../data/analogs';
import { MISSIONS } from '../data/missions';
import type { Design, MissionId } from '../data/types';
import ntrs from '../data/nasa/ntrs.json';
import { evaluateDesign } from './budget';
import { buildReport, designProfile, matchAnalogs, pickAnalog } from './scoring';
import { createSim, runToEnd } from './simulate';

const base: Record<MissionId, Design> = {
  earth: { instruments: ['thermal'], solar: 'deploy', battery: 'bat_m', radio: 'sband', computer: 'obc_std', attitude: 'torq', propulsion: null, burnWire: true, orbit: 'sso', launcher: 'medium', stations: ['wal', 'fai'], test: 'test_std' },
  lunar: { instruments: ['cam', 'altim'], solar: 'wings', battery: 'bat_m', radio: 'kaband', computer: 'obc_rad', attitude: 'wheel', propulsion: 'mono_l', burnWire: false, orbit: 'llo', launcher: 'lunar_share', stations: ['gold', 'madrid', 'canb'], test: 'test_std' },
  mars: { instruments: ['fields'], solar: 'wings', battery: 'bat_m', radio: 'x2', computer: 'obc_auto', attitude: 'thr', propulsion: 'biprop', burnWire: false, orbit: 'capture', launcher: 'escape_share', stations: ['gold', 'madrid'], test: 'test_std' },
};
const top = (id: MissionId, d: Partial<Design>, outcome: Parameters<typeof designProfile>[2] = null) =>
  matchAnalogs(designProfile({ ...base[id], ...d }, MISSIONS[id], outcome), MISSIONS[id]);

describe('analog matching', () => {
  it('thermal infrared imager in SSO resembles HyTI', () => {
    const r = top('earth', {});
    expect(r.top.analog.id).toBe('hyti');
    expect(r.top.shared.join(' ')).toMatch(/thermal infrared imager/);
    expect(r.top.differences.join(' ')).toMatch(/430 km/);
  });

  it('camera + laser altimeter in low lunar orbit resembles LRO', () => {
    const r = top('lunar', {});
    expect(r.top.analog.id).toBe('lro');
    expect(r.top.shared.join(' ')).toMatch(/laser altimeter/);
  });

  it('fields package at Mars resembles MAVEN', () => {
    const r = top('mars', {});
    expect(r.top.analog.id).toBe('maven');
  });

  it('other signatures: neutron → Lunar Prospector, NRHO → CAPSTONE, fine pointing + imager → ASTERIA, trace gas → TGO, radar + aerobraking → MRO', () => {
    expect(top('lunar', { instruments: ['neutron'], attitude: 'thr', radio: 'sband', solar: 'fixed' }).top.analog.id).toBe('lunar_prospector');
    expect(top('lunar', { instruments: ['cam'], orbit: 'nrho', radio: 'xband', propulsion: 'mono_s' }).top.analog.id).toBe('capstone');
    expect(top('earth', { instruments: ['imager'], attitude: 'wheel', orbit: 'leo' }).top.analog.id).toBe('asteria');
    expect(top('mars', { instruments: ['tracegas'], orbit: 'direct' }).top.analog.id).toBe('tgo');
    expect(top('mars', { instruments: ['cam', 'radar'], orbit: 'aerobrake', attitude: 'wheel', propulsion: 'mono_l' }).top.analog.id).toBe('mro');
  });

  it('is deterministic, returns two distinct runners-up and sensible percentages', () => {
    for (const id of ['earth', 'lunar', 'mars'] as MissionId[]) {
      const a = top(id, {});
      const b = top(id, {});
      expect(a).toEqual(b);
      expect(a.runnersUp).toHaveLength(2);
      const ids = [a.top, ...a.runnersUp].map((m) => m.analog.id);
      expect(new Set(ids).size).toBe(3);
      expect(a.top.percent).toBeGreaterThanOrEqual(a.runnersUp[0].percent);
      expect(a.top.percent).toBeGreaterThan(40);
      expect(a.top.percent).toBeLessThanOrEqual(100);
      expect(a.top.shared.length).toBeGreaterThanOrEqual(1);
      expect(a.top.shared.length).toBeLessThanOrEqual(4);
      expect(a.top.differences.length).toBeLessThanOrEqual(2);
      for (const m of [a.top, ...a.runnersUp]) expect(m.analog.mission).toBe(id);
    }
  });

  it('a lost spacecraft leans toward lost real missions', () => {
    const ok = top('lunar', { instruments: ['mapper'] }, 'success');
    const lost = top('lunar', { instruments: ['mapper'] }, 'lost');
    const pct = (r: typeof ok) => [r.top, ...r.runnersUp].find((m) => m.analog.id === 'lunar_trailblazer')?.percent ?? 0;
    expect(pct(lost)).toBeGreaterThan(pct(ok));
    expect(lost.top.analog.id).toBe('lunar_trailblazer');
  });

  it('buildReport carries the match and pickAnalog stays compatible', () => {
    const flyable: Record<MissionId, Design> = {
      earth: base.earth,
      lunar: { ...base.lunar, instruments: ['cam'], solar: 'fixed', radio: 'xband', computer: 'obc_std', propulsion: 'biprop' },
      mars: { instruments: ['cam', 'radar'], solar: 'large', battery: 'bat_m', radio: 'ka3', computer: 'obc_rad', attitude: 'wheel', propulsion: 'biprop', burnWire: false, orbit: 'aerobrake', launcher: 'escape_share', stations: ['gold', 'madrid'], test: 'test_min' },
    };
    for (const id of ['earth', 'lunar', 'mars'] as MissionId[]) {
      const m = MISSIONS[id];
      // Balance may change under us: take the first propulsion / launcher that makes the design launchable.
      const options = (m.catalog.propulsion.length ? m.catalog.propulsion.map((p) => p.id) : [null]).flatMap((propulsion) =>
        m.launchers.map((l) => ({ ...flyable[id], propulsion, launcher: l.id })));
      const d = options.find((x) => evaluateDesign(x, m).canLaunch);
      if (!d) continue;
      flyable[id] = d;
      const s = runToEnd(createSim(d, m, 7), m, 'first');
      const r = buildReport(s, m);
      expect(r.analog.id).toBe(r.analogMatch.top.analog.id);
      expect(ANALOGS[r.analog.id]).toBeTruthy();
      expect(pickAnalog(flyable[id], m).mission).toBe(id);
      expect(r.analogMatch.top.shared.length).toBeGreaterThan(0);
    }
  });
});

describe('analog data integrity', () => {
  it('every analog has sources, a mission page and verified basics', () => {
    expect(ANALOG_LIST.length).toBeGreaterThanOrEqual(20);
    const ids = new Set<string>();
    for (const a of ANALOG_LIST) {
      expect(ids.has(a.id), a.id).toBe(false);
      ids.add(a.id);
      expect(a.sources.length, a.id).toBeGreaterThanOrEqual(1);
      for (const s of a.sources) expect(s.url, a.id).toMatch(/^https:\/\//);
      expect(a.url).toMatch(/^https:\/\//);
      expect(a.facts.instruments.length, a.id).toBeGreaterThanOrEqual(1);
      expect(a.facts.goal.length).toBeGreaterThan(10);
      expect(a.text.length).toBeGreaterThan(40);
      expect(a.teaser).toBeTruthy();
      expect(a.imageQuery).toBeTruthy();
      expect(a.text).not.toMatch(/logo/i);
    }
    for (const id of ['earth', 'lunar', 'mars'] as MissionId[]) expect(ANALOG_LIST.filter((a) => a.mission === id).length).toBeGreaterThanOrEqual(6);
  });

  it('keeps the ids of saved collections (backwards compatible)', () => {
    for (const id of ['harp', 'hyti', 'icecube', 'minxss', 'dellingr', 'asteria', 'lro', 'lunar_prospector', 'lunar_trailblazer', 'capstone', 'mro', 'maven', 'tgo']) {
      expect(ANALOGS[id], id).toBeTruthy();
    }
  });

  it('every game instrument maps to a science type that some analog carries', () => {
    for (const m of Object.values(MISSIONS)) {
      for (const i of m.catalog.instruments) {
        const t = INSTRUMENT_SCIENCE[i.id];
        expect(t, i.id).toBeTruthy();
        expect(ANALOG_LIST.some((a) => a.mission === m.id && a.facts.instruments.some((x) => x.type === t)), `${m.id}/${i.id}`).toBe(true);
      }
    }
  });

  it('every analog has 1–3 NTRS papers and every lesson topic one', () => {
    const papers = ntrs.analogs as Record<string, { id: string; url: string; title: string }[]>;
    for (const a of ANALOG_LIST) {
      const list = papers[a.id];
      expect(list?.length, a.id).toBeGreaterThanOrEqual(1);
      expect(list.length).toBeLessThanOrEqual(3);
      for (const p of list) expect(p.url).toBe(`https://ntrs.nasa.gov/citations/${p.id}`);
    }
    for (const k of ['antenna', 'power', 'battery', 'pointing', 'storage', 'schedule', 'radiation', 'deployment']) {
      expect((ntrs.lessons as Record<string, { title: string }>)[k]?.title, k).toBeTruthy();
    }
  });
});
