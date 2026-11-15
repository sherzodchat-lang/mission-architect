# Mission Architect — engine, data and store API

Everything a screen needs. Engine = pure functions (`src/engine`, no React). Data = plain objects (`src/data`).
Store = Zustand (`src/store/gameStore.ts`). Import from the barrels:

```ts
import { MISSIONS, EVENTS, GLOSSARY, ANALOG_LIST, VOICE_LINES } from '../data';
import type { Mission, Design, MissionId } from '../data';
import { evaluateDesign, getTimeline, fmtMoney } from '../engine';
import { useGameStore, useMission, useDesignEvaluation } from '../store/gameStore';
```

All UI text from the engine is English. Numbers are raw floats: round them for display (or use `fmt*`).

---

## 1. Data (`src/data`)

### Mission (`MISSIONS[id]`, `MISSION_ORDER = ['earth','lunar','mars']`)
| field | meaning |
|---|---|
| `id, name, difficulty, objective, summary` | card texts |
| `limits: { budgetM, massKg, devMonths, requiredGB, requiredLabel, steps }` | `requiredLabel` e.g. `'50 GB'`, `'1.2 TB'`; `steps` = 12 |
| `platform: { name, kg, watts, costM }` | fixed bus (3U structure etc.) |
| `baseTime, overFee, overScorePenalty, overAllowed, solarFactor, stepMonths, dvRefMass` | formula params (`dvRefMass` null = no propulsion) |
| `scienceTarget, timelineLabel` | `'Mission timeline • 12 months'` / `• 24 months` |
| `body: { name, color, glow, radiusKm, distanceKm }` | central SVG disc (Earth/Moon/Mars) |
| `categories: CatalogCategory[]` | **builder tabs, in order** (see below) |
| `catalog: { instruments, solar, battery, radio, computer, attitude, propulsion }` | component lists |
| `orbits: Orbit[]`, `defaultOrbit` | Earth includes `geo` with `available:false` + `unavailableReason` |
| `launchers: Launcher[]`, `stations: Station[]`, `stationsMin/Max`, `stationsNote` | |
| `tests: TestCampaign[]`, `defaultTest` | Test campaign block on screen 04 |
| `phases: PhaseRow[]` | for a "phases" info table |
| `rules: string[]` | special rules for the mission card |
| `massDecimals` | 2 for Earth, 0 for Lunar/Mars |

**CatalogCategory** `{ id, label, slotNumber, slotLabel, groups, options }`
- Tab label = `label` (`Instruments`, `Power`, `Comms`, `Computer`, `Attitude control`, `Propulsion`).
- Schematic slot = `slotNumber` + `slotLabel` (1 Science payload, 2 Onboard computer, 3 Radio + antenna, 4 Attitude control, 5 Battery + EPS, 6 Propulsion).
- `groups: { key: SlotKey, label, min, max }[]` — Power has two groups (`solar`, `battery`). Cards of a group = `mission.catalog[group.key]`. `max` 3 for instruments, 1 otherwise.
- `options: { key:'burnWire', label, description, kg, costM }[]` — Earth Power tab checkbox `Redundant burn wire` (description = tooltip).

**Components** (all have `id, name, description, kg, costM, months, kind`):
- `Instrument`: `watts, gbPerMonth, value, quality:[none,coarse,fine]`
- `SolarArray`: `sunWatts, deployRisk, deployRiskRedundant?`
- `Battery`: `wh`
- `Radio`: `watts, gbPerUnit, pointingFactor:[none,coarse,fine]`
- `Computer`: `watts, storageGB, flareDamage, autonomous`
- `Attitude`: `watts, pointing (0|1|2), wheelFaultChance` — label via `POINTING_LABEL[p]`
- `Propulsion`: `dvAtRef, extraCruiseSteps` (Δv at `mission.dvRefMass` kg)

Card stat lines: build them from these fields with `fmtKg/fmtW/fmtMoney/fmtGBmo` (e.g. `1.5 kg · 6 W · $1.20M · +3 mo · 8 GB/mo`).

**Orbit** `{ id, name, short, description, available, unavailableReason?, altitude?, inclination?, period?, sunFraction, coverage, lastStep, batteryK, dvInsert, dvKeepPerStep, scienceDelaySteps, flareExtraDamage, secondFlareChance, contactUnits, stationNotes }` — `description` is the one-line property shown under the selected orbit.

