#!/usr/bin/env node
// Refreshes src/data/nasa/ntrs.json from the NASA Technical Reports Server API (https://ntrs.nasa.gov/api/openapi/).
//   node tools/fetch_ntrs.mjs            -> fetch metadata for the curated citation ids below, write the JSON
//   node tools/fetch_ntrs.mjs --search   -> print search candidates for every query (to curate new ids)
// No dependencies (Node >= 18, global fetch). NTRS does not send CORS headers, so the game ships this snapshot.
//
// Every id below was picked by hand from NTRS search results (title/abstract checked) and is verified here:
// the script fails if a citation does not resolve.
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const API = 'https://ntrs.nasa.gov/api/citations';
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../src/data/nasa/ntrs.json');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Real-mission analog id (src/data/analogs.ts) -> NTRS citation ids (2-3 each, best first) + the search used to find them. */
const ANALOG_PAPERS = {
  harp: { q: 'Hyper-Angular Rainbow Polarimeter', ids: ['20240012542'] },
  hyti: { q: 'HyTI T2SL focal plane', ids: ['20230006928', '20220005811'] },
  icecube: { q: 'IceCube CubeSat submillimeter radiometer', ids: ['20210012947', '20150021071'] },
  minxss: { q: 'MinXSS CubeSat', ids: ['21677650990236', '88351484026550'] },
  dellingr: { q: 'Dellingr CubeSat', ids: ['20170011566', '20160010304'] },
  asteria: { q: 'ASTERIA CubeSat pointing', ids: ['20210006798', '20210008536', '20220001561'] },
  raincube: { q: 'RainCube radar CubeSat', ids: ['20210007697', '20210013808'] },
  tempestd: { q: 'TEMPEST-D CubeSat', ids: ['20220000908', '74524097874203'] },
  lro: { q: 'Lunar Reconnaissance Orbiter mission overview', ids: ['20180000056', '20110007093', '20100014880'] },
  lunar_prospector: { q: 'Lunar Prospector mission', ids: ['19970017222', '19990064167', '20060041385'] },
  lunar_trailblazer: { q: 'Lunar Trailblazer', ids: ['20230007018'] },
  capstone: { q: 'CAPSTONE near rectilinear halo orbit CubeSat', ids: ['20210010903', '20240004138'] },
  ladee: { q: 'LADEE mission', ids: ['20160000571', '20160007047', '20150000695'] },
  grail: { q: 'GRAIL gravity mission', ids: ['20150008737', '20130010673'] },
  clementine: { q: 'Clementine lunar mission', ids: ['19950027033', '19980041408'] },
  mro: { q: 'Mars Reconnaissance Orbiter aerobraking', ids: ['20080032390', '20070034022', '20070010460'] },
  maven: { q: 'Mars Atmosphere and Volatile Evolution MAVEN mission', ids: ['20120002014', '20180000060', '20160010314'] },
  odyssey: { q: '2001 Mars Odyssey aerobraking', ids: ['20030110814', '20030005808'] },
  mgs: { q: 'Mars Global Surveyor mission', ids: ['20210001222', '20210002675'] },
  marco: { q: 'MarCO CubeSat Mars', ids: ['20210015981', '20190025562'] },
  mex: { q: 'Mars Express MARSIS', ids: ['20050161987', '20060042713'] },
  tgo: { q: 'Trace Gas Orbiter', ids: ['20130000291', '20210012821'] },
  mco: { q: 'Mars Climate Orbiter', ids: ['20060043364'] },
};

