import { describe, expect, it } from 'vitest';
import { MISSIONS } from '../data/missions';
import type { Design, Mission, MissionId } from '../data/types';
import { evaluateDesign } from './budget';
import { buildReport, computeStars, forecastDesign, reportVoice } from './scoring';
import { advance, createSim, decide, getTimeline, runToEnd } from './simulate';
import type { SimState } from './simulate';
import { isMissionUnlocked, emptyProgress } from '../store/persistence';

const IDS: MissionId[] = ['earth', 'lunar', 'mars'];

function extreme(m: Mission, pick: 'max' | 'min'): Design {
  const by = <T extends { costM: number }>(list: T[]): T =>
    [...list].sort((a, b) => (pick === 'max' ? b.costM - a.costM : a.costM - b.costM))[0];
  const c = m.catalog;
  const ins = [...c.instruments].sort((a, b) => (pick === 'max' ? b.costM - a.costM : a.costM - b.costM)).slice(0, pick === 'max' ? 3 : 1);
  const launcher = by(m.launchers);
  const orbit = m.orbits.find((o) => o.available && launcher.orbits.includes(o.id))!;
  return {
    instruments: ins.map((i) => i.id), solar: by(c.solar).id, battery: by(c.battery).id, radio: by(c.radio).id,
    computer: by(c.computer).id, attitude: by(c.attitude).id, propulsion: c.propulsion.length ? by(c.propulsion).id : null,
    burnWire: false, orbit: orbit.id, launcher: launcher.id,
    stations: pick === 'max' ? m.stations.map((s) => s.id) : [by(m.stations).id], test: by(m.tests).id,
  };
}

/** Good flight-ready designs (top designs from tools/balance_check.py). */
const GOOD: Record<MissionId, Design> = {
  earth: { instruments: ['thermal', 'spectro'], solar: 'track', battery: 'bat_m', radio: 'sband', computer: 'obc_basic', attitude: 'wheel', propulsion: null, burnWire: true, orbit: 'sso', launcher: 'medium', stations: ['wal', 'fai'], test: 'test_min' },
  lunar: { instruments: ['cam'], solar: 'fixed', battery: 'bat_m', radio: 'xband', computer: 'obc_std', attitude: 'wheel', propulsion: 'biprop', burnWire: false, orbit: 'llo', launcher: 'lunar_share', stations: ['gold', 'madrid', 'canb'], test: 'test_std' },
  mars: { instruments: ['cam', 'radar'], solar: 'large', battery: 'bat_m', radio: 'ka3', computer: 'obc_rad', attitude: 'wheel', propulsion: 'biprop', burnWire: false, orbit: 'aerobrake', launcher: 'escape_share', stations: ['gold', 'madrid'], test: 'test_min' },
};

describe('(2) most expensive build', () => {
  for (const id of IDS) {
    it(`${id}: at least two critical errors`, () => {
      const ev = evaluateDesign(extreme(MISSIONS[id], 'max'), MISSIONS[id]);
      expect(ev.criticals.length).toBeGreaterThanOrEqual(2);
      expect(ev.canLaunch).toBe(false);
      expect(ev.criticals.map((c) => c.code)).toContain('budget');
      for (const c of ev.issues) { expect(c.what).toBeTruthy(); expect(c.why).toBeTruthy(); expect(c.fix).toBeTruthy(); }
    });
  }
});

describe('(3) cheapest build', () => {
  it('earth: flies but does not return 50 GB', () => {
    const m = MISSIONS.earth;
    const d = extreme(m, 'min');
    expect(d.instruments).toEqual(['atmos']);
    const ev = evaluateDesign(d, m);
    expect(ev.canLaunch).toBe(true);
    expect(forecastDesign(d, m)!.returned).toBeLessThan(50);
    for (let seed = 1; seed <= 20; seed++) {
      const s = runToEnd(createSim(d, m, seed), m, 'first');
      expect(s.returnedGB).toBeLessThan(50);
      expect(buildReport(s, m).outcome).toBe('failure');
    }
  });
});

