import { useEffect, useRef, useState, type RefObject } from 'react'

/**
 * Drives the simulation: while `running`, progress of the current step goes 0 → 1 over `durationMs`
 * (requestAnimationFrame, so a hidden tab simply pauses). At 1 it calls `onStepDone` once and stops;
 * the caller advances the sim, which changes `stepKey` and restarts the clock from 0.
 * One loop at a time (effect cleanup cancels it), so StrictMode cannot double-advance.
 */
export function useSimClock({
  running,
  durationMs,
  stepKey,
  restartKey,
  onStepDone,
}: {
  running: boolean
  durationMs: number
  /** changes whenever a new step starts (resets progress to 0) */
  stepKey: unknown
  /** any change restarts the loop (e.g. the sim object), without resetting progress */
  restartKey?: unknown
  onStepDone: () => void
}): RefObject<number> {
  const progress = useRef(0)
  const lastKey = useRef(stepKey)
  const duration = useRef(durationMs)
  const done = useRef(onStepDone)

  useEffect(() => {
    duration.current = durationMs
    done.current = onStepDone
  })

  useEffect(() => {
    if (lastKey.current !== stepKey) {
      lastKey.current = stepKey
      progress.current = 0
    }
    if (!running) return
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      // cap the frame delta so a long hitch never skips a whole step
      const dt = Math.min(now - last, 120)
      last = now
      progress.current = Math.min(1, progress.current + dt / duration.current)
      if (progress.current >= 1) {
        done.current()
        return
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [running, stepKey, restartKey])

  return progress
}

/** Re-renders the calling component every animation frame while `active`, returning `ref.current`. */
export function useFrameValue(ref: RefObject<number>, active: boolean): number {
  const [value, setValue] = useState(0)
  useEffect(() => {
    let raf = 0
    const tick = () => {
      setValue(ref.current)
      if (active) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [ref, active])
  return value
}
