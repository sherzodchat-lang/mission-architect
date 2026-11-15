// All mission data. One object per mission (GAME_DESIGN.md sections 5, 5A, 5B).
// Values are cross-checked with tools/balance_check.py. Orbit numbers come from NASA GMAT runs
// (tools/gmat -> src/data/nasa/gmat.json), component numbers are calibrated against the NASA Small Spacecraft
// Technology State of the Art 2025 report and CubeSat 101 (src/data/nasa/components.json). Every change and its
// source is listed in src/data/nasa/calibration.md; prices and budgets stay game-scaled.

import componentRefs from './nasa/components.json';
import gmatRaw from './nasa/gmat.json';
import type { Catalog, CatalogCategory, Mission, MissionId, NasaRef, Orbit, Referenced } from './types';

interface RefEntry { nasaRef: NasaRef; sources: Record<string, string> }
const COMPONENT_REFS = componentRefs.components as unknown as Record<MissionId, Record<keyof Catalog, Record<string, RefEntry>>>;
const PLATFORM_REFS = componentRefs.platforms as unknown as Record<MissionId, RefEntry>;

/** Attaches the NASA reference (tooltip text + url) and per-field provenance from components.json to each catalog item. */
function withComponentRefs(m: Mission): Mission {
  const refs = COMPONENT_REFS[m.id];
  for (const key of Object.keys(m.catalog) as (keyof Catalog)[]) {
    for (const item of m.catalog[key] as Referenced[] & { id: string }[]) {
      const r = refs?.[key]?.[(item as { id: string }).id];
      if (r) { item.nasaRef = r.nasaRef; item.sources = r.sources; }
    }
  }
  return m;
}

const SLOT = {
  instruments: { slotNumber: 1, slotLabel: 'Science payload' },
  computer: { slotNumber: 2, slotLabel: 'Onboard computer' },
  comms: { slotNumber: 3, slotLabel: 'Radio + antenna' },
  attitude: { slotNumber: 4, slotLabel: 'Attitude control' },
  power: { slotNumber: 5, slotLabel: 'Battery + EPS' },
  propulsion: { slotNumber: 6, slotLabel: 'Propulsion' },
} as const;

function categories(withPropulsion: boolean, burnWire: boolean): CatalogCategory[] {
  const cats: CatalogCategory[] = [
    {
      id: 'instruments', label: 'Instruments', ...SLOT.instruments,
      groups: [{ key: 'instruments', label: 'Instruments (1 to 3)', min: 1, max: 3 }], options: [],
    },
    {
      id: 'power', label: 'Power', ...SLOT.power,
      groups: [
        { key: 'solar', label: 'Solar panels', min: 1, max: 1 },
        { key: 'battery', label: 'Battery', min: 1, max: 1 },
      ],
      options: burnWire
        ? [{
            key: 'burnWire', label: 'Redundant burn wire', kg: 0.02, costM: 0.02,
            description:
              'A thin line holds folded panels closed during launch; a small resistor burns through it to release them. Two resistors are more reliable than one.',
          }]
        : [],
    },
    { id: 'comms', label: 'Comms', ...SLOT.comms, groups: [{ key: 'radio', label: 'Radio', min: 1, max: 1 }], options: [] },
    { id: 'computer', label: 'Computer', ...SLOT.computer, groups: [{ key: 'computer', label: 'Onboard computer', min: 1, max: 1 }], options: [] },
    { id: 'attitude', label: 'Attitude control', ...SLOT.attitude, groups: [{ key: 'attitude', label: 'Attitude control', min: 1, max: 1 }], options: [] },
  ];
  if (withPropulsion) {
    cats.push({ id: 'propulsion', label: 'Propulsion', ...SLOT.propulsion, groups: [{ key: 'propulsion', label: 'Propulsion (mass includes fuel)', min: 1, max: 1 }], options: [] });
  }
  return cats;
}

// ---------------------------------------------------------------------------
// Earth Observation CubeSat (section 5)
// ---------------------------------------------------------------------------

const EARTH_LEO_NOTES: Record<string, string> = {
  sva: 'This orbit never rises above the horizon here — the satellite does not fly far enough north.',
  fai: 'Far north of this orbit\'s track: the satellite only skims the horizon, so passes are short.',
};
const EARTH_SSO_NOTES: Record<string, string> = {
  sva: 'A polar orbit passes near the poles on every lap, so polar stations see the satellite many times a day.',
  fai: 'A polar orbit passes near the poles on every lap, so polar stations see the satellite many times a day.',
};

const earthOrbits: Orbit[] = [
  {
    id: 'leo', name: 'LEO · 400 km', short: 'LEO', available: true,
    description: 'Cheaper to reach and lower radiation, but air drag ends the mission after 11 months (NASA GMAT, 2027 solar activity) and polar regions are never seen.',
    altitude: '400 km', inclination: '51.6°', period: '92.6 min',
    sunFraction: 0.66, coverage: 0.78, lastStep: 11, batteryK: 2, dvInsert: 0, dvKeepPerStep: 0, scienceDelaySteps: 0,
    flareExtraDamage: 0, secondFlareChance: 0.15,
    contactUnits: { wal: 1.36, san: 1.07, fai: 0.26, sva: 0 }, stationNotes: EARTH_LEO_NOTES,
  },
  {
    id: 'sso', name: 'Sun-synchronous · 600 km', short: 'SSO', available: true,
    description: 'Consistent local solar time for repeat imaging and global coverage, but more radiation over the poles.',
    altitude: '600 km', inclination: '97.8°', period: '96.7 min',
    sunFraction: 0.64, coverage: 1.0, lastStep: 12, batteryK: 2, dvInsert: 0, dvKeepPerStep: 0, scienceDelaySteps: 0,
    flareExtraDamage: 0.1, secondFlareChance: 0.3,
    contactUnits: { wal: 1.14, san: 1.09, fai: 2.66, sva: 3.92 }, stationNotes: EARTH_SSO_NOTES,
  },
  {
    id: 'geo', name: 'GEO · 35,786 km', short: 'GEO', available: false,
    unavailableReason:
      'Not available for a CubeSat: 60× farther from Earth, so images are far less detailed, the radio link is too weak, and the launch costs many times your budget.',
    description: 'Stays over one spot on the equator, but is far out of reach for a CubeSat.',
    altitude: '35,786 km', inclination: '0°', period: '24 h',
    sunFraction: 0, coverage: 0, lastStep: 12, batteryK: 2, dvInsert: 0, dvKeepPerStep: 0, scienceDelaySteps: 0,
    flareExtraDamage: 0, secondFlareChance: 0, contactUnits: {}, stationNotes: {},
  },
];

