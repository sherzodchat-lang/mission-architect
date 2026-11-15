// Judge fast path: `?demo=1` (or the "Quick demo" button on Overview) loads a known-good Earth design and opens
// Orbit & launch with everything selected. Uses existing store actions only.

import type { Design } from '../data/types';
import { useGameStore } from './gameStore';

/** Top design from tools/balance_check.py earth (also the GOOD earth design in engine.test.ts). */
export const DEMO_DESIGN: Design = {
  instruments: ['thermal', 'spectro'],
  solar: 'track',
  battery: 'bat_m',
  radio: 'sband',
  computer: 'obc_basic',
  attitude: 'wheel',
  propulsion: null,
  burnWire: true,
  orbit: 'sso',
  launcher: 'medium',
  stations: ['wal', 'fai'],
  test: 'test_min',
};

/** Simulation reads this to start at 4x after a demo load. */
let demoSpeed = false;
export const demoStartsFast = (): boolean => demoSpeed;

/** Load the demo design into the store (via normal undoable edit actions) and open Orbit & launch. */
export function loadDemo(): void {
  const st = useGameStore.getState();
  st.selectMission('earth');
  st.startDesign(); // fresh empty Earth design, seed, screen = builder
  // team mode: the demo fills every role's parts, so lift the ownership check while loading
  const team = useGameStore.getState().team;
  if (team) useGameStore.setState({ team: null });
  const d = () => useGameStore.getState().design;
  const s = useGameStore.getState();
  for (const id of DEMO_DESIGN.instruments) if (!d().instruments.includes(id)) s.toggleInstrument(id);
  s.setComponent('solar', DEMO_DESIGN.solar);
  s.setComponent('battery', DEMO_DESIGN.battery);
  s.setComponent('radio', DEMO_DESIGN.radio);
  s.setComponent('computer', DEMO_DESIGN.computer);
  s.setComponent('attitude', DEMO_DESIGN.attitude);
  if (d().burnWire !== DEMO_DESIGN.burnWire) s.setBurnWire(DEMO_DESIGN.burnWire);
  if (d().orbit !== DEMO_DESIGN.orbit) s.setOrbit(DEMO_DESIGN.orbit!);
  if (d().launcher !== DEMO_DESIGN.launcher) s.setLauncher(DEMO_DESIGN.launcher);
  for (const id of d().stations) if (!DEMO_DESIGN.stations.includes(id)) s.toggleStation(id);
  for (const id of DEMO_DESIGN.stations) if (!d().stations.includes(id)) s.toggleStation(id);
  if (d().test !== DEMO_DESIGN.test) s.setTest(DEMO_DESIGN.test!);
  demoSpeed = true;
  if (team) useGameStore.setState({ team, mode: 'team' });
  s.goTo('orbit');
}

/** Called once at start-up: `?demo=1` jumps straight to Orbit & launch. */
export function applyDemoFromUrl(): void {
  try {
    if (new URLSearchParams(globalThis.location?.search ?? '').get('demo') === '1') loadDemo();
  } catch {
    /* ignore */
  }
}
