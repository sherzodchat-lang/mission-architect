# Mission Architect

> **For judges**
> - **Play (live):** https://sherzodchat-lang.github.io/mission-architect/ (laptop/desktop, at least 1024 px wide)
> - **Quick path:** open `?demo=1` (or press **Quick demo** on the Overview screen) - a ready Earth design lands on *Orbit & launch*; just press Launch. Add `&unlock=all` to try the Moon and Mars missions.
> - **Faster flight:** pick **4x** speed and use **Skip to end** during operations to reach the report in seconds.
> - `GAME_DESIGN.md` is the team's internal design spec (written in Russian); everything judges need is in this README and in the in-app *How it works* and *Built on NASA data* pages.

**Design a space mission, fly it for a year, and learn why it worked — or didn't.**
A browser game for the NASA Space Apps Challenge 2026 challenge *Space Mission Design Game*.

▶ **Play:** https://sherzodchat-lang.github.io/mission-architect/ (best on a laptop/desktop, ≥1024 px wide)
Demo tip: add `?unlock=all` to the URL to open the Lunar and Mars missions without earning stars first.

## Design summary

Mission Architect puts the player in the role of a mission designer: choose a science goal, assemble a spacecraft from real component classes, pick an orbit, a launch vehicle, ground stations and a test campaign, then fly the mission for a simulated year. Six resources (mass, power, budget, data, comms, schedule; plus Delta-v for the Moon and Mars) are tied together by one engine, so every gain costs something elsewhere. Random events (solar flares, deployment anomalies, software glitches, station outages) test the design, and the final report explains in plain language what happened and why, with *next time* advice and the closest real NASA mission. Three missions of rising difficulty share the same engine: Earth observation CubeSat, Lunar orbiter, Mars probe. Numbers are calibrated against NASA data (GMAT orbit runs, the Small Spacecraft State of the Art report, JPL Horizons) and the game is an educational simulation, not an engineering tool.

### Challenge requirements: where in the game

| Challenge requirement | Where it is in the game |
|---|---|
| Design choices (spacecraft, instruments, systems) | **Design** screen: payload, power, comms, computer, attitude control, propulsion; 3D spacecraft built from the chosen parts; live resource bars |
| Launch vehicle and orbit | **Orbit & launch** screen: orbit (LEO / SSO / lunar / Mars orbits), three launch options with mass and price limits, ground stations, test campaign |
| Resource trade-offs | Six live resources with warnings (mass, power, budget, data, comms, schedule; Delta-v for deep space); every choice has a visible cost elsewhere |
| Explanations and learning | Glossary tooltips, *How it works*, per-event decisions during operations, **Report** with "what happened and why" and *next time* advice |
| Use of NASA data | Real NASA imagery returned by your spacecraft (GIBS, Moon Trek, Mars Trek), GMAT orbit numbers, JPL Horizons, SOA 2025 component values, real-mission analogues; see *Built on NASA data* |
| Collaboration | **Team mode** for 2–4 players on one device: Science Lead, Systems Engineer, Comms & Ground Lead, Mission Manager — each owns parts of the design and has a personal goal; "Pass the console" turns; a review board must approve before launch (Manager has 2 overrides); flight decisions name their owner; the report scores **Teamwork** |
| Save, replay and compare | Autosaved draft, named saved designs, *redesign and relaunch* loop, stars and unlocks, real-mission comparison in the report |

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
| Launch windows, distances, signal delay | **JPL Horizons API** | Snapshot (`tools/fetch_horizons.mjs`): real Earth–Mars light time for decision delays and real Earth–Moon distance; Mars launch windows (e.g. 23 Nov 2028) computed by our Lambert search over Horizons planet positions, checked against the Mars 2020 and InSight windows |
| Orbit numbers | **NASA GMAT R2026a** (14 propagated cases) with MSFC solar-flux predictions and the GRAIL gravity model | Sun fraction, eclipse length, ground-station contact minutes, LEO lifetime (11 months for a 4 kg 3U CubeSat with 0.03 m² drag area, nominal solar activity), lunar station keeping (`tools/gmat/`) |
| Component values | **NASA Small Spacecraft Technology State of the Art 2025** report and **CubeSat 101** | Battery energy density, radio data rates, propulsion Isp, etc. (105 page-cited quotes in `src/data/nasa/components.json`; calibration log in `src/data/nasa/calibration.md`) |
| Real-mission analogues | **NSSDCA Master Catalog**, **science.nasa.gov**, **NASA Image and Video Library API**, **NTRS API** | Feature-similarity match to ~20 real missions, live NASA photos, linked NASA technical papers |
| 3D planets | **Blue Marble Next Generation**, **Black Marble 2016**, Blue Marble clouds, GEBCO topography, **LROC/LOLA (CGI Moon Kit)**, **Viking MDIM 2.1 / MGS MOLA** | Photoreal Earth, Moon and Mars (credits in `public/textures/planets/CREDITS.md`) |

Prices and budgets are game-scaled; science instruments use game-balanced values (the SOA report has no instrument chapter). The game is an educational simulation, not an engineering tool.

### Challenge resources used
Used directly in the app: **CubeSat 101** (component values, terms, events) and **NASA GMAT** (orbit analysis). Informed the design: Design and Develop Science Missions (mission segments and life cycle), Concept Maturity Levels (redesign-and-relaunch loop), Mission Design Lab (disciplines and report structure), *A Learning Game About Telescopes / Build It Yourself* (real-mission analogue idea).

Note on dates: Earth imagery replays the most recent 12 months of real MODIS data; the mission calendar (launch windows, light time) uses programme dates from November 2025.

## Use of AI (synthetic intelligence, SI)

- **Code:** written with SI coding agents (Anthropic Claude Code) under the team's direction and review. The game concept, rules and design were defined by the team (`GAME_DESIGN.md`).
- **Audio:** mission-control voice lines and sound effects were generated with **ElevenLabs** (voice "Russell Clark", eleven_v4; SFX v2) and processed with ffmpeg. Every mp3 carries an SI acknowledgement in its metadata.
- **Images:** mission and collection card artwork was generated with OpenAI image generation via Codex (brief in `assets_src/cards_v2/PROMPT.md`). The Overview background and the "Continue your design" picture were supplied by the team. All of these carry a visible **"SI-generated"** watermark.
- UI concept mockups were SI-generated (design reference only, not shipped).
- No NASA logo or insignia is used or generated. **Mission Architect is an educational simulation and is not affiliated with or endorsed by NASA.**

## Licences & credits

- Project code and original content: **Apache License 2.0** (`LICENSE`).
- NASA imagery and data (GIBS, Moon Trek, Mars Trek, Blue Marble, Black Marble, LROC/LOLA, Viking/MOLA, NASA Image and Video Library) are used under NASA's media usage guidelines; full credits in `public/textures/planets/CREDITS.md` and on the in-app "Built on NASA data" page.
- Space agency partner data: ESA mission facts for Mars Express and ExoMars Trace Gas Orbiter (esa.int).
- Mars Viking MDIM 2.1 mosaic via Wikimedia Commons (public domain, NASA/JPL/USGS).
- Libraries: React, Zustand, three.js, @react-three/fiber, @react-three/drei, Howler.js, Tailwind CSS, Vite, Vitest, TypeScript (MIT / Apache-2.0 / ISC / BSD). Fonts: DM Sans and JetBrains Mono (SIL Open Font License 1.1, Google Fonts).

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
