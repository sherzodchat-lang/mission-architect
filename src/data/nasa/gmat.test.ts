// Drift test: the orbit numbers in src/data/missions.ts must stay equal to the NASA GMAT results in gmat.json
// (see src/data/nasa/calibration.md). Regenerate gmat.json with tools/gmat/run_all.sh, then update missions.ts.
import { describe, expect, it } from 'vitest'
import { MISSIONS } from '../missions'
import type { MissionId } from '../types'
import gmat from './gmat.json'

interface Case {
  periodMin?: number | null
  periodDays?: number
  sunFraction?: number
  maxUmbraMin?: number
  lifetimeMonths?: number
  stations?: Record<string, { minutesPerDay: number }>
}
const C = gmat.cases as unknown as Record<string, Case>

/** game orbit -> GMAT case, contact unit (min/day), depth of discharge for the battery factor (null = not calibrated) */
const MAP: { mission: MissionId; orbit: string; geom: string; unit: number; dod: number | null; perStation: boolean }[] = [
  { mission: 'earth', orbit: 'leo', geom: 'earth_leo400_geom', unit: 30, dod: 0.3, perStation: true },
  { mission: 'earth', orbit: 'sso', geom: 'earth_sso600_geom', unit: 30, dod: null, perStation: true },
  { mission: 'lunar', orbit: 'llo', geom: 'lunar_llo100_geom', unit: 480, dod: 0.3, perStation: false },
  { mission: 'lunar', orbit: 'frozen', geom: 'lunar_frozen_geom', unit: 480, dod: 0.3, perStation: false },
  { mission: 'lunar', orbit: 'nrho', geom: 'lunar_nrho_geom', unit: 480, dod: 0.3, perStation: false },
  { mission: 'mars', orbit: 'capture', geom: 'mars_capture_geom', unit: 480, dod: 0.6, perStation: false },
  { mission: 'mars', orbit: 'aerobrake', geom: 'mars_low300_geom', unit: 480, dod: 0.3, perStation: false },
  { mission: 'mars', orbit: 'direct', geom: 'mars_low300_geom', unit: 480, dod: 0.3, perStation: false },
]

const r2 = (v: number) => Math.round(v * 100) / 100
const orbitOf = (m: MissionId, id: string) => MISSIONS[m].orbits.find((o) => o.id === id)!

describe('missions.ts orbit data matches NASA GMAT (gmat.json)', () => {
  for (const x of MAP) {
    it(`${x.mission} ${x.orbit} ← ${x.geom}`, () => {
      const o = orbitOf(x.mission, x.orbit)
      const g = C[x.geom]
      expect(o.sunFraction).toBeCloseTo(g.sunFraction!, 2)
      if (x.dod != null) expect(o.batteryK).toBeCloseTo(Math.max(1, Math.round((g.maxUmbraMin! / 60 / x.dod) * 10) / 10), 5)
      const st = Object.entries(g.stations ?? {})
      if (x.perStation) {
        for (const [id, s] of st) expect(o.contactUnits[id]).toBeCloseTo(r2(s.minutesPerDay / x.unit), 5)
      } else {
        const avg = st.reduce((a, [, s]) => a + s.minutesPerDay, 0) / st.length
        for (const [id] of st) expect(o.contactUnits[id]).toBeCloseTo(r2(avg / x.unit), 5)
      }
      const p = o.period ?? ''
      if (g.periodMin != null && g.periodMin < 600) {
        const k = p.includes('.') ? 10 : 1
        expect(p).toBe(`${Math.round(g.periodMin * k) / k} min`)
      }
    })
  }

  it('LEO lifetime = nominal GMAT decay run (body-mounted panels)', () => {
    expect(orbitOf('earth', 'leo').lastStep).toBe(Math.round(C.earth_leo400_decay_body_nom.lifetimeMonths!))
  })
})