const EARTH: Mission = {
  id: 'earth',
  name: 'Earth Observation CubeSat',
  difficulty: 'Easy',
  objective: 'Monitor Earth\'s land, water and atmosphere from a 3U CubeSat and return at least 50 GB of science data.',
  summary: 'Build a shoebox-sized satellite, pick an orbit and a rideshare, and bring home 50 GB of Earth science.',
  limits: { budgetM: 5.0, massKg: 5.0, devMonths: 12, requiredGB: 50, requiredLabel: '50 GB', steps: 12 },
  overAllowed: true,
  platform: { name: '3U CubeSat structure', kg: 0.9, watts: 1, costM: 0.3 },
  baseTime: 3,
  overFee: 0.15,
  overScorePenalty: 2,
  solarFactor: 1.0,
  stepMonths: 1,
  dvRefMass: null,
  scienceTarget: 100,
  timelineLabel: 'Mission timeline • 12 months',
  body: { name: 'Earth', color: '#2f7fd8', glow: '#40a9fd', radiusKm: 6371, distanceKm: 0 },
  categories: categories(false, true),
  catalog: {
    instruments: [
      { kind: 'instrument', id: 'imager', name: 'Multispectral Imager', kg: 1.5, watts: 6, costM: 1.2, months: 3, gbPerMonth: 8, value: 1.0, quality: [0.2, 0.5, 1.0],
        description: 'Takes pictures in several colors of light to map crops, forests and water. Lots of data; needs steady pointing.' },
      { kind: 'instrument', id: 'thermal', name: 'Thermal Infrared Camera', kg: 1.2, watts: 5, costM: 1.0, months: 2, gbPerMonth: 5, value: 1.1, quality: [0.3, 0.7, 1.0],
        description: 'Sees heat instead of light: wildfires, volcanoes, city heat islands and sea temperature.' },
      { kind: 'instrument', id: 'atmos', name: 'Atmospheric Sensor', kg: 0.8, watts: 3, costM: 0.6, months: 1, gbPerMonth: 2, value: 1.5, quality: [0.8, 1.0, 1.0],
        description: 'Measures gases and particles in the air. Small, cheap and forgiving about pointing.' },
      { kind: 'instrument', id: 'spectro', name: 'Compact Spectrometer', kg: 0.6, watts: 4, costM: 0.8, months: 2, gbPerMonth: 3, value: 1.4, quality: [0.3, 0.8, 1.0],
        description: 'Splits light into a rainbow to tell what the surface and air are made of.' },
    ],
    solar: [
      { kind: 'solar', id: 'body', name: 'Body-mounted Panels', kg: 0.2, sunWatts: 8, costM: 0.1, months: 0, deployRisk: 0,
        description: 'Solar cells glued to the outside of the CubeSat. Nothing to unfold, but little power.' },
      { kind: 'solar', id: 'deploy', name: 'Deployable Panels', kg: 0.5, sunWatts: 20, costM: 0.35, months: 1, deployRisk: 0.15, deployRiskRedundant: 0.05,
        description: 'Panels that swing open after launch, more than doubling the power. They must unfold correctly.' },
      { kind: 'solar', id: 'track', name: 'Sun-tracking Panels', kg: 0.8, sunWatts: 30, costM: 0.7, months: 2, deployRisk: 0.25, deployRiskRedundant: 0.08,
        description: 'Large panels on a motor that turns them toward the Sun. Most power, most moving parts.' },
    ],
    battery: [
      { kind: 'battery', id: 'bat_s', name: 'Small Battery', kg: 0.17, wh: 20, costM: 0.08, months: 0, description: 'Enough to keep the core systems alive through each eclipse.' },
      { kind: 'battery', id: 'bat_m', name: 'Medium Battery', kg: 0.33, wh: 40, costM: 0.15, months: 0, description: 'Keeps a small payload running in Earth\'s shadow.' },
      { kind: 'battery', id: 'bat_l', name: 'Large Battery', kg: 0.67, wh: 80, costM: 0.3, months: 0, description: 'Plenty of stored energy for power-hungry instruments in eclipse.' },
    ],
    radio: [
      { kind: 'radio', id: 'uhf', name: 'UHF Radio + Tape Antenna', kg: 0.15, watts: 1, costM: 0.05, months: 0, gbPerUnit: 0.26, pointingFactor: [1, 1, 1],
        description: 'A simple radio with a measuring-tape antenna. Works in any orientation but sends very little data.' },
      { kind: 'radio', id: 'sband', name: 'S-band Radio + Patch Antenna', kg: 0.3, watts: 2, costM: 0.25, months: 1, gbPerUnit: 3, pointingFactor: [0.7, 1, 1],
        description: 'A flat patch antenna with a good data rate. Works best when roughly pointed at the ground.' },
      { kind: 'radio', id: 'xband', name: 'X-band Transmitter + High-gain Antenna', kg: 0.6, watts: 4, costM: 0.6, months: 2, gbPerUnit: 9, pointingFactor: [0.2, 0.6, 1.0],
        description: 'A fast, focused beam. Sends three times more than S-band, but only if aimed precisely.' },
    ],
    computer: [
      { kind: 'computer', id: 'obc_basic', name: 'Basic Onboard Computer', kg: 0.1, watts: 1, costM: 0.08, months: 0, storageGB: 4, flareDamage: 0.6, autonomous: false,
        description: 'A hobby-grade board. Cheap and light, but radiation can easily upset it.' },
      { kind: 'computer', id: 'obc_std', name: 'Standard Onboard Computer', kg: 0.15, watts: 2, costM: 0.2, months: 0, storageGB: 8, flareDamage: 0.35, autonomous: false,
        description: 'A flight-proven CubeSat computer with more memory.' },
      { kind: 'computer', id: 'obc_rad', name: 'Radiation-tolerant Computer', kg: 0.25, watts: 3, costM: 0.55, months: 1, storageGB: 12, flareDamage: 0.1, autonomous: false,
        description: 'Built to survive solar flares, with the largest memory buffer.' },
    ],
    attitude: [
      { kind: 'attitude', id: 'mag', name: 'Passive Magnets', kg: 0.05, watts: 0, costM: 0.02, months: 0, pointing: 0, wheelFaultChance: 0,
        description: 'Magnets that line the satellite up with Earth\'s magnetic field, like a compass. No real pointing.' },
      { kind: 'attitude', id: 'torq', name: 'Magnetorquers + Sun Sensors', kg: 0.2, watts: 1, costM: 0.15, months: 0, pointing: 1, wheelFaultChance: 0,
        description: 'Electromagnets push against Earth\'s field to turn the satellite. Coarse but reliable pointing.' },
      { kind: 'attitude', id: 'wheel', name: 'Reaction Wheels + Star Tracker', kg: 0.6, watts: 3, costM: 0.7, months: 1, pointing: 2, wheelFaultChance: 0.3,
        description: 'Spinning wheels turn the satellite and a star camera checks the aim. Fine pointing, but wheels can fail.' },
    ],
    propulsion: [],
  },
  orbits: earthOrbits,
  defaultOrbit: 'sso',
  launchers: [
    { id: 'light', name: 'Light rideshare', capacityKg: 3.0, costM: 0.15, waitMonths: 0, orbits: ['leo'], coverageMult: 1.0, transferDv: 0, cruiseSteps: 1, canSlip: true,
      note: 'Cheapest ride to LEO. Launch may slip.' },
    { id: 'medium', name: 'Medium rideshare', capacityKg: 6.0, costM: 0.45, waitMonths: 1, orbits: ['leo', 'sso'], coverageMult: 1.0, transferDv: 0, cruiseSteps: 1, canSlip: true,
      note: 'Shared ride to LEO or SSO; 1 month wait. Launch may slip.' },
    { id: 'dedicated', name: 'Dedicated small launcher', capacityKg: 150, costM: 1.5, waitMonths: 0, orbits: ['leo', 'sso'], coverageMult: 1.1, transferDv: 0, cruiseSteps: 1, canSlip: false,
      note: 'Your own rocket: exact orbit (coverage ×1.1), no slips.' },
  ],
  stations: [
    { id: 'wal', name: 'Wallops', location: 'USA', latitude: '38° N', costM: 0.15, description: 'Mid-latitude station on the US east coast.' },
    { id: 'san', name: 'Santiago', location: 'Chile', latitude: '33° S', costM: 0.15, description: 'Southern hemisphere station in the Andes foothills.' },
    { id: 'fai', name: 'Fairbanks', location: 'Alaska', latitude: '65° N', costM: 0.2, description: 'High-latitude station near the Arctic Circle.' },
    { id: 'sva', name: 'Svalbard', location: 'Norway', latitude: '78° N', costM: 0.25, description: 'Arctic station close to the North Pole.' },
  ],
  stationsMin: 1,
  stationsMax: 4,
  defaultStations: ['wal'],
  stationsNote: 'One contact unit is about 30 minutes of radio contact per day.',
  tests: [
    { id: 'test_min', name: 'Minimal testing', description: 'Ship it. Fast and cheap, but software bugs are likely in flight.', costM: 0, months: 0, glitchChance: 0.6, insertionProblemChance: 0, forecastHealthPenalty: 8 },
    { id: 'test_std', name: 'Standard testing', description: 'Functional and vibration tests catch most problems.', costM: 0.15, months: 1, glitchChance: 0.25, insertionProblemChance: 0, forecastHealthPenalty: 3 },
    { id: 'test_full', name: 'Full test campaign', description: 'Thermal-vacuum and end-to-end tests. Almost nothing surprises you in orbit.', costM: 0.35, months: 2, glitchChance: 0.05, insertionProblemChance: 0, forecastHealthPenalty: 0 },
  ],
  defaultTest: 'test_std',
  phases: [
    { steps: 'Month 1', name: 'Launch & deployment', science: '0%' },
    { steps: 'Month 2', name: 'Commissioning', science: '50%' },
    { steps: 'Months 3–12', name: 'Science', science: '100%' },
  ],
  outageEvent: 'outage',
  outageFixCostM: 0.1,
  signalDelay: false,
  rules: ['LEO ends after month 11: air drag pulls the satellite down (NASA GMAT decay run).'],
  massDecimals: 2,
};

