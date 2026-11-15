import { describe, expect, it } from 'vitest'
import { MISSIONS } from '../data'
import { createSim, runToEnd } from '../engine'
import { bestFrames, buildFrames, explainEffects, frameEffects, missionDate, type EffectInput } from './frames'
import { INSTRUMENT_LAYER, LAYERS, layerFor, layerUrl } from './layers'
import { inSeason, orbitReach, TARGETS, targetsFor, unreachableTargets } from './targets'
import { planFrame, project } from './tiles'
import { lostBands } from './renderFrame'

describe('layer selection', () => {
  it('maps every instrument of every mission to a real layer', () => {
    for (const m of Object.values(MISSIONS)) {
      for (const inst of m.catalog.instruments) {
        const l = layerFor(m.id, inst.id)
        expect(l, `${m.id}/${inst.id}`).toBeTruthy()
        expect(LAYERS[l!.id]).toBe(l)
      }
    }
  })
  it('uses GIBS for Earth, Moon Trek for the Moon, Mars Trek for Mars', () => {
    expect(layerFor('earth', 'imager')!.id).toBe('MODIS_Terra_CorrectedReflectance_TrueColor')
    expect(layerFor('earth', 'thermal')!.id).toMatch(/Land_Surface_Temp/)
    expect(layerFor('earth', 'spectro')!.id).toMatch(/NDVI/)
    expect(Object.values(INSTRUMENT_LAYER.lunar).every((id) => LAYERS[id].service === 'moontrek')).toBe(true)
    expect(Object.values(INSTRUMENT_LAYER.mars).every((id) => LAYERS[id].service === 'marstrek')).toBe(true)
  })
  it('builds WMTS REST urls', () => {
    expect(layerUrl(LAYERS.MODIS_Terra_CorrectedReflectance_TrueColor, 6, 38, 25, '2026-03-14')).toBe(
      'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/2026-03-14/GoogleMapsCompatible_Level9/6/25/38.jpg',
    )
    expect(layerUrl(LAYERS.LRO_WAC_Mosaic_Global_303ppd_v02, 5, 10, 3, null)).toBe(
      'https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/5/3/10.jpg',
    )
    expect(layerUrl(LAYERS.BlueMarble_ShadedRelief_Bathymetry, 2, 1, 1, '2026-01-01')).toContain('/default/default/')
  })
})

describe('tile maths', () => {
  it('projects lat/lon on both grids', () => {
    const merc = { grid: 'mercator' as const }
    const geo = { grid: 'geographic' as const }
    expect(project(merc, 0, 0, 0)).toEqual({ x: 128, y: 128 })
    expect(project(geo, 0, 0, 0)).toEqual({ x: 256, y: 128 })
    expect(project(geo, 1, 90, -180)).toEqual({ x: 0, y: 0 })
  })
  it('covers the frame with a handful of tiles and wraps longitude', () => {
    const p = planFrame(LAYERS.MODIS_Terra_CorrectedReflectance_TrueColor, 30.8, 31, 6, 480, 320)
    expect(p.tiles.length).toBeGreaterThan(0)
    expect(p.tiles.length).toBeLessThanOrEqual(9)
    const w = planFrame(LAYERS.Mars_Viking_MDIM21_ClrMosaic_global_232m, 45, -179.9, 6, 480, 320)
    expect(w.tiles.every((t) => t.x >= 0 && t.x < 2 ** (w.z + 1))).toBe(true)
  })
  it('lowers zoom near the poles of equirectangular maps', () => {
    const eq = planFrame(LAYERS.LRO_WAC_Mosaic_Global_303ppd_v02, 0, 0, 6, 480, 320)
    const pole = planFrame(LAYERS.LRO_WAC_Mosaic_Global_303ppd_v02, -80, 0, 6, 480, 320)
    expect(pole.z).toBeLessThan(eq.z)
    expect(pole.tiles.length).toBeLessThanOrEqual(16)
  })
  it('clamps zoom to the layer range', () => {
    expect(planFrame(LAYERS.LP_NS_H_Clr_Global_2ppd, -75, 0, -2, 480, 320).z).toBe(1)
  })
})

describe('targets by orbit', () => {
  it('LEO 51.6° never reaches polar targets; SSO does', () => {
    const leo = orbitReach('earth', 'leo')
    const sso = orbitReach('earth', 'sso')
    const leoT = targetsFor('earth', 'imager', leo)
    expect(leoT.reachable.every((t) => Math.abs(t.lat) <= 51.6)).toBe(true)
    expect(leoT.unreachable.map((t) => t.id)).toContain('greenland')
    expect(targetsFor('earth', 'imager', sso).reachable.map((t) => t.id)).toContain('greenland')
    expect(unreachableTargets('earth', ['imager'], sso)).toEqual([])
  })
  it('Mars capture orbit misses the polar caps, low orbit sees them', () => {
    expect(unreachableTargets('mars', ['radar'], orbitReach('mars', 'capture')).map((t) => t.id)).toContain('northcap')
    expect(unreachableTargets('mars', ['radar'], orbitReach('mars', 'direct'))).toEqual([])
  })
  it('far orbits lose detail', () => {
    expect(orbitReach('lunar', 'llo').zoomOffset).toBe(0)
    expect(orbitReach('lunar', 'nrho').zoomOffset).toBeLessThan(orbitReach('lunar', 'frozen').zoomOffset)
    expect(orbitReach('mars', 'aerobrake', 'aerobraking').zoomOffset).toBeLessThan(0)
    expect(orbitReach('mars', 'aerobrake', 'science').zoomOffset).toBe(0)
  })
  it('skips Earth polar targets in polar night', () => {
    const g = TARGETS.earth.find((t) => t.id === 'greenland')!
    expect(inSeason('earth', g, 7)).toBe(true)
    expect(inSeason('earth', g, 12)).toBe(false)
    expect(inSeason('lunar', TARGETS.lunar[0], 12)).toBe(true)
  })
  it('respects product latitude limits (THEMIS ends at 64°)', () => {
    const r = targetsFor('mars', 'fields', orbitReach('mars', 'direct'), LAYERS.THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018.latLimit)
    expect(r.reachable.every((t) => Math.abs(t.lat) <= 64)).toBe(true)
  })
})

