// Real missions the player's design can resemble (GAME_DESIGN.md 8.4, matched in engine/scoring.ts `matchAnalogs`).
//
// Every fact below was read on the cited page (fetched with curl, Nov 2026): NSSDCA spacecraft pages
// (nssdc.gsfc.nasa.gov), science.nasa.gov mission pages, NASA ESTO / JPL / nasa.gov articles, NTRS abstracts and,
// for the two ESA missions, esa.int. A field the sources do not state is `null` and is skipped by the matcher —
// nothing is filled in from memory. Missions without enough verifiable detail were dropped (CSIM, CubeRRT, PACE).
//
// Ids of the original 13 analogs are kept so saved collections (`ma_progress.analogs`) stay valid.

import type { MissionId } from './types';

/** Science type of an instrument, shared by the game catalog and the real missions (see `INSTRUMENT_SCIENCE`). */
export type ScienceType =
  | 'imaging' | 'thermal_ir' | 'atmosphere' | 'spectrometer' | 'altimetry' | 'ir_mapping' | 'neutron'
  | 'trace_gas' | 'radar' | 'fields' | 'gravity' | 'dust' | 'radiation' | 'navigation';

/** Orbit class per body. Earth: leo (≈400 km, ISS-like) | sso. Moon: low_polar | low_elliptical_polar | high_elliptical_polar | low_equatorial | nrho. Mars: low_polar | low_inclined | elliptical | polar | flyby. */
export type OrbitClass =
  | 'leo' | 'sso'
  | 'low_polar' | 'low_elliptical_polar' | 'high_elliptical_polar' | 'low_equatorial' | 'nrho'
  | 'low_inclined' | 'elliptical' | 'polar' | 'flyby';

/** fine = reaction wheels + star tracker (or better); three_axis = 3-axis stabilised, sensors unstated or Sun sensors; spin = spin-stabilised. */
export type PointingClass = 'fine' | 'three_axis' | 'spin';
export type Band = 'uhf' | 's' | 'x' | 'ka';
export type PropulsionClass = 'mono' | 'biprop' | 'cold_gas' | 'sep';
export type SizeClass = '3U' | '6U' | '12U';
export type AnalogOutcome = 'success' | 'partial' | 'lost';

export interface AnalogInstrument {
  type: ScienceType;
  /** Real instrument name as the source gives it. */
  name: string;
}

export interface AnalogSource {
  label: string;
  url: string;
}

export interface AnalogFacts {
  launchYear: number | null;
  /** Launch / fuelled mass where the source states it. */
  massKg: number | null;
  /** CubeSat form factor (Earth CubeSats, CAPSTONE, MarCO). */
  size: SizeClass | null;
  /** Plain size line, e.g. '6U CubeSat, about 10 kg'. */
  sizeText: string;
  orbit: { classes: OrbitClass[]; text: string } | null;
  /** Reached its low orbit by aerobraking (Mars). */
  aerobraking: boolean | null;
  instruments: AnalogInstrument[];
  pointing: { cls: PointingClass; text: string } | null;
  comms: { bands: Band[]; text: string } | null;
  propulsion: { cls: PropulsionClass; text: string } | null;
  solar: { cls: 'body' | 'deployable'; text: string } | null;
  power: string | null;
  goal: string;
  outcome: { cls: AnalogOutcome; text: string } | null;
}

export interface Analog {
  id: string;
  mission: MissionId;
  name: string;
  /** Short name for tiles. */
  short: string;
  /** e.g. '3U CubeSat · 2019' */
  tagline: string;
  /** 1–2 conservative factual sentences. */
  text: string;
  /** Locked-tile hint in the collection (never gives the name away). */
  teaser: string;
  /** "Explore the real mission" page (NASA where one exists). */
  url: string;
  agency: string;
  facts: AnalogFacts;
  /** Every page the facts were read from. */
  sources: AnalogSource[];
  /** Curated NASA Image and Video Library id (verified), loaded live via images-api.nasa.gov. */
  image: { nasaId: string; caption?: string } | null;
  /** Fallback live search for the NASA Image Library when no curated id exists. */
  imageQuery: string;
}

const NSSDCA = (id: string) => ({ label: `NSSDCA ${id}`, url: `https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=${id}` });
const SCI = (slug: string, label = 'NASA Science mission page') => ({ label, url: `https://science.nasa.gov/mission/${slug}/` });
const NTRS = (id: string, label: string) => ({ label: `NTRS: ${label}`, url: `https://ntrs.nasa.gov/citations/${id}` });