describe('(4) fixed seed is reproducible', () => {
  for (const id of IDS) {
    it(id, () => {
      const m = MISSIONS[id];
      const a = runToEnd(createSim(GOOD[id], m, 12345), m, 'risky');
      const b = runToEnd(createSim(GOOD[id], m, 12345), m, 'risky');
      expect(b).toEqual(a);
      expect(buildReport(b, m)).toEqual(buildReport(a, m));
      // step-by-step play equals runToEnd
      let s: SimState = createSim(GOOD[id], m, 12345);
      while (s.status === 'running' || s.status === 'decision') {
        s = s.status === 'decision' ? decide(s, m, (s.pending!.options.find((o) => !o.protective && !o.disabled) ?? s.pending!.options[0]).id) : advance(s, m);
      }
      expect(s).toEqual(a);
      // different seeds diverge somewhere
      const results = new Set<string>();
      for (let seed = 1; seed <= 30; seed++) results.add(JSON.stringify(runToEnd(createSim(GOOD[id], m, seed), m).log.map((l) => l.title)));
      expect(results.size).toBeGreaterThan(1);
    });
  }
  it('does not mutate the input state', () => {
    const m = MISSIONS.earth;
    const s0 = createSim(GOOD.earth, m, 7);
    const copy = structuredClone(s0);
    advance(s0, m);
    expect(s0).toEqual(copy);
  });
});

describe('(5) category sum equals total score', () => {
  // 13 months of development → 1 month over, −2 points
  const overrun: Design = { instruments: ['atmos', 'spectro'], solar: 'track', battery: 'bat_m', radio: 'sband', computer: 'obc_rad', attitude: 'torq', propulsion: null, burnWire: false, orbit: 'sso', launcher: 'medium', stations: ['wal', 'fai'], test: 'test_full' };
  it('forecast includes the overrun penalty', () => {
    const f = forecastDesign(overrun, MISSIONS.earth);
    expect(f).not.toBeNull();
    expect(f!.score.penalty).toBe(2);
    const sum = f!.score.categories.reduce((a, c) => a + c.points, 0);
    expect(sum - f!.score.penalty).toBeCloseTo(f!.total, 10);
  });
  for (const id of IDS) {
    it(`${id}: report over many seeds`, () => {
      const m = MISSIONS[id];
      for (let seed = 1; seed <= 40; seed++) {
        const design = id === 'earth' && seed % 2 ? overrun : GOOD[id];
        const rep = buildReport(runToEnd(createSim(design, m, seed), m, seed % 3 ? 'protective' : 'risky'), m);
        const sum = rep.score.categories.reduce((a, c) => a + c.points, 0);
        expect(sum - rep.score.penalty).toBeCloseTo(rep.score.total, 10);
        for (const c of rep.score.categories) { expect(c.points).toBeGreaterThanOrEqual(0); expect(c.points).toBeLessThanOrEqual(c.max + 1e-9); }
        expect(rep.cards.length).toBeGreaterThanOrEqual(1);
        expect(rep.cards.length).toBeLessThanOrEqual(4);
      }
    });
  }
});