**Launcher** `{ id, name, capacityKg, costM, waitMonths, orbits, coverageMult, transferDv, cruiseSteps, canSlip, note }`.
**Station** `{ id, name, location, latitude?, costM, description }`.
**TestCampaign** `{ id, name, description, costM, months, glitchChance, insertionProblemChance, forecastHealthPenalty }`.

**Design** (the player's choices; plain JSON):
```ts
{ instruments: string[]; solar; battery; radio; computer; attitude; propulsion: string|null;
  burnWire: boolean; orbit: string|null; launcher: string|null; stations: string[]; test: string|null }
```

### Other data
- `EVENTS: Record<EventId, EventDef>` — `{ id, title, what(ctx), tag, voice?, sfx?, options[] }`. You rarely need it: the sim's `pending` already has final texts. `DECISION_PAUSE_TEXT`, `signalDelayLine(min)`.
- `GLOSSARY: Record<id, {id, term, text, scope}>`, `GLOSSARY_LIST` — ids: `cubesat, 3u, payload, leo, sso, geo, inclination, eclipse, downlink, ground_station, contact_window, attitude_control, reaction_wheel, magnetorquer, safe_mode, rideshare, margin, solar_flare, duty_cycle, delta_v, propellant, orbit_insertion, station_keeping, frozen_orbit, halo_orbit, aerobraking, launch_window, signal_delay, dsn, high_gain_antenna, sep`.
- `ANALOG_LIST / ANALOGS[id] / ANALOG_COUNT (13)` — `{ id, mission, name, tagline, text, match, url, agency }`. Main menu shelf: `progress.analogs` ids vs `ANALOG_LIST` (`3 / 13 discovered`). Button `Explore the real mission` → `url`.
- `VOICE_LINES: Record<VoiceId, {id, file, path, trigger, text}>`, `VOICE_LIST`. `path` = `audio/voice/<id>.mp3` (prefix with `import.meta.env.BASE_URL`). Subtitle text = `text`.

---

## 2. Budget (`evaluateDesign`)

```ts
evaluateDesign(design: Design, mission: Mission): DesignEvaluation
emptyDesign(mission): Design            // defaults: orbit = defaultOrbit, stations = defaultStations, test = defaultTest
computeCore(design, mission, { extraMonths? }): CoreNumbers   // raw section-6 numbers
resolveDesign(design, mission): ResolvedDesign                 // ids → objects
```

`DesignEvaluation`:
| field | use |
|---|---|
| `gauges: Gauge[]` | order: mass, power, budget, data, comms, time (+ `fuel` on Lunar/Mars). Build `ResourceStrip` from this list. |
| `issues / criticals / warnings: Issue[]` | warning panels |
| `canLaunch` | no criticals at all → enable Launch |
| `designReady` | no criticals with `scope:'design'` → builder "Next" |
| `allGreen` | all gauges green (voice `v06_design_ok`) |
| `launchers: LauncherStatus[]` | launcher cards |
| `stations: StationStatus[]` | station list/map |
| `orbits: OrbitStatus[]` | orbit cards (GEO disabled with reason) |
| `statusLine` | bottom bar center text (`Resolve critical warnings before launch` / `Orbit and launch configuration compatible` / `N warnings — you can launch at your own risk`) |
| `core: CoreNumbers` | `mass, massAvailable, costM, timeMonths, overMonths, supplyW, busLoadW, instLoadW, demandW, duty, dutyPower, batteryUndersized, batteryNeedWh, pointing, coverage, contactUnits, generatedPerMonth, capacityPerMonth, bufferNeedGB, storageGB, quality, pointingQuality, radioFactor, cruiseSteps, dvHave, dvNeed, scienceSteps, scienceMonths` |

`Gauge { id, label, unit, used, available, margin, status: 'green'|'amber'|'red', valueText, breakdown, availableBreakdown, tooltip }`
- `valueText` = `'4.35 kg / 5 kg'`; `tooltip` = `'Power: Thermal Infrared Camera 5 W + Compact Spectrometer 4 W + 3U CubeSat structure 1 W + … = 16 W of 19.8 W'`.
- `breakdown/availableBreakdown: { label, value, text }[]` for richer hover cards.
- Status: red = critical; amber = warning or margin < 5%; green otherwise.

`Issue { code, severity: 'critical'|'warning', scope: 'design'|'launch', what, why, fix, gauge?, slot?, voice? }`
- Render as the three-part panel: **what** / why / fix (section 4.1).
- `scope:'launch'` issues (no launcher, launcher can't reach orbit, too heavy for rocket, no station, GEO) belong on screen 04; hide them on the builder.
- `slot` (for `missing_component`) → which tab/schematic slot to open.
- `voice`: `v03_warning_power`, `v04_warning_mass`, `v05_warning_budget`, `v23_fuel` — play the first time an issue with that code appears (max once per step, section 14.3).
- Codes: critical `mass_limit, mass_launcher, budget, power_bus, missing_component, orbit_unavailable, no_launcher, launcher_orbit, no_station, fuel, schedule_window`; warning `power_instruments, battery_small, comms_bottleneck, storage_buffer, schedule_over, pointing_instrument, pointing_radio`.

`LauncherStatus { id, name, compatible, reason, orbitPayloadKg, spacecraftKg, launchPriceM, flies, overCapacityKg }` — `reason` is `'Compatible'`, `'Does not fly to this orbit'` or `'Spacecraft is 1.1 kg over capacity'`. Card rows: `Orbit payload`, `Your spacecraft`, `Launch price`.

`StationStatus { id, name, location, costM, selected, units, minutesPerDay, usable, note }` — `note` is the tooltip (Svalbard on LEO: "This orbit never rises above the horizon here…"; on SSO: polar-orbit note; deep-space missions: DSN note). One unit = 30 min/day on Earth, about 8 h/day (a third of the day) per Deep Space Network station on Lunar/Mars.

`forecastDesign(design, mission): Forecast | null` (in scoring) — deterministic expected score without events (exact port of `tools/balance_check.py`). `null` = cannot launch. Useful for a "Predicted score" hint. `Forecast { total, science, returned, generated, mass, cost, time, duty, cap, gen, health, score, core }`.

---

## 3. Simulation (`simulate.ts`)

```ts
createSim(design, mission, seed): SimState           // throws SimDesignError if !canLaunch
advance(state, mission): SimState                     // play next step (or open a decision)
decide(state, mission, optionId): SimState            // resolve pending decision + finish that step
runToEnd(state, mission, policy?): SimState           // 'protective' (default) | 'risky' | 'first' | (p)=>OptionId
getTimeline(state, mission): TimelineStep[]           // 12 dots
phaseOf(state, mission, step): StepPhase
reserveM(state): number                               // budget left for in-flight purchases
isFinished(state): boolean
```
All functions return a **new** state (never mutate) and are deterministic for a given seed.

### UI loop
```ts
// on Operations screen mount: store.launch() already created store.sim
const speedMs = speed === '4x' ? 1500 : 6000;
useEffect(() => {
  if (paused || sim.status !== 'running') return;          // 'decision' pauses automatically
  const t = setTimeout(() => store.simAdvance(), speedMs);
  return () => clearTimeout(t);
}, [sim, paused, speed]);
// sim.status === 'decision' → modal from sim.pending; button → store.simDecide(option.id)
// sim.status 'complete' | 'lost' → store.report is ready → "View report" → store.showReport()
```
After each new state, look at **new** `sim.log` entries (compare `id` with the last one you saw): show them in the Mission log, and if an entry has `voice` queue `VOICE_LINES[voice]` (+ subtitle), if it has `sfx` play `public/audio/sfx/<sfx>.mp3`. (Pending decisions also list `voices`; these are the same lines already attached to log entries — don't play both.)

### `SimState` (main fields)
`status: 'running'|'decision'|'complete'|'lost'`, `endReason: 'completed'|'decayed'|'lost'|null`, `step` (completed steps 0…12), `totalSteps`, `lastStep` (LEO 10), `stepMonths`, `cruiseSteps`, `pending: PendingDecision|null`,
`health, storedGB, returnedGB, generatedGB, lostGB, science`, `devMonths, overMonths, launchSlip, preflightCostM, spentInFlightM, budgetLimitM`,
`telemetry: TelemetryPoint[]` (one per completed step), `log: LogEntry[]`, `decisions: DecisionRecord[]`, `seed`.

Bottom summary line: `Science collected` = `science` (of `mission.scienceTarget`), `Data returned` = `returnedGB` (of `requiredGB`), `Health` = `health`.

### `PendingDecision` (event window, screen 05)
`{ eventId, step, title, what, options: DecisionOption[], signalDelayLine?, signalDelayMin?, pauseText, voices, sfx?, reserveM }`
- `title` + `what` (one line) + `pauseText` ("The simulation is paused until you decide").
- Mars without the autonomous computer: show `signalDelayLine` ("Signal delay: 14 min — the spacecraft acts on its own until your command arrives").
- `DecisionOption { id, label, tag, costText, riskChance, costM, disabled, disabledReason?, protective }` — button = `label`; under it `costText`, e.g. `Lower risk · −50% science this month` / `More science · 35% risk of hardware damage`. `disabled` when the reserve can't pay `costM` (show `disabledReason`).

Events: `deploy, glitch, flare, outage (Earth) / dsn_busy (Lunar, Mars), wheel, insertion, aerobrake` need decisions; `launch_slip, battery_wear, decay` are automatic log entries. Insertion success is a log entry with `eventId:'insertion'`.

### `LogEntry`
`{ id, step, month, tag: 'science'|'systems', level: 'info'|'good'|'warning'|'critical', title, text, eventId?, voice?, sfx? }` — filters `All / Science / Systems` use `tag`. Step 0 = pre-launch (launch slip, countdown with `v08_countdown` + `launch` sfx).

### `TelemetryPoint` (charts and tiles)
`{ step, month, phase, phaseName, batteryPct, storedGB, downlinkedGB, generatedGB, returnedTotalGB, generatedTotalGB, lostTotalGB, scienceTotal, solarInputW, payloadDrawW, coreTempC, link: 'nominal'|'degraded'|'offline', linkText, capacityGB, duty, health, fuelPct, distanceToTargetKm, activeStations }`
- Charts: `Battery` = batteryPct, `Stored data` = storedGB, `Downlinked data` = downlinkedGB (per step) or returnedTotalGB.
- Tiles: `Solar input` = solarInputW, `Payload draw` = payloadDrawW, `Core temperature` = coreTempC (cosmetic), `Link status` = linkText.
- During cruise `distanceToTargetKm` is set (show distance instead of the station beam). `activeStations` → which station beams to draw.

### `TimelineStep`
`{ step, kind: 'launch'|'cruise'|'commissioning'|'aerobraking'|'science'|'ended', name, scienceFactor, label ('Month 3' / 'Months 5–6'), events: EventId[] (already happened), current, done }`.

---

## 4. Scoring & report (`scoring.ts`)

```ts
buildReport(state, mission, mode = 'solo'): MissionReport
computeScore(mission, inputs, mode): ScoreBreakdown
marginFactor(m), computeOutcome(mission, returnedGB, survived), computeStars(total, outcome)
pickAnalog(design, mission): Analog
```
`MissionReport`:
- `outcome: 'success'|'partial'|'failure'`, `outcomeTitle` (`Mission Success` …), `stars 0–3`, `totalRounded`, `seed`, `design`.
- `score: { categories, efficiencyParts, penalty, total }` — 4 categories `{ id, label, points, max, detail }`: Science return /30, Resource efficiency /25, Reliability /25, Operations /20. `total = Σ points − penalty` (penalty = 2 × overrun months). `efficiencyParts` = mass/power/budget/time `{ margin, factor, weight, points }`.
- `stats: { science, scienceTarget, returnedGB, requiredGB, generatedGB, lostGB, health, stepsOperated, totalSteps, finalCostM, spentInFlightM, reserveLeftM, devMonths, overMonths, launchSlip, endReason }`.
- `cards: ReportCard[]` (1–4, "What happened and why") `{ id, color: 'good'|'lesson'|'loss', title, text, nextTime, months?, impact }` — color: good = green, lesson = amber, loss = red. Decisions of the same kind are merged into one card (`months` lists when, text ends "Happened in months 6 and 8."). There is always at least one card with `nextTime` (an improvement card from the biggest lost score component, or the tightest margin when nothing was lost).
- `chain: {label, value, bottleneck}[]` = Sensor → Onboard storage → Antenna → Earth (always present; `bottleneck` is true on the limiting node when returned < generated or comms was limiting, otherwise none).
- `analog: Analog` ("Your mission resembles"), `voice` (`reportVoice()`: `v18_failure` only if the spacecraft was lost; survived → `v16_success` / `v17_partial` / `v18b_low_data`), `sfx` (`report_success`/`report_fail`).

---

## 5. Store (`useGameStore`)

State: `mode: 'solo'`, `screen: 'menu'|'missions'|'builder'|'orbit'|'sim'|'report'|'howto'`, `missionId`, `design`, `past/future` (undo stacks), `seed`, `sim`, `report`, `newlyUnlocked: MissionId[]`, `progress: { stars, bestScore, analogs }`, `saves: SavedDesign[]`, `unlockAll`, `lastAutosaveAt` (show `Autosaved`).

Actions:
| action | notes |
|---|---|
| `goTo(screen)` | plain navigation (Back buttons) |
| `selectMission(id)` | ignored if locked; switching mission resets the design |
| `startDesign()` | fresh design + new seed → `builder` |
| `hasDraft()`, `continueDraft()` | Main menu `Continue last design` (`ma_draft`) |
| `toggleInstrument(id)` | max 3 |
| `setComponent(key, id\|null)`, `toggleComponent(key, id)` | single-choice slots (`solar, battery, radio, computer, attitude, propulsion`) — `+` / `−` buttons |
| `setBurnWire(on)`, `setOrbit(id)` (ignores unavailable), `setLauncher(id\|null)`, `toggleStation(id)` (max per mission), `setTest(id)` | |
| `undo()`, `redo()`, `resetDesign()` | use `selectCanUndo/selectCanRedo` selectors |
| `launch({ acceptRisk? })` → `{ ok, reason?, evaluation }` | `reason:'critical'` = blocked; `'needs_confirmation'` = warnings → show "Launch at your own risk" then call `launch({ acceptRisk: true })`. On ok: screen → `sim`. |
| `simAdvance()`, `simDecide(optionId)`, `simSkipToEnd(policy?)` | when the sim ends, `report` + `progress` (stars, analogs → `ma_progress`) + `newlyUnlocked` are set automatically |
| `showReport()` | → `report` screen |
| `redesign()` | `Redesign and relaunch`: same design, **new seed**, → `builder` |
| `saveCurrentDesign(name)`, `loadSavedDesign(id)`, `deleteSavedDesign(id)` | up to 5 (`ma_saves`), score/stars filled when the design has flown |
| `setUnlockAll(on)`, `isUnlocked(id)` | `?unlock=all` sets `unlockAll` at start; hidden How-to-Play button can call `setUnlockAll(true)` |

Hooks: `useMission()` (current Mission), `useDesignEvaluation()` (memoized `evaluateDesign` of the current design), `getMissionData()` (non-hook).

Stepper (`Mission → Design → Orbit → Launch → Operations`): Orbit ✓ when `design.orbit` set, Launch ✓ when `design.launcher` set and that launcher is compatible.

Persistence (`src/store/persistence.ts`): `loadProgress/saveProgress/recordResult`, `loadDraft/saveDraft/clearDraft`, `loadSaves/writeSaves`, `isMissionUnlocked(id, progress, unlockAll)` (★★ earth → lunar, ★★ lunar → mars), `unlockAllFromUrl()`, `LOCKED_TEXT` = `Earn ★★ on the previous mission to unlock`. All storage access is try/catch.

Formatting (`format.ts`): `fmtMoney(1.2)='$1.20M'`, `fmtKg(v, mission)`, `fmtW`, `fmtGB` (≥1000 → TB), `fmtGBmo`, `fmtMonths`, `fmtDv`, `fmtPct(0.35)='35%'`.

---

## 6. Real ephemerides — JPL Horizons (`src/data/nasa/horizons.ts`)

The Lunar and Mars missions run on a snapshot of the **NASA/JPL Horizons API** (`node tools/fetch_horizons.mjs` refreshes `src/data/nasa/horizons.json`, ~60 KB: query URLs, retrieval date and Horizons version are in `HORIZONS_META`). Source is registered in `src/data/nasa/sources/horizons.ts`. All dates are ISO `'YYYY-MM-DD'` strings (UTC).

```ts
import { nextMarsWindow, marsWindows, marsLightTimeMin, marsDistanceKm, moonDistanceKm, moonLightTimeSec,
         helioPositions, helioTrack, transferPosition, fmtDate, PROGRAMME_START, devEndDate } from '../data/nasa/horizons';
```

| function | returns |
|---|---|
| `nextMarsWindow(afterDate)` | first real Mars launch window with `optimal >= afterDate` (or `null` after 2031): `MarsWindow { id, open, optimal, close, c3, tofDays, arrival, arrivalLightMin, marsAtArrival, transfer }` (`transfer` = heliocentric arc `[x,y]` AU for drawing). **Use this on mission select** (e.g. `nextMarsWindow(devEndDate(devMonths))`, show `fmtDate(w.optimal)`). |
| `marsWindows()`, `windowAfter(w)` | all windows in the snapshot: 8 Nov 2026, 23 Nov 2028, 28 Dec 2030 (each ~26 months apart, ~280-day transfer) |
| `marsScheduleCheck(devMonths, devLimit)` | `{ window, targetWindow, missedByMonths, devEnd }` |
| `marsDistanceKm(date)`, `marsLightTimeMin(date)` | real Earth–Mars range and one-way light time (4.9–19.8 min in the snapshot) |
| `moonDistanceKm(date)`, `moonLightTimeSec(date)` | real Earth–Moon distance (356 700–406 700 km) and light time (1.19–1.36 s) |
| `helioPositions(date)`, `helioTrack(from, to)`, `marsPhaseAngleDeg(date)` | Earth/Mars heliocentric ecliptic positions (AU, 5-day samples, interpolated) for the transfer visual |
| `transferPosition(w, date)`, `transferDistanceToMarsKm(w, date)` | spacecraft position / distance to Mars along the Lambert transfer |
| `addMonths, addDays, monthsBetween, fmtDate ('23 Nov 2028'), fmtMonthYear` | calendar helpers |

Window method: Lambert-transfer search over Horizons daily Earth/Mars states (launch day × 190–280 day flight, minimum departure + arrival v-infinity); the window is the days within 0.4 km/s of the best. Validated against the published Mars 2020 (17 Jul–11 Aug 2020) and InSight 2018 windows (`HORIZONS_META.validation`).

**Calendar.** `PROGRAMME_START = '2025-11-23'` (fixed, deterministic). Development ends at `start + devMonths`. It is chosen so that the 36-month Mars limit lands exactly on the real 23 Nov 2028 window. Mars launch day = optimal day of the first window on/after the end of development (always 23 Nov 2028 for a legal design). Earth/Moon launch day = development end.

### Additive sim fields
- `SimState`: `programmeStart`, `launchDate`, `arrivalDate` (Moon: launch + cruise; Mars: real transfer arrival; `null` on Earth), `launchWindow: { id, open, optimal, close, tofDays, arrival, c3 } | null` (Mars).
- `LogEntry.date` (ISO, end of that step; step 0 = launch day). New `Cruise update` log lines on Lunar/Mars cruise steps ("12 Apr 2029: Earth–Mars distance 100 million km, one-way signal time 5.5 min, 54 million km to go."). The Countdown line has the launch date and, on Mars, the real window.
- `TelemetryPoint`: `date`, `earthTargetKm` (real Earth–Moon / Earth–Mars distance, `null` on Earth), `lightTimeSec` (real one-way light time, Moon ≈ 1.3 s; `null` on Earth). `distanceToTargetKm` in cruise is now real geometry: Mars = spacecraft–Mars distance along the transfer (reaches 0 at the arrival step); Moon = real Earth–Moon distance × remaining share.
- `PendingDecision`: `date`; Mars `signalDelayMin` is the real light time at that step's date (one decimal, e.g. `Signal delay: 12.6 min — …`). Voice `v22_signal_delay` ("Mind the signal delay. The spacecraft is on its own until our command arrives.") is generic (no number) and plays at the first Mars decision; the log/decision line carries the real delay.
- `stepDate(state, mission, step)`, `targetGeometry(mission, date)` exported from `simulate.ts`.
- Mars `schedule_window` critical now reads `Next Mars launch window: 23 Nov 2028 — you would miss it by 2 months. Development takes 38 months (limit 36 months); the window after it is 28 Dec 2030, 25 months later.` (gap computed from the window dates). The 36-month limit/blocking is unchanged.

---

## Real-mission analogs (NASA data) — `matchAnalogs`, NASA Image Library, NTRS

Data: `src/data/analogs.ts` — `ANALOG_LIST` (23 real missions: 8 Earth CubeSats, 7 lunar, 8 Mars; ids of the original 13 kept for saved collections). Each `Analog` = `{ id, mission, name, short, tagline, text, teaser, url, agency, facts, sources[], image: { nasaId, caption? } | null, imageQuery }`. `facts` = `{ launchYear, massKg, size ('3U'|'6U'|'12U'), sizeText, orbit {classes, text}, aerobraking, instruments [{type: ScienceType, name}], pointing {cls: fine|three_axis|spin, text}, comms {bands, text}, propulsion {cls, text}, solar {cls, text}, power, goal, outcome {cls: success|partial|lost, text} }` — **`null` = not stated in the cited NASA/NSSDCA/ESA source; never guessed**. `INSTRUMENT_SCIENCE` maps game instrument ids to science types.

```ts
designProfile(design, mission, outcome?: 'success'|'partial'|'failure'|'lost'|null, massKg?): DesignProfile
matchAnalogs(profile, mission): { top: AnalogMatch, runnersUp: [AnalogMatch, AnalogMatch] }
// AnalogMatch = { analog, percent (0–100), features: {feature, sim, weight}[], shared: string[] (≤4), differences: string[] (≤2) }
pickAnalog(design, mission): Analog          // = matchAnalogs(designProfile(design, mission)).top.analog
MATCH_WEIGHTS                                // instruments .41, orbit .16, pointing .09, size .09, comms .08, propulsion .06, aerobraking .05, solar .04, outcome .02 (size sim >= 0.7 only within ±35 % mass)
```
Weighted feature similarity against missions to the same body; unknown facts are skipped and a coverage factor (0.75 + 0.25 × known weight) keeps sparse records from winning on one feature. Deterministic, ties by catalog order. `MissionReport.analogMatch` holds the result (built with the flight outcome and final mass); `MissionReport.analog` = `analogMatch.top.analog` (its id goes into `progress.analogs`).

NASA APIs (`src/nasa/`):
- `imageLibrary.ts` — `fetchNasaImage({ nasaId } | { query })`, hook `useNasaImage(nasaId, query?)` → `{ status: loading|ready|missing, image: { nasaId, title, credit, date, description, src (medium JPEG), pageUrl } }`. Live calls to `images-api.nasa.gov` (`/search?nasa_id=`, `/asset/<id>`), memory + localStorage cache (`ma_nasa_images_v1`, 30 days), logo/insignia results skipped, `missing` offline.
- `analogsPhoto.tsx` — `<AnalogPhoto analog credit="corner|none">` photo with credit; falls back to the mission card picture.
- `ntrs.ts` — `papersForAnalog(id)` (1–3 NTRS papers), `paperForCard(cardId)` (one paper per lesson card / event decision), `authorLine(p)`. Snapshot `src/data/nasa/ntrs.json` (NTRS has no CORS) from `node tools/fetch_ntrs.mjs` (curated ids, each verified to resolve; `--search` prints candidates).

---

## 6. NASA references on data objects (`nasaRef`, `sources`)

Every component in `mission.catalog.*`, every `Orbit`, `Station` and `Launcher` can carry two optional fields (types in `src/data/types.ts`, interface `Referenced`). Screens can show them as a "NASA reference: …" tooltip.

```ts
nasaRef?: { text: string; url: string; source: string }   // e.g. source 'NASA SOA 2025 §3.2.2, PDF p.51' or 'NASA GMAT R2026a'
sources?: Record<string, string>                           // per-field provenance, e.g. { kg: 'NASA SOA 2025 §3.4.1', costM: 'game balance' }
```
- `nasaRef.text` is one or two plain-English sentences with the real reference numbers. Show it as is, with a link to `url` and `source` as small print.
- The `sources` labels are `NASA SOA 2025 §x`, `CubeSat 101 §x`, `GMAT` and `game balance`.
- All prices and budgets are `game balance` (game-scaled).
- Science instruments are `game balance`: the NASA SOA report has no instrument chapter.
- `PLATFORM_NASA_REF[missionId]` (exported from `src/data/missions.ts`) gives the reference for the spacecraft bus.
- The raw data lives in `src/data/nasa/components.json` (verbatim NASA quotes with PDF pages) and `src/data/nasa/gmat.json` (NASA GMAT results: period, sunlight fraction, contact minutes per station, LEO decay lifetime, lunar station-keeping Δv).
- Every calibrated value and its source is listed in `src/data/nasa/calibration.md`.
- Orbit `contactUnits` come from GMAT. Earth: 1 unit = 30 min of contact per day. Moon and Mars: 1 unit = 8 h of DSN view per day, so `minutesPerDay` in `evaluateDesign().stations` is real GMAT contact time.