const base: EffectInput = {
  quality: [0.2, 0.5, 1],
  pointing: 2,
  flare: 'none',
  damaged: false,
  flareDamage: 0.35,
  lostFrac: 0,
  arrivedFrac: 1,
  health: 100,
  seed: 42,
}

describe('quality -> effects', () => {
  it('fine pointing is sharp, coarse blurs, none smears', () => {
    const fine = frameEffects(base)
    const coarse = frameEffects({ ...base, pointing: 1 })
    const none = frameEffects({ ...base, pointing: 0 })
    expect(fine.blur).toBe(0)
    expect(fine.jitterX).toBe(0)
    expect(coarse.blur).toBeGreaterThan(0)
    expect(none.blur).toBeGreaterThan(coarse.blur)
    expect(none.smear).toBe(1)
    expect(coarse.smear).toBe(0)
  })
  it('non-imaging instruments ignore pointing', () => {
    const e = frameEffects({ ...base, quality: [1, 1, 1], pointing: 0 })
    expect(e.pointingFree).toBe(true)
    expect(e.blur).toBe(0)
    expect(e.smear).toBe(0)
  })
  it('storage overflow, downlink bottleneck and flares map to strips, partial frames and noise', () => {
    const e = frameEffects({ ...base, lostFrac: 0.4, arrivedFrac: 0.5, flare: 'observed' })
    expect(e.lost).toBe(0.4)
    expect(e.arrived).toBe(0.5)
    expect(e.noise).toBeGreaterThan(0.3)
    expect(frameEffects({ ...base, flare: 'observed', flareDamage: 0.05 }).noise).toBeLessThan(e.noise)
    expect(frameEffects({ ...base, arrivedFrac: 0.99 }).arrived).toBe(1)
    expect(frameEffects({ ...base, arrivedFrac: 0.01 }).arrived).toBe(0.25)
    const bands = lostBands(0.4, 7)
    expect(bands.reduce((a, [x, y]) => a + (y - x), 0)).toBeCloseTo(0.4, 5)
  })
  it('explains the blur with the attitude system in plain words', () => {
    const notes = explainEffects(frameEffects({ ...base, pointing: 1 }), {
      instrumentName: 'Multispectral Imager',
      attitudeName: 'Magnetorquers + Sun Sensors',
      radioName: 'S-band',
      computerName: 'Basic Onboard Computer',
      storageGB: 4,
      lostGB: 0,
      pointingLostMonth: null,
      damagedMonth: null,
    })
    expect(notes[0].text).toMatch(/Blurred: Magnetorquers \+ Sun Sensors give only coarse pointing/)
  })
})

describe('frames from a simulation', () => {
  const now = new Date('2026-11-15T00:00:00Z')
  const earth = MISSIONS.earth
  const design = (attitude: string, orbit = 'sso') => ({
    instruments: ['imager'], solar: 'deploy', battery: 'bat_m', radio: 'sband', computer: 'obc_basic',
    attitude, propulsion: null, burnWire: false, orbit, launcher: 'medium', stations: ['wal', 'fai'], test: 'test_std',
  })
  /** first seed (1..30) whose flight completes, so the test does not depend on event luck */
  const fly = (d: ReturnType<typeof design>) => {
    for (let seed = 1; seed <= 30; seed++) {
      const s = runToEnd(createSim(d, earth, seed), earth)
      if (s.status === 'complete' && s.returnedGB > 0) return s
    }
    throw new Error('no seed completed the test mission - update the test design')
  }
  it('maps mission months onto the last year of real dates', () => {
    expect(missionDate(12, 12, now).iso.slice(0, 7)).toBe('2026-09')
    expect(missionDate(1, 12, now).iso.slice(0, 7)).toBe('2025-10')
  })
  it('one frame per contact step, deterministic, fine pointing beats coarse', () => {
    const fine = fly(design('wheel'))
    const coarse = fly(design('torq'))
    const ff = buildFrames(fine, earth, { now })
    const cf = buildFrames(coarse, earth, { now })
    expect(ff.length).toBeGreaterThan(0)
    expect(buildFrames(fine, earth, { now })).toEqual(ff)
    expect(ff.every((f) => f.instrumentId === 'imager')).toBe(true)
    const fImg = ff.find((f) => f.instrumentId === 'imager' && f.effects.pointing === 2)
    const cImg = cf.find((f) => f.instrumentId === 'imager')
    if (fImg) expect(fImg.effects.blur).toBe(0)
    if (cImg && cImg.effects.pointing === 1) expect(cImg.effects.blur).toBeGreaterThan(0)
    expect(bestFrames(ff).length).toBe(1)
    for (const f of ff) if (f.layer.temporal) expect(f.date).toMatch(/^202[5-6]-\d\d-\d\d$/)
  })
  it('LEO frames never show targets above 51.6°', () => {
    const s = fly(design('wheel', 'leo'))
    for (const f of buildFrames(s, earth, { now })) expect(Math.abs(f.target.lat)).toBeLessThanOrEqual(51.6)
  })
})
