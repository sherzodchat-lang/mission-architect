// Shared data types for all three missions. Pure data — no React, no engine logic.

export type MissionId = 'earth' | 'lunar' | 'mars';

/** Pointing level: 0 = none, 1 = coarse, 2 = fine. */
export type Pointing = 0 | 1 | 2;
export const POINTING_LABEL: Record<Pointing, string> = { 0: 'None', 1: 'Coarse', 2: 'Fine' };

/** A triple indexed by Pointing (none, coarse, fine). */
export type ByPointing = readonly [number, number, number];

/** Keys of the spacecraft selections inside a Design. */
export type SlotKey = 'instruments' | 'solar' | 'battery' | 'radio' | 'computer' | 'attitude' | 'propulsion';

/** Builder tabs. Earth: 5 tabs, Lunar/Mars: + propulsion. */
export type CategoryId = 'instruments' | 'power' | 'comms' | 'computer' | 'attitude' | 'propulsion';

/** Provenance label of one data value: a NASA document section, a NASA GMAT run, or plain game tuning. */
export type ValueSource = string; // e.g. 'NASA SOA 2025 §3.4.1' | 'GMAT' | 'CubeSat 101 §1.1' | 'game balance'

/** Short NASA reference for a tooltip ("NASA reference: …"). See src/data/nasa/calibration.md. */
export interface NasaRef {
  /** One or two plain-English sentences with the real reference numbers. */
  text: string;
  /** Link to the NASA document / tool. */
  url: string;
  /** Short citation, e.g. 'NASA SOA 2025 §3.2.2, PDF p.51' or 'NASA GMAT R2026a'. */
  source: string;
}

/** Optional provenance carried by every data object (additive; screens may ignore it). */
export interface Referenced {
  nasaRef?: NasaRef;
  /** Per-field provenance, e.g. { kg: 'NASA SOA 2025 §3.4.1', costM: 'game balance' }. */
  sources?: Record<string, ValueSource>;
}

export interface ComponentBase extends Referenced {
  id: string;
  name: string;
  /** One-sentence plain English description for the catalog card. */
  description: string;
  kg: number;
  costM: number;
  /** Development months added to the schedule. */
  months: number;
}

export interface Instrument extends ComponentBase {
  kind: 'instrument';
  watts: number;
  gbPerMonth: number;
  /** Science value per GB. */
  value: number;
  /** Data quality at pointing none / coarse / fine. */
  quality: ByPointing;
}

export interface SolarArray extends ComponentBase {
  kind: 'solar';
  /** Output in full sunlight (near Earth), W. */
  sunWatts: number;
  /** Chance that deployment fails (0 = no deployment needed). */
  deployRisk: number;
  /** Deployment risk with the redundant burn wire option (Earth only). */
  deployRiskRedundant?: number;
}

export interface Battery extends ComponentBase {
  kind: 'battery';
  wh: number;
}

export interface Radio extends ComponentBase {
  kind: 'radio';
  watts: number;
  /** GB per month per ground contact unit. */
  gbPerUnit: number;
  /** Downlink multiplier at pointing none / coarse / fine. */
  pointingFactor: ByPointing;
}

export interface Computer extends ComponentBase {
  kind: 'computer';
  watts: number;
  storageGB: number;
  /** Chance of damage when observing through a solar flare. */
  flareDamage: number;
  /** Autonomous fault protection (Mars signal delay rule). */
  autonomous: boolean;
}

export interface Attitude extends ComponentBase {
  kind: 'attitude';
  watts: number;
  pointing: Pointing;
  /** Chance of a reaction wheel fault during the mission (0 = no wheels). */
  wheelFaultChance: number;
}

export interface Propulsion extends ComponentBase {
  kind: 'propulsion';
  /** Δv in m/s at the mission's reference mass (mission.dvRefMass). */
  dvAtRef: number;
  /** Extra cruise steps (SEP: +1). */
  extraCruiseSteps: number;
}

export type AnyComponent = Instrument | SolarArray | Battery | Radio | Computer | Attitude | Propulsion;

export interface ComponentByKey {
  instruments: Instrument;
  solar: SolarArray;
  battery: Battery;
  radio: Radio;
  computer: Computer;
  attitude: Attitude;
  propulsion: Propulsion;
}

export interface Catalog {
  instruments: Instrument[];
  solar: SolarArray[];
  battery: Battery[];
  radio: Radio[];
  computer: Computer[];
  attitude: Attitude[];
  propulsion: Propulsion[];
}

/** A group of cards inside a builder tab (Power has two: panels and battery). */
export interface CatalogGroup {
  key: SlotKey;
  label: string;
  /** Minimum selections required to launch. */
  min: number;
  /** Maximum selections (1 = single choice). */
  max: number;
}