/** "What happened and why" card topic -> one NTRS paper ("Read the NASA paper"). */
const LESSON_PAPERS = {
  antenna: { q: 'CubeSat communications downlink', id: '20160001365' },
  power: { q: 'CubeSat power system', id: '20170007278' },
  battery: { q: 'lithium-ion battery small satellite', id: '20150020899' },
  pointing: { q: 'ASTERIA CubeSat pointing', id: '20210006798' },
  storage: { q: 'solid state recorder', id: '20210007900' },
  schedule: { q: 'cost and schedule growth', id: '20160003386' },
  radiation: { q: 'CubeSat radiation', id: '20230011128' },
  deployment: { q: 'deployable solar array CubeSat', id: '20180004164' },
  decay: { q: 'low Earth orbit atmospheric drag CubeSat orbit lifetime reentry', id: '20170011160' },
  wheel: { q: 'reaction wheel failure', id: '20020060665' },
  software: { q: 'Dellingr CubeSat', id: '20170011566' },
  ground: { q: 'CubeSat communications downlink', id: '20190003857' },
  aerobrake: { q: 'Mars Reconnaissance Orbiter aerobraking', id: '20070010460' },
  insertion: { q: 'LADEE mission', id: '20150000695' },
  lost: { q: 'Mars Climate Orbiter', id: '20060043364' },
  margins: { q: 'small spacecraft technology state of the art', id: '20250000142' },
};

async function getJson(url) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (attempt >= 3) throw new Error(`${url}: ${e.message}`);
      await sleep(2000 * attempt);
    }
  }
}

function year(r) {
  const d = r.publications?.[0]?.publicationDate || r.distributionDate || r.submittedDate || r.created || '';
  return Number(String(d).slice(0, 4)) || null;
}

const STI = {
  CONFERENCE_PAPER: 'Conference paper', PRESENTATION: 'Presentation', PREPRINT: 'Preprint', REPRINT: 'Journal article',
  ACCEPTED_MANUSCRIPT: 'Journal article', TECHNICAL_MEMORANDUM: 'Technical memorandum', TECHNICAL_PUBLICATION: 'Technical publication',
  CONTRACTOR_REPORT: 'Contractor report', ABSTRACT: 'Abstract', OTHER: 'Report',
};

async function citation(id) {
  const r = await getJson(`${API}/${id}`);
  if (String(r.id) !== String(id)) throw new Error(`citation ${id} resolved to ${r.id}`);
  const authors = [...(r.authorAffiliations ?? [])]
    .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
    .map((a) => a.meta?.author?.name)
    .filter(Boolean);
  await sleep(250);
  return {
    id: String(r.id),
    title: String(r.title).replace(/\s+/g, ' ').trim(),
    year: year(r),
    authors: authors.slice(0, 3),
    moreAuthors: Math.max(0, authors.length - 3),
    type: STI[r.stiType] ?? 'Report',
    center: r.center?.name ?? null,
    url: `https://ntrs.nasa.gov/citations/${r.id}`,
  };
}

async function search() {
  const all = [...Object.entries(ANALOG_PAPERS), ...Object.entries(LESSON_PAPERS)];
  for (const [key, { q }] of all) {
    const d = await getJson(`${API}/search?${new URLSearchParams({ q, 'page.size': '8' })}`);
    console.log(`## ${key}: ${q}`);
    for (const r of d.results ?? []) console.log(`   ${r.id} | ${year(r)} | ${r.stiType} | ${r.title.slice(0, 110)}`);
    await sleep(400);
  }
}

async function main() {
  if (process.argv.includes('--search')) return search();
  const cache = new Map();
  const get = async (id) => {
    if (!cache.has(id)) cache.set(id, await citation(id));
    return cache.get(id);
  };
  const analogs = {};
  for (const [key, { ids }] of Object.entries(ANALOG_PAPERS)) {
    analogs[key] = [];
    for (const id of ids) analogs[key].push(await get(id));
    console.log(`analog ${key}: ${analogs[key].length}`);
  }
  const lessons = {};
  for (const [key, { id }] of Object.entries(LESSON_PAPERS)) {
    lessons[key] = await get(id);
    console.log(`lesson ${key}: ${lessons[key].title.slice(0, 70)}`);
  }
  const out = {
    source: 'NASA Technical Reports Server (NTRS) API, https://ntrs.nasa.gov/api/citations',
    fetched: new Date().toISOString().slice(0, 10),
    script: 'node tools/fetch_ntrs.mjs',
    analogs,
    lessons,
  };
  writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
  console.log(`wrote ${OUT} (${cache.size} citations)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
