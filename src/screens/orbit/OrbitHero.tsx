import { useState, type ReactNode } from 'react'
import { Icon, cx } from '../../components'
import type { Mission, Orbit } from '../../data'
import { fmtDv, fmtPct } from '../../engine'
import type { Gauge as EngineGauge } from '../../engine'
import CelestialView from '../../scene/CelestialView'
import { GTerm } from './helpers'
import { ResourceSummary } from './ResourceSummary'

/** Which glossary term (and which words of the orbit name) get a "?" tooltip. */
const ORBIT_TERMS: Record<string, { gloss: string; match: string }> = {
  leo: { gloss: 'leo', match: 'LEO' },
  sso: { gloss: 'sso', match: 'Sun-synchronous' },
  geo: { gloss: 'geo', match: 'GEO' },
  frozen: { gloss: 'frozen_orbit', match: 'Frozen' },
  nrho: { gloss: 'halo_orbit', match: 'halo orbit' },
  aerobrake: { gloss: 'aerobraking', match: 'aerobraking' },
}

function OrbitName({ orbit }: { orbit: Orbit }) {
  const t = ORBIT_TERMS[orbit.id]
  const at = t ? orbit.name.indexOf(t.match) : -1
  if (!t || at < 0) return <>{orbit.name}</>
  return (
    <>
      {orbit.name.slice(0, at)}
      <GTerm id={t.gloss} placement="bottom">
        {t.match}
      </GTerm>
      {orbit.name.slice(at + t.match.length)}
    </>
  )
}

function Spec({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 py-1.5">
      <dt className="text-sm whitespace-nowrap text-text-dim">{label}</dt>
      <dd className="num text-sm whitespace-nowrap text-text">{children}</dd>
    </div>
  )
}

export interface OrbitHeroProps {
  mission: Mission
  orbitId: string | null
  stations: string[]
  activeStation: string | null
  gauges: EngineGauge[]
  className?: string
}

/** The hero: the 3D orbit view with the chosen orbit's name and one-liner, its specs on demand, and resources below. */
export function OrbitHero({ mission, orbitId, stations, activeStation, gauges, className }: OrbitHeroProps) {
  const orbit = mission.orbits.find((o) => o.id === orbitId)
  const [specsOpen, setSpecsOpen] = useState(false)
  const deep = mission.id !== 'earth'
  const months = orbit ? orbit.lastStep * mission.stepMonths : 0

  return (
    <section className={cx('glass flex min-h-0 flex-col', className)} aria-label="Orbit view">
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0 overflow-hidden rounded-t-panel">
          <CelestialView missionId={mission.id} orbitId={orbitId} stations={stations} activeStation={activeStation} />
        </div>
        {/* soft scrim so the caption reads over a bright planet */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-64 rounded-t-panel bg-gradient-to-b from-bg/80 via-bg/45 to-transparent"
          aria-hidden="true"
        />

        <div className="absolute top-6 left-7 max-w-[460px]">
          <h2 className="text-xl font-medium text-text">{orbit ? <OrbitName orbit={orbit} /> : 'No orbit chosen'}</h2>
          <p className="mt-1 text-base leading-snug text-text-dim">
            {orbit ? orbit.description : 'Pick an orbit on the right to see what it gives you.'}
          </p>
          {orbit && (
            <>
              <button
                type="button"
                onClick={() => setSpecsOpen((v) => !v)}
                aria-expanded={specsOpen}
                className="mt-2 -ml-1 flex items-center gap-1 rounded-md px-1 py-0.5 text-sm text-text-dim transition-colors duration-200 hover:text-text"
              >
                {specsOpen ? 'Hide orbit details' : 'Orbit details'}
                <Icon name={specsOpen ? 'chevronUp' : 'chevronDown'} size={16} />
              </button>
              {specsOpen && (
                <dl className="mt-2 w-[260px] animate-fade-in divide-y divide-white/[0.07] rounded-card bg-bg/60 px-4 py-1.5">
                  <Spec label="Altitude">{orbit.altitude ?? '—'}</Spec>
                  <Spec label={<GTerm id="inclination">Inclination</GTerm>}>{orbit.inclination ?? '—'}</Spec>
                  <Spec label="Period">{orbit.period ?? '—'}</Spec>
                  <Spec label={<GTerm id="eclipse">Sunlight</GTerm>}>{fmtPct(orbit.sunFraction)}</Spec>
                  <Spec label="Coverage">{fmtPct(orbit.coverage)}</Spec>
                  {deep ? (
                    <Spec label={<GTerm id="orbit_insertion">Insertion Δv</GTerm>}>{fmtDv(orbit.dvInsert)}</Spec>
                  ) : (
                    <Spec label="Lifetime">
                      {orbit.lastStep < mission.limits.steps ? `${months} mo` : `${months}+ mo`}
                    </Spec>
                  )}
                </dl>
              )}
            </>
          )}
        </div>

        <span className="pointer-events-none absolute right-6 bottom-4 text-sm text-text-faint">
          Paths schematic · orbits calibrated to NASA GMAT
        </span>
      </div>

      <div className="shrink-0 border-t border-hairline px-7 py-4">
        <ResourceSummary gauges={gauges} />
      </div>
    </section>
  )
}
