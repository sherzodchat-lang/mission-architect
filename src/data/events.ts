// Event definitions (GAME_DESIGN.md 7.3). Texts are English UI strings.
// Numbers are filled in by the engine (engine/simulate.ts) from the current design.

import type { VoiceId } from './voiceLines';

export type EventId =
  | 'launch_slip'
  | 'deploy'
  | 'glitch'
  | 'flare'
  | 'outage'
  | 'wheel'
  | 'battery_wear'
  | 'decay'
  | 'insertion'
  | 'aerobrake'
  | 'dsn_busy';

/** Events that pause the simulation for a decision. */
export type DecisionEventId = 'deploy' | 'glitch' | 'flare' | 'outage' | 'wheel' | 'insertion' | 'aerobrake' | 'dsn_busy';

export type OptionId =
  | 'retry_release' | 'accept_half_power'
  | 'upload_patch' | 'reboot_only'
  | 'safe_mode' | 'keep_observing'
  | 'emergency_pass' | 'wait_out'
  | 'attempt_reset' | 'switch_backup'
  | 'burn_longer' | 'accept_orbit'
  | 'aggressive' | 'gentle'
  | 'request_priority' | 'wait_dsn';

export interface EventTextContext {
  stationName?: string;
  instrumentName?: string;
  costM?: number;
  signalDelayMin?: number;
}

export interface EventOptionText {
  id: OptionId;
  label: string;
  /** Short tag before the cost text, e.g. 'Lower risk'. */
  tag: string;
  /** Whether this is the protective choice (Mars: science loss ×1.5 without autonomy). */
  protective: boolean;
}

export interface EventDef {
  id: EventId;
  title: string;
  /** One line "what happened". */
  what: (ctx: EventTextContext) => string;
  tag: 'science' | 'systems';
  voice?: VoiceId;
  sfx?: string;
  /** Empty for automatic events. Option A first. */
  options: EventOptionText[];
}

export const EVENTS: Record<EventId, EventDef> = {
  launch_slip: {
    id: 'launch_slip', title: 'Launch slip', tag: 'systems', options: [],
    what: () => 'The primary payload on your rideshare is late. Your launch moves one month to the right.',
  },
  deploy: {
    id: 'deploy', title: 'Deployment anomaly', tag: 'systems', voice: 'v13_anomaly', sfx: 'ui_warning',
    what: () => 'One solar panel did not swing open. The spacecraft is running on half power.',
    options: [
      { id: 'retry_release', label: 'Retry release', tag: 'Full power if it works', protective: false },
      { id: 'accept_half_power', label: 'Accept half power', tag: 'No risk', protective: true },
    ],
  },
  glitch: {
    id: 'glitch', title: 'Software glitch', tag: 'systems', voice: 'v13_anomaly', sfx: 'ui_warning',
    what: () => 'The flight software crashed and the spacecraft rebooted itself. A bug is still hiding in the code.',
    options: [
      { id: 'upload_patch', label: 'Upload patch', tag: 'Fix it for good', protective: true },
      { id: 'reboot_only', label: 'Reboot only', tag: 'Keep observing', protective: false },
    ],
  },
  flare: {
    id: 'flare', title: 'Solar flare', tag: 'systems', voice: 'v11_flare', sfx: 'flare',
    what: () => 'A burst of radiation from the Sun is hitting the spacecraft electronics.',
    options: [
      { id: 'safe_mode', label: 'Switch to safe mode', tag: 'Lower risk', protective: true },
      { id: 'keep_observing', label: 'Keep observing', tag: 'More science', protective: false },
    ],
  },
  outage: {
    id: 'outage', title: 'Ground station outage', tag: 'science', voice: 'v12_outage', sfx: 'ui_warning',
    what: (c) => `${c.stationName ?? 'A ground station'} is offline for maintenance this month.`,
    options: [
      { id: 'emergency_pass', label: 'Buy emergency pass', tag: 'Keep the data flowing', protective: true },
      { id: 'wait_out', label: 'Wait it out', tag: 'Save money', protective: false },
    ],
  },
  dsn_busy: {
    id: 'dsn_busy', title: 'Antenna reassigned', tag: 'science', voice: 'v12_outage', sfx: 'ui_warning',
    what: (c) => `${c.stationName ?? 'Your Deep Space Network antenna'} has been reassigned to another mission for this step.`,
    options: [
      { id: 'request_priority', label: 'Request priority time', tag: 'Keep the link', protective: true },
      { id: 'wait_dsn', label: 'Wait it out', tag: 'Save money', protective: false },
    ],
  },
  wheel: {
    id: 'wheel', title: 'Reaction wheel fault', tag: 'systems', voice: 'v13_anomaly', sfx: 'ui_warning',
    what: () => 'One reaction wheel is spinning roughly and drawing too much current.',
    options: [
      { id: 'attempt_reset', label: 'Attempt reset', tag: 'Keep fine pointing if it works', protective: false },
      { id: 'switch_backup', label: 'Switch to backup', tag: 'Safe but coarse', protective: true },
    ],
  },
  battery_wear: {
    id: 'battery_wear', title: 'Battery wear', tag: 'systems', options: [],
    what: () => 'Deep discharges in every eclipse are wearing the battery out. Instruments get less run time each month.',
  },
  decay: {
    id: 'decay', title: 'Orbit decay', tag: 'systems', options: [],
    what: () => 'Air drag is pulling the satellite down. Re-entry is expected in about two months.',
  },
  insertion: {
    id: 'insertion', title: 'Orbit insertion burn', tag: 'systems', voice: 'v13_anomaly', sfx: 'engine_burn',
    what: () => 'The engine is under-performing during the braking burn. The orbit will be higher than planned.',
    options: [
      { id: 'burn_longer', label: 'Burn longer', tag: 'Reach the planned orbit', protective: false },
      { id: 'accept_orbit', label: 'Accept the orbit', tag: 'Save fuel', protective: true },
    ],
  },
  aerobrake: {
    id: 'aerobrake', title: 'Aerobraking campaign', tag: 'systems', sfx: 'ui_warning',
    what: () => 'Time to dip into the upper atmosphere to lower the orbit. How hard do you push?',
    options: [
      { id: 'aggressive', label: 'Aggressive passes', tag: 'Science one step sooner', protective: false },
      { id: 'gentle', label: 'Gentle passes', tag: 'No risk', protective: true },
    ],
  },
};

/** Line shown in the event window on Mars when the computer is not autonomous. */
export function signalDelayLine(minutes: number): string {
  return `Signal delay: ${minutes} min — the spacecraft acts on its own until your command arrives`;
}

export const DECISION_PAUSE_TEXT = 'The simulation is paused until you decide';
