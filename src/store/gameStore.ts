// Game state (Zustand). Screens read state and call actions; all game math lives in src/engine.

import { useMemo } from 'react';
import { create } from 'zustand';
import type { OptionId } from '../data/events';
import { MISSIONS } from '../data/missions';
import type { Design, Mission, MissionId, SlotKey } from '../data/types';
import { emptyDesign, evaluateDesign } from '../engine/budget';
import type { DesignEvaluation } from '../engine/budget';
import { newSeed } from '../engine/rng';
import { canEditKey, createTeam, DESIGN_KEY_OWNER, OVERRIDE_TOKENS } from '../engine/team';
import type { TeamState } from '../engine/team';
import { buildReport } from '../engine/scoring';
import type { MissionReport } from '../engine/scoring';
import { advance, createSim, decide, isFinished, runToEnd } from '../engine/simulate';
import type { DecisionPolicy, SimState } from '../engine/simulate';
import {
  isMissionUnlocked, loadDraft, loadProgress, loadSaves, loadTeam, MAX_SAVES, recordResult, saveDraft, saveProgress,
  saveTeam, unlockAllFromUrl, writeSaves,
} from './persistence';
import type { Progress, SavedDesign } from './persistence';

export type Screen = 'menu' | 'missions' | 'builder' | 'orbit' | 'sim' | 'report' | 'howto' | 'nasa';
const HISTORY_LIMIT = 60;

export interface LaunchResult {
  ok: boolean;
  /** 'critical' = blocked; 'needs_confirmation' = warnings present and acceptRisk was not passed. */
  reason?: 'critical' | 'needs_confirmation' | 'no_mission';
  evaluation?: DesignEvaluation;
}

export interface GameState {
  mode: 'solo' | 'team';
  /** Hot-seat team session (GAME_DESIGN 9); null in solo mode. */
  team: TeamState | null;
  screen: Screen;
  missionId: MissionId;
  design: Design;
  past: Design[];
  future: Design[];
  /** Seed for the next / current run. */
  seed: number;
  sim: SimState | null;
  report: MissionReport | null;
  /** Missions unlocked by the last report. */
  newlyUnlocked: MissionId[];
  progress: Progress;
  saves: SavedDesign[];
  unlockAll: boolean;
  lastAutosaveAt: number | null;

  // team mode
  /** Start (or restart) a team session with 2-4 players; names may be empty. */
  startTeam: (names: string[]) => void;
  endTeam: () => void;
  /** Hand the console to the next player. */
  passConsole: () => void;
  setActivePlayer: (index: number) => void;
  /** Mission Manager spends an Override token; false when none are left. */
  spendOverride: () => boolean;
  /** Team mode: may the player at the console change this part of the design? Always true in solo mode. */
  canEdit: (key: keyof Design) => boolean;

  // navigation
  goTo: (screen: Screen) => void;
  selectMission: (id: MissionId) => void;
  /** Start a fresh design for the selected mission and open the builder. */
  startDesign: () => void;
  continueDraft: () => boolean;
  hasDraft: () => boolean;

  // design edits (all go through undo history)
  toggleInstrument: (id: string) => void;
  /** Set a single-choice slot; null clears it. */
  setComponent: (key: Exclude<SlotKey, 'instruments'>, id: string | null) => void;
  /** Select, or clear if already selected. */
  toggleComponent: (key: Exclude<SlotKey, 'instruments'>, id: string) => void;
  setBurnWire: (on: boolean) => void;
  setOrbit: (id: string) => void;
  setLauncher: (id: string | null) => void;
  toggleStation: (id: string) => void;
  setTest: (id: string) => void;
  undo: () => void;
  redo: () => void;
  resetDesign: () => void;

  // flight
  /** Create the sim. Pass acceptRisk=true after the "Launch at your own risk" confirmation. */
  launch: (opts?: { acceptRisk?: boolean }) => LaunchResult;
  simAdvance: () => void;
  simDecide: (optionId: OptionId) => void;
  simSkipToEnd: (policy?: DecisionPolicy) => void;
  /** Open the report (after sim finished). */
  showReport: () => void;
  /** Back to the builder with the same design and a NEW seed. */
  redesign: () => void;

  // saves
  saveCurrentDesign: (name: string) => SavedDesign | null;
  loadSavedDesign: (id: string) => void;
  deleteSavedDesign: (id: string) => void;
  setUnlockAll: (on: boolean) => void;
  isUnlocked: (id: MissionId) => boolean;
}

function mission(id: MissionId): Mission {
  return MISSIONS[id];
}