// ---------------------------------------------------------------------------
// Lunar Orbiter (section 5A)
// ---------------------------------------------------------------------------

function dsnUnits(factor: number, commercial: number): Record<string, number> {
  return { gold: 1.0 * factor, madrid: 1.0 * factor, canb: 1.0 * factor, com: commercial };
}

const DSN_NOTE =
  'The three Deep Space Network stations sit on three continents about 120° of longitude apart, so together they see the spacecraft around the clock — each one alone about a third of the day.';

const LUNAR: Mission = {
  id: 'lunar',
  name: 'Lunar Orbiter',
  difficulty: 'Medium',
  objective: 'Map the lunar surface and identify future landing sites.',
  summary: 'Fly to the Moon on your own fuel, choose an orbit, and return 500 GB of lunar maps.',
  limits: { budgetM: 25, massKg: 250, devMonths: 24, requiredGB: 500, requiredLabel: '500 GB', steps: 12 },
  overAllowed: true,
  platform: { name: 'Small spacecraft bus', kg: 60, watts: 20, costM: 3.0 },
  baseTime: 8,
  overFee: 0.6,
  overScorePenalty: 2,
  solarFactor: 1.0,
  stepMonths: 1,
  dvRefMass: 200,
  scienceTarget: 720,
  timelineLabel: 'Mission timeline • 12 months',
  body: { name: 'Moon', color: '#b8b4ad', glow: '#d9d4cc', radiusKm: 1737, distanceKm: 384400 },
  categories: categories(true, false),
  catalog: {
    instruments: [
      { kind: 'instrument', id: 'cam', name: 'High-resolution Camera', kg: 35, watts: 60, costM: 4.0, months: 5, gbPerMonth: 60, value: 1.0, quality: [0.2, 0.5, 1.0],
        description: 'Photographs boulders and craters as small as a car. Huge data volume; needs fine pointing.' },
      { kind: 'instrument', id: 'altim', name: 'Laser Altimeter', kg: 18, watts: 45, costM: 3.0, months: 4, gbPerMonth: 9, value: 2.0, quality: [0.3, 0.8, 1.0],
        description: 'Fires laser pulses at the ground and times the echo to build a 3D height map.' },
      { kind: 'instrument', id: 'mapper', name: 'Infrared Mineral Mapper', kg: 22, watts: 40, costM: 3.2, months: 4, gbPerMonth: 36, value: 1.2, quality: [0.3, 0.7, 1.0],
        description: 'Reads the infrared "fingerprint" of rocks to map minerals and traces of water.' },
      { kind: 'instrument', id: 'neutron', name: 'Neutron Spectrometer (water ice)', kg: 10, watts: 12, costM: 1.8, months: 2, gbPerMonth: 3, value: 4.0, quality: [1.0, 1.0, 1.0],
        description: 'Counts neutrons leaking from the soil: fewer means hydrogen, a sign of buried ice. Tiny data, huge value.' },
    ],
    solar: [
      { kind: 'solar', id: 'fixed', name: 'Fixed Solar Array', kg: 12, sunWatts: 250, costM: 0.8, months: 0, deployRisk: 0,
        description: 'Panels fixed to the bus. Nothing to unfold.' },
      { kind: 'solar', id: 'wings', name: 'Deployable Solar Wings', kg: 18, sunWatts: 450, costM: 1.4, months: 1, deployRisk: 0.1,
        description: 'Folded wings that open after launch for almost twice the power.' },
      { kind: 'solar', id: 'track', name: 'Sun-tracking Solar Wings', kg: 28, sunWatts: 750, costM: 2.4, months: 2, deployRisk: 0.15,
        description: 'Large wings on drive motors that follow the Sun.' },
    ],
    battery: [
      { kind: 'battery', id: 'bat_s', name: 'Small Battery', kg: 3.5, wh: 300, costM: 0.3, months: 0, description: 'Covers short eclipses for the core systems.' },
      { kind: 'battery', id: 'bat_m', name: 'Medium Battery', kg: 7, wh: 600, costM: 0.5, months: 0, description: 'Keeps the payload running through most lunar eclipses.' },
      { kind: 'battery', id: 'bat_l', name: 'Large Battery', kg: 13, wh: 1200, costM: 0.9, months: 0, description: 'For long eclipses behind the Moon with a full payload.' },
    ],
    radio: [
      { kind: 'radio', id: 'sband', name: 'S-band Low-gain Radio', kg: 3, watts: 15, costM: 0.4, months: 1, gbPerUnit: 6, pointingFactor: [1, 1, 1],
        description: 'Wide beam that reaches Earth in any orientation, at a slow data rate.' },
      { kind: 'radio', id: 'xband', name: 'X-band Medium-gain Antenna', kg: 8, watts: 35, costM: 1.2, months: 2, gbPerUnit: 30, pointingFactor: [0.6, 1, 1],
        description: 'A good balance of speed and pointing tolerance.' },
      { kind: 'radio', id: 'kaband', name: 'Ka-band High-gain Dish', kg: 15, watts: 60, costM: 2.6, months: 3, gbPerUnit: 90, pointingFactor: [0.1, 0.5, 1.0],
        description: 'A narrow, very fast beam. Must be aimed precisely at Earth.' },
    ],
    computer: [
      { kind: 'computer', id: 'obc_std', name: 'Standard Flight Computer', kg: 2, watts: 10, costM: 0.5, months: 0, storageGB: 60, flareDamage: 0.4, autonomous: false,
        description: 'A capable computer with modest radiation protection.' },
      { kind: 'computer', id: 'obc_rad', name: 'Radiation-hardened Computer', kg: 4, watts: 15, costM: 1.4, months: 1, storageGB: 120, flareDamage: 0.12, autonomous: false,
        description: 'Shielded electronics that shrug off most solar storms.' },
      { kind: 'computer', id: 'obc_mem', name: 'Rad-hard Computer + Mass Memory', kg: 6, watts: 25, costM: 2.2, months: 2, storageGB: 300, flareDamage: 0.08, autonomous: false,
        description: 'Hardened computer with a big recorder to ride out gaps in contact.' },
    ],
    attitude: [
      { kind: 'attitude', id: 'thr', name: 'Thrusters + Sun Sensors', kg: 4, watts: 5, costM: 0.4, months: 0, pointing: 1, wheelFaultChance: 0,
        description: 'Small gas jets turn the spacecraft. Coarse pointing, nothing to wear out.' },
      { kind: 'attitude', id: 'wheel', name: 'Reaction Wheels + Star Tracker', kg: 12, watts: 25, costM: 1.5, months: 1, pointing: 2, wheelFaultChance: 0.3,
        description: 'Fine pointing for cameras and dishes. A wheel can fail.' },
      { kind: 'attitude', id: 'wheel_red', name: 'Redundant Wheels + Dual Star Trackers', kg: 16, watts: 35, costM: 2.4, months: 2, pointing: 2, wheelFaultChance: 0.1,
        description: 'A spare wheel and a second star camera make faults much less likely.' },
    ],
    propulsion: [
      { kind: 'propulsion', id: 'mono_s', name: 'Monopropellant, small tank', kg: 45, costM: 1.5, months: 2, dvAtRef: 560, extraCruiseSteps: 0,
        description: 'Simple, reliable thrusters with a small fuel tank.' },
      { kind: 'propulsion', id: 'mono_l', name: 'Monopropellant, large tank', kg: 80, costM: 2.2, months: 2, dvAtRef: 1090, extraCruiseSteps: 0,
        description: 'The same thrusters with a bigger tank.' },
      { kind: 'propulsion', id: 'biprop', name: 'Bipropellant Engine', kg: 110, costM: 3.6, months: 3, dvAtRef: 2010, extraCruiseSteps: 0,
        description: 'Fuel and oxidizer burn together for the most push per kilogram.' },
    ],
  },
  orbits: [
    { id: 'llo', name: 'Low polar orbit · 100 km', short: 'LLO', available: true,
      description: 'Closest look at the surface, but lumpy lunar gravity keeps pulling the orbit down — it costs fuel every month, and the Moon hides Earth for part of every orbit (about a fifth of the time, NASA GMAT).',
      altitude: '100 km', inclination: '90°', period: '118 min',
      sunFraction: 0.72, coverage: 1.0, lastStep: 12, batteryK: 2.6, dvInsert: 900, dvKeepPerStep: 12, scienceDelaySteps: 0,
      flareExtraDamage: 0, secondFlareChance: 0.3, contactUnits: dsnUnits(0.89, 0.45), stationNotes: {} },
    { id: 'frozen', name: 'Frozen elliptical orbit', short: 'Frozen', available: true,
      description: 'A stable orbit that needs almost no fuel to keep, at the price of flying higher over most of the surface.',
      altitude: '30 × 200 km', inclination: '86°', period: '119 min',
      sunFraction: 0.74, coverage: 0.7, lastStep: 12, batteryK: 2.6, dvInsert: 700, dvKeepPerStep: 1.8, scienceDelaySteps: 0,
      flareExtraDamage: 0, secondFlareChance: 0.3, contactUnits: dsnUnits(0.9, 0.45), stationNotes: {} },
    { id: 'nrho', name: 'Near-rectilinear halo orbit', short: 'NRHO', available: true,
      description: 'Almost always in sunlight and in view of Earth, cheap to reach — but far from the surface most of the time.',
      altitude: '1,500 × 69,500 km', inclination: 'polar', period: '6.6 days',
      sunFraction: 1.0, coverage: 0.35, lastStep: 12, batteryK: 1.0, dvInsert: 450, dvKeepPerStep: 1, scienceDelaySteps: 0,
      flareExtraDamage: 0, secondFlareChance: 0.3, contactUnits: dsnUnits(1.05, 0.53), stationNotes: {} },
  ],
  defaultOrbit: 'frozen',
  launchers: [
    { id: 'gto', name: 'Rideshare to transfer orbit', capacityKg: 300, costM: 2.0, waitMonths: 2, orbits: ['llo', 'frozen', 'nrho'], coverageMult: 1.0, transferDv: 700, cruiseSteps: 3, canSlip: true,
      note: 'Drops you far from the Moon: you fly the rest on your own fuel. Launch may slip.' },
    { id: 'lunar_share', name: 'Lunar rideshare', capacityKg: 280, costM: 4.0, waitMonths: 1, orbits: ['llo', 'frozen', 'nrho'], coverageMult: 1.0, transferDv: 50, cruiseSteps: 1, canSlip: true,
      note: 'Shared ride straight toward the Moon. Launch may slip.' },
    { id: 'dedicated', name: 'Dedicated launcher', capacityKg: 400, costM: 8.0, waitMonths: 0, orbits: ['llo', 'frozen', 'nrho'], coverageMult: 1.1, transferDv: 50, cruiseSteps: 1, canSlip: false,
      note: 'Your own rocket: precise trajectory (coverage ×1.1), no slips.' },
  ],
  stations: [
    { id: 'gold', name: 'Goldstone', location: 'USA', costM: 0.6, description: 'Deep Space Network complex in the California desert.' },
    { id: 'madrid', name: 'Madrid', location: 'Spain', costM: 0.6, description: 'Deep Space Network complex near Madrid.' },
    { id: 'canb', name: 'Canberra', location: 'Australia', costM: 0.6, description: 'Deep Space Network complex near Canberra.' },
    { id: 'com', name: 'Commercial 13 m dish', location: 'Commercial network', costM: 0.3, description: 'A cheaper, smaller commercial antenna with less contact time.' },
  ],
  stationsMin: 1,
  stationsMax: 4,
  defaultStations: ['gold'],
  stationsNote: DSN_NOTE,
  tests: [
    { id: 'test_min', name: 'Minimal testing', description: 'Fast and cheap; problems will show up in flight.', costM: 0, months: 0, glitchChance: 0.6, insertionProblemChance: 0.3, forecastHealthPenalty: 8 },
    { id: 'test_std', name: 'Standard testing', description: 'Catches most software and engine problems before launch.', costM: 0.8, months: 2, glitchChance: 0.25, insertionProblemChance: 0.12, forecastHealthPenalty: 3 },
    { id: 'test_full', name: 'Full test campaign', description: 'Full thermal-vacuum and engine firing tests.', costM: 1.8, months: 4, glitchChance: 0.05, insertionProblemChance: 0.03, forecastHealthPenalty: 0 },
  ],
  defaultTest: 'test_std',
  phases: [
    { steps: 'Steps 1…cruise (1 or 3)', name: 'Launch & cruise', science: '0%' },
    { steps: 'Next step', name: 'Orbit insertion & commissioning', science: '50%' },
    { steps: 'Remaining steps', name: 'Science', science: '100%' },
  ],
  outageEvent: 'dsn_busy',
  outageFixCostM: 0.4,
  signalDelay: false,
  rules: [
    'Propulsion is required: the heavier the spacecraft, the less Δv the same fuel gives.',
    'Low lunar orbit needs fuel every month to stay up.',
  ],
  massDecimals: 0,
};

