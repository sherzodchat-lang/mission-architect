// Central body view for screens 04 and 05 (Earth / Moon / Mars).
// Always interactive 3D (lazy-loaded three.js chunk). The SVG view (`CelestialSvg`) is kept ONLY as a
// silent emergency fallback when WebGL is unavailable or the 3D view crashes; there is no 2D/3D toggle.
import { Component, Suspense, lazy, useCallback, useState, type ReactNode } from 'react'
import CelestialSvg from './CelestialSvg'
import type { Design } from '../data/types'
export { PLANET_TEXTURE_SOURCES, type PlanetTextureSource } from './sources'

export interface CelestialViewProps {
  missionId: string
  orbitId?: string | null
  /**
   * Orbit view: spacecraft position along the orbit as a fraction of one lap (0..1). With `animate`
   * (default) the spacecraft also keeps circling from there; with `animate={false}` it sits exactly at `phase`.
   * Cruise view: progress along the transfer trajectory (0 = departure, 1 = arrival); when omitted it loops.
   */
  phase?: number
  stations?: string[]
  activeStation?: string | null
  /** show the transfer trajectory (Earth → target body / launch ascent for Earth) */
  cruise?: boolean
  className?: string
  /** keep the spacecraft moving on its own (default true) */
  animate?: boolean
  /** orbit / station / body labels (default true) */
  labels?: boolean
  /** @deprecated ignored - the 3D view is always used (SVG only as a crash / no-WebGL fallback) */
  mode?: 'auto' | '2d' | '3d'
  /** @deprecated ignored - there is no 2D/3D toggle any more */
  showToggle?: boolean
  /** spacecraft to draw in 3D; defaults to the current design in the game store (or a showcase design) */
  design?: Design | null
}

const CelestialView3D = lazy(() => import('./CelestialView3D'))

let webglOk: boolean | null = null
let webglFailed = false
function hasWebGL(): boolean {
  if (webglFailed) return false
  if (webglOk !== null) return webglOk
  try {
    const c = document.createElement('canvas')
    const gl = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext | null
    webglOk = !!gl
    ;(gl?.getExtension('WEBGL_lose_context') as { loseContext?: () => void } | null)?.loseContext?.()
  } catch {
    webglOk = false
  }
  return webglOk
}

class GLBoundary extends Component<{ fallback: ReactNode; onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch() {
    this.props.onError()
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

/** Neutral glass loading state shown while the 3D chunk / textures load. */
function Loading3D() {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      role="status"
      aria-live="polite"
      aria-label="Loading 3D view"
    >
      <div className="glass-inset flex h-24 w-24 items-center justify-center rounded-full">
        <span className="h-9 w-9 rounded-full border-2 border-white/15 border-t-mint/70 motion-safe:animate-spin" />
      </div>
    </div>
  )
}

export default function CelestialView(props: CelestialViewProps) {
  // `mode` and `showToggle` are deprecated and intentionally ignored (always 3D).
  const { className } = props
  const [failed, setFailed] = useState(false)
  const [glAvailable] = useState(hasWebGL)

  const use3d = glAvailable && !failed

  const onFail = useCallback(() => {
    webglFailed = true
    setFailed(true)
  }, [])

  const svg = <CelestialSvg {...props} className="absolute inset-0 h-full w-full" />

  return (
    <div className={`relative h-full w-full overflow-hidden ${className ?? ''}`}>
      {use3d ? (
        <GLBoundary fallback={svg} onError={onFail}>
          <Suspense fallback={<Loading3D />}>
            <CelestialView3D {...props} onFail={onFail} />
          </Suspense>
        </GLBoundary>
      ) : (
        svg
      )}
    </div>
  )
}
