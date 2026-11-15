import type { NasaSource } from '../types';

export const SOURCES: NasaSource[] = [
  {
    id: 'nasa-gmat',
    title: 'NASA General Mission Analysis Tool (GMAT) R2026a',
    provider: 'NASA GSFC',
    url: 'https://sourceforge.net/projects/gmat/files/GMAT/GMAT-R2026a/',
    usedFor:
      'Every game orbit was flown in NASA GMAT. GMAT gave the orbital periods, the share of time in sunlight, the minutes of radio contact per day at each ground station and DSN complex, how long a 3U CubeSat survives at 400 km, and how much fuel a low lunar orbit needs each month.',
    access: 'snapshot',
    where: [
      'Orbit cards (period, sunlight fraction, battery factor, lifetime)',
      'Ground station panel (contact minutes per day)',
      'Lunar low-orbit station-keeping fuel',
    ],
    refreshScript: 'GMAT_BIN=/path/to/GMAT/R2026a/bin tools/gmat/run_all.sh',
    license: 'GMAT: NASA Open Source Agreement (Apache 2.0 since R2020a)',
  },
  {
    id: 'nasa-msfc-schatten',
    title: 'NASA MSFC solar-cycle flux predictions (Schatten), shipped with GMAT',
    provider: 'NASA MSFC',
    url: 'https://www.nasa.gov/solar-cycle-progression-and-forecast/',
    usedFor: 'The predicted solar activity for 2027 sets how fast air drag pulls the LEO CubeSat down.',
    access: 'snapshot',
    where: ['LEO orbit lifetime'],
    refreshScript: 'tools/gmat/run_all.sh',
    license: 'Public domain (NASA)',
  },
  {
    id: 'nasa-grail-grgm900c',
    title: 'GRAIL lunar gravity model GRGM900C (NASA GSFC), shipped with GMAT',
    provider: 'NASA GSFC',
    url: 'https://science.nasa.gov/mission/grail/',
    usedFor: 'The Moon\'s lumpy gravity (mascons) measured by GRAIL shows how quickly a 100 km orbit sinks, and so how much fuel it costs to stay up.',
    access: 'snapshot',
    where: ['Lunar Orbiter: low polar orbit fuel per month'],
    refreshScript: 'tools/gmat/run_all.sh',
    license: 'Public domain (NASA)',
  },
];
