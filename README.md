# Mission Architect

**Design a space mission, fly it for a year, and learn why it worked — or didn't.**
A browser game for the NASA Space Apps Challenge 2026 challenge *Space Mission Design Game*.

▶ **Play:** https://sherzodchat-lang.github.io/mission-architect/ (best on a laptop/desktop, ≥1024 px wide)
Demo tip: add `?unlock=all` to the URL to open the Lunar and Mars missions without earning stars first.

## What you do

1. **Mission** — pick a science goal: Earth Observation CubeSat (easy), Lunar Orbiter (medium), Mars Probe (hard).
2. **Design** — build the spacecraft from real component classes (payload, power, comms, computer, attitude control, propulsion) and watch six resources update live: mass, power, budget, data, comms, schedule (+ Δv fuel for the Moon and Mars). The spacecraft is assembled in 3D from your parts.
3. **Orbit & launch** — choose orbit, launch vehicle, ground stations and test campaign. Every choice has a cost elsewhere.
4. **Operations** — fly 12 steps with solar flares, deployment anomalies, software glitches, station outages and orbit insertion burns. Your spacecraft returns **real NASA imagery**, degraded or sharpened by your design (pointing, downlink, storage, radiation, orbit reach).
5. **Report** — score, plain-language "what happened and why" with *next time* advice, and the real NASA mission your design most resembles.

## NASA data at the core

The game runs on real NASA data and tools — live in the browser, as build-time snapshots, or as assets. The in-app **"Built on NASA data"** page lists every source and where it appears.

| What | NASA source | How it is used |
|---|---|---|
| Science your spacecraft returns (Earth) | **NASA GIBS** WMTS — MODIS Terra true colour, land surface temperature, aerosol optical depth, NDVI | Live tiles; quality depends on your pointing, downlink, storage, flares and orbit |
| Science returns (Moon / Mars) | **NASA Moon Trek** (LRO WAC, LOLA, Lunar Prospector NS, Clementine) and **Mars Trek** (Viking MDIM, MGS MOLA, TES, THEMIS) | Live tiles; stand-in layers are labelled as such |
| Launch windows, distances, signal delay | **JPL Horizons API** | Snapshot (`tools/fetch_horizons.mjs`): real Mars windows (e.g. 23 Nov 2028), real Earth–Mars light time for decision delays, real Earth–Moon distance |
| Orbit numbers | **NASA GMAT R2026a** (14 propagated cases) with MSFC solar-flux predictions and the GRAIL gravity model | Sun fraction, eclipse length, ground-station contact minutes, LEO lifetime (11 months for a 3U CubeSat), lunar station keeping (`tools/gmat/`) |
| Component values | **NASA Small Spacecraft Technology State of the Art 2025** report and **CubeSat 101** | Battery energy density, radio data rates, propulsion Isp, etc. (105 page-cited quotes in `src/data/nasa/components.json`; calibration log in `src/data/nasa/calibration.md`) |
| Real-mission analogues | **NSSDCA Master Catalog**, **science.nasa.gov**, **NASA Image and Video Library API**, **NTRS API** | Feature-similarity match to ~20 real missions, live NASA photos, linked NASA technical papers |
| 3D planets | **Blue Marble Next Generation**, **Black Marble 2016**, Blue Marble clouds, GEBCO topography, **LROC/LOLA (CGI Moon Kit)**, **Viking MDIM 2.1 / MGS MOLA** | Photoreal Earth, Moon and Mars (credits in `public/textures/planets/CREDITS.md`) |

Prices and budgets are game-scaled; science instruments use game-balanced values (the SOA report has no instrument chapter). The game is an educational simulation, not an engineering tool.

### Challenge resources used
Design and Develop Science Missions (mission segments and life cycle) · CubeSat 101 (components, terms, events) · Concept Maturity Levels (redesign-and-relaunch loop) · Mission Design Lab (disciplines and report structure) · NASA GMAT (orbit analysis) · *A Learning Game About Telescopes / Build It Yourself* (real-mission analogue idea).

## Use of AI

- Code was written with AI coding agents (Anthropic Claude Code) under the team's direction and review.
- Mission-control voice lines and sound effects were generated with **ElevenLabs** (voice "Russell Clark", eleven_v4; SFX v2), then processed with ffmpeg.
- Mission and collection card artwork was generated with OpenAI Codex image generation (brief in `assets_src/cards_v2/PROMPT.md`).
- UI concept mockups were AI-generated.
- No NASA logo or insignia is used. NASA does not endorse this project.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # engine tests (FULL_BALANCE=1 npm test for the full balance enumeration)
npm run build      # static site in dist/
python3 tools/balance_check.py earth|lunar|mars   # reference balance check
```

Stack: Vite, React, TypeScript, Tailwind CSS, Zustand, three.js / react-three-fiber, Howler.js, Vitest. No backend; deploys as a static site (GitHub Pages via `.github/workflows/deploy.yml`).

## Project map

- `GAME_DESIGN.md` — rules, formulas, data, screens (single source of truth)
- `src/engine/` — pure game engine (budget, simulation, scoring) · `src/data/` — missions and NASA data
- `src/nasa/` — NASA imagery, image library and NTRS clients · `src/scene/`, `src/spacecraft3d/` — 3D
- `tools/` — balance check, Horizons/NTRS fetchers, GMAT scripts, asset build scripts
