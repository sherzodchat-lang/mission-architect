import { useMemo, useState } from 'react'
import { ActionBar, Button, Icon, PageHeader, cx, type IconName } from '../components'
import { NASA_SOURCES, type NasaSource } from '../data/nasa'
import { PLANET_TEXTURE_SOURCES } from '../scene/sources'
import { useGameStore } from '../store/gameStore'

/**
 * "Built on NASA data": every NASA (or partner) source the game uses, aggregated from `NASA_SOURCES`
 * (src/data/nasa/sources/*.ts) and `PLANET_TEXTURE_SOURCES` (src/scene/sources.ts), grouped by the part of the game
 * where the player meets it. Reached from the Overview and from Settings.
 */

type Access = NasaSource['access']

interface Group {
  id: string
  title: string
  icon: IconName
  /** matched against a source's first `where` entry (first match wins) */
  test: RegExp
}

const GROUPS: Group[] = [
  { id: 'design', title: 'Spacecraft design', icon: 'cube', test: /component|catalog|battery|propulsion|platform|schedule/i },
  { id: 'orbit', title: 'Orbit & launch', icon: 'orbit', test: /^orbit|ground station|station-keeping|lifetime|low-orbit|low polar/i },
  { id: 'missions', title: 'Mission select', icon: 'satellite', test: /mission select/i },
  { id: 'ops', title: 'Mission operations', icon: 'pulse', test: /operations|simulation|cruise|downlink|signal/i },
  { id: 'report', title: 'Mission report', icon: 'document', test: /report/i },
  { id: 'menu', title: 'Overview & collection', icon: 'home', test: /menu|collection/i },
]

const ACCESS: Record<Access, { label: string; hint: string; cls: string }> = {
  live: { label: 'Live', hint: 'Fetched from NASA in your browser while you play', cls: 'border-mint/35 text-mint' },
  snapshot: { label: 'Snapshot', hint: 'Fetched or computed with a script in tools/ and shipped with the game', cls: 'border-blue/35 text-blue' },
  asset: { label: 'Asset', hint: 'Images or reference text stored with the game', cls: 'border-purple/35 text-purple' },
}

interface Entry {
  src: NasaSource
  /** layer / product entries of a service (e.g. GIBS layers), shown folded under it */
  children: NasaSource[]
}

/** orbit first: its texts mention batteries ("battery factor"), which would otherwise land in design */
const MATCH_ORDER = ['orbit', 'design', 'missions', 'ops', 'report', 'menu']

/** `gibs_modis_lst` belongs to `gibs`, `moontrek_lola` to `moontrek` … */
function parentId(s: NasaSource, ids: Set<string>): string | null {
  const i = s.id.indexOf('_')
  if (i < 0) return null
  const p = s.id.slice(0, i)
  return ids.has(p) ? p : null
}

function useGroups() {
  return useMemo(() => {
    const ids = new Set(NASA_SOURCES.map((s) => s.id))
    const byId = new Map<string, Entry>()
    const top: Entry[] = []
    for (const s of NASA_SOURCES) {
      if (parentId(s, ids)) continue
      const e = { src: s, children: [] }
      byId.set(s.id, e)
      top.push(e)
    }
    for (const s of NASA_SOURCES) {
      const p = parentId(s, ids)
      if (p) byId.get(p)?.children.push(s)
    }
    const out = GROUPS.map((g) => ({ group: g, entries: [] as Entry[] }))
    const rest: Entry[] = []
    for (const e of top) {
      const w = e.src.where[0] ?? ''
      const id = MATCH_ORDER.find((m) => GROUPS.find((g) => g.id === m)!.test.test(w))
      const hit = out.find((o) => o.group.id === id)
      if (hit) hit.entries.push(e)
      else rest.push(e)
    }
    if (rest.length) out.push({ group: { id: 'other', title: 'Elsewhere in the game', icon: 'globe', test: /./ }, entries: rest })
    return out.filter((o) => o.entries.length > 0)
  }, [])
}

function AccessBadge({ access }: { access: Access }) {
  const a = ACCESS[access]
  return (
    <span title={a.hint} className={cx('inline-flex h-6 shrink-0 items-center rounded-full border px-2.5 text-xs', a.cls)}>
      {a.label}
    </span>
  )
}

