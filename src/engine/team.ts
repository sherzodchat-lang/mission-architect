// Team mode (GAME_DESIGN.md section 9 and 13.2): roles, ownership, personal goals and the Teamwork score.
// Pure functions, no React. Hot-seat on one device, 2-4 players.

import type { DecisionEventId } from '../data/events';
import type { CategoryId, Design, Mission, MissionId } from '../data/types';
import type { CoreNumbers } from './budget';
import { fmtMoney, fmtPct } from './format';

export type RoleId = 'science' | 'systems' | 'comms' | 'manager';
export const ROLE_ORDER: RoleId[] = ['science', 'systems', 'comms', 'manager'];

export const ROLE_NAME: Record<RoleId, string> = {
  science: 'Science Lead',
  systems: 'Systems Engineer',
  comms: 'Comms & Ground Lead',
  manager: 'Mission Manager',
};
/** Short names for tight places ("Science + Comms"). */
export const ROLE_SHORT: Record<RoleId, string> = { science: 'Science', systems: 'Systems', comms: 'Comms', manager: 'Manager' };

export interface TeamPlayer {
  /** Optional display name (may be empty). */
  name: string;
  roles: RoleId[];
}

export interface TeamState {
  players: TeamPlayer[];
  /** Index of the player at the console. */
  active: number;
  /** Mission Manager override tokens spent this run (max OVERRIDE_TOKENS). */
  overridesUsed: number;
}

export const OVERRIDE_TOKENS = 2;
export const OVERRIDE_PENALTY = 3;
export const TEAMWORK_MAX = 20;

/** Section 9: 4 = one role each; 3 = Manager merged into Systems; 2 = Science + Comms / Systems + Manager. */
export function assignRoles(count: number): RoleId[][] {
  const n = Math.max(2, Math.min(4, Math.round(count)));
  if (n === 4) return [['science'], ['systems'], ['comms'], ['manager']];
  if (n === 3) return [['science'], ['systems', 'manager'], ['comms']];
  return [['science', 'comms'], ['systems', 'manager']];
}

export function createTeam(names: string[]): TeamState {
  const roles = assignRoles(names.length);
  return { players: roles.map((r, i) => ({ name: (names[i] ?? '').trim().slice(0, 24), roles: r })), active: 0, overridesUsed: 0 };
}

export function playerRoleLabel(p: TeamPlayer, short = false): string {
  if (p.roles.length === 1) return ROLE_NAME[p.roles[0]];
  return p.roles.map((r) => (short ? ROLE_SHORT[r] : ROLE_NAME[r])).join(' + ');
}

/** "Systems Engineer (Ana)" or "Systems Engineer". */
export function playerLabel(p: TeamPlayer, short = false): string {
  const role = playerRoleLabel(p, short);
  return p.name ? `${role} (${p.name})` : role;
}

export function playerOf(team: TeamState, role: RoleId): TeamPlayer {
  return team.players.find((p) => p.roles.includes(role)) ?? team.players[0];
}

// ---------------------------------------------------------------------------
// Ownership
// ---------------------------------------------------------------------------

/** Who changes which part of the design. Orbit goes to the Science Lead (it sets coverage). */
export const DESIGN_KEY_OWNER: Record<keyof Design, RoleId> = {
  instruments: 'science',
  orbit: 'science',
  solar: 'systems',
  battery: 'systems',
  burnWire: 'systems',
  computer: 'systems',
  attitude: 'systems',
  propulsion: 'systems',
  radio: 'comms',
  stations: 'comms',
  launcher: 'manager',
  test: 'manager',
};

export const CATEGORY_OWNER: Record<CategoryId, RoleId> = {
  instruments: 'science',
  power: 'systems',
  computer: 'systems',
  attitude: 'systems',
  propulsion: 'systems',
  comms: 'comms',
};

/** Flight plan sections on screen 04. */
export type FlightSection = 'orbit' | 'launcher' | 'stations' | 'test';
export const FLIGHT_OWNER: Record<FlightSection, RoleId> = { orbit: 'science', launcher: 'manager', stations: 'comms', test: 'manager' };

export function canEditKey(team: TeamState | null, key: keyof Design): boolean {
  if (!team) return true;
  const p = team.players[team.active];
  return !!p && p.roles.includes(DESIGN_KEY_OWNER[key]);
}

/** What a role controls, for the team bar ("Power, Computer, Attitude control"). */
export function roleControls(role: RoleId, mission: Mission): string[] {
  const tabs = mission.categories.filter((c) => CATEGORY_OWNER[c.id] === role).map((c) => c.label);
  const extra: Record<RoleId, string[]> = {
    science: ['Orbit'],
    systems: [],
    comms: ['Ground stations'],
    manager: ['Launch vehicle', 'Testing', 'Budget & schedule'],
  };
  return [...tabs, ...extra[role]];
}

/** In-flight decision owner (section 9). */
export function decisionOwner(eventId: DecisionEventId): RoleId {
  return eventId === 'outage' || eventId === 'dsn_busy' ? 'comms' : 'systems';
}

// ---------------------------------------------------------------------------
// Personal goals
// ---------------------------------------------------------------------------