// ---------------------------------------------------------------------------
// Mars Probe (section 5B)
// ---------------------------------------------------------------------------

const MARS: Mission = {
  id: 'mars',
  name: 'Mars Probe',
  difficulty: 'Hard',
  objective: 'Study the Martian atmosphere and search for signs of past water.',
  summary: 'Catch the launch window, cross 200 million km, and return 1.2 TB from Mars orbit.',
  limits: { budgetM: 60, massKg: 600, devMonths: 36, requiredGB: 1200, requiredLabel: '1.2 TB', steps: 12 },
  overAllowed: false,
  platform: { name: 'Interplanetary spacecraft bus', kg: 150, watts: 40, costM: 8.0 },
  baseTime: 12,
  overFee: 0,
  overScorePenalty: 2,
  solarFactor: 0.43,
  stepMonths: 2,
  dvRefMass: 500,
  scienceTarget: 2700,
  timelineLabel: 'Mission timeline • 24 months',
  body: { name: 'Mars', color: '#c8553a', glow: '#f08a5d', radiusKm: 3390, distanceKm: 225000000 },
  categories: categories(true, false),
  catalog: {
    instruments: [
      { kind: 'instrument', id: 'cam', name: 'Context Camera', kg: 30, watts: 50, costM: 5.0, months: 5, gbPerMonth: 90, value: 1.0, quality: [0.2, 0.5, 1.0],
        description: 'Wide pictures of the surface: river channels, dunes and old lake beds.' },
      { kind: 'instrument', id: 'tracegas', name: 'Atmospheric Trace-gas Spectrometer', kg: 35, watts: 55, costM: 7.0, months: 6, gbPerMonth: 30, value: 2.2, quality: [0.4, 0.8, 1.0],
        description: 'Looks through the air at sunrise and sunset to find rare gases such as methane.' },
      { kind: 'instrument', id: 'radar', name: 'Ground-penetrating Radar (water ice)', kg: 45, watts: 90, costM: 8.0, months: 6, gbPerMonth: 60, value: 1.8, quality: [0.6, 1.0, 1.0],
        description: 'Radio waves that sink into the ground and echo off buried ice layers.' },
      { kind: 'instrument', id: 'fields', name: 'Magnetometer + Particle Package', kg: 8, watts: 10, costM: 2.5, months: 2, gbPerMonth: 4, value: 5.0, quality: [1.0, 1.0, 1.0],
        description: 'Measures how the solar wind strips away the upper atmosphere. Little data, great value.' },
    ],
    solar: [
      { kind: 'solar', id: 'wings', name: 'Deployable Solar Wings', kg: 30, sunWatts: 900, costM: 2.5, months: 1, deployRisk: 0.1,
        description: 'Standard folding wings. Mars gets less than half of Earth\'s sunlight.' },
      { kind: 'solar', id: 'large', name: 'Large Solar Arrays', kg: 50, sunWatts: 1600, costM: 4.0, months: 2, deployRisk: 0.12,
        description: 'Big multi-panel arrays sized for weak Martian sunlight.' },
      { kind: 'solar', id: 'ultra', name: 'Ultra-light Fan Arrays', kg: 70, sunWatts: 2400, costM: 6.0, months: 3, deployRisk: 0.18,
        description: 'Fan-shaped arrays that open like a folding fan. Most power, trickiest deployment.' },
    ],
    battery: [
      { kind: 'battery', id: 'bat_s', name: 'Small Battery', kg: 9, wh: 800, costM: 0.8, months: 0, description: 'Enough for the core systems through eclipses.' },
      { kind: 'battery', id: 'bat_m', name: 'Medium Battery', kg: 18, wh: 1600, costM: 1.4, months: 0, description: 'Keeps a medium payload running behind Mars.' },
      { kind: 'battery', id: 'bat_l', name: 'Large Battery', kg: 33, wh: 3000, costM: 2.4, months: 0, description: 'For long eclipses with power-hungry instruments.' },
    ],
    radio: [
      { kind: 'radio', id: 'x1', name: 'X-band · 1 m dish', kg: 12, watts: 40, costM: 1.5, months: 1, gbPerUnit: 10, pointingFactor: [0.5, 1, 1],
        description: 'A small dish. Forgiving about pointing, but slow at Mars distance.' },
      { kind: 'radio', id: 'x2', name: 'X-band · 2 m high-gain dish', kg: 20, watts: 80, costM: 3.0, months: 2, gbPerUnit: 35, pointingFactor: [0.1, 0.6, 1.0],
        description: 'A large dish with a tight beam. Needs good pointing.' },
      { kind: 'radio', id: 'ka3', name: 'Ka-band · 3 m high-gain dish', kg: 30, watts: 120, costM: 4.5, months: 3, gbPerUnit: 90, pointingFactor: [0, 0.3, 1.0],
        description: 'The fastest link to Earth — useless unless aimed precisely.' },
    ],
    computer: [
      { kind: 'computer', id: 'obc_rad', name: 'Radiation-hardened Computer', kg: 6, watts: 20, costM: 2.0, months: 0, storageGB: 150, flareDamage: 0.15, autonomous: false,
        description: 'Shielded flight computer with a modest recorder.' },
      { kind: 'computer', id: 'obc_mem', name: 'Rad-hard Computer + Mass Memory', kg: 9, watts: 30, costM: 3.5, months: 1, storageGB: 400, flareDamage: 0.1, autonomous: false,
        description: 'Adds a large recorder to store data between contacts.' },
      { kind: 'computer', id: 'obc_auto', name: 'Autonomous Fault-protection Computer', kg: 10, watts: 35, costM: 5.0, months: 3, storageGB: 400, flareDamage: 0.05, autonomous: true,
        description: 'Detects and handles faults on its own while your commands are still on the way.' },
    ],
    attitude: [
      { kind: 'attitude', id: 'thr', name: 'Thrusters + Sun Sensors', kg: 6, watts: 8, costM: 0.8, months: 0, pointing: 1, wheelFaultChance: 0,
        description: 'Gas jets for coarse pointing. Nothing to wear out.' },
      { kind: 'attitude', id: 'wheel', name: 'Reaction Wheels + Star Tracker', kg: 15, watts: 30, costM: 2.0, months: 1, pointing: 2, wheelFaultChance: 0.3,
        description: 'Fine pointing for dishes and cameras. A wheel can fail.' },
      { kind: 'attitude', id: 'wheel_red', name: 'Redundant Wheels + Dual Star Trackers', kg: 22, watts: 40, costM: 3.2, months: 2, pointing: 2, wheelFaultChance: 0.1,
        description: 'Spare wheel and second star camera for a long mission.' },
    ],
    propulsion: [
      { kind: 'propulsion', id: 'mono_l', name: 'Monopropellant, large tank', kg: 120, costM: 3.0, months: 2, dvAtRef: 600, extraCruiseSteps: 0,
        description: 'Simple thrusters with a large tank.' },
      { kind: 'propulsion', id: 'biprop', name: 'Bipropellant Engine', kg: 200, costM: 6.0, months: 3, dvAtRef: 1310, extraCruiseSteps: 0,
        description: 'The classic main engine for braking into Mars orbit.' },
      { kind: 'propulsion', id: 'biprop_xl', name: 'Bipropellant, extended tanks', kg: 280, costM: 8.0, months: 4, dvAtRef: 2060, extraCruiseSteps: 0,
        description: 'The same engine with extra tanks for a direct low orbit.' },
      { kind: 'propulsion', id: 'sep', name: 'Solar-electric Propulsion', kg: 110, costM: 9.0, months: 5, dvAtRef: 2640, extraCruiseSteps: 1,
        description: 'Ion thrusters: very efficient but weak, so the cruise takes one step longer.' },
    ],
  },
  orbits: [
    { id: 'capture', name: 'Elliptical capture orbit', short: 'Capture', available: true,
      description: 'The cheapest way to stay at Mars: one braking burn, then a long looping orbit that is far from the planet most of the time.',
      altitude: '300 × 45,000 km', inclination: '75°', period: '35.5 h',
      sunFraction: 0.99, coverage: 0.5, lastStep: 12, batteryK: 2.0, dvInsert: 1000, dvKeepPerStep: 0, scienceDelaySteps: 0,
      flareExtraDamage: 0, secondFlareChance: 0.3, contactUnits: { gold: 1.3, madrid: 1.3, canb: 1.3 }, stationNotes: {} },
    { id: 'aerobrake', name: 'Low orbit via aerobraking', short: 'Aerobrake', available: true,
      description: 'Dip into the upper atmosphere on every pass and let drag lower the orbit for free — it saves fuel but takes months and carries risk.',
      altitude: '300 km', inclination: '93°', period: '114 min',
      sunFraction: 0.76, coverage: 1.0, lastStep: 12, batteryK: 1.7, dvInsert: 1100, dvKeepPerStep: 0, scienceDelaySteps: 2,
      flareExtraDamage: 0, secondFlareChance: 0.3, contactUnits: { gold: 1.09, madrid: 1.09, canb: 1.09 }, stationNotes: {} },
    { id: 'direct', name: 'Low orbit, direct insertion', short: 'Direct', available: true,
      description: 'Brake all the way into a low orbit with the engine: science starts at once, but it takes twice the fuel.',
      altitude: '300 km', inclination: '93°', period: '114 min',
      sunFraction: 0.76, coverage: 1.0, lastStep: 12, batteryK: 1.7, dvInsert: 2200, dvKeepPerStep: 0, scienceDelaySteps: 0,
      flareExtraDamage: 0, secondFlareChance: 0.3, contactUnits: { gold: 1.09, madrid: 1.09, canb: 1.09 }, stationNotes: {} },
  ],
  defaultOrbit: 'capture',
  launchers: [
    { id: 'gto', name: 'Rideshare to transfer orbit', capacityKg: 700, costM: 8.0, waitMonths: 0, orbits: ['capture', 'aerobrake', 'direct'], coverageMult: 1.0, transferDv: 1500, cruiseSteps: 4, canSlip: false,
      note: 'Cheap ride to high Earth orbit; leave for Mars on your own engine.' },
    { id: 'escape_share', name: 'Shared Mars launch', capacityKg: 650, costM: 14.0, waitMonths: 0, orbits: ['capture', 'aerobrake', 'direct'], coverageMult: 1.0, transferDv: 100, cruiseSteps: 4, canSlip: false,
      note: 'Shared rocket that sends you straight toward Mars.' },
    { id: 'dedicated', name: 'Dedicated launcher', capacityKg: 900, costM: 22.0, waitMonths: 0, orbits: ['capture', 'aerobrake', 'direct'], coverageMult: 1.1, transferDv: 60, cruiseSteps: 4, canSlip: false,
      note: 'Your own rocket: most precise trajectory (coverage ×1.1).' },
  ],
  stations: [
    { id: 'gold', name: 'Goldstone', location: 'USA', costM: 1.5, description: 'Deep Space Network complex in the California desert.' },
    { id: 'madrid', name: 'Madrid', location: 'Spain', costM: 1.5, description: 'Deep Space Network complex near Madrid.' },
    { id: 'canb', name: 'Canberra', location: 'Australia', costM: 1.5, description: 'Deep Space Network complex near Canberra.' },
  ],
  stationsMin: 1,
  stationsMax: 3,
  defaultStations: ['gold'],
  stationsNote: DSN_NOTE,
  tests: [
    { id: 'test_min', name: 'Minimal testing', description: 'Fast and cheap; problems will show up in flight.', costM: 0, months: 0, glitchChance: 0.6, insertionProblemChance: 0.3, forecastHealthPenalty: 8 },
    { id: 'test_std', name: 'Standard testing', description: 'Catches most software and engine problems before launch.', costM: 2.0, months: 3, glitchChance: 0.25, insertionProblemChance: 0.12, forecastHealthPenalty: 3 },
    { id: 'test_full', name: 'Full test campaign', description: 'Full thermal-vacuum and engine firing tests.', costM: 4.0, months: 6, glitchChance: 0.05, insertionProblemChance: 0.03, forecastHealthPenalty: 0 },
  ],
  defaultTest: 'test_std',
  phases: [
    { steps: 'Steps 1…cruise (4 or 5)', name: 'Launch & cruise', science: '0%' },
    { steps: 'Next step', name: 'Orbit insertion & commissioning', science: '50%' },
    { steps: 'Aerobraking only: 2 steps', name: 'Aerobraking', science: '0%' },
    { steps: 'Remaining steps', name: 'Science', science: '100%' },
  ],
  outageEvent: 'dsn_busy',
  outageFixCostM: 1.0,
  signalDelay: true,
  rules: [
    'Weak sunlight: solar panels give 43% of their Earth output.',
    'Launch window: the schedule cannot run over 36 months.',
    'Signal delay: without an autonomous computer, every decision is riskier.',
  ],
  massDecimals: 0,
};

