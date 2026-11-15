import { describe, expect, it } from 'vitest';
import { MISSIONS } from '../data/missions';
import { evaluateDesign } from '../engine/budget';
import { DEMO_DESIGN, loadDemo } from './demo';
import { useGameStore } from './gameStore';

describe('judge quick demo', () => {
  it('the demo design is launchable', () => {
    const ev = evaluateDesign(DEMO_DESIGN, MISSIONS.earth);
    expect(ev.designReady).toBe(true);
    expect(ev.canLaunch).toBe(true);
  });
  it('loadDemo fills the store and opens Orbit & launch', () => {
    loadDemo();
    const s = useGameStore.getState();
    expect(s.screen).toBe('orbit');
    expect(s.missionId).toBe('earth');
    expect(s.design).toEqual(DEMO_DESIGN);
  });
});