export const ANALOG_LIST: Analog[] = [
  // ------------------------------------------------------------------ Earth
  {
    id: 'harp', mission: 'earth', name: 'HARP', short: 'HARP', agency: 'NASA ESTO / UMBC', tagline: '3U CubeSat · 2019',
    teaser: 'Clouds and aerosols',
    text: 'The Hyper-Angular Rainbow Polarimeter imaged clouds and aerosols from many angles at once, the first wide-angle imaging polarimeter to orbit Earth. Built for three months, it returned data for two years.',
    url: 'https://esto.nasa.gov/harp-instrument-deorbits-after-pioneering-novel-atmospheric-observation-technologies',
    facts: {
      launchYear: 2019, massKg: null, size: '3U', sizeText: '3U CubeSat, "smaller than a shoebox"',
      orbit: { classes: ['leo'], text: 'about 400 km, after a ride to the ISS (Nov 2019)' }, aerobraking: null,
      instruments: [{ type: 'imaging', name: 'wide-angle imaging polarimeter' }, { type: 'atmosphere', name: 'cloud and aerosol polarimetry' }],
      pointing: null, comms: null, propulsion: null, solar: null, power: null,
      goal: 'Measure the size, shape and make-up of cloud droplets and aerosols from many viewing angles.',
      outcome: { cls: 'success', text: 'Collected data for two years against a three-month requirement; deorbited after 777 days.' },
    },
    sources: [{ label: 'NASA ESTO: HARP deorbits after pioneering mission', url: 'https://esto.nasa.gov/harp-instrument-deorbits-after-pioneering-novel-atmospheric-observation-technologies' }],
    image: { nasaId: 'iss061e154749', caption: 'The ISS CubeSat deployer that released HARP, Feb 2020' },
    imageQuery: 'HARP CubeSat',
  },
  {
    id: 'hyti', mission: 'earth', name: 'HyTI', short: 'HyTI', agency: 'NASA ESTO / Univ. of Hawaiʻi', tagline: '6U CubeSat · 2023',
    teaser: 'Thermal imaging',
    text: 'The Hyperspectral Thermal Imager tested detailed long-wave infrared imaging from a 6U CubeSat, using a spectrometer with no moving parts to watch volcanic gases and soil moisture.',
    url: 'https://esto.nasa.gov/invest/hyti/',
    facts: {
      launchYear: 2023, massKg: null, size: '6U', sizeText: '6U CubeSat',
      orbit: { classes: ['leo'], text: '430 km orbit' }, aerobraking: null,
      instruments: [{ type: 'thermal_ir', name: 'hyperspectral thermal imager, 8.0–10.7 µm, aiming at 60 m pixels' }],
      pointing: null, comms: null, propulsion: null, solar: null, power: null,
      goal: 'Show that a CubeSat can take high-resolution thermal infrared spectra to track volcanic gases and crop water use.',
      outcome: null,
    },
    sources: [
      { label: 'NASA ESTO: HyTI', url: 'https://esto.nasa.gov/invest/hyti/' },
      NTRS('20230006928', 'Digital MWIR/LWIR focal planes for SmallSat applications (HyTI detector)'),
    ],
    image: null, imageQuery: 'HyTI CubeSat',
  },
  {
    id: 'icecube', mission: 'earth', name: 'IceCube', short: 'IceCube', agency: 'NASA Goddard', tagline: '3U CubeSat · 2017',
    teaser: 'Ice in clouds',
    text: 'IceCube flew an 883 GHz submillimeter-wave radiometer to measure ice in clouds. Launched on 19 Apr 2017 and operated until 3 Oct 2018, it returned the first global map of cloud ice at that frequency.',
    url: 'https://science.nasa.gov/mission/icecube/',
    facts: {
      launchYear: 2017, massKg: null, size: '3U', sizeText: '3U CubeSat',
      orbit: { classes: ['leo'], text: 'low Earth orbit (launched 19 Apr 2017, mission ended 3 Oct 2018)' }, aerobraking: null,
      instruments: [{ type: 'atmosphere', name: '883 GHz cloud-ice radiometer' }],
      pointing: null, comms: null, propulsion: null, solar: null, power: null,
      goal: 'Space-qualify a commercial submillimeter-wave receiver for measuring cloud ice.',
      outcome: { cls: 'success', text: 'Operated until 3 Oct 2018; all mission objectives achieved.' },
    },
    sources: [SCI('icecube'), NSSDCA('1998067LN'), NTRS('20210012947', 'IceCube: spaceflight demonstration of 883-GHz cloud radiometer')],
    image: null, imageQuery: 'IceCube CubeSat',
  },
  {
    id: 'minxss', mission: 'earth', name: 'MinXSS', short: 'MinXSS', agency: 'NASA / Univ. of Colorado', tagline: 'CubeSats · Solar X-rays',
    teaser: 'Solar X-rays',
    text: 'The Miniature X-ray Solar Spectrometer CubeSats measured soft X-rays from solar flares, which disturb the ionosphere where radio and GPS signals travel.',
    url: 'https://science.nasa.gov/mission/minxss/',
    facts: {
      launchYear: null, massKg: null, size: null, sizeText: 'CubeSat series',
      orbit: { classes: ['leo'], text: 'low Earth orbit' }, aerobraking: null,
      instruments: [{ type: 'spectrometer', name: 'soft X-ray solar spectrometer' }],
      pointing: null, comms: null, propulsion: null, solar: null, power: null,
      goal: 'Measure soft X-rays from solar flares and how they affect the ionosphere.',
      outcome: { cls: 'success', text: 'MinXSS-1 succeeded and led to MinXSS-2.' },
    },
    sources: [SCI('minxss'), NTRS('21677650990236', 'MinXSS-2 mission overview: improvements from the successful MinXSS-1')],
    image: null, imageQuery: 'MinXSS',
  },
  {
    id: 'dellingr', mission: 'earth', name: 'Dellingr', short: 'Dellingr', agency: 'NASA Goddard', tagline: '6U CubeSat · 2017',
    teaser: 'Many instruments',
    text: 'Dellingr carried two magnetometers and an ion-neutral mass spectrometer to study the ionosphere. It was built to prove that a CubeSat can host NASA-class science reliably, and recovered from a dead battery and a faulty Sun sensor.',
    url: 'https://www.nasa.gov/solar-system/dellingr-the-little-cubesat-that-could/',
    facts: {
      launchYear: 2017, massKg: null, size: '6U', sizeText: '6U CubeSat',
      orbit: { classes: ['leo'], text: 'about 400 km (250 miles), deployed from the ISS on 20 Nov 2017' }, aerobraking: null,
      instruments: [
        { type: 'spectrometer', name: 'Ion Neutral Mass Spectrometer (INMS)' },
        { type: 'fields', name: 'two magnetometers' },
      ],
      pointing: { cls: 'three_axis', text: 'reaction wheels steered by Sun sensors' },
      comms: null, propulsion: null,
      solar: { cls: 'body', text: 'solar cells cover every surface' }, power: null,
      goal: 'Build a resilient 6U CubeSat for NASA-class heliophysics science at lower cost.',
      outcome: { cls: 'success', text: 'Recovered from a dead battery at deployment and a faulty Sun sensor, then returned science data.' },
    },
    sources: [
      { label: 'NASA: Dellingr, the little CubeSat that could', url: 'https://www.nasa.gov/solar-system/dellingr-the-little-cubesat-that-could/' },
      NSSDCA('1998067NJ'),
    ],
    image: { nasaId: 'GSFC_20170427_2017-13815_008-012', caption: 'Dellingr in the lab before launch' },
    imageQuery: 'Dellingr CubeSat',
  },
  {
    id: 'asteria', mission: 'earth', name: 'ASTERIA', short: 'ASTERIA', agency: 'NASA JPL / MIT', tagline: '6U CubeSat · 2017',
    teaser: 'Precision pointing',
    text: 'ASTERIA showed that a 10 kg CubeSat can hold a telescope steady to better than half an arcsecond, the precision needed to watch stars dim as planets pass in front of them.',
    url: 'https://www.jpl.nasa.gov/missions/arcsecond-space-telescope-enabling-research-in-astrophysics-asteria/',
    facts: {
      launchYear: 2017, massKg: 10, size: '6U', sizeText: '6U CubeSat, about 10 kg',
      orbit: { classes: ['leo'], text: 'low Earth orbit, deployed from the ISS on 20 Nov 2017' }, aerobraking: null,
      instruments: [{ type: 'imaging', name: 'small telescope with a CMOS imager on a piezo stage' }],
      pointing: { cls: 'fine', text: 'reaction wheels plus guide-star tracking: under 0.5 arcsec RMS' },
      comms: null, propulsion: null, solar: null, power: null,
      goal: 'Demonstrate arcsecond pointing and stable detector temperature for precision photometry.',
      outcome: { cls: 'success', text: 'Met all primary requirements by Feb 2018; three extensions until contact was lost in Dec 2019.' },
    },
    sources: [
      { label: 'NASA JPL: ASTERIA', url: 'https://www.jpl.nasa.gov/missions/arcsecond-space-telescope-enabling-research-in-astrophysics-asteria/' },
      NTRS('20210006798', 'On-orbit, subarcsecond pointing of the 6U ASTERIA CubeSat'),
    ],
    image: { nasaId: 'PIA23124', caption: 'Los Angeles, imaged by ASTERIA in March 2019' },
    imageQuery: 'ASTERIA CubeSat',
  },
  {
    id: 'raincube', mission: 'earth', name: 'RainCube', short: 'RainCube', agency: 'NASA JPL', tagline: '6U CubeSat · 2018',
    teaser: 'Radar for rain',
    text: 'RainCube flew a 35.75 GHz Ka-band precipitation radar with a fold-out dish in a 6U CubeSat, the first radar on a CubeSat, and collected storm data from orbit.',
    url: 'https://www.jpl.nasa.gov/missions/radar-in-a-cubesat-raincube/',
    facts: {
      launchYear: 2018, massKg: null, size: '6U', sizeText: '6U CubeSat',
      orbit: { classes: ['leo'], text: 'deployed from the ISS on 13 Jul 2018' }, aerobraking: null,
      instruments: [{ type: 'atmosphere', name: 'Ka-band precipitation profiling radar, 0.5 m deployable antenna' }],
      pointing: { cls: 'three_axis', text: 'radar points straight down (nadir)' },
      comms: null, propulsion: null, solar: null, power: null,
      goal: 'Validate a miniature Ka-band rain radar and deployable antenna for future constellations.',
      outcome: { cls: 'success', text: 'Became the first spaceborne radar in a CubeSat and collected its first storm data in 2018.' },
    },
    sources: [NSSDCA('1998067NW'), NTRS('20210007697', 'RainCube, a Ka-band precipitation radar in a 6U CubeSat'), NTRS('20220002799', 'RainCube - first spaceborne radar in a CubeSat')],
    image: { nasaId: 'PIA22457', caption: 'RainCube with its antenna deployed' },
    imageQuery: 'RainCube',
  },
  {
    id: 'tempestd', mission: 'earth', name: 'TEMPEST-D', short: 'TEMPEST-D', agency: 'NASA', tagline: '6U CubeSat · 2018',
    teaser: 'Storms in microwaves',
    text: 'TEMPEST-D tested microwave radiometers on a 6U CubeSat to watch clouds and rain develop. It worked for more than 1.5 years and imaged Hurricane Dorian in 2019.',
    url: 'https://www.jpl.nasa.gov/missions/temporal-experiment-for-storms-and-tropical-systems-demonstration-tempest-d/',
    facts: {
      launchYear: 2018, massKg: null, size: '6U', sizeText: '6U CubeSat (Blue Canyon bus)',
      orbit: { classes: ['leo'], text: 'deployed from the ISS on 13 Jul 2018' }, aerobraking: null,
      instruments: [{ type: 'atmosphere', name: 'microwave and millimeter-wave radiometers for clouds and precipitation' }],
      pointing: null, comms: null, propulsion: null, solar: null, power: null,
      goal: 'Reduce risk for a six-satellite TEMPEST constellation timing storm growth.',
      outcome: { cls: 'success', text: 'Performed well after 1.5 years on orbit; imaged Hurricane Dorian (2019).' },
    },
    sources: [NSSDCA('1998067NV'), NTRS('20220000908', 'TEMPEST-D performance after 1.5 years on-orbit')],
    image: { nasaId: 'PIA22458', caption: 'TEMPEST-D with solar panels deployed' },
    imageQuery: 'TEMPEST-D',
  },

  // ------------------------------------------------------------------ Moon
  {
    id: 'lro', mission: 'lunar', name: 'Lunar Reconnaissance Orbiter', short: 'LRO', agency: 'NASA Goddard', tagline: 'Lunar orbiter · since 2009',
    teaser: 'Moon mapper',
    text: 'LRO maps the Moon from a low polar orbit with cameras, a laser altimeter, a neutron detector and a thermal radiometer, helping to pick safe landing sites. It is the longest-lived lunar orbiter.',
    url: 'https://science.nasa.gov/mission/lro/',
    facts: {
      launchYear: 2009, massKg: 1846, size: null, sizeText: 'about 1,846 kg at launch, 92 kg of instruments',
      orbit: { classes: ['low_polar', 'low_elliptical_polar'], text: '50 km circular polar orbit, then a low-maintenance ~30 × 180 km orbit from Sept 2010' },
      aerobraking: null,
      instruments: [
        { type: 'imaging', name: 'LROC narrow- and wide-angle cameras' },
        { type: 'altimetry', name: 'LOLA laser altimeter' },
        { type: 'neutron', name: 'LEND neutron detector' },
        { type: 'thermal_ir', name: 'Diviner thermal radiometer' },
        { type: 'spectrometer', name: 'LAMP far-UV mapper' },
        { type: 'radiation', name: 'CRaTER cosmic-ray telescope' },
        { type: 'radar', name: 'Mini-RF radar' },
      ],
      pointing: { cls: 'three_axis', text: 'three-axis stabilised' },
      comms: { bands: ['s', 'ka'], text: 'S-band, plus Ka-band at 100–300 Mbps for science' },
      propulsion: null,
      solar: null,
      power: '10.7 m² solar array, about 800 W orbit average; 80 Ah Li-ion battery',
      goal: 'Map the Moon and characterise landing sites, resources and radiation for future human missions.',
      outcome: { cls: 'success', text: 'Still operating after more than 15 years.' },
    },
    sources: [SCI('lro'), NSSDCA('2009-031A')],
    image: { nasaId: 'PIA18163' }, imageQuery: 'Lunar Reconnaissance Orbiter',
  },
  {
    id: 'lunar_prospector', mission: 'lunar', name: 'Lunar Prospector', short: 'Prospector', agency: 'NASA Ames', tagline: 'Lunar orbiter · 1998–1999',
    teaser: 'Hunts water ice',
    text: 'Lunar Prospector mapped the Moon\'s composition from a 100 km polar orbit and found evidence of water ice at both poles with its neutron spectrometer. The spin-stabilised drum needed no pointing.',
    url: 'https://science.nasa.gov/mission/lunar-prospector/',
    facts: {
      launchYear: 1998, massKg: 296, size: null, sizeText: 'about 296 kg fuelled, a 1.4 m drum',
      orbit: { classes: ['low_polar'], text: '100 km circular polar orbit, 90°, 118 min' }, aerobraking: null,
      instruments: [
        { type: 'neutron', name: 'Neutron Spectrometer' },
        { type: 'spectrometer', name: 'Gamma Ray and Alpha Particle Spectrometers' },
        { type: 'fields', name: 'Magnetometer and Electron Reflectometer' },
        { type: 'gravity', name: 'Doppler gravity experiment' },
      ],
      pointing: { cls: 'spin', text: 'spin-stabilised at 12 rpm; omnidirectional instruments' },
      comms: { bands: ['s'], text: 'S-band, medium- and low-gain antennas' },
      propulsion: { cls: 'mono', text: 'six 22 N hydrazine monopropellant thrusters' },
      solar: { cls: 'body', text: 'body-mounted solar cells' },
      power: '186 W average from body-mounted cells; 4.8 Ah NiCd battery',
      goal: 'Map surface composition and look for polar ice; measure magnetic and gravity fields.',
      outcome: { cls: 'success', text: 'Found evidence of polar water ice; ended by a planned impact in July 1999.' },
    },
    sources: [SCI('lunar-prospector'), NSSDCA('1998-001A')],
    image: { nasaId: 'PIA18162' }, imageQuery: 'Lunar Prospector',
  },
  {
    id: 'lunar_trailblazer', mission: 'lunar', name: 'Lunar Trailblazer', short: 'Trailblazer', agency: 'NASA / Caltech', tagline: 'Small lunar orbiter · 2025',
    teaser: 'Water and minerals',
    text: 'Lunar Trailblazer was a 200 kg SIMPLEx orbiter built to map lunar water and minerals with an infrared imaging spectrometer and a thermal mapper. Contact was lost soon after its February 2025 launch.',
    url: 'https://science.nasa.gov/mission/lunar-trailblazer/',
    facts: {
      launchYear: 2025, massKg: 200, size: null, sizeText: 'about 200 kg, 3.5 m across with wings open',
      orbit: { classes: ['low_polar'], text: 'planned 100 km (± 30 km) circular polar orbit' }, aerobraking: null,
      instruments: [
        { type: 'ir_mapping', name: 'HVM³ shortwave-infrared imaging spectrometer' },
        { type: 'thermal_ir', name: 'Lunar Thermal Mapper' },
      ],
      pointing: null,
      comms: { bands: ['x'], text: 'X-band Iris radio, >256 kbps via the Deep Space Network' },
      propulsion: { cls: 'mono', text: 'hydrazine chemical propulsion' },
      solar: { cls: 'deployable', text: 'two deployable solar wings' },
      power: '280 W from the solar wings',
      goal: 'Map the form, abundance and distribution of water on the Moon and its link to geology.',
      outcome: { cls: 'lost', text: 'Contact was lost within a day of its Feb 2025 launch.' },
    },
    sources: [SCI('lunar-trailblazer'), NSSDCA('2025-038C')],
    image: { nasaId: 'PIA26453' }, imageQuery: 'Lunar Trailblazer',
  },
  {
    id: 'capstone', mission: 'lunar', name: 'CAPSTONE', short: 'CAPSTONE', agency: 'NASA', tagline: '12U CubeSat · 2022',
    teaser: 'A new orbit',
    text: 'CAPSTONE was the first spacecraft to fly the near-rectilinear halo orbit planned for the Gateway station, and tested navigation by ranging to LRO.',
    url: 'https://www.nasa.gov/mission/capstone/',
    facts: {
      launchYear: 2022, massKg: 25, size: '12U', sizeText: '12U CubeSat, about 25 kg',
      orbit: { classes: ['nrho'], text: 'near-rectilinear halo orbit: ~1,600 km over one pole, ~70,000 km over the other, every 7 days' },
      aerobraking: null,
      instruments: [{ type: 'navigation', name: 'spacecraft-to-spacecraft navigation with LRO' }],
      pointing: null,
      comms: { bands: ['s', 'x'], text: 'S-band crosslink to LRO, X-band Iris radio to the Deep Space Network' },
      propulsion: { cls: 'mono', text: 'hydrazine monopropellant (8 thrusters)' },
      solar: null, power: null,
      goal: 'Prove the halo orbit and autonomous cislunar navigation ahead of Artemis.',
      outcome: { cls: 'success', text: 'Entered the halo orbit on 13 Nov 2022 after recovering from a thruster-valve tumble; met its goals within six months.' },
    },
    sources: [{ label: 'NASA: CAPSTONE', url: 'https://www.nasa.gov/mission/capstone/' }, NSSDCA('2022-070A')],
    image: { nasaId: 'ACD22-0003-003' }, imageQuery: 'CAPSTONE CubeSat',
  },
  {
    id: 'ladee', mission: 'lunar', name: 'LADEE', short: 'LADEE', agency: 'NASA Ames', tagline: 'Lunar orbiter · 2013–2014',
    teaser: 'Thin air and dust',
    text: 'LADEE sampled the Moon\'s extremely thin atmosphere and lofted dust from a low equatorial orbit, and tested laser communications to Earth.',
    url: 'https://science.nasa.gov/mission/ladee/',
    facts: {
      launchYear: 2013, massKg: 383, size: null, sizeText: 'about 383 kg incl. 135 kg of fuel',
      orbit: { classes: ['low_equatorial'], text: 'near-circular retrograde equatorial orbit, about 50 km' }, aerobraking: null,
      instruments: [
        { type: 'spectrometer', name: 'Neutral Mass Spectrometer and UV/Visible Spectrometer' },
        { type: 'dust', name: 'Lunar Dust Experiment' },
      ],
      pointing: null,
      comms: { bands: ['s'], text: 'S-band (10 kbps science), plus a laser-comms demonstration' },
      propulsion: null,
      solar: { cls: 'body', text: 'solar panels covering the outside of the body' },
      power: '295 W at 1 AU',
      goal: 'Measure the density and make-up of the lunar exosphere and dust.',
      outcome: { cls: 'success', text: 'About five months of science, then a planned impact in April 2014.' },
    },
    sources: [SCI('ladee'), NSSDCA('2013-047A')],
    image: { nasaId: 'PIA18160' }, imageQuery: 'LADEE spacecraft',
  },
  {
    id: 'grail', mission: 'lunar', name: 'GRAIL (Ebb and Flow)', short: 'GRAIL', agency: 'NASA JPL / MIT', tagline: 'Twin lunar orbiters · 2011–2012',
    teaser: 'Gravity twins',
    text: 'GRAIL flew two spacecraft in tandem around the Moon, measuring the changing distance between them to map lunar gravity in more detail than for any other body.',
    url: 'https://science.nasa.gov/mission/grail/',
    facts: {
      launchYear: 2011, massKg: 202, size: null, sizeText: 'two spacecraft, about 202 kg each fuelled',
      orbit: { classes: ['low_polar'], text: 'tandem 50 km near-circular polar orbits' }, aerobraking: null,
      instruments: [{ type: 'gravity', name: 'Ka-band Lunar Gravity Ranging System' }],
      pointing: { cls: 'fine', text: 'three reaction wheels, star tracker, Sun sensor and IMU' },
      comms: { bands: ['s'], text: 'S-band to Earth (Ka-band only between the twins)' },
      propulsion: null,
      solar: { cls: 'deployable', text: 'two solar panels' },
      power: 'solar panels and a Li-ion battery',
      goal: 'Map the Moon\'s gravity field to reveal its crust and interior.',
      outcome: { cls: 'success', text: 'Produced the highest-resolution gravity map of any body; planned impacts in Dec 2012.' },
    },
    sources: [SCI('grail'), NSSDCA('2011-046A')],
    image: { nasaId: 'PIA13965' }, imageQuery: 'GRAIL spacecraft',
  },
  {
    id: 'clementine', mission: 'lunar', name: 'Clementine', short: 'Clementine', agency: 'BMDO / NASA', tagline: 'Lunar orbiter · 1994',
    teaser: 'Cameras and lasers',
    text: 'Clementine tested lightweight sensors in lunar orbit, took about 1.6 million images and gave the first look at the whole Moon, including the poles. A computer fault later ended its asteroid flyby.',
    url: 'https://science.nasa.gov/mission/clementine/',
    facts: {
      launchYear: 1994, massKg: 424, size: null, sizeText: 'about 424 kg',
      orbit: { classes: ['high_elliptical_polar'], text: 'elliptical polar orbit, about 430 × 2,950 km' }, aerobraking: null,
      instruments: [
        { type: 'imaging', name: 'UV/visible, high-resolution and star-tracker cameras' },
        { type: 'ir_mapping', name: 'near-infrared camera' },
        { type: 'thermal_ir', name: 'long-wave infrared camera' },
        { type: 'altimetry', name: 'LIDAR laser ranging' },
        { type: 'radiation', name: 'charged particle telescope' },
      ],
      pointing: null,
      comms: { bands: ['s'], text: 'S-band transponder (also used for gravity)' },
      propulsion: null, solar: null, power: null,
      goal: 'Test lightweight spacecraft technology and map the Moon (and fly by an asteroid).',
      outcome: { cls: 'partial', text: 'Lunar mapping succeeded; a thruster misfire after a computer problem cancelled the asteroid flyby.' },
    },
    sources: [SCI('clementine')],
    image: { nasaId: 'PIA18159' }, imageQuery: 'Clementine spacecraft',
  },

  // ------------------------------------------------------------------ Mars
  {
    id: 'mro', mission: 'mars', name: 'Mars Reconnaissance Orbiter', short: 'MRO', agency: 'NASA JPL', tagline: 'Mars orbiter · since 2006',
    teaser: 'Cameras and radar',
    text: 'MRO studies Mars with the HiRISE camera, an imaging spectrometer and a shallow radar that looks for buried ice. It aerobraked for six months to reach its low, sun-synchronous science orbit.',
    url: 'https://science.nasa.gov/mission/mars-reconnaissance-orbiter/',
    facts: {
      launchYear: 2005, massKg: 2180, size: null, sizeText: 'about 2,180 kg incl. 1,149 kg of propellant',
      orbit: { classes: ['low_polar'], text: '255 × 320 km sun-synchronous polar orbit (3 p.m. local time)' }, aerobraking: true,
      instruments: [
        { type: 'imaging', name: 'HiRISE, CTX and MARCI cameras' },
        { type: 'radar', name: 'SHARAD shallow subsurface radar' },
        { type: 'ir_mapping', name: 'CRISM imaging spectrometer' },
        { type: 'atmosphere', name: 'Mars Climate Sounder' },
      ],
      pointing: { cls: 'fine', text: 'reaction wheels, two star trackers and IMUs' },
      comms: { bands: ['x', 'ka'], text: 'X-band through a 3 m dish, up to 6 Mbps, plus a Ka-band experiment and UHF relay' },
      propulsion: { cls: 'mono', text: 'hydrazine monopropellant: six 170 N main thrusters' },
      solar: { cls: 'deployable', text: 'two 10 m² solar wings' },
      power: '1,000 W at Mars; two 50 Ah NiH₂ batteries',
      goal: 'Find out whether water persisted on the surface of Mars for long periods.',
      outcome: { cls: 'success', text: 'Science since Nov 2006, still operating.' },
    },
    sources: [SCI('mars-reconnaissance-orbiter'), NSSDCA('2005-029A')],
    image: { nasaId: 'PIA07245' }, imageQuery: 'Mars Reconnaissance Orbiter',
  },
  {
    id: 'maven', mission: 'mars', name: 'MAVEN', short: 'MAVEN', agency: 'NASA', tagline: 'Mars orbiter · 2014–2025',
    teaser: 'Upper atmosphere',
    text: 'MAVEN was the first mission devoted to Mars\'s upper atmosphere, measuring how the Sun and solar wind strip it away. It operated for more than 11 years until signal was lost in December 2025.',
    url: 'https://science.nasa.gov/mission/maven/',
    facts: {
      launchYear: 2013, massKg: null, size: null, sizeText: '2.3 m bus with two solar wings',
      orbit: { classes: ['elliptical'], text: '4.5-hour elliptical orbit, 75° inclination, 150 km periapsis' }, aerobraking: null,
      instruments: [
        { type: 'fields', name: 'Magnetometer, Langmuir probe and solar-wind and particle analysers' },
        { type: 'spectrometer', name: 'Neutral Gas and Ion Mass Spectrometer, Imaging UV Spectrometer' },
      ],
      pointing: null, comms: null,
      propulsion: { cls: 'mono', text: 'hydrazine (tank holds up to 1,640 kg)' },
      solar: { cls: 'deployable', text: 'two solar panel wings' }, power: null,
      goal: 'Measure how Mars lost its atmosphere and water to space.',
      outcome: { cls: 'success', text: 'A decade past its one-year prime mission; declared ended after loss of signal on 6 Dec 2025.' },
    },
    sources: [SCI('maven'), NSSDCA('2013-063A')],
    image: { nasaId: 'PIA17487' }, imageQuery: 'MAVEN spacecraft',
  },
  {
    id: 'odyssey', mission: 'mars', name: '2001 Mars Odyssey', short: 'Odyssey', agency: 'NASA JPL', tagline: 'Mars orbiter · since 2001',
    teaser: 'Thermal mineral maps',
    text: 'Odyssey made the first global map of the chemical elements and minerals on Mars with a thermal infrared imager and a gamma-ray spectrometer. It is the longest-working spacecraft at another planet.',
    url: 'https://science.nasa.gov/mission/odyssey/',
    facts: {
      launchYear: 2001, massKg: 725, size: null, sizeText: 'about 725 kg incl. 349 kg of fuel',
      orbit: { classes: ['low_polar'], text: 'about 400 km circular polar orbit, 2 hours' }, aerobraking: true,
      instruments: [
        { type: 'thermal_ir', name: 'THEMIS thermal infrared imaging spectrometer' },
        { type: 'imaging', name: 'THEMIS visible camera' },
        { type: 'neutron', name: 'Gamma Ray Spectrometer suite (shallow hydrogen)' },
        { type: 'radiation', name: 'MARIE radiation experiment' },
      ],
      pointing: { cls: 'fine', text: 'reaction wheels, star camera, Sun sensor and IMU' },
      comms: { bands: ['x', 'uhf'], text: 'X-band high-gain dish to Earth, UHF relay for landers' },
      propulsion: { cls: 'biprop', text: 'hydrazine / nitrogen tetroxide main engine' },
      solar: { cls: 'deployable', text: 'gallium-arsenide solar array' },
      power: 'GaAs solar array; 16 Ah NiH₂ battery',
      goal: 'Map surface minerals and elements, find shallow water ice, measure radiation for astronauts.',
      outcome: { cls: 'success', text: 'Primary mission 2002–2004; still active more than 100,000 orbits later.' },
    },
    sources: [SCI('odyssey'), NSSDCA('2001-013A')],
    image: { nasaId: 'PIA04244' }, imageQuery: 'Mars Odyssey spacecraft',
  },
  {
    id: 'mgs', mission: 'mars', name: 'Mars Global Surveyor', short: 'MGS', agency: 'NASA JPL', tagline: 'Mars orbiter · 1997–2006',
    teaser: 'Laser topography',
    text: 'Mars Global Surveyor mapped Mars for nearly a decade with a camera, a thermal emission spectrometer and a laser altimeter. A damaged solar panel forced a slower aerobraking campaign.',
    url: 'https://science.nasa.gov/mission/mars-global-surveyor/',
    facts: {
      launchYear: 1996, massKg: null, size: null, sizeText: '1.2 × 1.2 × 1.7 m box with two solar wings',
      orbit: { classes: ['low_polar'], text: '378 km circular sun-synchronous polar orbit, 118 min' }, aerobraking: true,
      instruments: [
        { type: 'imaging', name: 'Mars Orbiter Camera' },
        { type: 'ir_mapping', name: 'Thermal Emission Spectrometer' },
        { type: 'altimetry', name: 'Mars Orbiter Laser Altimeter' },
        { type: 'fields', name: 'Magnetometer / Electron Reflectometer' },
      ],
      pointing: { cls: 'three_axis', text: 'three-axis stabilised, no scan platform' },
      comms: { bands: ['x', 'ka'], text: 'X-band up, X- and Ka-band down via a 1.5 m dish' },
      propulsion: { cls: 'biprop', text: '596 N hydrazine / N₂O₄ main engine' },
      solar: { cls: 'deployable', text: 'two solar wings' },
      power: '980 W; two 20 Ah NiH₂ batteries',
      goal: 'Map the surface, topography, gravity, atmosphere and magnetic field of Mars.',
      outcome: { cls: 'success', text: 'About a decade of data; went silent in Nov 2006 after a computer error linked to battery failure.' },
    },
    sources: [SCI('mars-global-surveyor'), NSSDCA('1996-062A')],
    image: { nasaId: 'PIA17486' }, imageQuery: 'Mars Global Surveyor',
  },
  {
    id: 'marco', mission: 'mars', name: 'MarCO (Mars Cube One)', short: 'MarCO', agency: 'NASA JPL', tagline: 'Twin 6U CubeSats · 2018',
    teaser: 'Tiny relay to Mars',
    text: 'The two MarCO CubeSats were the first CubeSats in deep space. They flew past Mars with the InSight lander and relayed its landing data to Earth in near real time.',
    url: 'https://science.nasa.gov/mission/marco/',
    facts: {
      launchYear: 2018, massKg: null, size: '6U', sizeText: 'two 6U CubeSats',
      orbit: { classes: ['flyby'], text: 'Mars flyby on 26 Nov 2018 (no orbit insertion)' }, aerobraking: null,
      instruments: [{ type: 'imaging', name: 'wide- and narrow-field engineering cameras' }],
      pointing: null,
      comms: { bands: ['x', 'uhf'], text: 'deployable X-band high-gain antenna (8 kbps) and UHF from InSight' },
      propulsion: { cls: 'cold_gas', text: 'cold-gas R236FA thrusters, 25 mN' },
      solar: { cls: 'deployable', text: 'two deployable solar arrays' }, power: null,
      goal: 'Relay InSight\'s landing in real time and prove CubeSats can work in deep space.',
      outcome: { cls: 'success', text: 'Relayed the landing on 26 Nov 2018; last contact in Jan 2019.' },
    },
    sources: [SCI('marco'), NSSDCA('2018-042B')],
    image: { nasaId: 'PIA22323', caption: 'MarCO-B\'s first image: its antenna, Earth and the Moon' }, imageQuery: 'MarCO CubeSat',
  },
  {
    id: 'mex', mission: 'mars', name: 'Mars Express', short: 'Mars Express', agency: 'ESA (with NASA)', tagline: 'ESA Mars orbiter · since 2003',
    teaser: 'Deep radar',
    text: 'ESA\'s Mars Express has explored Mars from a polar orbit since 2003. Its MARSIS radar, built with NASA and the Italian Space Agency, probes kilometres below the surface for water ice.',
    url: 'https://science.nasa.gov/mission/mars-express/',
    facts: {
      launchYear: 2003, massKg: null, size: null, sizeText: 'medium orbiter',
      orbit: { classes: ['polar'], text: 'polar orbit since December 2003' }, aerobraking: null,
      instruments: [
        { type: 'radar', name: 'MARSIS subsurface and ionosphere radar' },
        { type: 'imaging', name: 'High Resolution Stereo Camera' },
        { type: 'trace_gas', name: 'instruments that mapped the atmosphere\'s chemical composition' },
      ],
      pointing: null, comms: null, propulsion: null, solar: null, power: null,
      goal: 'Search for subsurface water and study the geology and atmosphere of Mars.',
      outcome: { cls: 'success', text: 'Still operating; the Beagle 2 lander it carried was lost on arrival.' },
    },
    sources: [SCI('mars-express'), { label: 'ESA: Mars Express', url: 'https://www.esa.int/Science_Exploration/Space_Science/Mars_Express' }],
    image: { nasaId: 'PIA04802' }, imageQuery: 'Mars Express',
  },
  {
    id: 'tgo', mission: 'mars', name: 'ExoMars Trace Gas Orbiter', short: 'ExoMars TGO', agency: 'ESA / Roscosmos', tagline: 'ESA Mars orbiter · since 2016',
    teaser: 'Trace gases',
    text: 'The Trace Gas Orbiter measures rare gases in the Martian atmosphere such as methane and water vapour, maps hidden water ice and relays data from rovers to Earth.',
    url: 'https://www.esa.int/missions/about-us/directorates/human-and-robotic-exploration/mars/exomars/trace-gas-orbiter',
    facts: {
      launchYear: 2016, massKg: null, size: null, sizeText: 'large orbiter',
      orbit: { classes: ['low_inclined'], text: 'science orbit designed as circular, ~400 km, 74°' }, aerobraking: null,
      instruments: [
        { type: 'trace_gas', name: 'atmosphere analyser and gas detector spectrometers' },
        { type: 'imaging', name: 'surface camera' },
        { type: 'neutron', name: '"ice finder" that maps hidden water ice' },
      ],
      pointing: null, comms: null, propulsion: null, solar: null, power: null,
      goal: 'Find trace gases that could point to life or geology, and map subsurface ice.',
      outcome: { cls: 'success', text: 'Arrived on 19 Oct 2016; still returning science and relaying rover data.' },
    },
    sources: [
      { label: 'ESA: Trace Gas Orbiter', url: 'https://www.esa.int/missions/about-us/directorates/human-and-robotic-exploration/mars/exomars/trace-gas-orbiter' },
      NTRS('20130000291', 'ExoMars/TGO science orbit design'),
    ],
    image: { nasaId: 'PIA13310' }, imageQuery: 'ExoMars Trace Gas Orbiter',
  },
  {
    id: 'mco', mission: 'mars', name: 'Mars Climate Orbiter', short: 'Climate Orbiter', agency: 'NASA JPL', tagline: 'Mars orbiter · 1998–1999',
    teaser: 'A lesson in units',
    text: 'Mars Climate Orbiter was lost on arrival in 1999: ground software used English units while the spacecraft used metric, so it flew too close to Mars and burned up.',
    url: 'https://science.nasa.gov/mission/mars-climate-orbiter/',
    facts: {
      launchYear: 1998, massKg: 629, size: null, sizeText: 'about 629 kg incl. 291 kg of propellant',
      orbit: null, aerobraking: null,
      instruments: [
        { type: 'imaging', name: 'MARCI colour imager' },
        { type: 'atmosphere', name: 'Pressure Modulated Infrared Radiometer' },
      ],
      pointing: { cls: 'fine', text: 'reaction wheels, star tracker and Sun sensors' },
      comms: { bands: ['x', 'uhf'], text: 'X-band via a 1.3 m dish, UHF for the Mars Polar Lander' },
      propulsion: { cls: 'biprop', text: '640 N hydrazine / N₂O₄ main engine' },
      solar: { cls: 'deployable', text: 'single 5.5 m solar wing' },
      power: '500 W at Mars',
      goal: 'Monitor Martian weather, dust and water vapour, and relay for the Mars Polar Lander.',
      outcome: { cls: 'lost', text: 'Lost at orbit insertion on 23 Sept 1999 because of a units mix-up in navigation software.' },
    },
    sources: [SCI('mars-climate-orbiter'), NSSDCA('1998-073A'), NTRS('20060043364', 'Report on the loss of the Mars Climate Orbiter mission')],
    image: { nasaId: 'PIA02330', caption: 'Mars, seen by the Climate Orbiter\'s MARCI camera on approach' }, imageQuery: 'Mars Climate Orbiter',
  },
];

