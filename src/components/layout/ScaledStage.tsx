import { useEffect, useState, type ReactNode } from 'react'
import { StageRootContext } from './stageContext'

export const STAGE_W = 1672
export const STAGE_H = 941
const MIN_WIDTH = 1024

function measure() {
  const w = window.innerWidth
  const h = window.innerHeight
  const scale = Math.min(w / STAGE_W, h / STAGE_H)
  // The canvas always fills the whole window: one side equals the design size, the other grows
  // (wider-than-16:9 windows get a wider canvas instead of side bars). Layouts must stretch with flex/grid.
  return { tooSmall: w < MIN_WIDTH, scale, cw: w / scale, ch: h / scale }
}

export interface ScaledStageProps {
  children: ReactNode
}

/**
 * Design canvas scaled so that 1672x941 design px always fit, and stretched to fill the whole window:
 * the canvas is at least 1672 wide and 941 tall (extra width/height on non-16:9 windows). Lay screens out in
 * design px as in the mockups, but let columns/rows stretch (flex/grid 1fr), never assume exactly 1672x941. Below 1024px width a notice is shown instead.
 */
export function ScaledStage({ children }: ScaledStageProps) {
  const [m, setM] = useState(measure)
  const [root, setRoot] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    const on = () => setM(measure())
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])

  if (m.tooSmall) {
    return (
      <div className="app-bg fixed inset-0 flex items-center justify-center p-8 text-center">
        <div className="glass max-w-sm p-8">
          <h1 className="text-2xl font-medium text-text">Mission Architect</h1>
          <p className="mt-3 text-lg text-text-dim">Best played on a laptop or desktop</p>
        </div>
      </div>
    )
  }

  return (
    <div className="app-bg fixed inset-0 overflow-hidden">
      <div
        ref={setRoot}
        className="absolute top-0 left-0 overflow-hidden"
        style={{
          width: m.cw,
          height: m.ch,
          transform: `scale(${m.scale})`,
          transformOrigin: '0 0',
        }}
      >
        <StageRootContext.Provider value={root}>{root && children}</StageRootContext.Provider>
      </div>
    </div>
  )
}
