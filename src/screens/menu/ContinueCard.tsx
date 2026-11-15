import { publicUrl } from '../../lib/publicUrl'
import { AiMark, Button, Icon } from '../../components'
import type { Design, Mission } from '../../data'

/** How far the draft is along the 5-step flow: Mission, Design, Orbit, Simulation, Report. */
export function draftProgress(design: Design, designReady: boolean): { step: number; name: string; fraction: number } {
  const slots = [design.instruments.length > 0, !!design.solar, !!design.battery, !!design.radio, !!design.computer, !!design.attitude]
  const filled = slots.filter(Boolean).length / slots.length
  if (designReady) return { step: 3, name: 'Orbit', fraction: (2 + (design.launcher ? 0.8 : 0.3)) / 5 }
  return { step: 2, name: 'Design', fraction: (1 + filled * 0.9) / 5 }
}

export function ContinueCard({
  mission,
  design,
  designReady,
  onResume,
  onNew,
}: {
  mission: Mission | null
  design: Design | null
  designReady: boolean
  onResume: () => void
  onNew: () => void
}) {
  if (!mission || !design) {
    return (
      <section className="glass flex items-center gap-5 px-5 py-4" aria-label="Continue your design">
        <div className="relative flex h-[110px] w-[158px] shrink-0 items-center justify-center overflow-hidden rounded-card border border-dashed border-white/20 bg-[#0b1d25]">
          <img
            src={publicUrl('images/bg/continue_cubesat.webp')}
            alt=""
            width={512}
            height={512}
            decoding="async"
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover opacity-30 saturate-50 select-none"
          />
          <span className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-[#06141b]/70 text-text">
            <Icon name="plus" size={20} />
          </span>
          <AiMark corner="bl" className="!bottom-1.5 !left-1.5" />
        </div>
        <span className="h-[88px] w-px shrink-0 bg-hairline" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="text-sm text-text-dim">Continue your design</div>
          <div className="mt-1 text-2xl leading-tight text-text">No design in progress</div>
          <div className="mt-1 text-base text-text-dim">Start a new mission to build your first spacecraft.</div>
        </div>
        <Button variant="secondary" size="md" iconRight="arrowRight" onClick={onNew}>
          Start a mission
        </Button>
      </section>
    )
  }
  const p = draftProgress(design, designReady)
  return (
    <section className="glass flex items-center gap-5 px-5 py-4" aria-label="Continue your design">
      <div className="relative h-[110px] w-[158px] shrink-0 overflow-hidden rounded-card border border-white/[0.12] bg-[#0b1d25] shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]">
        <img
          src={publicUrl('images/bg/continue_cubesat.webp')}
          alt=""
          width={512}
          height={512}
          decoding="async"
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover select-none"
        />
        <AiMark corner="bl" className="!bottom-1.5 !left-1.5" />
        <span className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_1px_0_rgb(255_255_255/0.1)]" aria-hidden="true" />
      </div>
      <span className="h-[88px] w-px shrink-0 bg-hairline" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="text-sm text-text-dim">Continue your design</div>
        <div className="mt-0.5 truncate text-2xl leading-tight text-text">{mission.name}</div>
        <div className="mt-2 flex items-center gap-4">
          <span className="glass-inset shrink-0 !rounded-[10px] px-3 py-1 text-sm text-text">
            {p.name} <span className="text-text-dim">•</span> <span className="num">{p.step} of 5</span>
          </span>
          <div
            className="h-1.5 max-w-[380px] min-w-[120px] flex-1 overflow-hidden rounded-full bg-white/10"
            role="progressbar"
            aria-label="Design progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(p.fraction * 100)}
          >
            <div className="h-full rounded-full bg-mint" style={{ width: `${p.fraction * 100}%` }} />
          </div>
        </div>
      </div>
      <Button size="md" iconRight="arrowRight" onClick={onResume}>
        Resume
      </Button>
    </section>
  )
}