// ---------------------------------------------------------------------------
// NASA GMAT references for orbits and ground stations (src/data/nasa/gmat.json, tools/gmat/run_all.sh)
// ---------------------------------------------------------------------------

interface GmatStation { name: string; minutesPerDay: number; passesPerDay: number }
interface GmatCase {
  periodMin?: number | null; sunFraction?: number; maxUmbraMin?: number; stations?: Record<string, GmatStation>;
  lifetimeMonths?: number | null; stationKeepingDvPerMonthMS?: number; stationKeepingDvPerYearMS?: number; periodDays?: number;
}
const GMAT = gmatRaw.cases as unknown as Record<string, GmatCase>;
const GMAT_URL = 'https://sourceforge.net/projects/gmat/files/GMAT/GMAT-R2026a/';
const GMAT_SRC = 'NASA GMAT R2026a (tools/gmat)';

const pct = (x: number | undefined) => `${Math.round((x ?? 0) * 100)}%`;
const ORBIT_GMAT: Record<string, { case: string; extra?: () => string }> = {
  'earth.leo': { case: 'earth_leo400_geom', extra: () =>
    ` A 4 kg 3U CubeSat falls from 400 km in ${GMAT.earth_leo400_decay_body_nom.lifetimeMonths} months at NASA MSFC's predicted 2027 solar activity (${Math.round(GMAT.earth_leo400_decay_body_hi.lifetimeMonths ?? 0)}–${Math.round(GMAT.earth_leo400_decay_body_lo.lifetimeMonths ?? 0)} months for high–low activity; about ${Math.round(GMAT.earth_leo400_decay_wings_nom.lifetimeMonths ?? 0)} months with large deployed wings).` },
  'earth.sso': { case: 'earth_sso600_geom', extra: () => ' Local time of the ascending node 10:30.' },
  'lunar.llo': { case: 'lunar_llo100_geom', extra: () =>
    ` With GRAIL lunar gravity (GRGM900C), the orbit's lowest point sinks by tens of km a month; holding it costs about ${GMAT.lunar_llo100_keep.stationKeepingDvPerMonthMS} m/s per month (${GMAT.lunar_llo100_keep.stationKeepingDvPerYearMS} m/s per year).` },
  'lunar.frozen': { case: 'lunar_frozen_geom', extra: () =>
    ` In GMAT the orbit stays "frozen" for a year with the low point over the south pole (like LRO's 30 × 200 km orbit); holding it costs about ${GMAT.lunar_frozen_keep.stationKeepingDvPerYearMS} m/s per year.` },
  'lunar.nrho': { case: 'lunar_nrho_geom', extra: () =>
    ` This is the 9:2 L2 halo orbit chosen for Gateway: period ${GMAT.lunar_nrho_geom.periodDays} days, with no eclipse in the GMAT run.` },
  'mars.capture': { case: 'mars_capture_geom' },
  'mars.aerobrake': { case: 'mars_low300_geom' },
  'mars.direct': { case: 'mars_low300_geom' },
};