export const ANALOGS: Record<string, Analog> = Object.fromEntries(ANALOG_LIST.map((a) => [a.id, a]));
export const ANALOG_COUNT = ANALOG_LIST.length;

/** Game instrument id → science type (all three catalogs). */
export const INSTRUMENT_SCIENCE: Record<string, ScienceType> = {
  imager: 'imaging', thermal: 'thermal_ir', atmos: 'atmosphere', spectro: 'spectrometer',
  cam: 'imaging', altim: 'altimetry', mapper: 'ir_mapping', neutron: 'neutron',
  tracegas: 'trace_gas', radar: 'radar', fields: 'fields',
};

/** Plain-English instrument class for match sentences ("you both fly a laser altimeter"). */
export const SCIENCE_LABEL: Record<ScienceType, string> = {
  imaging: 'a camera', thermal_ir: 'a thermal infrared imager', atmosphere: 'an atmospheric sensor',
  spectrometer: 'a spectrometer', altimetry: 'a laser altimeter', ir_mapping: 'an infrared mineral mapper',
  neutron: 'a neutron spectrometer for water ice', trace_gas: 'a trace-gas spectrometer', radar: 'a radar',
  fields: 'a magnetometer and particle package', gravity: 'a gravity-ranging system', dust: 'a dust detector',
  radiation: 'a radiation detector', navigation: 'a navigation experiment',
};

export const BAND_LABEL: Record<Band, string> = { uhf: 'UHF', s: 'S-band', x: 'X-band', ka: 'Ka-band' };
export const PROPULSION_LABEL: Record<PropulsionClass, string> = {
  mono: 'monopropellant (hydrazine) thrusters', biprop: 'a bipropellant engine', cold_gas: 'cold-gas thrusters', sep: 'solar-electric propulsion',
};
