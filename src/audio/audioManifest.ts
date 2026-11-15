import { publicUrl } from '../lib/publicUrl'

/** All audio files of the game (GAME_DESIGN 14.3-14.4). Files may be missing: the engine then stays silent. */

export interface VoiceEntry {
  file: string
  /** subtitle text, used when `audio.say(id)` gets no explicit text */
  text: string
}

export const VOICE = {
  v01_welcome: { file: 'v01_welcome.mp3', text: 'Mission Control online. Welcome, Architect.' },
  v02_mission_selected: { file: 'v02_mission_selected.mp3', text: "Mission confirmed. Let's design your spacecraft." },
  v03_warning_power: { file: 'v03_warning_power.mp3', text: 'Power budget exceeded. Check your solar panels.' },
  v04_warning_mass: { file: 'v04_warning_mass.mp3', text: 'Spacecraft is over the mass limit.' },
  v05_warning_budget: { file: 'v05_warning_budget.mp3', text: "We're over budget. Something has to go." },
  v06_design_ok: { file: 'v06_design_ok.mp3', text: 'All systems within limits. Good work.' },
  v07_go_for_launch: { file: 'v07_go_for_launch.mp3', text: 'Launch plan confirmed. Go for launch.' },
  v08_countdown: { file: 'v08_countdown.mp3', text: 'Five. Four. Three. Two. One. Liftoff.' },
  v09_deployed: { file: 'v09_deployed.mp3', text: 'Separation confirmed. Spacecraft deployed.' },
  v10_first_contact: { file: 'v10_first_contact.mp3', text: 'We have signal. First contact acquired.' },
  v11_flare: { file: 'v11_flare.mp3', text: 'Solar flare detected. Radiation rising. Your call, Architect.' },
  v12_outage: { file: 'v12_outage.mp3', text: "Ground station offline. We've lost a downlink window." },
  v13_anomaly: { file: 'v13_anomaly.mp3', text: 'Anomaly detected. Awaiting your command.' },
  v14_safe_mode: { file: 'v14_safe_mode.mp3', text: 'Safe mode engaged. Spacecraft is stable.' },
  v15_science: { file: 'v15_science.mp3', text: 'Science data received. Nice and clean.' },
  v16_success: { file: 'v16_success.mp3', text: 'Mission complete. Outstanding work, team.' },
  v17_partial: { file: 'v17_partial.mp3', text: 'Mission complete. We learned a lot for next time.' },
  v18_failure: { file: 'v18_failure.mp3', text: "We've lost the spacecraft. Let's review what happened." },
  v18b_low_data: {
    file: 'v18b_low_data.mp3',
    text: "The spacecraft made it, but we didn't bring home enough science. Let's review the design.",
  },
  v19_pass_console: { file: 'v19_pass_console.mp3', text: 'Pass the console to the next engineer.' },
  v20_cruise: { file: 'v20_cruise.mp3', text: 'Trajectory is clean. Settle in for the cruise.' },
  v21_insertion: { file: 'v21_insertion.mp3', text: 'Burn complete. We are in orbit.' },
  v22_signal_delay: {
    file: 'v22_signal_delay.mp3',
    text: 'Mind the signal delay. The spacecraft is on its own until our command arrives.',
  },
  v23_fuel: { file: 'v23_fuel.mp3', text: 'Not enough fuel to reach that orbit. Lose mass or add propellant.' },
} as const satisfies Record<string, VoiceEntry>

export type VoiceId = keyof typeof VOICE

export const SFX = {
  ui_click: 'ui_click.mp3',
  ui_add: 'ui_add.mp3',
  ui_remove: 'ui_remove.mp3',
  ui_warning: 'ui_warning.mp3',
  ui_critical: 'ui_critical.mp3',
  ui_success: 'ui_success.mp3',
  ui_step: 'ui_step.mp3',
  launch: 'launch.mp3',
  radio_beep: 'radio_beep.mp3',
  downlink: 'downlink.mp3',
  flare: 'flare.mp3',
  safe_mode: 'safe_mode.mp3',
  report_success: 'report_success.mp3',
  report_fail: 'report_fail.mp3',
  engine_burn: 'engine_burn.mp3',
} as const

export type SfxId = keyof typeof SFX

export const AMBIENT = { space_loop: 'space_loop.mp3' } as const
export type AmbientId = keyof typeof AMBIENT

/** path relative to public/audio (as listed in public/audio/index.json) */
export const voicePath = (id: VoiceId) => `voice/${VOICE[id].file}`
export const sfxPath = (id: SfxId) => `sfx/${SFX[id]}`
export const ambientPath = (id: AmbientId) => `ambient/${AMBIENT[id]}`

/** full URL, BASE_URL-prefixed */
export const audioUrl = (relPath: string) => publicUrl(`audio/${relPath}`)
