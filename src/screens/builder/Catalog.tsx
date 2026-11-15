import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { audio } from '../../audio/audioManager'
import { Checkbox, cx, Icon, Tooltip } from '../../components'
import { POINTING_LABEL } from '../../data'
import type { AnyComponent, CatalogCategory, CategoryId, Design, Mission, NasaRef, SlotKey } from '../../data'
import { fmtDv, fmtGB, fmtGBmo, fmtKg, fmtMoney, fmtPct, fmtW } from '../../engine'
import { ComponentThumb } from '../../spacecraft3d'
import { useGameStore } from '../../store/gameStore'
import { categoryFill, componentsOf, selectedIds } from './util'

/** Short tab names (mockup 03: "Payload | Power | Comms | More"). */
export const TAB_LABEL: Partial<Record<CategoryId, string>> = { instruments: 'Payload', attitude: 'Attitude' }
export const tabLabel = (c: CatalogCategory) => TAB_LABEL[c.id] ?? c.label

const VISIBLE_TABS = 3
const THUMB = 76

interface CatalogProps {
  mission: Mission
  design: Design
  tab: CategoryId
  onTab: (id: CategoryId) => void
  /** Team mode: hint for a tab the player at the console does not control ("Systems Engineer controls Power"). */
  lockHint?: (id: CategoryId) => string | null
}

