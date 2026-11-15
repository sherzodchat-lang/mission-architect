// NASA Technical Reports Server papers for the report (snapshot: NTRS sends no CORS headers).
// Refresh with `node tools/fetch_ntrs.mjs`; ids are curated there.
import data from '../data/nasa/ntrs.json'

export interface NtrsPaper {
  id: string
  title: string
  year: number | null
  authors: string[]
  moreAuthors: number
  /** 'Conference paper' | 'Presentation' | … */
  type: string
  center: string | null
  url: string
}

const ANALOGS = data.analogs as Record<string, NtrsPaper[]>
const LESSONS = data.lessons as Record<string, NtrsPaper>

export const NTRS_FETCHED: string = data.fetched

/** 1–3 technical papers about a real analog mission. */
export function papersForAnalog(analogId: string): NtrsPaper[] {
  return ANALOGS[analogId] ?? []
}

/** Report card id ("What happened and why") → lesson topic in ntrs.json. */
const CARD_TOPIC: Record<string, string> = {
  antenna: 'antenna', power: 'power', battery: 'battery', blurry: 'pointing', overflow: 'storage', overrun: 'schedule',
  unused: 'margins', decay: 'decay', lost: 'lost',
  improve_science: 'pointing', improve_operations: 'antenna', improve_reliability: 'radiation',
  improve_margin_mass: 'margins', improve_margin_power: 'power', improve_margin_budget: 'schedule', improve_margin_time: 'schedule',
}
/** Event id inside `decision_good_<event>_<option>` / `decision_bad_…` → topic. */
const EVENT_TOPIC: Record<string, string> = {
  flare: 'radiation', deploy: 'deployment', glitch: 'software', outage: 'ground', dsn_busy: 'ground', wheel: 'wheel',
  insertion: 'insertion', aerobrake: 'aerobrake', battery_wear: 'battery', decay: 'decay', launch_slip: 'schedule',
}

/** The one NASA paper behind a report card, or null for cards without a lesson (e.g. "On schedule"). */
export function paperForCard(cardId: string): NtrsPaper | null {
  let topic = CARD_TOPIC[cardId]
  const m = /^decision_(?:good|bad)_(.+)$/.exec(cardId)
  if (!topic && m) {
    const key = Object.keys(EVENT_TOPIC)
      .sort((a, b) => b.length - a.length)
      .find((e) => m[1] === e || m[1].startsWith(`${e}_`))
    topic = key ? EVENT_TOPIC[key] : ''
  }
  return (topic && LESSONS[topic]) || null
}

/** "Smith, J.; Lee, K. et al." */
export function authorLine(p: NtrsPaper): string {
  if (!p.authors.length) return p.center ?? 'NASA'
  return p.authors.slice(0, 2).join('; ') + (p.authors.length > 2 || p.moreAuthors ? ' et al.' : '')
}
