/** Ground targets for the science frames, and which of them the player's orbit can actually reach. */
import type { MissionId } from '../data'

export interface Target {
  id: string
  name: string
  lat: number
  lon: number
  /** instrument ids that observe this target */
  instruments: string[]
  /** one-line "why scientists look here" */
  why: string
}

export interface OrbitReach {
  /** highest latitude the ground track passes over */
  maxLat: number
  /** zoom levels lost because the orbit is far from the surface (0 = low orbit) */
  zoomOffset: number
  /** short reason shown in captions when zoomOffset < 0 */
  distanceNote?: string
  /** short reason shown when polar targets are out of reach */
  reachNote?: string
}

const T = (id: string, name: string, lat: number, lon: number, instruments: string[], why: string): Target => ({
  id, name, lat, lon, instruments, why,
})

export const TARGETS: Record<MissionId, Target[]> = {
  earth: [
    T('nile', 'Nile Delta, Egypt', 30.8, 31.0, ['imager', 'spectro', 'thermal'], 'Farmland squeezed between two deserts.'),
    T('richat', 'Richat Structure, Sahara', 21.1, -11.4, ['imager', 'thermal', 'atmos'], 'A 40 km eroded dome, a classic orbital landmark.'),
    T('amazon', 'Amazon and Rio Negro, Brazil', -3.1, -60.0, ['imager', 'spectro', 'atmos'], 'The largest rainforest: clearing, rivers and fire smoke.'),
    T('reef', 'Great Barrier Reef, Australia', -18.5, 147.5, ['imager'], 'Coral reefs visible through clear tropical water.'),
    T('himalaya', 'Himalaya and Ganges plain', 28.0, 85.0, ['imager', 'atmos', 'spectro'], 'Snow peaks above one of the haziest plains on Earth.'),
    T('outback', 'Australian outback', -25.0, 133.0, ['thermal', 'imager'], 'Hot, dry interior: a desert heat reference.'),
    T('arabia', 'Arabian Peninsula', 23.0, 47.0, ['thermal', 'atmos'], 'Some of the hottest land surface on the planet.'),
    T('mojave', 'Death Valley and Mojave, USA', 36.0, -116.5, ['thermal', 'imager'], 'A record-heat desert next to cool mountains.'),
    T('cornbelt', 'US Corn Belt, Iowa', 41.5, -93.5, ['spectro', 'imager'], 'Crop growth rises and falls with the seasons.'),
    T('europe', 'Western Europe', 47.5, 2.5, ['spectro', 'atmos'], 'Fields, forests and city haze.'),
    T('westafrica', 'Saharan dust over the Atlantic', 16.0, -20.0, ['atmos', 'imager'], 'Dust plumes cross the ocean towards the Americas.'),
    T('china', 'North China Plain', 34.0, 116.0, ['atmos', 'spectro'], 'Dense industry and farmland: strong aerosol signal.'),
    T('patagonia', 'Patagonian ice fields', -49.5, -73.5, ['imager'], 'Glaciers flowing from the southern Andes.'),
    // beyond 51.6°: only polar / sun-synchronous orbits pass over these
    T('siberia', 'Central Siberia', 62.0, 129.0, ['thermal', 'atmos', 'spectro'], 'Permafrost forests that warm fast in summer.'),
    T('boreal', 'Canadian boreal forest', 56.0, -100.0, ['spectro', 'imager'], 'A vast northern forest belt.'),
    T('greenland', 'Greenland ice sheet', 72.0, -40.0, ['imager', 'thermal'], 'Ice-sheet melt is a key climate measurement.'),
    T('svalbard', 'Svalbard, Arctic Ocean', 78.5, 17.0, ['imager'], 'Glaciers and sea ice in the high Arctic.'),
    T('antarctic', 'Antarctic Peninsula', -66.0, -63.0, ['imager', 'thermal'], 'The fastest-warming part of Antarctica.'),
  ],
  lunar: [
    T('tycho', 'Tycho crater', -43.3, -11.2, ['cam', 'altim', 'mapper'], 'A young crater with bright rays across the near side.'),
    T('copernicus', 'Copernicus crater', 9.6, -20.1, ['cam', 'altim'], 'A 93 km crater with terraced walls.'),
    T('apollo11', 'Mare Tranquillitatis (Apollo 11)', 0.7, 23.5, ['cam', 'mapper'], 'Dark basalt plains where humans first landed.'),
    T('imbrium', 'Mare Imbrium', 33.0, -15.0, ['mapper', 'altim', 'neutron'], 'A giant impact basin flooded with iron-rich lava.'),
    T('aristarchus', 'Aristarchus plateau', 24.0, -48.0, ['mapper', 'cam'], 'The brightest crater next to volcanic glass deposits.'),
    T('orientale', 'Mare Orientale', -19.0, -95.0, ['altim', 'cam'], 'A perfect three-ring basin on the western limb.'),
    T('spa', 'South Pole-Aitken basin', -53.0, 169.0, ['altim', 'mapper'], 'The oldest and deepest basin on the Moon.'),
    T('southpole', 'South polar region', -80.0, 0.0, ['cam', 'altim', 'neutron'], 'Permanently shadowed craters that can trap water ice.'),
    T('northpole', 'North polar region', 78.0, 0.0, ['neutron', 'altim'], 'Cold traps near the north pole.'),
  ],
  mars: [
    T('valles', 'Valles Marineris', -13.9, -59.2, ['cam', 'radar'], 'A canyon system 4,000 km long.'),
    T('olympus', 'Olympus Mons', 18.6, -133.8, ['cam', 'radar'], 'The tallest volcano in the Solar System.'),
    T('jezero', 'Jezero crater', 18.4, 77.5, ['cam'], 'An ancient river delta explored by Perseverance.'),
    T('gale', 'Gale crater', -5.4, 137.8, ['cam', 'fields'], 'Mount Sharp, explored by Curiosity.'),
    T('hellas', 'Hellas basin', -42.4, 70.5, ['cam', 'tracegas', 'radar'], 'A deep impact basin where dust collects.'),
    T('tharsis', 'Tharsis volcanoes', 0.0, -112.0, ['tracegas', 'fields'], 'Giant volcanoes; the crust here has no magnetic stripes.'),
    T('arabia', 'Arabia Terra', 20.0, 10.0, ['tracegas', 'cam'], 'Dusty, ancient highlands.'),
    T('cimmeria', 'Terra Cimmeria', -40.0, 175.0, ['fields', 'cam'], 'The strongest crustal magnetic fields on Mars.'),
    T('sirenum', 'Terra Sirenum', -40.0, -150.0, ['fields'], 'Magnetic stripes in very old crust.'),
    T('arcadia', 'Arcadia Planitia', 45.0, -170.0, ['radar', 'cam'], 'Radar found thick buried ice under these plains.'),
    T('utopia', 'Utopia Planitia', 46.7, 117.5, ['radar', 'tracegas'], 'Plains with a buried ice layer as big as Lake Superior.'),
    // beyond 75°: only the low (near-polar) orbits pass over these
    T('northcap', 'North polar cap', 82.0, 0.0, ['radar', 'cam', 'tracegas'], 'Layered water ice up to 3 km thick.'),
    T('southcap', 'South polar layered deposits', -82.0, 0.0, ['radar', 'cam'], 'Ice and dust layers recording past climate.'),
  ],
}

