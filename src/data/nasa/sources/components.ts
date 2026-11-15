import type { NasaSource } from '../types';

export const SOURCES: NasaSource[] = [
  {
    id: 'nasa-sst-soa',
    title: 'NASA Small Spacecraft Technology State of the Art 2025 report',
    provider: 'NASA Ames (Small Spacecraft Systems Virtual Institute)',
    url: 'https://www.nasa.gov/smallsat-institute/sst-soa/',
    usedFor:
      'The NASA reference behind each component card. It sets the mass of the solar panels and batteries, radio data rates, pointing accuracy, computer power use and engine efficiency (Isp). The page and section for every number are listed in src/data/nasa/components.json.',
    access: 'snapshot',
    where: ['Component catalog cards (NASA reference tooltips)', 'Battery and propulsion values of all three missions'],
    license: 'Public domain (NASA)',
  },
  {
    id: 'nasa-cubesat-101',
    title: 'CubeSat 101: Basic Concepts and Processes for First-Time CubeSat Developers (NASA CSLI)',
    provider: 'NASA',
    url: 'https://www.nasa.gov/wp-content/uploads/2017/03/nasa_csli_cubesat_101_508.pdf',
    usedFor: 'CubeSat size and mass, typical development time (9 to 24 months), and the launch cost NASA covers for a 3U CubeSat.',
    access: 'snapshot',
    where: ['Earth Observation CubeSat: platform, launcher and schedule tooltips'],
    license: 'Public domain (NASA)',
  },
];