function attachOrbitRefs(m: Mission): void {
  for (const o of m.orbits) {
    const g = ORBIT_GMAT[`${m.id}.${o.id}`];
    const c = g && GMAT[g.case];
    if (!c) continue;
    const period = c.periodMin ? ` period ${c.periodMin < 600 ? `${c.periodMin.toFixed(1)} min` : `${(c.periodMin / 60).toFixed(1)} h`},` : '';
    const st = Object.values(c.stations ?? {}).map((x) => `${x.name} ${Math.round(x.minutesPerDay)} min/day`).join(', ');
    o.nasaRef = {
      text: `NASA GMAT:${period} in sunlight ${pct(c.sunFraction)} of the time (longest shadow ${Math.round(c.maxUmbraMin ?? 0)} min). Radio contact: ${st}.${g.extra ? g.extra() : ''}`,
      url: GMAT_URL, source: `${GMAT_SRC}, case ${g.case}`,
    };
    o.sources = {
      sunFraction: 'GMAT', contactUnits: 'GMAT', period: 'GMAT', dvInsert: 'game balance',
      coverage: m.id === 'earth' && o.id === 'leo' ? 'geometry (sin 51.6°: latitudes the orbit overflies)' : 'game balance',
      batteryK: 'GMAT (longest shadow) + game balance (30% depth of discharge; 60% for rare eclipses)',
      dvKeepPerStep: m.id === 'lunar' && o.id !== 'nrho' ? 'GMAT' : 'game balance',
      lastStep: m.id === 'earth' && o.id === 'leo' ? 'GMAT' : 'game balance',
    };
  }
  for (const s of m.stations) {
    const parts = m.orbits.flatMap((o) => {
      const g = ORBIT_GMAT[`${m.id}.${o.id}`];
      const x = g && GMAT[g.case]?.stations?.[s.id];
      return x ? [`${o.short} ${Math.round(x.minutesPerDay)} min/day`] : [];
    });
    if (!parts.length) {
      s.nasaRef = { text: 'Commercial antenna: contact time is game balance (half a DSN complex).', url: GMAT_URL, source: 'game balance' };
      s.sources = { costM: 'game balance', contact: 'game balance' };
      continue;
    }
    const mask = m.id === 'earth' ? '5°' : '10°';
    s.nasaRef = { text: `NASA GMAT contact time above ${mask} elevation: ${[...new Set(parts)].join(', ')}.`, url: GMAT_URL, source: GMAT_SRC };
    s.sources = { costM: 'game balance', contact: 'GMAT' };
  }
}

const LAUNCH_REFS = componentRefs.launchers as unknown as Partial<Record<MissionId, RefEntry>>;
for (const m of [EARTH, LUNAR, MARS]) {
  withComponentRefs(m);
  attachOrbitRefs(m);
  const lr = LAUNCH_REFS[m.id];
  for (const l of m.launchers) {
    l.nasaRef = lr?.nasaRef;
    l.sources = { costM: lr ? lr.sources.costM : 'game balance', capacityKg: 'game balance', transferDv: 'game balance' };
  }
}

/** NASA reference for each mission's spacecraft platform (bus). */
export const PLATFORM_NASA_REF: Record<MissionId, NasaRef> = {
  earth: PLATFORM_REFS.earth.nasaRef, lunar: PLATFORM_REFS.lunar.nasaRef, mars: PLATFORM_REFS.mars.nasaRef,
};

export const MISSIONS: Record<MissionId, Mission> = { earth: EARTH, lunar: LUNAR, mars: MARS };
export const MISSION_ORDER: MissionId[] = ['earth', 'lunar', 'mars'];

export function getMission(id: MissionId): Mission {
  return MISSIONS[id];
}
