import type { NasaSource } from '../types';

export const SOURCES: NasaSource[] = [
  {
    id: 'jpl-horizons',
    title: 'JPL Horizons API (solar system ephemerides)',
    provider: 'NASA JPL',
    url: 'https://ssd-api.jpl.nasa.gov/doc/horizons.html',
    usedFor: 'Real Earth–Moon and Earth–Mars distances, radio signal travel times and the real Mars launch windows drive the Lunar Orbiter and Mars Probe missions.',
    access: 'snapshot',
    where: ['Lunar Orbiter and Mars Probe simulation (cruise distance, signal delay, calendar dates)', 'Mars launch window on mission select and schedule warnings', 'Transfer and planet positions'],
    refreshScript: 'node tools/fetch_horizons.mjs',
    license: 'Public domain (NASA/JPL)',
  },
];
