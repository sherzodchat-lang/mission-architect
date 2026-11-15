import type { RefObject } from 'react'
import { Icon } from '../../components'
import type { Mission, Orbit } from '../../data'
import type { SimState } from '../../engine'
import CelestialView from '../../scene/CelestialView'
import { useFrameValue } from './useSimClock'

function fmtDistance(km: number): string {
  if (km >= 1e6) return `${(km / 1e6).toFixed(km >= 1e8 ? 0 : 1)} million km`
  return `${Math.round(km).toLocaleString('en-US')} km`
}

/** Centre of screen 05: the animated body/orbit view (full-bleed in its glass panel) plus title chips. */
export function SceneView({
  sim,
  mission,
  progress,
  animating,
  cruise,
  orbit,
}: {
  sim: SimState
  mission: Mission
  progress: RefObject<number>
  animating: boolean
  cruise: boolean
  orbit?: Orbit
}) {
  const stepProgress = useFrameValue(progress, animating)
  // Orbit view: one lap per month step. Cruise view: progress along the whole transfer (all cruise steps).
  // The view must not animate on its own (`animate={false}`), otherwise its own lap clock adds to this phase.
  const phase = cruise ? Math.min(1, (sim.step + stepProgress) / Math.max(1, sim.cruiseSteps)) : stepProgress
  const last = sim.telemetry[sim.telemetry.length - 1]
  const linkUp = last && last.link !== 'offline'
  const activeStation = !cruise && linkUp ? (last.activeStations[0] ?? null) : null
  const stationName = activeStation ? mission.stations.find((s) => s.id === activeStation)?.name : null
  const distance = last?.distanceToTargetKm ?? null
  const title = cruise ? `Cruise to ${mission.body.name}` : (orbit?.name.split(' · ')[0] ?? mission.body.name)

  return (
    <div className="absolute inset-0">
      <CelestialView
        missionId={mission.id}
        orbitId={sim.design.orbit}
        phase={phase}
        stations={sim.design.stations}
        activeStation={activeStation}
        cruise={cruise}
        animate={false}
        labels={cruise}
        className="absolute inset-0"
      />

      <div className="pointer-events-none absolute top-[18px] left-[22px] flex items-center gap-3">
        <h2 className="text-xl font-medium text-text">{title}</h2>
        {orbit && (
          <span className="glass-strong num rounded-control px-3 py-1 text-sm text-text-dim">
            {cruise ? 'Target ' : ''}
            {orbit.short}
            {orbit.altitude ? ` · ${orbit.altitude}` : ''}
          </span>
        )}
      </div>

      <div className="pointer-events-none absolute bottom-5 left-[22px] flex items-center gap-2.5 rounded-control bg-[#061217]/70 px-3.5 py-2 text-sm backdrop-blur-sm">
        <Icon name="antenna" size={18} className={last?.link === 'offline' ? 'text-red' : last?.link === 'degraded' ? 'text-amber' : 'text-mint'} />
        <span className="text-text-dim">Link</span>
        <span className="text-text">{last ? (stationName ? `${last.linkText} · ${stationName}` : last.linkText) : 'Standby'}</span>
      </div>

      {cruise && (
        <div className="glass-strong pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 px-6 py-2.5 text-center">
          <div className="text-sm text-text-dim">Distance to {mission.body.name}</div>
          <div className="num text-2xl text-text">{distance != null ? fmtDistance(distance) : 'Leaving Earth'}</div>
        </div>
      )}
    </div>
  )
}