/** Section 9 (Earth) and 13.2 (Moon, Mars) thresholds. */
export const TEAM_THRESHOLDS: Record<MissionId, { science: number; reserveM: number; dvMargin: number | null }> = {
  earth: { science: 9, reserveM: 0.3, dvMargin: null },
  lunar: { science: 45, reserveM: 1.5, dvMargin: 0.05 },
  mars: { science: 130, reserveM: 3.5, dvMargin: 0.05 },
};

export interface GoalCheck {
  label: string;
  value: string;
  ok: boolean;
}

export interface RoleGoal {
  role: RoleId;
  /** One-line goal text ("Power margin ≥ 10% and mass margin ≥ 5%"). */
  goal: string;
  checks: GoalCheck[];
  met: boolean;
}

export interface GoalOverrides {
  /** Final cost including in-flight spending (report). */
  costM?: number;
  /** Final development time (report). */
  devMonths?: number;
}

/** Science per month from the design: Σ(GB/mo × value × quality) × duty × coverage. */
export function sciencePerMonth(core: CoreNumbers): number {
  return core.quality * core.generatedPerMonth;
}

export function roleGoals(core: CoreNumbers, mission: Mission, o: GoalOverrides = {}): Record<RoleId, RoleGoal> {
  const T = TEAM_THRESHOLDS[mission.id];
  const L = mission.limits;
  const goal = (role: RoleId, text: string, checks: GoalCheck[]): RoleGoal => ({ role, goal: text, checks, met: checks.every((c) => c.ok) });

  const sci = sciencePerMonth(core);
  const powerMargin = core.supplyW > 0 ? (core.supplyW - core.demandW) / core.supplyW : -1;
  const massMargin = (L.massKg - core.mass) / L.massKg;
  const sys: GoalCheck[] = [
    { label: 'Power margin', value: fmtPct(powerMargin), ok: powerMargin >= 0.1 },
    { label: 'Mass margin', value: fmtPct(massMargin), ok: massMargin >= 0.05 },
  ];
  if (T.dvMargin !== null && core.dvNeed !== null && core.dvHave !== null) {
    const dv = core.dvNeed > 0 ? (core.dvHave - core.dvNeed) / core.dvNeed : 0;
    sys.push({ label: 'Δv margin', value: fmtPct(dv), ok: dv >= T.dvMargin });
  }
  const cost = o.costM ?? core.costM;
  const time = o.devMonths ?? core.timeMonths;
  const reserve = L.budgetM - cost;

  return {
    science: goal('science', `Science ≥ ${T.science} pts per month`, [
      { label: 'Science rate', value: `${sci.toFixed(1)} / ${T.science}`, ok: sci >= T.science },
    ]),
    systems: goal('systems', `Power margin ≥ 10%, mass margin ≥ 5%${T.dvMargin !== null ? ', Δv margin ≥ 5%' : ''}`, sys),
    comms: goal('comms', 'Downlink keeps up with the data and the buffer fits in memory', [
      { label: 'Downlink', value: `${core.capacityPerMonth.toFixed(1)} / ${core.generatedPerMonth.toFixed(1)} GB/mo`, ok: core.capacityPerMonth > 0 && core.capacityPerMonth >= core.generatedPerMonth - 1e-9 },
      { label: 'Buffer', value: `${core.bufferNeedGB.toFixed(1)} / ${core.storageGB} GB`, ok: core.storageGB > 0 && core.bufferNeedGB <= core.storageGB + 1e-9 },
    ]),
    manager: goal('manager', `Budget left ≥ ${fmtMoney(T.reserveM)} and schedule ≤ ${L.devMonths} months`, [
      { label: 'Budget left', value: fmtMoney(reserve), ok: reserve >= T.reserveM - 1e-9 },
      { label: 'Schedule', value: `${Math.round(time * 10) / 10} / ${L.devMonths} mo`, ok: time <= L.devMonths + 1e-9 },
    ]),
  };
}

export function playerGoalsMet(p: TeamPlayer, goals: Record<RoleId, RoleGoal>): boolean {
  return p.roles.every((r) => goals[r].met);
}

export interface TeamworkResult {
  points: number;
  playersMet: number;
  players: number;
  overrides: number;
  detail: string;
}

/**
 * Teamwork (20): 5 × personal goals met with 4 players; with 2-3 players each player's share is 20 / players
 * (a player meets their goal when every role they hold meets its goal). Minus 3 per Override, never below 0.
 */
export function teamworkScore(team: Pick<TeamState, 'players' | 'overridesUsed'>, goals: Record<RoleId, RoleGoal>): TeamworkResult {
  const n = team.players.length || 1;
  const playersMet = team.players.filter((p) => playerGoalsMet(p, goals)).length;
  const overrides = Math.max(0, Math.min(OVERRIDE_TOKENS, team.overridesUsed));
  const points = Math.max(0, (TEAMWORK_MAX * playersMet) / n - OVERRIDE_PENALTY * overrides);
  const detail = `${playersMet} of ${n} personal goals met${overrides ? ` · ${overrides} override${overrides > 1 ? 's' : ''} −${overrides * OVERRIDE_PENALTY}` : ''}`;
  return { points, playersMet, players: n, overrides, detail };
}

export interface TeamReport {
  players: (TeamPlayer & { met: boolean })[];
  goals: Record<RoleId, RoleGoal>;
  teamwork: TeamworkResult;
}