export const useGameStore = create<GameState>()((set, get) => {
  const initialProgress = loadProgress();
  const initialTeam = loadTeam();

  /** Apply a design change with undo history. `key` = the part being changed (team-mode ownership check). */
  const edit = (fn: (d: Design, m: Mission) => Design | null, key?: keyof Design) => {
    const st = get();
    if (key && !canEditKey(st.team, key)) return;
    const next = fn(structuredClone(st.design), mission(st.missionId));
    if (!next) return;
    set({ design: next, past: [...st.past, st.design].slice(-HISTORY_LIMIT), future: [] });
  };

  const finishIfDone = (sim: SimState) => {
    if (!isFinished(sim)) return {};
    const st = get();
    const report = buildReport(sim, mission(sim.missionId), st.team ? 'team' : 'solo', st.team);
    const before = st.progress;
    const progress = recordResult(before, report);
    saveProgress(progress);
    const newlyUnlocked = (['lunar', 'mars'] as MissionId[]).filter(
      (id) => !isMissionUnlocked(id, before, false) && isMissionUnlocked(id, progress, false),
    );
    const saves = st.saves.map((s) =>
      JSON.stringify(s.design) === JSON.stringify(sim.design) && s.missionId === sim.missionId
        ? { ...s, score: report.totalRounded, stars: report.stars } : s);
    if (saves.some((s, i) => s !== st.saves[i])) writeSaves(saves);
    return { report, progress, newlyUnlocked, saves };
  };

  return {
    mode: initialTeam ? 'team' : 'solo',
    team: initialTeam,
    screen: 'menu',
    missionId: 'earth',
    design: emptyDesign(mission('earth')),
    past: [],
    future: [],
    seed: newSeed(),
    sim: null,
    report: null,
    newlyUnlocked: [],
    progress: initialProgress,
    saves: loadSaves(),
    unlockAll: unlockAllFromUrl(),
    lastAutosaveAt: null,

    startTeam: (names) => {
      const team = createTeam(names.length >= 2 ? names : ['', '']);
      set({ team, mode: 'team' });
    },
    endTeam: () => set({ team: null, mode: 'solo' }),
    passConsole: () => {
      const t = get().team;
      if (!t) return;
      set({ team: { ...t, active: (t.active + 1) % t.players.length } });
    },
    setActivePlayer: (index) => {
      const t = get().team;
      if (!t || index < 0 || index >= t.players.length || index === t.active) return;
      set({ team: { ...t, active: index } });
    },
    spendOverride: () => {
      const t = get().team;
      if (!t || t.overridesUsed >= OVERRIDE_TOKENS) return false;
      set({ team: { ...t, overridesUsed: t.overridesUsed + 1 } });
      return true;
    },
    canEdit: (key) => canEditKey(get().team, key),

    goTo: (screen) => set({ screen }),
    selectMission: (id) => {
      if (!get().isUnlocked(id)) return;
      if (id !== get().missionId) set({ missionId: id, design: emptyDesign(mission(id)), past: [], future: [], sim: null, report: null });
      else set({ missionId: id });
    },
    startDesign: () => {
      const id = get().missionId;
      const t = get().team;
      set({ design: emptyDesign(mission(id)), past: [], future: [], sim: null, report: null, seed: newSeed(), screen: 'builder', ...(t ? { team: { ...t, overridesUsed: 0, active: 0 } } : {}) });
    },
    hasDraft: () => !!loadDraft(),
    continueDraft: () => {
      const d = loadDraft();
      if (!d || !MISSIONS[d.missionId] || !get().isUnlocked(d.missionId)) return false;
      set({ missionId: d.missionId, design: { ...emptyDesign(mission(d.missionId)), ...d.design }, past: [], future: [], sim: null, report: null, screen: 'builder' });
      return true;
    },

    toggleInstrument: (id) => edit((d, m) => {
      if (d.instruments.includes(id)) d.instruments = d.instruments.filter((x) => x !== id);
      else {
        const max = m.categories.flatMap((c) => c.groups).find((g) => g.key === 'instruments')?.max ?? 3;
        if (d.instruments.length >= max) return null;
        d.instruments = [...d.instruments, id];
      }
      return d;
    }, 'instruments'),
    setComponent: (key, id) => edit((d) => {
      if (d[key] === id) return null;
      d[key] = id;
      return d;
    }, key),
    toggleComponent: (key, id) => edit((d) => {
      d[key] = d[key] === id ? null : id;
      return d;
    }, key),
    setBurnWire: (on) => edit((d) => (d.burnWire === on ? null : { ...d, burnWire: on }), 'burnWire'),
    setOrbit: (id) => edit((d, m) => {
      const o = m.orbits.find((x) => x.id === id);
      if (!o || !o.available || d.orbit === id) return null;
      d.orbit = id;
      return d;
    }, 'orbit'),
    setLauncher: (id) => edit((d) => (d.launcher === id ? null : { ...d, launcher: id }), 'launcher'),
    toggleStation: (id) => edit((d, m) => {
      if (d.stations.includes(id)) d.stations = d.stations.filter((x) => x !== id);
      else {
        if (d.stations.length >= m.stationsMax) return null;
        d.stations = [...d.stations, id];
      }
      return d;
    }, 'stations'),
    setTest: (id) => edit((d) => (d.test === id ? null : { ...d, test: id }), 'test'),
    undo: () => {
      const st = get();
      if (!st.past.length) return;
      set({ design: st.past[st.past.length - 1], past: st.past.slice(0, -1), future: [st.design, ...st.future] });
    },
    redo: () => {
      const st = get();
      if (!st.future.length) return;
      set({ design: st.future[0], future: st.future.slice(1), past: [...st.past, st.design] });
    },
    resetDesign: () => edit((d, m) => {
      const fresh = emptyDesign(m);
      const t = get().team;
      if (!t) return fresh;
      // team mode: a player only resets the parts they own
      const out: Record<string, unknown> = { ...d };
      for (const k of Object.keys(DESIGN_KEY_OWNER) as (keyof Design)[]) if (canEditKey(t, k)) out[k] = fresh[k];
      return JSON.stringify(out) === JSON.stringify(d) ? null : (out as unknown as Design);
    }),

    launch: (opts = {}) => {
      const st = get();
      const m = mission(st.missionId);
      const ev = evaluateDesign(st.design, m);
      if (!ev.canLaunch) return { ok: false, reason: 'critical', evaluation: ev };
      if (ev.warnings.length && !opts.acceptRisk) return { ok: false, reason: 'needs_confirmation', evaluation: ev };
      const sim = createSim(st.design, m, st.seed);
      set({ sim, report: null, newlyUnlocked: [], screen: 'sim' });
      return { ok: true, evaluation: ev };
    },
    simAdvance: () => {
      const st = get();
      if (!st.sim) return;
      const sim = advance(st.sim, mission(st.sim.missionId));
      set({ sim, ...finishIfDone(sim) });
    },
    simDecide: (optionId) => {
      const st = get();
      if (!st.sim) return;
      const sim = decide(st.sim, mission(st.sim.missionId), optionId);
      set({ sim, ...finishIfDone(sim) });
    },
    simSkipToEnd: (policy = 'protective') => {
      const st = get();
      if (!st.sim) return;
      const sim = runToEnd(st.sim, mission(st.sim.missionId), policy);
      set({ sim, ...finishIfDone(sim) });
    },
    showReport: () => {
      if (get().report) set({ screen: 'report' });
    },
    redesign: () => {
      const t = get().team;
      set({ seed: newSeed(), sim: null, screen: 'builder', ...(t ? { team: { ...t, overridesUsed: 0, active: 0 } } : {}) });
    },

    saveCurrentDesign: (name) => {
      const st = get();
      const entry: SavedDesign = {
        id: `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
        name: name.trim() || `Design ${st.saves.length + 1}`,
        missionId: st.missionId,
        design: structuredClone(st.design),
        score: st.report && JSON.stringify(st.report.design) === JSON.stringify(st.design) ? st.report.totalRounded : null,
        stars: st.report && JSON.stringify(st.report.design) === JSON.stringify(st.design) ? st.report.stars : null,
        savedAt: Date.now(),
      };
      const saves = [entry, ...st.saves].slice(0, MAX_SAVES);
      writeSaves(saves);
      set({ saves });
      return entry;
    },
    loadSavedDesign: (id) => {
      const st = get();
      const s = st.saves.find((x) => x.id === id);
      if (!s || !st.isUnlocked(s.missionId)) return;
      set({ missionId: s.missionId, design: { ...emptyDesign(mission(s.missionId)), ...structuredClone(s.design) }, past: [], future: [], sim: null, report: null, screen: 'builder' });
    },
    deleteSavedDesign: (id) => {
      const saves = get().saves.filter((x) => x.id !== id);
      writeSaves(saves);
      set({ saves });
    },
    setUnlockAll: (on) => set({ unlockAll: on }),
    isUnlocked: (id) => isMissionUnlocked(id, get().progress, get().unlockAll),
  };
});

// Autosave the design draft (ma_draft) whenever it changes.
useGameStore.subscribe((state, prev) => {
  if (state.design === prev.design && state.missionId === prev.missionId) return;
  if (state.screen === 'menu') return;
  if (saveDraft({ missionId: state.missionId, design: state.design, savedAt: Date.now(), team: state.team })) {
    useGameStore.setState({ lastAutosaveAt: Date.now() });
  }
});

// Persist the team session (ma_team) whenever it changes.
useGameStore.subscribe((state, prev) => {
  if (state.team !== prev.team) saveTeam(state.team);
});

// ---------------------------------------------------------------------------
// Selectors / hooks
// ---------------------------------------------------------------------------

export function getMissionData(): Mission {
  return MISSIONS[useGameStore.getState().missionId];
}

/** The selected mission's data object. */
export function useMission(): Mission {
  const id = useGameStore((s) => s.missionId);
  return MISSIONS[id];
}

/** Live evaluation of the current design (gauges, issues, launcher/station statuses). */
export function useDesignEvaluation(): DesignEvaluation {
  const design = useGameStore((s) => s.design);
  const id = useGameStore((s) => s.missionId);
  return useMemo(() => evaluateDesign(design, MISSIONS[id]), [design, id]);
}

export const selectCanUndo = (s: GameState) => s.past.length > 0;
export const selectCanRedo = (s: GameState) => s.future.length > 0;
