// Mission Control voice lines (GAME_DESIGN.md 14.3).
// Files live in public/audio/voice/. A missing file must never break the game.

export type VoiceId =
  | 'v01_welcome' | 'v02_mission_selected' | 'v03_warning_power' | 'v04_warning_mass' | 'v05_warning_budget'
  | 'v06_design_ok' | 'v07_go_for_launch' | 'v08_countdown' | 'v09_deployed' | 'v10_first_contact'
  | 'v11_flare' | 'v12_outage' | 'v13_anomaly' | 'v14_safe_mode' | 'v15_science' | 'v16_success'
  | 'v17_partial' | 'v18_failure' | 'v18b_low_data' | 'v19_pass_console' | 'v20_cruise' | 'v21_insertion'
  | 'v22_signal_delay' | 'v23_fuel';

export interface VoiceLine {
  id: VoiceId;
  /** File name inside public/audio/voice/. */
  file: string;
  /** Public path, e.g. 'audio/voice/v01_welcome.mp3' (prefix with import.meta.env.BASE_URL). */
  path: string;
  trigger: string;
  text: string;
}

const L = (id: VoiceId, trigger: string, text: string): VoiceLine => ({
  id, file: `${id}.mp3`, path: `audio/voice/${id}.mp3`, trigger, text,
});

export const VOICE_LINES: Record<VoiceId, VoiceLine> = {
  v01_welcome: L('v01_welcome', 'First click on the main menu', 'Mission Control online. Welcome, Architect.'),
  v02_mission_selected: L('v02_mission_selected', 'Start design', "Mission confirmed. Let's design your spacecraft."),
  v03_warning_power: L('v03_warning_power', 'Power deficit appears for the first time', 'Power budget exceeded. Check your solar panels.'),
  v04_warning_mass: L('v04_warning_mass', 'Mass limit exceeded for the first time', 'Spacecraft is over the mass limit.'),
  v05_warning_budget: L('v05_warning_budget', 'Budget exceeded for the first time', "We're over budget. Something has to go."),
  v06_design_ok: L('v06_design_ok', 'All gauges turned green', 'All systems within limits. Good work.'),
  v07_go_for_launch: L('v07_go_for_launch', 'Confirm launch plan', 'Launch plan confirmed. Go for launch.'),
  v08_countdown: L('v08_countdown', 'Simulation start', 'Five. Four. Three. Two. One. Liftoff.'),
  v09_deployed: L('v09_deployed', 'Month 1', 'Separation confirmed. Spacecraft deployed.'),
  v10_first_contact: L('v10_first_contact', 'First contact', 'We have signal. First contact acquired.'),
  v11_flare: L('v11_flare', 'Event: flare', 'Solar flare detected. Radiation rising. Your call, Architect.'),
  v12_outage: L('v12_outage', 'Event: outage', "Ground station offline. We've lost a downlink window."),
  v13_anomaly: L('v13_anomaly', 'Events: deploy, glitch, wheel', 'Anomaly detected. Awaiting your command.'),
  v14_safe_mode: L('v14_safe_mode', 'Safe mode chosen', 'Safe mode engaged. Spacecraft is stable.'),
  v15_science: L('v15_science', 'First science downlink', 'Science data received. Nice and clean.'),
  v16_success: L('v16_success', 'Report: success', 'Mission complete. Outstanding work, team.'),
  v17_partial: L('v17_partial', 'Report: partial success (spacecraft survived)', 'Mission complete. We learned a lot for next time.'),
  v18_failure: L('v18_failure', 'Report: spacecraft lost', "We've lost the spacecraft. Let's review what happened."),
  v18b_low_data: L('v18b_low_data', 'Report: spacecraft survived but returned too little data', "The spacecraft made it, but we didn't bring home enough science. Let's review the design."),
  v19_pass_console: L('v19_pass_console', 'Team mode: next player', 'Pass the console to the next engineer.'),
  v20_cruise: L('v20_cruise', 'Lunar, Mars: cruise begins', 'Trajectory is clean. Settle in for the cruise.'),
  v21_insertion: L('v21_insertion', 'Lunar, Mars: successful orbit insertion', 'Burn complete. We are in orbit.'),
  v22_signal_delay: L('v22_signal_delay', 'Mars: first decision event', 'Mind the signal delay. The spacecraft is on its own until our command arrives.'),
  v23_fuel: L('v23_fuel', 'Not enough fuel for the first time', 'Not enough fuel to reach that orbit. Lose mass or add propellant.'),
};

export const VOICE_LIST: VoiceLine[] = Object.values(VOICE_LINES);
