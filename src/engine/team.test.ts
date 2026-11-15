import { describe, expect, it } from 'vitest';
import { MISSIONS } from '../data/missions';
import type { Design, MissionId } from '../data/types';
import { computeCore } from './budget';
import { buildReport } from './scoring';
import { createSim, runToEnd } from './simulate';
import {
  assignRoles, canEditKey, createTeam, decisionOwner, roleGoals, sciencePerMonth, TEAM_THRESHOLDS, teamworkScore,
} from './team';
import type { RoleGoal, RoleId } from './team';

const GOOD: Record<MissionId, Design> = {
  earth: { instruments: ['thermal', 'spectro'], solar: 'track', battery: 'bat_m', radio: 'sband', computer: 'obc_basic', attitude: 'wheel', propulsion: null, burnWire: true, orbit: 'sso', launcher: 'medium', stations: ['wal', 'fai'], test: 'test_min' },
  lunar: { instruments: ['cam'], solar: 'fixed', battery: 'bat_m', radio: 'xband', computer: 'obc_std', attitude: 'wheel', propulsion: 'biprop', burnWire: false, orbit: 'llo', launcher: 'lunar_share', stations: ['gold', 'madrid', 'canb'], test: 'test_std' },
  mars: { instruments: ['cam', 'radar'], solar: 'large', battery: 'bat_m', radio: 'ka3', computer: 'obc_rad', attitude: 'wheel', propulsion: 'biprop', burnWire: false, orbit: 'aerobrake', launcher: 'escape_share', stations: ['gold', 'madrid'], test: 'test_min' },
};
const IDS: MissionId[] = ['earth', 'lunar', 'mars'];

const goalsWith = (met: Partial<Record<RoleId, boolean>>): Record<RoleId, RoleGoal> => {
  const g = (role: RoleId): RoleGoal => ({ role, goal: '', checks: [], met: met[role] ?? false });
  return { science: g('science'), systems: g('systems'), comms: g('comms'), manager: g('manager') };
};

describe('team roles (section 9)', () => {
  it('assigns roles for 2, 3 and 4 players', () => {
    expect(assignRoles(4)).toEqual([['science'], ['systems'], ['comms'], ['manager']]);
    expect(assignRoles(3)).toEqual([['science'], ['systems', 'manager'], ['comms']]);
    expect(assignRoles(2)).toEqual([['science', 'comms'], ['systems', 'manager']]);
    for (const n of [2, 3, 4]) expect(assignRoles(n).flat().sort()).toEqual(['comms', 'manager', 'science', 'systems']);
  });

  it('only the owner can edit a part of the design', () => {
    const t = createTeam(['Ana', 'Ben', 'Cy', 'Dee']);
    expect(canEditKey(t, 'instruments')).toBe(true);
    expect(canEditKey(t, 'solar')).toBe(false);
    expect(canEditKey({ ...t, active: 1 }, 'solar')).toBe(true);
    expect(canEditKey({ ...t, active: 2 }, 'stations')).toBe(true);
    expect(canEditKey({ ...t, active: 3 }, 'launcher')).toBe(true);
    expect(canEditKey(null, 'launcher')).toBe(true);
  });

  it('decision owners', () => {
    expect(decisionOwner('flare')).toBe('systems');
    expect(decisionOwner('wheel')).toBe('systems');
    expect(decisionOwner('outage')).toBe('comms');
    expect(decisionOwner('dsn_busy')).toBe('comms');
  });
});

describe('team goals', () => {
  it('science rate is Σ(GB × value × quality) × duty × coverage with mission thresholds', () => {
    for (const id of IDS) {
      const m = MISSIONS[id];
      const core = computeCore(GOOD[id], m);
      const goals = roleGoals(core, m);
      expect(goals.science.met).toBe(sciencePerMonth(core) >= TEAM_THRESHOLDS[id].science);
      expect(goals.systems.checks.length).toBe(id === 'earth' ? 2 : 3);
    }
  });
});

describe('Teamwork score', () => {
  it('4 players: 5 per goal met, minus 3 per override', () => {
    const t = createTeam(['', '', '', '']);
    expect(teamworkScore(t, goalsWith({ science: true, systems: true, comms: true, manager: true })).points).toBe(20);
    expect(teamworkScore(t, goalsWith({ science: true, comms: true })).points).toBe(10);
    expect(teamworkScore({ ...t, overridesUsed: 2 }, goalsWith({ science: true, comms: true })).points).toBe(4);
    expect(teamworkScore({ ...t, overridesUsed: 2 }, goalsWith({})).points).toBe(0);
  });

  it('2-3 players are scaled proportionally', () => {
    const three = createTeam(['', '', '']);
    // Systems + Manager share one player: both must be met
    expect(teamworkScore(three, goalsWith({ science: true, systems: true })).points).toBeCloseTo(20 / 3, 10);
    expect(teamworkScore(three, goalsWith({ science: true, systems: true, manager: true, comms: true })).points).toBe(20);
    const two = createTeam(['', '']);
    expect(teamworkScore(two, goalsWith({ science: true, comms: true })).points).toBe(10);
  });

  it('team report: categories sum to the total, 4th category is Teamwork', () => {
    for (const id of IDS) {
      const m = MISSIONS[id];
      for (const n of [2, 3, 4]) {
        const team = { ...createTeam(Array(n).fill('')), overridesUsed: n === 4 ? 1 : 0 };
        const rep = buildReport(runToEnd(createSim(GOOD[id], m, 1234 + n), m), m, 'team', team);
        const sum = rep.score.categories.reduce((a, c) => a + c.points, 0);
        expect(sum - rep.score.penalty).toBeCloseTo(rep.score.total, 10);
        expect(rep.score.categories[3].label).toBe('Teamwork');
        expect(rep.team).toBeDefined();
        expect(rep.score.categories[3].points).toBeCloseTo(rep.team!.teamwork.points, 10);
        expect(rep.team!.players.length).toBe(n);
      }
    }
  });

  it('solo report is unchanged', () => {
    const m = MISSIONS.earth;
    const s = runToEnd(createSim(GOOD.earth, m, 42), m);
    const rep = buildReport(s, m);
    expect(rep.team).toBeUndefined();
    expect(rep.score.categories[3].label).toBe('Operations');
    expect(rep.score.categories[3].points).toBeCloseTo(20 * (s.returnedGB / s.generatedGB), 10);
  });
});