describe('budget details', () => {
  it('launcher status reasons', () => {
    const m = MISSIONS.earth;
    const d: Design = { ...GOOD.earth, launcher: null };
    const ev = evaluateDesign(d, m);
    const light = ev.launchers.find((l) => l.id === 'light')!;
    expect(light.compatible).toBe(false);
    expect(light.reason).toBe('Does not fly to this orbit');
    const leo = evaluateDesign({ ...d, orbit: 'leo' }, m).launchers.find((l) => l.id === 'light')!;
    expect(leo.reason).toMatch(/^Spacecraft is 1\.\d+ kg over capacity$/);
    expect(ev.launchers.find((l) => l.id === 'medium')!.reason).toBe('Compatible');
    expect(ev.criticals.map((c) => c.code)).toContain('no_launcher');
  });
  it('Svalbard on LEO has no contact and explains why', () => {
    const ev = evaluateDesign({ ...GOOD.earth, orbit: 'leo' }, MISSIONS.earth);
    const sva = ev.stations.find((s) => s.id === 'sva')!;
    expect(sva.units).toBe(0);
    expect(sva.usable).toBe(false);
    expect(sva.note).toContain('never rises above the horizon');
    expect(evaluateDesign(GOOD.earth, MISSIONS.earth).stations.find((s) => s.id === 'sva')!.minutesPerDay).toBe(118);
  });
  it('power tooltip lists the parts', () => {
    const ev = evaluateDesign(GOOD.earth, MISSIONS.earth);
    const p = ev.gauges.find((g) => g.id === 'power')!;
    expect(p.tooltip).toMatch(/^Power: Thermal Infrared Camera 5 W \+ Compact Spectrometer 4 W \+ /);
    expect(ev.gauges.map((g) => g.id)).toEqual(['mass', 'power', 'budget', 'data', 'comms', 'time']);
    expect(evaluateDesign(GOOD.lunar, MISSIONS.lunar).gauges.map((g) => g.id)).toContain('fuel');
  });
  it('GOOD designs can launch', () => {
    for (const id of IDS) expect(evaluateDesign(GOOD[id], MISSIONS[id]).canLaunch).toBe(true);
  });
  it('empty design: missing components are critical', () => {
    const ev = evaluateDesign({ ...GOOD.lunar, propulsion: null, radio: null }, MISSIONS.lunar);
    expect(ev.criticals.filter((c) => c.code === 'missing_component').map((c) => c.slot).sort()).toEqual(['propulsion', 'radio']);
  });
  it('Mars schedule over 36 months is critical', () => {
    const d: Design = { ...GOOD.mars, test: 'test_full', computer: 'obc_auto', attitude: 'wheel_red' };
    const ev = evaluateDesign(d, MISSIONS.mars);
    expect(ev.criticals.map((c) => c.code)).toContain('schedule_window');
  });
});