/** What part of the body the player's orbit can see, and how close. */
export function orbitReach(missionId: MissionId, orbitId: string | null, phase?: string): OrbitReach {
  switch (`${missionId}:${orbitId}`) {
    case 'earth:leo':
      return { maxLat: 51.6, zoomOffset: 0, reachNote: 'Your 51.6° orbit never flies north of 51.6°N or south of 51.6°S.' }
    case 'earth:sso':
      return { maxLat: 82, zoomOffset: 0 }
    case 'lunar:llo':
      return { maxLat: 90, zoomOffset: 0 }
    case 'lunar:frozen':
      return { maxLat: 86, zoomOffset: -1, distanceNote: 'The frozen orbit flies up to 200 km high, so frames cover more ground in less detail.' }
    case 'lunar:nrho':
      return { maxLat: 90, zoomOffset: -3, distanceNote: 'The halo orbit is 3,000-70,000 km out: wide views, very little detail.' }
    case 'mars:capture':
      return {
        maxLat: 75, zoomOffset: -2,
        distanceNote: 'The capture orbit swings out to 45,000 km: frames are wide and coarse.',
        reachNote: 'Your 75° capture orbit never passes over the polar caps.',
      }
    case 'mars:aerobrake':
      return phase === 'aerobraking'
        ? { maxLat: 87, zoomOffset: -2, distanceNote: 'Still aerobraking from a high orbit: coarse frames until the orbit is low.' }
        : { maxLat: 87, zoomOffset: 0 }
    case 'mars:direct':
      return { maxLat: 87, zoomOffset: 0 }
    default:
      return { maxLat: 90, zoomOffset: 0 }
  }
}

/** Earth only: polar and boreal targets are dark (polar night) or snow-covered out of season. */
export function inSeason(missionId: MissionId, target: Target, calendarMonth: number | null): boolean {
  if (missionId !== 'earth' || calendarMonth == null || Math.abs(target.lat) < 55) return true
  const northSummer = calendarMonth >= 4 && calendarMonth <= 9
  return target.lat > 0 ? northSummer : !northSummer
}

export interface TargetChoice {
  reachable: Target[]
  /** targets of this instrument the orbit can never see */
  unreachable: Target[]
}

export function targetsFor(missionId: MissionId, instrumentId: string, reach: OrbitReach, latLimit = 90): TargetChoice {
  const all = TARGETS[missionId].filter((t) => t.instruments.includes(instrumentId))
  const reachable: Target[] = []
  const unreachable: Target[] = []
  for (const t of all) {
    if (Math.abs(t.lat) > latLimit) continue // product does not cover it - not the orbit's fault
    ;(Math.abs(t.lat) <= reach.maxLat ? reachable : unreachable).push(t)
  }
  return { reachable, unreachable }
}

/** Targets the orbit can never see for any of the given instruments (for the "out of reach" lesson). */
export function unreachableTargets(missionId: MissionId, instrumentIds: string[], reach: OrbitReach): Target[] {
  return TARGETS[missionId].filter(
    (t) => Math.abs(t.lat) > reach.maxLat && t.instruments.some((i) => instrumentIds.includes(i)),
  )
}