function SourceRow({ entry }: { entry: Entry }) {
  const { src, children } = entry
  const [open, setOpen] = useState(false)
  return (
    <li className="py-3.5 first:pt-1 last:pb-1">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <a
            href={src.url}
            target="_blank"
            rel="noreferrer"
            className="group inline-flex items-baseline gap-1.5 text-base leading-snug text-text hover:text-mint"
          >
            <span>{src.title}</span>
            <Icon name="external" size={14} className="shrink-0 translate-y-[1px] text-text-faint group-hover:text-mint" />
          </a>
          <p className="mt-0.5 text-sm text-text-faint">{src.provider}</p>
          <p className="mt-1.5 text-sm leading-snug text-text-dim">{src.usedFor}</p>
          {src.where.length > 1 && (
            <p className="mt-1 text-sm leading-snug text-text-faint">Also in: {src.where.slice(1).join(' · ')}</p>
          )}
          {children.length > 0 && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                className="inline-flex items-center gap-1 text-sm text-text-dim transition-colors hover:text-text"
              >
                {children.length} {children.length === 1 ? 'layer' : 'layers'}
                <Icon name="chevronDown" size={16} className={cx('transition-transform duration-200', open && 'rotate-180')} />
              </button>
              {open && (
                <ul className="mt-2 flex animate-fade-in flex-col gap-2 border-l border-hairline pl-4">
                  {children.map((c) => (
                    <li key={c.id} className="text-sm leading-snug">
                      <a href={c.url} target="_blank" rel="noreferrer" className="text-text hover:text-mint">
                        {c.title}
                      </a>
                      <span className="text-text-faint"> · {c.provider}</span>
                      <span className="block text-text-dim">{c.usedFor}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        <AccessBadge access={src.access} />
      </div>
    </li>
  )
}

export default function NasaData() {
  const goTo = useGameStore((s) => s.goTo)
  const groups = useGroups()
  const counts = useMemo(() => {
    const c: Record<Access, number> = { live: 0, snapshot: 0, asset: PLANET_TEXTURE_SOURCES.length }
    for (const s of NASA_SOURCES) c[s.access]++
    return c
  }, [])
  const total = NASA_SOURCES.length + PLANET_TEXTURE_SOURCES.length
  const [planetsOpen, setPlanetsOpen] = useState(false)

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        breadcrumb={['Workspace', 'NASA data']}
        title="Built on NASA data"
        subtitle="Every real number, image and orbit in the game, and where it comes from."
      />

      <div className="grid min-h-0 flex-1 gap-[13px] px-4" style={{ gridTemplateColumns: '410px minmax(0,1fr)' }}>
        {/* left: what the badges mean, counts, planet imagery */}
        <aside className="glass flex min-h-0 flex-col gap-5 overflow-y-auto px-6 py-5" aria-label="About the data">
          <div>
            <p className="text-stat leading-none font-light text-text">
              <span className="num">{total}</span>
            </p>
            <p className="mt-2 text-base text-text-dim">NASA and partner sources used in this game</p>
          </div>
          <dl className="flex flex-col divide-y divide-hairline border-y border-hairline">
            {(Object.keys(ACCESS) as Access[]).map((k) => (
              <div key={k} className="flex items-start gap-3 py-3">
                <AccessBadge access={k} />
                <dd className="min-w-0 flex-1 text-sm leading-snug text-text-dim">{ACCESS[k].hint}.</dd>
                <dt className="num text-base text-text">{counts[k]}</dt>
              </div>
            ))}
          </dl>
          <p className="text-sm leading-snug text-text-dim">
            Prices, budgets and event chances are game balance, tuned for play. Physical values (orbits, contact times,
            batteries, panels, radios, engines) were checked against NASA references; each catalog card and orbit
            option shows its <span className="text-text">NASA ref</span>.
          </p>

          <section aria-label="3D planet imagery">
            <button
              type="button"
              onClick={() => setPlanetsOpen((v) => !v)}
              aria-expanded={planetsOpen}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <span className="flex items-center gap-2.5 text-base font-medium text-text">
                <Icon name="globe" size={20} className="text-text-dim" />
                3D planets
              </span>
              <span className="flex items-center gap-2 text-sm text-text-dim">
                {PLANET_TEXTURE_SOURCES.length} images
                <Icon name="chevronDown" size={16} className={cx('transition-transform duration-200', planetsOpen && 'rotate-180')} />
              </span>
            </button>
            <p className="mt-1 text-sm text-text-faint">Earth, Moon and Mars on the orbit and operations screens</p>
            {planetsOpen && (
              <ul className="mt-3 flex animate-fade-in flex-col gap-3">
                {PLANET_TEXTURE_SOURCES.map((p) => (
                  <li key={p.url} className="text-sm leading-snug">
                    <span className="text-text-faint">{p.body} · </span>
                    <a href={p.url} target="_blank" rel="noreferrer" className="text-text hover:text-mint">
                      {p.title}
                    </a>
                    <span className="block text-text-dim">{p.credit}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>

        {/* right: sources grouped by where they appear */}
        <section className="glass flex min-h-0 flex-col" aria-label="Sources by screen">
          <div className="nasa-scroll min-h-0 flex-1 overflow-y-auto px-7 py-5">
            {groups.map(({ group, entries }) => (
              <section key={group.id} className="mb-6 last:mb-0" aria-labelledby={`nasa-${group.id}`}>
                <h2 id={`nasa-${group.id}`} className="flex items-center gap-2.5 border-b border-hairline pb-2.5 text-xl font-medium text-text">
                  <Icon name={group.icon} size={20} className="text-text-dim" />
                  {group.title}
                  <span className="num ml-auto text-sm font-normal text-text-faint">{entries.length}</span>
                </h2>
                <ul className="divide-y divide-hairline pt-2">
                  {entries.map((e) => (
                    <SourceRow key={e.src.id} entry={e} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <style>{`.nasa-scroll{scrollbar-width:thin;scrollbar-color:rgb(255 255 255/.16) transparent}`}</style>
        </section>
      </div>

      <div className="shrink-0 px-4 pt-3 pb-3.5">
        <ActionBar
          onBack={() => goTo('menu')}
          backLabel="Overview"
          status="No NASA logo is used and no endorsement is implied."
          action={
            <Button variant="secondary" iconRight="arrowRight" onClick={() => goTo('missions')}>
              Choose a mission
            </Button>
          }
        />
      </div>
    </div>
  )
}
