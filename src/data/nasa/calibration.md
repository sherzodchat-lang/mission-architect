# NASA calibration of the game data

This file lists every game number that was changed or checked against a NASA source, with the source and the old and new values.

- **Data files.** The data lives in `src/data/missions.ts`, and the reference engine is `tools/balance_check.py`. Both always carry the same numbers.
- **Tooltips.** Each component, orbit and ground station has a `nasaRef` (a short text and a URL) and a `sources` map that names the provenance of each field.

The provenance labels are:

| label | meaning |
|---|---|
| `NASA SOA 2025 §x` | NASA Ames, *Small Spacecraft Technology State of the Art 2025* report ([PDF](https://www.nasa.gov/wp-content/uploads/2026/05/soa-2026.pdf), [landing page](https://www.nasa.gov/smallsat-institute/sst-soa/)). The PDF is titled "...State of the Art 2025 report" and was published in 2026. Page numbers are PDF pages. |
| `CubeSat 101 §x` | NASA CSLI, *CubeSat 101* ([PDF](https://www.nasa.gov/wp-content/uploads/2017/03/nasa_csli_cubesat_101_508.pdf)). |
| `GMAT` | Computed by running **NASA GMAT R2026a** (GmatConsole, ubuntu-x64 build) on the scripts in `tools/gmat/scripts/`. The results are in `src/data/nasa/gmat.json`. |
| `game balance` | Tuned for play, not taken from NASA. |

**Prices are game-scaled.** All $M values, the mission budgets, and the development months are `game balance`. They were tuned so that the three missions are fun and get harder in turn. They are not cost estimates. CubeSat 101 itself says "there isn't a standard price tag". The only real cost anchors we quote are these:
- NASA CSLI covers up to $300,000 of launch cost, "typically enough to launch a 3U into low-Earth orbit".
- SpaceX Transporter rideshares start at $350k for about 50 kg (SOA §10.3.2).

The game's $0.15–0.45 M CubeSat rideshares are in that range.

**How the numbers were verified.**
- **SOA and CubeSat 101.** Both PDFs were downloaded with curl and converted with `pdftotext -layout`. Every value cited in `components.json` carries a verbatim quote and its PDF page, and a script checked that each quote occurs on that page (105 of 105 references).
- **Orbits.** Every orbit value comes from an actual GMAT run. `tools/gmat/run_all.sh` regenerates `gmat.json`.
- **NRHO.** The NRHO initial state was computed with our own CR3BP corrector (`tools/orbits/nrho.py`). GMAT then propagated it in the full ephemeris model.

## 1. Orbits (NASA GMAT R2026a)

GMAT R2026a ran from the official SourceForge ubuntu-x64 tarball. The run used this setup:
- **Epoch.** 2027-01-01 for Earth and Moon, 2030-01-01 for Mars.
- **Earth.** JGM-3 8×8 gravity, Sun/Moon third bodies and SRP, propagated for 365 days.
- **Moon.** GRAIL GRGM900C gravity, 60×60 for the stability runs and 4×4 for the geometry runs, with Earth and Sun third bodies. Propagated for 365 days (90 days for the 100 km LLO stability run).
- **Mars.** Mars50c gravity and the Sun, propagated for 180 days.
- **Locators.** GMAT `EclipseLocator` (umbra, penumbra, antumbra) and `ContactLocator`.
- **Elevation masks.** 5° for the Earth stations and 10° for the DSN, which is the DSN operational limit.
- **Contacts.** The Moon and Mars occult the line of sight, and light-time is included.

The longest shadow is the battery factor input below.

The shadow fraction is (umbra + ½ penumbra) / time. The battery factor `k` is the longest GMAT shadow (in hours) divided by the allowed depth of discharge. We use 30% depth of discharge for orbits with an eclipse every orbit and 60% for the rare eclipses of the Mars capture ellipse. The depth of discharge is a game-balance assumption: the SOA lists depth of discharge as an ageing driver but gives no number. The floor is k = 1.

| Mission · orbit | GMAT case | value | before | after | source |
|---|---|---|---|---|---|
| Earth · LEO 400 km 51.6° | `earth_leo400_geom` | period | 92.6 min | 92.6 min (GMAT 92.56) | GMAT |
| | | sun fraction | 0.62 | **0.66** (shadow 34.3%) | GMAT |
| | | battery k | 2 | 2 (longest shadow 35.9 min / 0.3) | GMAT + game |
| | | contact units (min/day ÷ 30) | wal 1, san 1, fai 0.5, sva 0 | **wal 1.36, san 1.07, fai 0.26, sva 0** (41 / 32 / 8 / 0 min/day) | GMAT |
| | | coverage | 0.75 | **0.78** (= sin 51.6°, the share of Earth's surface between ±51.6° latitude) | geometry |
| | `earth_leo400_decay_*` | last operating month (re-entry) | 10 | **11** | GMAT |
| Earth · SSO 600 km | `earth_sso600_geom` | inclination | 97.8° | 97.8° (J2 sun-synchronous 97.79°), LTAN 10:30 | GMAT |
| | | period | 96.7 min | 96.7 min | GMAT |
| | | sun fraction | 0.66 | **0.64** | GMAT |
| | | contact units | wal 1, san 1, fai 2, sva 2.5 | **wal 1.14, san 1.09, fai 2.66, sva 3.92** (34 / 33 / 80 / 118 min/day) | GMAT |
| Lunar · LLO 100 km polar | `lunar_llo100_geom`, `_keep` | period | 118 min | 117.9 min | GMAT |
| | | sun fraction | 0.60 | **0.72** | GMAT |
| | | battery k | 3.0 | **2.6** (47 min / 0.3) | GMAT + game |
| | | station-keeping Δv per month | 15 m/s | **12 m/s** (11.9; 143 m/s per year) | GMAT |
| | | DSN units (min/day ÷ 480) | 0.8 | **0.89** (427 / 417 / 444 min/day) | GMAT |
| | | commercial dish | 0.4 | 0.45 (half a DSN unit) | game balance |
| Lunar · frozen 30 × 200 km 86° | `lunar_frozen_geom`, `_keep` | period | 2.5 h | **119 min** | GMAT |
| | | sun fraction | 0.75 | 0.74 | GMAT |
| | | battery k | 2.5 | **2.6** | GMAT + game |
| | | Δv per month | 2 m/s | **1.8 m/s** (21 m/s per year) | GMAT |
| | | DSN units | 1.0 | **0.90** | GMAT |
| Lunar · NRHO | `lunar_nrho_geom` | perilune × apolune (altitude) | "3,000 × 70,000 km" | **1,500 × 69,500 km** (radius 3,249 × 71,222 km) | CR3BP + GMAT |
| | | period | 6.5 d | **6.56 d** (9:2 synodic resonance) | CR3BP |
| | | sun fraction | 0.95 | **1.0** (no eclipse in the 2-revolution GMAT run) | GMAT |
| | | DSN units | 1.2 | **1.05** (average of 410 / 374 / 731 min/day) | GMAT |
| | | commercial dish | 0.6 | 0.53 | game balance |
| Mars · capture 300 × 45,000 km | `mars_capture_geom` | period | 35 h | **35.5 h** | GMAT |
| | | sun fraction | 0.85 | **0.99** | GMAT |
| | | battery k | 1.5 | **2.0** (72 min / 0.6) | GMAT + game |
| | | DSN units | 1.0 | **1.30** (655 / 655 / 567 min/day) | GMAT |
| Mars · low 300 km 93° (aerobrake / direct) | `mars_low300_geom` | period | 113 min | 114 min (113.7) | GMAT |
| | | sun fraction | 0.62 | **0.76** | GMAT |
| | | battery k | 2.5 | **1.7** (31 min / 0.3) | GMAT + game |
| | | DSN units | 1.0 | **1.09** (544 / 543 / 481 min/day) | GMAT |

**Notes on the orbit table**
- **Units.** `budget.ts` already shows Earth units × 30 min and deep-space units × 480 min, so the "minutes per day" on the station panel is now real GMAT contact time.
- **LEO lifetime** (`earth_leo400_decay_*`): a 4.0 kg 3U CubeSat, Cd 2.2, MSISE-90 atmosphere, NASA MSFC Schatten solar-flux predictions shipped with GMAT, from 400 km down to 150 km.
  - Body-mounted panels (0.03 m²): **11.0 months nominal**, 9.0 months at +2σ solar activity, 14.8 months at −2σ.
  - Large deployed wings (0.08 m²): 3.6 months nominal, 3.0 months at +2σ.
  - The game keeps one lifetime per orbit, the nominal body-mounted 11 months. Drag area is not yet linked to the solar panels chosen.
- **LLO station keeping.**
  - With no maneuvers, GRAIL gravity pulls the periapsis of the 100 km polar orbit down to ~78 km in 15 days and to 47 km in 90 days.
  - The eccentricity reached within 28 days is removed by tangential burns, with Δv = v·Δe/2 per 28-day cycle.
- **Frozen orbit.** The 30 × 200 km orbit at 86° with periapsis over the south pole (LRO-like) stays between 14 and 30 km periapsis for a year with no maneuvers. Its Δv bound is v·(e_max − e_min)/2.
- **NRHO.** The initial state is the L2 southern 9:2 NRHO from our CR3BP differential corrector (`tools/orbits/nrho.py`). GMAT propagated it for two revolutions in the Moon + Earth + Sun ephemeris model with no station keeping. The NRHO station-keeping value (1 m/s per month) is game balance and was not computed.
- **Not computed, kept as game balance:** orbit-insertion and transfer Δv, coverage factors (except the LEO latitude band), launcher prices, capacities and coverage multipliers, and the commercial 13 m dish.

## 2. Components (NASA SOA 2025 / CubeSat 101)

Every component has `nasaRef` and `sources` (from `components.json`), as listed in the table below.

| Mission · item | value | before | after | source |
|---|---|---|---|---|
| Earth · batteries 20 / 40 / 80 Wh | mass | 0.25 / 0.45 / 0.85 kg (80–94 Wh/kg) | **0.17 / 0.33 / 0.67 kg** (120 Wh/kg) | SOA §3.4.1, PDF p.61: packs 57.75–178.1 Wh/kg, most 110–178; p.59: cells 150–270 Wh/kg |
| Lunar · batteries 300 / 600 / 1200 Wh | mass | 5 / 9 / 17 kg (60–71 Wh/kg) | **3.5 / 7 / 13 kg** (~90 Wh/kg) | SOA §3.4.1, PDF p.61: space-grade Saft VES16 91 Wh/kg |
| Mars · batteries 800 / 1600 / 3000 Wh | mass | 12 / 22 / 38 kg | **9 / 18 / 33 kg** (~90 Wh/kg) | same |
| Earth · UHF radio | GB per contact unit | 0.4 (≈ 60 kbps, faster than any UHF radio in the SOA) | **0.26** (38.4 kbps × 30 min/day × 30 d) | SOA §9.2.8, PDF p.294–295: UHF 9.6 kbps typical, 0.1–38.4 kbps |
| Lunar · monoprop small / large | Δv at 200 kg | 700 / 1150 m/s | **560 / 1090 m/s** | Isp 250 s (ASCENT GR-22, SOA §4.6.1, PDF p.127; hydrazine 200–235 s, p.87), 90% of system mass is propellant, rocket equation |
| Lunar · bipropellant | Δv at 200 kg | 1900 m/s | **2010 m/s** | Isp 300 s (SOA §4.6.1, PDF p.125–126: hydrazine/NTO 285 s, green biprop 250–310 s), 90% propellant |
| Mars · monoprop large | Δv at 500 kg | 700 | **600** | 250 s, 90% |
| Mars · biprop / biprop extended | Δv at 500 kg | 1500 / 2300 | **1310 / 2060** | 300 s, 90% |
| Mars · solar-electric | Δv at 500 kg | 4000 | **2640** | Isp 1,900 s (SOA §4.5/§4.6.2, PDF p.86, 133–135: Hall 1,390–1,920 s, BIT-3 ion 1,960 s), 60% of the system mass is xenon/iodine. This also removes the known "SEP dominates Mars" skew from GAME_DESIGN §12. |

The rocket equation is Δv = Isp · g0 · ln(m_ref / (m_ref − f · m_system)). The game keeps its linear rule `dvHave = dvAtRef × refMass / mass`.

**Checked and kept** (game value inside the NASA range):
- **Solar panels.**
  - Earth body / deployable / tracking: 8 W / 20 W / 30 W at 0.2 / 0.5 / 0.8 kg. The SOA gives body 3U faces of 8–8.4 W at 54–76 W/kg, 3U deployables of 7–21.6 W, and articulated arrays at 30–31 W/kg or 28–42 W for a 3U (PDF p.51–52).
  - Lunar and Mars wings: 21–34 W/kg. The SOA clusters arrays at ~30 W/kg, with DSA wings at 34–60 W/kg (p.51–53).
- **CubeSat radios.**
  - Mass: UHF 0.15 kg (SOA 22–158 g), S-band 0.3 kg (70–1360 g), X-band 0.6 kg including the antenna (transmitters 130–300 g).
  - Data rate: S-band and X-band volumes are deliberately scaled below the real 1–20 Mbps and 25–50 Mbps, together with the instruments' data volume. They are labelled `game balance (scaled)`.
- **Attitude control.**
  - Magnetorquer board: 0.2 kg / 1 W, against the SOA's 0.196–0.205 kg / 0.4–1.2 W (p.169).
  - Reaction wheels + star tracker: 0.6 kg / 3 W, inside the SOA's 0.26–1.813 kg integrated units (p.165).
  - Pointing classes: <15° for coarse and 0.003° for fine (p.29), with star trackers at 2–40″ (p.172).
- **Onboard computers.** 1–3 W for CubeSats against the SOA's 0.1–5 W, and 10–35 W for larger spacecraft against 5–12 W for rad-hard boards plus recorders (p.260–261).
- **CubeSat schedule.** The 12-month Earth limit is at the short end of CubeSat 101's "as little as 9 months, typically 18 to 24 months" (p.17). This is game balance.
- **Launch.** Earth rideshares cost $0.15–0.45 M, against $300k (CSLI, CubeSat 101 p.19) and $350k for ~50 kg (SOA p.322).
- **Lunar platform.** The 250 kg limit sits next to the ESPA port's 257 kg (SOA p.323).

**No NASA reference (game balance):**
- **Science instruments.** All three missions, because the SOA report has no instrument chapter.
- **Computer storage.** The SOA gives only "hundreds of KB to several GB" (p.254).
- **Prices, budgets, test campaigns and event chances.**

## 3. Balance after calibration

The enumeration was re-run with `python3 tools/balance_check.py earth|lunar|mars` and `FULL_BALANCE=1 npm test`. The TS engine matches Python on every design.

| | Earth | Lunar | Mars |
|---|---|---|---|
| Feasible designs | 181,850 → **199,813** | 711,808 → **676,658** | 396,902 → **360,256** |
| Meet required data | 14,633 (8.0%) → **17,630 (8.8%)** | 1,517 (0.21%) → **1,736 (0.26%)** | 991 (0.25%) → **1,154 (0.32%)** |
| … of them 85+ | 1,406 → **1,448** | 117 → **172** | 192 → **93** |
| Max score | 93.4 → **95.5** | 92.2 → **94.3** | 97.4 → **91.9** |

**Balance properties after calibration**
- **Only a minority meets the required data:** about 1 in 11 designs on Earth and about 1 in 300–400 on the Moon and Mars.
- **Difficulty still rises Earth → Lunar → Mars.** Mars has the fewest 85+ designs and the lowest top score.
- **No single winning build.** The top 1% still mixes instruments, radios, orbits and launchers. Mars top 1% propulsion is biprop 1,859, SEP 1,352 and biprop_xl 391 (it was SEP-dominated before). The Mars top-1% orbits are aerobrake 1,612, capture 1,106 and direct 884.
- **"Best of everything" still fails on budget** (engine test 2).
- **Test fixtures.** The fixtures in `src/engine/balance.test.ts` and `engine.test.ts` were regenerated from the Python script, not hand-edited. Engine-test changes:
  - LEO now ends after month 11, so the decay warning comes at month 9.
  - The Svalbard SSO contact is 118 min/day.