/** Checkbox option inside a tab (Earth: redundant burn wire). */
export interface CatalogOption {
  key: 'burnWire';
  label: string;
  description: string;
  kg: number;
  costM: number;
}

export interface CatalogCategory {
  id: CategoryId;
  /** Tab label, e.g. 'Attitude control'. */
  label: string;
  /** Slot number on the spacecraft schematic (1-based). */
  slotNumber: number;
  /** Schematic call-out, e.g. 'Science payload'. */
  slotLabel: string;
  groups: CatalogGroup[];
  options: CatalogOption[];
}

export interface Orbit extends Referenced {
  id: string;
  name: string;
  /** Short label for chips, e.g. 'SSO'. */
  short: string;
  /** One-line main property shown under the selected orbit. */
  description: string;
  available: boolean;
  unavailableReason?: string;
  altitude?: string;
  inclination?: string;
  period?: string;
  sunFraction: number;
  coverage: number;
  /** Last operating step (LEO: 10 — re-entry). */
  lastStep: number;
  /** Battery factor k: battery Wh must be ≥ k × demand W. */
  batteryK: number;
  dvInsert: number;
  dvKeepPerStep: number;
  /** Steps without science after insertion (aerobraking: 2). */
  scienceDelaySteps: number;
  /** Extra flare damage chance on this orbit (SSO: +0.10). */
  flareExtraDamage: number;
  /** Chance of a second solar flare. */
  secondFlareChance: number;
  /** Contact units per station id. */
  contactUnits: Record<string, number>;
  /** Station-specific tooltip on this orbit. */
  stationNotes: Record<string, string>;
}

export interface Launcher extends Referenced {
  id: string;
  name: string;
  capacityKg: number;
  costM: number;
  waitMonths: number;
  orbits: string[];
  coverageMult: number;
  transferDv: number;
  cruiseSteps: number;
  /** Rideshare: 25% launch slip chance. */
  canSlip: boolean;
  /** Short feature text for the card. */
  note: string;
}

export interface Station extends Referenced {
  id: string;
  name: string;
  location: string;
  latitude?: string;
  costM: number;
  description: string;
}

export interface TestCampaign {
  id: string;
  name: string;
  description: string;
  costM: number;
  months: number;
  glitchChance: number;
  /** Lunar/Mars: chance of a problem during orbit insertion. */
  insertionProblemChance: number;
  /** Health penalty used ONLY by the deterministic forecast (tools/balance_check.py). */
  forecastHealthPenalty: number;
}

export interface PhaseRow {
  steps: string;
  name: string;
  science: string;
}

export interface Mission {
  id: MissionId;
  name: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  objective: string;
  /** Short card blurb. */
  summary: string;
  limits: {
    budgetM: number;
    massKg: number;
    devMonths: number;
    requiredGB: number;
    /** Label for required data, e.g. '1.2 TB'. */
    requiredLabel: string;
    steps: number;
  };
  /** Over-schedule allowed (with fee)? Mars: false (launch window). */
  overAllowed: boolean;
  platform: { name: string; kg: number; watts: number; costM: number };
  baseTime: number;
  overFee: number;
  overScorePenalty: number;
  solarFactor: number;
  stepMonths: number;
  /** Reference mass for Δv (null = no propulsion). */
  dvRefMass: number | null;
  scienceTarget: number;
  timelineLabel: string;
  body: { name: string; color: string; glow: string; radiusKm: number; distanceKm: number };
  categories: CatalogCategory[];
  catalog: Catalog;
  orbits: Orbit[];
  defaultOrbit: string;
  launchers: Launcher[];
  stations: Station[];
  stationsMin: number;
  stationsMax: number;
  defaultStations: string[];
  /** General tooltip for the station panel. */
  stationsNote: string;
  tests: TestCampaign[];
  defaultTest: string;
  phases: PhaseRow[];
  /** Outage event used by this mission. */
  outageEvent: 'outage' | 'dsn_busy';
  /** Cost of the outage counter-measure ($M). */
  outageFixCostM: number;
  /** Mars signal-delay rule active. */
  signalDelay: boolean;
  /** Special rules shown on the mission card. */
  rules: string[];
  /** Units used for mass formatting (decimals). */
  massDecimals: number;
}

/** The player's choices. Plain JSON — safe to persist. */
export interface Design {
  instruments: string[];
  solar: string | null;
  battery: string | null;
  radio: string | null;
  computer: string | null;
  attitude: string | null;
  propulsion: string | null;
  burnWire: boolean;
  orbit: string | null;
  launcher: string | null;
  stations: string[];
  test: string | null;
}
