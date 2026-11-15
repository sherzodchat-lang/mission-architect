// localStorage helpers (GAME_DESIGN.md section 15). Every access is wrapped in try/catch:
// the game must work without storage.

import type { Design, MissionId } from '../data/types';
import type { MissionReport } from '../engine/scoring';

export const KEYS = { progress: 'ma_progress', draft: 'ma_draft', saves: 'ma_saves' } as const;
export const MAX_SAVES = 5;

export type Stars = 0 | 1 | 2 | 3;

export interface Progress {
  stars: Partial<Record<MissionId, Stars>>;
  /** Best score per mission (rounded). */
  bestScore: Partial<Record<MissionId, number>>;
  /** Discovered analog ids (main menu collection). */
  analogs: string[];
  /** Missions flown to the end (reports produced); main menu "experiments run". Absent in old saves. */
  runs?: number;
}

export interface Draft {
  missionId: MissionId;
  design: Design;
  savedAt: number;
}

export interface SavedDesign {
  id: string;
  name: string;
  missionId: MissionId;
  design: Design;
  /** Last report score for this design, if it has flown. */
  score: number | null;
  stars: Stars | null;
  savedAt: number;
}

function read<T>(key: string): T | null {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): boolean {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function remove(key: string): void {
  try {
    globalThis.localStorage?.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function emptyProgress(): Progress {
  return { stars: {}, bestScore: {}, analogs: [] };
}

export function loadProgress(): Progress {
  const p = read<Partial<Progress>>(KEYS.progress);
  if (!p || typeof p !== 'object') return emptyProgress();
  return {
    stars: p.stars && typeof p.stars === 'object' ? p.stars : {},
    bestScore: p.bestScore && typeof p.bestScore === 'object' ? p.bestScore : {},
    analogs: Array.isArray(p.analogs) ? p.analogs.filter((x) => typeof x === 'string') : [],
    ...(typeof p.runs === 'number' && p.runs >= 0 ? { runs: Math.floor(p.runs) } : {}),
  };
}

export function saveProgress(p: Progress): boolean {
  return write(KEYS.progress, p);
}

/** Merge a finished report into progress (best stars/score, discovered analog). Pure. */
export function recordResult(p: Progress, report: MissionReport): Progress {
  const id = report.missionId;
  return {
    stars: { ...p.stars, [id]: Math.max(p.stars[id] ?? 0, report.stars) as Stars },
    bestScore: { ...p.bestScore, [id]: Math.max(p.bestScore[id] ?? 0, report.totalRounded) },
    analogs: p.analogs.includes(report.analog.id) ? p.analogs : [...p.analogs, report.analog.id],
    runs: experimentsRun(p) + 1,
  };
}

/** Completed simulations; old saves without a counter fall back to the number of missions with stars. */
export function experimentsRun(p: Progress): number {
  return p.runs ?? Object.keys(p.stars).length;
}

export function loadDraft(): Draft | null {
  const d = read<Draft>(KEYS.draft);
  return d && d.missionId && d.design ? d : null;
}

export function saveDraft(d: Draft): boolean {
  return write(KEYS.draft, d);
}

export function clearDraft(): void {
  remove(KEYS.draft);
}

export function loadSaves(): SavedDesign[] {
  const s = read<SavedDesign[]>(KEYS.saves);
  return Array.isArray(s) ? s.slice(0, MAX_SAVES) : [];
}

export function writeSaves(list: SavedDesign[]): boolean {
  return write(KEYS.saves, list.slice(0, MAX_SAVES));
}

/** `?unlock=all` in the URL opens every mission (jury demo). */
export function unlockAllFromUrl(): boolean {
  try {
    return new URLSearchParams(globalThis.location?.search ?? '').get('unlock') === 'all';
  } catch {
    return false;
  }
}

/** ★★ on earth unlocks lunar; ★★ on lunar unlocks mars. */
export function isMissionUnlocked(id: MissionId, p: Progress, unlockAll = false): boolean {
  if (unlockAll || id === 'earth') return true;
  if (id === 'lunar') return (p.stars.earth ?? 0) >= 2;
  return (p.stars.lunar ?? 0) >= 2;
}

export const LOCKED_TEXT = 'Earn ★★ on the previous mission to unlock';
