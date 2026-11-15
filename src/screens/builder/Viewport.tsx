import { Fragment } from 'react'
import { audio } from '../../audio/audioManager'
import { cx, Icon, Toggle } from '../../components'
import type { CategoryId, Design, Mission } from '../../data'
import { SpacecraftViewLazy } from '../../spacecraft3d'
import { tabLabel } from './Catalog'
import { categoryFill, selectedIds } from './util'

interface ViewportProps {
  mission: Mission
  design: Design
  tab: CategoryId
  exploded: boolean
  onExploded: (v: boolean) => void
  onOpenTab: (id: CategoryId) => void
}

/** Platform heading per mission (03: "3U platform · 100 × 100 × 300 mm"). */
function platformTitle(mission: Mission): { title: string; sub: string } {
  if (mission.id === 'earth') return { title: '3U platform', sub: '100 × 100 × 300 mm' }
  const p = mission.platform
  return {
    title: mission.id === 'lunar' ? 'Small spacecraft bus' : 'Interplanetary bus',
    sub: `${p.kg} kg structure · ${p.watts} W housekeeping`,
  }
}

/** Centre column: title + Exploded/Assembled switch, the live 3D spacecraft, installed-stack strip. */
export function Viewport({ mission, design, tab, exploded, onExploded, onOpenTab }: ViewportProps) {
  const head = platformTitle(mission)
  return (
    <section className="glass relative isolate flex min-h-0 flex-col" aria-label="Spacecraft">
      <header className="relative z-10 flex shrink-0 items-start justify-between gap-3 px-[22px] pt-[18px]">
        <div className="min-w-0">
          <h2 className="text-[26px] leading-tight font-medium text-text">{head.title}</h2>
          <p className="mt-1 text-sm text-text-dim">{head.sub}</p>
        </div>
        <Toggle checked={!exploded} onChange={(v) => onExploded(!v)} options={['Exploded', 'Assembled']} aria-label="View mode" />
      </header>

      <div className="relative min-h-0 flex-1">
        <SpacecraftViewLazy
          missionId={mission.id}
          design={design}
          exploded={exploded}
          highlightCategory={tab}
          onSelectCategory={(c) => {
            if (c === tab) return
            audio.playSfx('ui_click')
            onOpenTab(c)
          }}
          labels={{ instruments: 'Payload' }}
          fallback={
            <div className="flex h-full items-center justify-center px-8 text-center text-sm text-text-dim">
              3D view unavailable on this device. Use the component list on the left.
            </div>
          }
        />
      </div>

      <InstalledStack mission={mission} design={design} tab={tab} onOpenTab={onOpenTab} />
    </section>
  )
}

/** "Installed stack ✓ Payload (3) | ✓ Computer | …": checked = complete; muted ones are clickable to install. */
function InstalledStack({ mission, design, tab, onOpenTab }: { mission: Mission; design: Design; tab: CategoryId; onOpenTab: (id: CategoryId) => void }) {
  // mockup order: payload, computer, comms, attitude, power (+ propulsion)
  const order: CategoryId[] = ['instruments', 'computer', 'comms', 'attitude', 'power', 'propulsion']
  const cats = order.map((id) => mission.categories.find((c) => c.id === id)).filter((c) => c != null)
  return (
    <div className="glass-inset @container relative z-10 mx-3.5 mb-3.5 flex shrink-0 items-center gap-1 !rounded-control px-3 py-2" aria-label="Installed stack">
      <span className={cx('mr-2 ml-1 text-sm whitespace-nowrap text-text-dim', cats.length > 5 ? 'hidden @[780px]:inline' : 'hidden @[560px]:inline')}>
        Installed stack
      </span>
      <div className="flex min-w-0 flex-1 items-center justify-between">
        {cats.map((c, i) => {
          const ok = categoryFill(c, design) === 'full'
          const n = c.id === 'instruments' ? selectedIds(design, 'instruments').length : 0
          return (
            <Fragment key={c.id}>
              {i > 0 && <span className="mx-0.5 h-4 w-px shrink-0 bg-hairline" aria-hidden="true" />}
              <button
                type="button"
                onClick={() => {
                  if (c.id === tab) return
                  audio.playSfx('ui_click')
                  onOpenTab(c.id)
                }}
                aria-label={`${c.label}: ${ok ? 'installed' : 'not installed'}`}
                className={cx(
                  'inline-flex h-8 min-w-0 items-center gap-1.5 rounded-[8px] px-2 text-sm whitespace-nowrap transition-colors duration-200',
                  ok ? 'text-text hover:bg-white/[0.06]' : 'text-text-faint hover:bg-white/[0.06] hover:text-text-dim',
                )}
              >
                <span
                  className={cx(
                    'grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full',
                    ok ? 'mint-fill' : 'border border-dashed border-white/30',
                  )}
                >
                  {ok && <Icon name="check" size={12} strokeWidth={2.6} />}
                </span>
                {tabLabel(c)}
                {c.id === 'instruments' && n > 0 && <span className="text-text-dim tabular-nums">({n})</span>}
              </button>
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}
