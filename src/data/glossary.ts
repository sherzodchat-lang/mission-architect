// Glossary for `?` term tooltips (GAME_DESIGN.md section 11). Plain English, 1–2 sentences.

export interface GlossaryTerm {
  id: string;
  term: string;
  text: string;
  /** Which missions mainly use it ('all' = every mission). */
  scope: 'all' | 'earth' | 'deep';
}

const T = (id: string, term: string, text: string, scope: GlossaryTerm['scope'] = 'all'): GlossaryTerm => ({ id, term, text, scope });

export const GLOSSARY_LIST: GlossaryTerm[] = [
  T('cubesat', 'CubeSat', 'A small, standard-sized satellite built from 10 cm cubes. Standard sizes make CubeSats cheap to build and easy to launch as passengers on bigger rockets.', 'earth'),
  T('3u', '3U', 'Three CubeSat units stacked together — about the size of a loaf of bread (10 × 10 × 34 cm).', 'earth'),
  T('payload', 'Payload', 'The instruments that do the science. Everything else on the spacecraft exists to power, point, protect and talk for the payload.'),
  T('leo', 'LEO', 'Low Earth orbit, a few hundred kilometers up. Easy to reach, but thin air slowly drags satellites down.', 'earth'),
  T('sso', 'Sun-synchronous orbit', 'A near-polar orbit that crosses each place at the same local time every day, so light conditions repeat from image to image.', 'earth'),
  T('geo', 'GEO', 'Geostationary orbit, 35,786 km up, where a satellite circles once a day and seems to hang over one spot on the equator.', 'earth'),
  T('inclination', 'Inclination', 'The tilt of an orbit relative to the equator. It sets how far north and south the spacecraft flies.'),
  T('eclipse', 'Eclipse', 'The part of each orbit spent in the planet\'s shadow. Solar panels produce nothing there, so the battery must carry the load.'),
  T('downlink', 'Downlink', 'Sending data from the spacecraft down to Earth. Data that is never downlinked is science that never happened.'),
  T('ground_station', 'Ground station', 'An antenna on Earth that talks to spacecraft. More stations, or better-placed ones, mean more time to send data.'),
  T('contact_window', 'Contact window', 'The minutes when a spacecraft is above a ground station\'s horizon and the two can talk.'),
  T('attitude_control', 'Attitude control', 'The system that turns the spacecraft and holds it pointed in the right direction.'),
  T('reaction_wheel', 'Reaction wheel', 'A spinning wheel inside the spacecraft. Speeding it up or slowing it down turns the spacecraft the opposite way.'),
  T('magnetorquer', 'Magnetorquer', 'An electromagnet that pushes against Earth\'s magnetic field to turn a small satellite. Simple and reliable, but not very precise.', 'earth'),
  T('safe_mode', 'Safe mode', 'A protective state where the spacecraft switches off the instruments, points its panels at the Sun and waits for instructions.'),
  T('rideshare', 'Rideshare', 'Launching as a passenger alongside other satellites. Cheaper than your own rocket, but you go where and when the main customer goes.'),
  T('margin', 'Margin', 'Spare capacity kept in reserve, like a few extra kilograms or watts. Too little margin is risky; too much is wasted capability.'),
  T('solar_flare', 'Solar flare', 'A sudden burst of energy and radiation from the Sun that can upset or damage spacecraft electronics.'),
  T('duty_cycle', 'Duty cycle', 'The share of time an instrument is switched on. If there is not enough power, instruments must take turns.'),
  T('delta_v', 'Delta-v (Δv)', 'How much the engine can change the spacecraft\'s speed, in meters per second. Every maneuver costs some; a heavier spacecraft gets less from the same fuel.', 'deep'),
  T('propellant', 'Propellant', 'The fuel (and oxidizer) the engine burns to push the spacecraft. Its mass is counted in the spacecraft mass.', 'deep'),
  T('orbit_insertion', 'Orbit insertion', 'The braking burn that slows the spacecraft enough to be captured into orbit around its target.', 'deep'),
  T('station_keeping', 'Station keeping', 'Small regular burns that keep a spacecraft in its chosen orbit against tugs from gravity and drag.', 'deep'),
  T('frozen_orbit', 'Frozen orbit', 'A special orbit around the Moon where the gravity tugs balance out, so it stays stable with almost no fuel.', 'deep'),
  T('halo_orbit', 'Halo orbit', 'A large looping orbit balanced between the gravity of Earth and the Moon. The near-rectilinear halo orbit always keeps Earth in view.', 'deep'),
  T('aerobraking', 'Aerobraking', 'Skimming the top of a planet\'s atmosphere on each orbit so air drag slows the spacecraft instead of fuel.', 'deep'),
  T('launch_window', 'Launch window', 'The period when the planets line up for a launch. Earth and Mars line up only once every 26 months.', 'deep'),
  T('signal_delay', 'Signal delay', 'Radio signals travel at the speed of light, which still takes 4 to 24 minutes between Earth and Mars. The spacecraft must handle surprises before your command arrives.', 'deep'),
  T('dsn', 'Deep Space Network', 'NASA\'s three big antenna complexes in California, Spain and Australia that talk to spacecraft far from Earth.', 'deep'),
  T('high_gain_antenna', 'High-gain antenna', 'A dish antenna that focuses the radio beam into a narrow cone. It sends much more data, but must be aimed precisely at Earth.', 'deep'),
  T('sep', 'Solar-electric propulsion', 'An engine that uses solar power to accelerate charged gas to very high speed. Extremely fuel-efficient, but the push is gentle, so trips take longer.', 'deep'),
];

export const GLOSSARY: Record<string, GlossaryTerm> = Object.fromEntries(GLOSSARY_LIST.map((t) => [t.id, t]));
