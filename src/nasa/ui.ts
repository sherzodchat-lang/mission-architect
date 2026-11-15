import type { FrameNote, ScienceFrame } from './frames'

export const NOTE_DOT: Record<FrameNote['tone'], string> = {
  good: 'bg-green',
  info: 'bg-mint',
  warn: 'bg-amber',
  bad: 'bg-red',
}

export function fmtFrameDate(f: ScienceFrame): string | null {
  if (!f.date) return null
  const d = new Date(`${f.date}T00:00:00Z`)
  const opts: Intl.DateTimeFormatOptions =
    f.layer.temporal === 'monthly'
      ? { month: 'long', year: 'numeric', timeZone: 'UTC' }
      : { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }
  const s = d.toLocaleDateString('en-GB', opts)
  return f.layer.temporal === 'periodic' ? `16 days around ${s}` : f.layer.temporal === 'monthly' ? `${s} average` : s
}

