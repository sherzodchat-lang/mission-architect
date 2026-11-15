import type { NasaSource } from '../types';

export const SOURCES: NasaSource[] = [
  {
    id: 'nasa-image-library',
    title: 'NASA Image and Video Library API',
    provider: 'NASA',
    url: 'https://images.nasa.gov/docs/images.nasa.gov_api_docs.pdf',
    usedFor: 'Real photos and artwork of the missions your spacecraft resembles, loaded live with their NASA credits.',
    access: 'live',
    where: ['Mission report: real-world analogue', 'Main menu: Collection of real missions discovered'],
    license: 'NASA media is generally not copyrighted; credits as given by the library',
  },
  {
    id: 'ntrs',
    title: 'NASA Technical Reports Server (NTRS) API',
    provider: 'NASA STI Program',
    url: 'https://ntrs.nasa.gov/api/openapi/',
    usedFor: 'Real NASA technical papers about each analog mission and behind every lesson in "What happened and why".',
    access: 'snapshot',
    where: ['Mission report: NASA papers of the analogue', 'Mission report: "Read the NASA paper" on lesson cards'],
    refreshScript: 'node tools/fetch_ntrs.mjs',
    license: 'Public NTRS citations; papers as published by NASA',
  },
  {
    id: 'nssdca',
    title: 'NSSDCA Master Catalog (spacecraft pages)',
    provider: 'NASA GSFC',
    url: 'https://nssdc.gsfc.nasa.gov/nmc/SpacecraftQuery.jsp',
    usedFor: 'Verified spacecraft facts (mass, orbit, instruments, pointing, radio, propulsion, power) for the real missions your design is matched against.',
    access: 'asset',
    where: ['Mission report: real-world analogue match and facts', 'Main menu: Collection'],
  },
  {
    id: 'nasa-science-missions',
    title: 'NASA Science mission pages (science.nasa.gov)',
    provider: 'NASA',
    url: 'https://science.nasa.gov/missions/',
    usedFor: 'Mission goals, launch dates and outcomes of the real analog missions, and the "Explore the real mission" links.',
    access: 'asset',
    where: ['Mission report: real-world analogue', 'Main menu: Collection'],
  },
];
