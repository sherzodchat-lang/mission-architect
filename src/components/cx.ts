/** tiny className joiner */
export type ClassPart = string | false | null | undefined | ClassPart[]
export function cx(...parts: ClassPart[]): string {
  return parts.flat(Infinity as 1).filter(Boolean).join(' ')
}

export type Status = 'green' | 'amber' | 'red'
/** 'cyan' = mint accent (legacy name kept). */
export type Tone = Status | 'cyan' | 'blue' | 'purple' | 'neutral'

/** Tailwind text/bg classes per tone (full literals so Tailwind can see them). */
export const TONE_TEXT: Record<Tone, string> = {
  green: 'text-green',
  amber: 'text-amber',
  red: 'text-red',
  cyan: 'text-cyan',
  blue: 'text-blue',
  purple: 'text-purple',
  neutral: 'text-text',
}
export const TONE_BG: Record<Tone, string> = {
  green: 'bg-green',
  amber: 'bg-amber',
  red: 'bg-red',
  cyan: 'bg-cyan',
  blue: 'bg-blue',
  purple: 'bg-purple',
  neutral: 'bg-text-dim',
}
export const TONE_HEX: Record<Tone, string> = {
  green: '#8fe6b8',
  amber: '#f5c06a',
  red: '#f4917d',
  cyan: '#a3f0d4', // 'cyan' is the legacy name of the mint accent
  blue: '#9fd8f6',
  purple: '#bdb7f7',
  neutral: '#a2b2bb',
}

/** 4.1 -> "4.1", 5 -> "5", 1250 -> "1250", 0.62 -> "0.62" */
export function fmtNum(n: number): string {
  if (Math.abs(n) >= 100) return String(Math.round(n))
  if (Math.abs(n) >= 10) return String(Math.round(n * 10) / 10)
  return String(Math.round(n * 100) / 100)
}
