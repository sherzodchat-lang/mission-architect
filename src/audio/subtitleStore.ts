import { create } from 'zustand'

export interface SubtitleLine {
  id: number
  text: string
  at: number
}

interface SubtitleState {
  /** line currently shown in the popup (null = hidden) */
  current: SubtitleLine | null
  /** journal of all lines said this session (newest last, capped) */
  log: SubtitleLine[]
  push: (text: string, durationMs?: number) => void
  clear: () => void
}

let seq = 0
let timer: ReturnType<typeof setTimeout> | undefined

export const useSubtitleStore = create<SubtitleState>((set) => ({
  current: null,
  log: [],
  push: (text, durationMs) => {
    const line: SubtitleLine = { id: ++seq, text, at: Date.now() }
    const ms = durationMs ?? Math.max(3500, text.length * 75)
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      set((s) => (s.current?.id === line.id ? { current: null } : s))
    }, ms)
    set((s) => ({ current: line, log: [...s.log, line].slice(-50) }))
  },
  clear: () => {
    if (timer) clearTimeout(timer)
    set({ current: null })
  },
}))