describe('simulation rules', () => {
  it('LEO ends after month 11', () => {
    const m = MISSIONS.earth;
    const d: Design = { ...GOOD.earth, orbit: 'leo', instruments: ['atmos'], stations: ['wal', 'san'] };
    const s = runToEnd(createSim(d, m, 3), m);
    expect(s.telemetry.length).toBeLessThanOrEqual(11);
    if (s.status === 'complete') {
      expect(s.endReason).toBe('decayed');
      expect(s.log.some((l) => l.eventId === 'decay' && l.step === 9)).toBe(true);
    }
  });
  it('every event type can happen', () => {
    const seen = new Set<string>();
    const designs: [MissionId, Design][] = [
      ['earth', { ...GOOD.earth, battery: 'bat_s', launcher: 'medium' }],
      ['lunar', { ...GOOD.lunar, solar: 'wings', propulsion: 'mono_l', orbit: 'frozen', computer: 'obc_std', test: 'test_min', instruments: ['cam', 'mapper'] }],
      ['mars', GOOD.mars],
    ];
    for (const [id, d] of designs) {
      const m = MISSIONS[id];
      for (let seed = 1; seed <= 200; seed++) {
        const s = runToEnd(createSim(d, m, seed), m, seed % 2 ? 'protective' : 'risky');
        s.log.forEach((l) => l.eventId && seen.add(l.eventId));
      }
    }
    for (const e of ['launch_slip', 'deploy', 'glitch', 'flare', 'outage', 'wheel', 'battery_wear', 'insertion', 'aerobrake', 'dsn_busy']) {
      expect(seen, e).toContain(e);
    }
  });
  it('at most one decision per step; decisions pause the sim', () => {
    const m = MISSIONS.earth;
    for (let seed = 1; seed <= 50; seed++) {
      const s = createSim(GOOD.earth, m, seed);
      const steps = s.schedule.map((e) => e.step);
      expect(new Set(steps).size).toBe(steps.length);
      expect(s.schedule.filter((e) => e.id === 'flare').length).toBeGreaterThanOrEqual(1);
    }
  });
  it('Mars: signal delay raises risk without the autonomous computer', () => {
    const m = MISSIONS.mars;
    const find = (d: Design) => {
      for (let seed = 1; seed < 100; seed++) {
        let s = createSim(d, m, seed);
        while (s.status === 'running') s = advance(s, m);
        if (s.status === 'decision' && s.pending!.eventId === 'flare') return s.pending!;
      }
      throw new Error('no flare');
    };
    const slow = find(GOOD.mars);
    // real JPL Horizons light time at the step's calendar date (was a fixed 14 min before)
    expect(slow.signalDelayLine).toMatch(/^Signal delay: \d+(\.\d)? min/);
    expect(slow.options[1].riskChance).toBeCloseTo(0.15 + 0.2, 10);
    const auto: Design = { ...GOOD.mars, computer: 'obc_auto', test: 'test_min' };
    if (evaluateDesign(auto, m).canLaunch) {
      const fast = find(auto);
      expect(fast.signalDelayLine).toBeUndefined();
      expect(fast.options[1].riskChance).toBeCloseTo(0.05, 10);
    }
  });
  it('timeline has 12 steps with phases', () => {
    const m = MISSIONS.mars;
    const s = createSim(GOOD.mars, m, 1);
    const t = getTimeline(s, m);
    expect(t).toHaveLength(12);
    expect(t[0].label).toBe('Months 1–2');
    expect(t[4].kind).toBe('commissioning');
    expect(t[5].kind).toBe('aerobraking');
  });
  it('emergency pass costs reserve', () => {
    const m = MISSIONS.earth;
    for (let seed = 1; seed < 200; seed++) {
      let s = createSim(GOOD.earth, m, seed);
      while (s.status === 'running' || s.status === 'decision') {
        if (s.status === 'decision') {
          const p = s.pending!;
          const before = s.spentInFlightM;
          s = decide(s, m, p.options[0].disabled ? p.options[1].id : p.options[0].id);
          if (p.eventId === 'outage' && !p.options[0].disabled) { expect(s.spentInFlightM - before).toBeCloseTo(0.1, 10); return; }
        } else s = advance(s, m);
      }
    }
    throw new Error('no outage found');
  });
});

describe('stars and unlocks', () => {
  it('stars are capped by outcome', () => {
    expect(computeStars(90, 'success')).toBe(3);
    expect(computeStars(90, 'partial')).toBe(2);
    expect(computeStars(90, 'failure')).toBe(1);
    expect(computeStars(64.9, 'success')).toBe(1);
    expect(computeStars(39, 'success')).toBe(0);
  });
  it('unlock rules', () => {
    const p = emptyProgress();
    expect(isMissionUnlocked('earth', p)).toBe(true);
    expect(isMissionUnlocked('lunar', p)).toBe(false);
    expect(isMissionUnlocked('lunar', { ...p, stars: { earth: 2 } })).toBe(true);
    expect(isMissionUnlocked('mars', { ...p, stars: { earth: 3 } })).toBe(false);
    expect(isMissionUnlocked('mars', { ...p, stars: { lunar: 2 } })).toBe(true);
    expect(isMissionUnlocked('mars', p, true)).toBe(true);
  });
  it('good designs usually succeed', () => {
    for (const id of IDS) {
      const m = MISSIONS[id];
      let ok = 0;
      for (let seed = 1; seed <= 30; seed++) if (buildReport(runToEnd(createSim(GOOD[id], m, seed), m), m).outcome === 'success') ok++;
      expect(ok, id).toBeGreaterThan(15);
    }
  });
});

describe('report voice', () => {
  it('v18_failure only when the spacecraft was lost; survivors with too little data get v18b', () => {
    expect(reportVoice('failure', false)).toBe('v18_failure');
    expect(reportVoice('partial', false)).toBe('v18_failure');
    expect(reportVoice('failure', true)).toBe('v18b_low_data');
    expect(reportVoice('partial', true)).toBe('v17_partial');
    expect(reportVoice('success', true)).toBe('v16_success');
  });
});