/** Left column (03 "Components"): search, segmented tabs with a More menu, component cards, selection footer. */
export function Catalog({ mission, design, tab, onTab, lockHint }: CatalogProps) {
  const cat = mission.categories.find((c) => c.id === tab) ?? mission.categories[0]
  const locked = lockHint ? lockHint(cat.id) : null
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const listRef = useRef<HTMLDivElement>(null)

  // back to the top when the tab changes (e.g. a click on the 3D model)
  useEffect(() => {
    listRef.current?.scrollTo({ top: 0 })
  }, [tab])

  const groups = useMemo(() => {
    if (!q) return cat.groups.map((g) => ({ key: g.key, max: g.max, label: cat.groups.length > 1 ? groupLabel(g.key) : null, items: componentsOf(mission, g.key) }))
    return mission.categories.flatMap((c) =>
      c.groups
        .map((g) => ({
          key: g.key,
          max: g.max,
          label: c.groups.length > 1 ? `${tabLabel(c)} · ${groupLabel(g.key)}` : tabLabel(c),
          items: componentsOf(mission, g.key).filter((x) => `${x.name} ${x.description}`.toLowerCase().includes(q)),
        }))
        .filter((g) => g.items.length > 0),
    )
  }, [q, cat, mission])

  return (
    <section className="glass flex min-h-0 flex-col" aria-label="Components">
      <header className="shrink-0 px-[18px] pt-[18px]">
        <h2 className="px-1 text-xl leading-tight font-medium text-text">Components</h2>
        <label className="mt-3.5 flex h-11 items-center gap-2.5 rounded-control border border-white/[0.11] bg-white/[0.035] px-3.5 transition-colors focus-within:border-mint/50">
          <Icon name="search" size={19} className="shrink-0 text-text-dim" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
            placeholder="Search components…"
            aria-label="Search components"
            className="min-w-0 flex-1 bg-transparent text-base text-text outline-none placeholder:text-text-faint [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="text-text-dim hover:text-text">
              <Icon name="cross" size={16} />
            </button>
          )}
        </label>
        <CategoryTabs mission={mission} design={design} active={cat.id} muted={!!q} onTab={(id) => (setQuery(''), onTab(id))} lockHint={lockHint} />
        {locked && !q && (
          <p className="mt-2.5 flex items-center gap-2 rounded-[10px] border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-text-dim" role="note">
            <Icon name="lock" size={16} className="shrink-0" />
            {locked}. View only.
          </p>
        )}
      </header>

      <div
        ref={listRef}
        className={cx('catalog-scroll mt-3 min-h-0 flex-1 overflow-y-auto px-[18px] pb-2', locked && !q && '[&_article]:pointer-events-none [&_article]:opacity-60')}
        aria-disabled={(locked && !q) || undefined}
        role="tabpanel"
        aria-label={q ? 'Search results' : cat.label}
      >
        {groups.length === 0 && (
          <p className="px-1 py-8 text-center text-sm text-text-dim">
            Nothing matches “{query.trim()}”.
          </p>
        )}
        {groups.map((g) => (
          <div key={g.key} className="mb-3 last:mb-0">
            {g.label && <h3 className="mb-2 px-1 text-sm text-text-dim">{g.label}</h3>}
            <div className="flex flex-col gap-2">
              {g.items.map((c) => (
                <ComponentCard key={c.id} mission={mission} design={design} slot={g.key} max={g.max} comp={c} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className={cx(locked && !q && 'pointer-events-none opacity-60')}>
        <CatalogFooter mission={mission} design={design} cat={cat} />
      </div>
      <style>{`.catalog-scroll{scrollbar-width:thin;scrollbar-color:rgb(255 255 255/.16) transparent}`}</style>
    </section>
  )
}

function groupLabel(key: SlotKey) {
  return key === 'solar' ? 'Solar panels' : key === 'battery' ? 'Battery' : key
}

// ---------------------------------------------------------------------------

function CategoryTabs({
  mission,
  design,
  active,
  muted,
  onTab,
  lockHint,
}: {
  mission: Mission
  design: Design
  active: CategoryId
  muted: boolean
  onTab: (id: CategoryId) => void
  lockHint?: (id: CategoryId) => string | null
}) {
  const visible = mission.categories.slice(0, VISIBLE_TABS)
  const more = mission.categories.slice(VISIBLE_TABS)
  const activeInMore = more.find((c) => c.id === active)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const pick = (id: CategoryId) => {
    setOpen(false)
    if (id !== active || muted) {
      audio.playSfx('ui_click')
      onTab(id)
    }
  }
  const seg = (on: boolean) =>
    cx(
      'relative inline-flex h-9 min-w-0 flex-auto items-center justify-center gap-1 rounded-[9px] px-2.5 text-sm font-medium whitespace-nowrap transition-[background-color,color,box-shadow] duration-200',
      on && !muted ? 'mint-fill' : 'text-text hover:bg-white/[0.06]',
    )

  return (
    <div
      role="tablist"
      aria-label="Component categories"
      className="mt-3 flex items-center gap-0.5 rounded-control border border-white/10 bg-white/[0.04] p-1 shadow-[inset_0_1px_2px_rgb(0_0_0/0.18)]"
    >
      {visible.map((c) => (
        <button key={c.id} type="button" role="tab" aria-selected={c.id === active} onClick={() => pick(c.id)} className={seg(c.id === active)} title={lockHint?.(c.id) ?? undefined}>
          {lockHint?.(c.id) && <Icon name="lock" size={13} className="shrink-0 opacity-70" />}
          {tabLabel(c)}
        </button>
      ))}
      {more.length > 0 && (
        <div ref={ref} className="relative flex min-w-0 flex-auto">
          <button
            type="button"
            role="tab"
            aria-selected={!!activeInMore}
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className={seg(!!activeInMore)}
          >
            <span className="truncate">{activeInMore ? tabLabel(activeInMore) : 'More'}</span>
            <Icon name="chevronDown" size={16} className={cx('shrink-0 transition-transform duration-200', open && 'rotate-180')} />
          </button>
          {open && (
            <div role="menu" className="glass-strong absolute top-full right-0 z-40 mt-2 w-[230px] animate-fade-in rounded-control p-1.5">
              {more.map((c) => {
                const fill = categoryFill(c, design)
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="menuitem"
                    onClick={() => pick(c.id)}
                    className={cx(
                      'flex h-10 w-full items-center justify-between gap-3 rounded-[9px] px-3 text-left text-sm transition-colors',
                      c.id === active ? 'bg-white/[0.08] text-text' : 'text-text hover:bg-white/[0.06]',
                    )}
                  >
                    <span className="flex items-center gap-1.5">
                      {lockHint?.(c.id) && <Icon name="lock" size={13} className="shrink-0 opacity-70" />}
                      {c.label}
                    </span>
                    {fill === 'full' ? (
                      <Icon name="check" size={16} className="text-mint" />
                    ) : (
                      <span className="text-xs text-text-faint">{fill === 'partial' ? 'partly' : 'empty'}</span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

interface CardProps {
  mission: Mission
  design: Design
  slot: SlotKey
  max: number
  comp: AnyComponent
}

function ComponentCard({ mission, design, slot, max, comp }: CardProps) {
  const toggleInstrument = useGameStore((s) => s.toggleInstrument)
  const setComponent = useGameStore((s) => s.setComponent)
  const chosen = selectedIds(design, slot)
  const installed = chosen.includes(comp.id)
  const multi = slot === 'instruments'
  const full = multi && !installed && chosen.length >= max

  const set = (on: boolean) => {
    if (on === installed || (on && full)) return
    if (multi) toggleInstrument(comp.id)
    else setComponent(slot, on ? comp.id : null)
    audio.playSfx(on ? 'ui_add' : 'ui_remove')
  }
  const s = stats(comp, mission, design)
  const [refOpen, setRefOpen] = useState(false)

  return (
    <article
      onClick={multi ? undefined : () => set(!installed)}
      className={cx(
        'relative flex gap-3 rounded-card border p-2.5 pr-3 transition-[background-color,border-color] duration-200',
        installed ? 'border-mint/40 bg-mint/[0.06]' : 'border-white/[0.09] bg-white/[0.03] hover:border-white/[0.18] hover:bg-white/[0.05]',
        !multi && 'cursor-pointer',
      )}
    >
      <div
        className={cx(
          'grid shrink-0 place-items-center self-start rounded-[10px] bg-[radial-gradient(circle_at_50%_40%,rgb(255_255_255/0.07),transparent_70%)]',
          !installed && 'opacity-90',
        )}
        style={{ width: THUMB, height: THUMB }}
      >
        <ComponentThumb componentId={comp.id} missionId={mission.id} size={THUMB} alt="" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h4 className="text-base leading-snug font-medium text-text">{comp.name}</h4>
            <p className={cx('text-xs leading-tight', installed ? 'text-mint' : 'text-text-faint')}>{installed ? 'Installed' : 'Not installed'}</p>
          </div>
          {multi ? (
            <CountStepper name={comp.name} count={installed ? 1 : 0} full={full} max={max} onSet={set} />
          ) : (
            <SelectButton name={comp.name} installed={installed} onSet={set} />
          )}
        </div>
        <p className="mt-1 truncate text-sm leading-snug text-text-dim" title={comp.description}>{comp.description}</p>
        <div className="num mt-1.5 text-[14px] leading-[1.45] text-text">
          <div>{s.a.join(' · ')}</div>
          <div>{s.b.join(' · ')}</div>
        </div>
        {(s.notes.length > 0 || comp.nasaRef) && (
          <div className="mt-1 flex items-start gap-2.5 text-xs leading-snug">
            <span className="flex min-w-0 flex-1 flex-wrap gap-x-2.5">
              {s.notes.map((n) => (
                <span key={n.text} className={n.warn ? 'text-amber' : 'text-text-dim'}>
                  {n.text}
                </span>
              ))}
            </span>
            {comp.nasaRef && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setRefOpen((v) => !v)
                }}
                aria-expanded={refOpen}
                aria-label={`NASA reference for ${comp.name}`}
                className={cx(
                  'inline-flex shrink-0 items-center gap-1 rounded-[6px] px-1 text-xs transition-colors',
                  refOpen ? 'text-text' : 'text-text-faint hover:text-text-dim',
                )}
              >
                <Icon name="book" size={13} />
                NASA ref
              </button>
            )}
          </div>
        )}
        {refOpen && comp.nasaRef && <NasaRefNote nref={comp.nasaRef} />}
      </div>
    </article>
  )
}

/** Expanded "NASA ref" note inside a card: the plain-English reference, its citation and a link. */
function NasaRefNote({ nref }: { nref: NasaRef }) {
  return (
    <div className="mt-1.5 animate-fade-in rounded-[10px] border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 text-xs leading-snug text-text-dim" onClick={(e) => e.stopPropagation()}>
      <p className="text-text">{nref.text}</p>
      <a
        href={nref.url}
        target="_blank"
        rel="noreferrer"
        className="mt-1 inline-flex items-center gap-1 text-text-faint underline decoration-white/20 underline-offset-2 hover:text-text-dim"
      >
        {nref.source}
        <Icon name="external" size={12} />
      </a>
    </div>
  )
}

/** "− 1 +" (instruments: 0 or 1 each, at most `max` in total). */
function CountStepper({ name, count, full, max, onSet }: { name: string; count: number; full: boolean; max: number; onSet: (on: boolean) => void }) {
  const btn = 'grid h-7 w-7 place-items-center rounded-[7px] transition-colors disabled:cursor-not-allowed disabled:text-text-faint/60'
  return (
    <div className="flex shrink-0 items-center rounded-[9px] border border-white/[0.12] bg-white/[0.04] p-0.5" role="group" aria-label={`${name} count`}>
      <button type="button" className={cx(btn, 'text-text hover:bg-white/[0.08]')} disabled={count === 0} onClick={() => onSet(false)} aria-label={`Remove ${name}`}>
        <Icon name="minus" size={15} strokeWidth={2} />
      </button>
      <span className="num w-5 text-center text-sm text-text" aria-live="polite">
        {count}
      </span>
      <Tooltip content={full ? `Up to ${max} instruments. Remove one first.` : null} placement="left">
        <button
          type="button"
          className={cx(btn, 'text-text hover:bg-white/[0.08]')}
          disabled={count === 1 || full}
          onClick={() => onSet(true)}
          aria-label={`Install ${name}`}
        >
          <Icon name="plus" size={15} strokeWidth={2} />
        </button>
      </Tooltip>
    </div>
  )
}

/** Single-choice slot: "Select" or a mint "Selected" chip that turns into "Remove" on hover. */
function SelectButton({ name, installed, onSet }: { name: string; installed: boolean; onSet: (on: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onSet(!installed)
      }}
      aria-pressed={installed}
      aria-label={installed ? `Remove ${name}` : `Select ${name}`}
      className={cx(
        'group/sel inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[9px] border px-2.5 text-sm transition-colors duration-200',
        installed
          ? 'border-mint/40 text-mint hover:border-red/50 hover:bg-red/10 hover:text-red'
          : 'border-white/[0.14] text-text hover:border-white/30 hover:bg-white/[0.06]',
      )}
    >
      {installed ? (
        <>
          <Icon name="check" size={15} strokeWidth={2} className="group-hover/sel:hidden" />
          <Icon name="cross" size={15} strokeWidth={2} className="hidden group-hover/sel:block" />
          <span className="group-hover/sel:hidden">Selected</span>
          <span className="hidden group-hover/sel:inline">Remove</span>
        </>
      ) : (
        'Select'
      )}
    </button>
  )
}

interface Note {
  text: string
  warn?: boolean
}

/** Two mono lines (physical · cost/performance) plus optional trait notes. */
function stats(c: AnyComponent, mission: Mission, design: Design): { a: string[]; b: string[]; notes: Note[] } {
  const a: string[] = [fmtKg(c.kg, mission)]
  const b: string[] = [fmtMoney(c.costM)]
  const notes: Note[] = []
  switch (c.kind) {
    case 'instrument':
      a.push(fmtW(c.watts))
      b.push(fmtGBmo(c.gbPerMonth))
      break
    case 'solar': {
      a.push(`${fmtW(c.sunWatts)} in sun`)
      const risk = design.burnWire && c.deployRiskRedundant != null ? c.deployRiskRedundant : c.deployRisk
      notes.push(risk > 0 ? { text: `Deploy risk ${fmtPct(risk)}`, warn: true } : { text: 'No deployment risk' })
      break
    }
    case 'battery':
      a.push(`${c.wh} Wh`)
      break
    case 'radio':
      a.push(fmtW(c.watts))
      b.push(`${fmtGBmo(c.gbPerUnit)} per contact`)
      if (c.pointingFactor[0] < 1) notes.push({ text: 'Needs pointing', warn: true })
      break
    case 'computer':
      a.push(fmtW(c.watts))
      b.push(`${fmtGB(c.storageGB)} storage`)
      notes.push({ text: `Flare damage ${fmtPct(c.flareDamage)}`, warn: c.flareDamage >= 0.3 })
      if (c.autonomous) notes.push({ text: 'Autonomous' })
      break
    case 'attitude':
      a.push(fmtW(c.watts))
      b.push(`${POINTING_LABEL[c.pointing]} pointing`)
      if (c.wheelFaultChance > 0) notes.push({ text: `Wheel fault ${fmtPct(c.wheelFaultChance)}`, warn: true })
      break
    case 'propulsion':
      a.push(`${fmtDv(c.dvAtRef)} at ${mission.dvRefMass} kg`)
      if (c.extraCruiseSteps > 0) notes.push({ text: `+${c.extraCruiseSteps} mo cruise`, warn: true })
      break
  }
  if (c.months > 0) b.push(`+${c.months} mo`)
  return { a, b, notes }
}

// ---------------------------------------------------------------------------

function CatalogFooter({ mission, design, cat }: { mission: Mission; design: Design; cat: CatalogCategory }) {
  const setBurnWire = useGameStore((s) => s.setBurnWire)
  const opt = cat.options.find((o) => o.key === 'burnWire')
  const parts: ReactNode[] = cat.groups.map((g) => {
    const ids = selectedIds(design, g.key)
    if (g.key === 'instruments') {
      return (
        <span key={g.key}>
          <span className="num text-text">{ids.length}</span> {ids.length === 1 ? 'payload' : 'payloads'} selected
          <span className="text-text-faint"> · max {g.max}</span>
        </span>
      )
    }
    const name = componentsOf(mission, g.key).find((c) => c.id === ids[0])?.name
    const head = cat.groups.length > 1 ? groupLabel(g.key) : 'Selected'
    return (
      <span key={g.key} className="block truncate">
        {head}: {name ? <span className="text-text">{name}</span> : <span className="text-text-faint">none yet</span>}
      </span>
    )
  })

  return (
    <footer className="mx-[18px] flex shrink-0 flex-col gap-1 border-t border-hairline pt-2.5 pb-3.5 text-sm text-text-dim">
      {parts}
      {opt && (
        <div className="mt-1 flex items-center gap-2">
          <Checkbox checked={design.burnWire} onChange={(on) => setBurnWire(on)} label={<span className="text-sm whitespace-nowrap text-text">{opt.label}</span>} />
          <span className="num ml-auto text-xs whitespace-nowrap text-text-dim">
            +{fmtKg(opt.kg, mission)} · +{fmtMoney(opt.costM)}
          </span>
          <Tooltip
            placement="top"
            bubbleClassName="w-72"
            content={
              <>
                <b className="mb-0.5 block font-medium text-text">{opt.label}</b>
                {opt.description}
                <span className="mt-1 block text-text-dim">Lowers the deployment risk of folding panels.</span>
              </>
            }
          >
            <span tabIndex={0} aria-label="What is a burn wire?" className="grid h-5 w-5 cursor-help place-items-center rounded-full text-text-dim hover:text-text">
              <Icon name="info" size={17} />
            </span>
          </Tooltip>
        </div>
      )}
    </footer>
  )
}
