import { AiMark, Icon } from '../../components'
import { publicUrl } from '../../lib/publicUrl'

export interface OrbitInfo {
  name: string
  altitude?: string
}

/** Photo is 1672x941; the orbit line passes (1445, 211) on the right of the satellite. */
const IMG_W = 1672
const IMG_H = 941
const pct = (v: number, of: number) => `${(v / of) * 100}%`

/**
 * Full-bleed Overview background: the user-provided photo (nebula, Earth limb, CubeSat, orbit line).
 * The frame reproduces `object-fit: cover` anchored top-right, so overlays (orbit dot, callout) can be
 * placed in image percentages and stay glued to the photo at any window size.
 * Needs `container-type: size` on the parent (see MainMenu).
 */
export function OverviewBackdrop({ orbit }: { orbit: OrbitInfo }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div
        className="absolute top-0 right-0"
        style={{ width: `max(100cqw, calc(100cqh * ${IMG_W / IMG_H}))`, aspectRatio: `${IMG_W} / ${IMG_H}` }}
      >
        <img
          src={publicUrl('images/bg/overview.webp')}
          alt=""
          width={IMG_W}
          height={IMG_H}
          decoding="async"
          fetchPriority="high"
          className="absolute inset-0 h-full w-full animate-fade-in select-none"
          style={{ animationDuration: '700ms' }}
          draggable={false}
        />
        {/* dot riding the orbit line */}
        <span className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: pct(1445, IMG_W), top: pct(211, IMG_H) }}>
          <span className="absolute -inset-2 animate-pulse-soft rounded-full border border-white/35" />
          <span className="block h-2.5 w-2.5 rounded-full bg-[#eef8f6] shadow-[0_0_10px_rgb(200_240_250/0.8)]" />
        </span>
        {/* leader from the dot up to the callout */}
        <span
          className="absolute w-px bg-gradient-to-t from-white/50 to-white/10"
          style={{ left: pct(1445, IMG_W), top: pct(176, IMG_H), height: pct(30, IMG_H) }}
        />
        <div
          className="glass-strong absolute flex items-center gap-3 !rounded-control px-4 py-2.5"
          style={{ right: pct(1672 - 1610, IMG_W), top: pct(108, IMG_H), minWidth: 180, background: 'rgb(12 30 38 / 0.72)' }}
        >
          <Icon name="orbit" size={22} className="text-text-dim" />
          <div className="leading-tight">
            <div className="text-sm text-text">{orbit.name}</div>
            {orbit.altitude && <div className="num mt-0.5 text-base text-text">{orbit.altitude}</div>}
          </div>
        </div>
      </div>

      {/* visible SI watermark, glued to the screen corner so the layout never crops it */}
      <AiMark corner="tr" className="!top-5 !right-7" />

      {/* readability scrims: left for the hero copy, bottom for the cards */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, rgb(6 18 24 / 0.82) 0%, rgb(6 18 24 / 0.55) 30%, rgb(6 18 24 / 0.08) 55%, transparent 70%),' +
            'linear-gradient(0deg, rgb(6 16 22 / 0.88) 0%, rgb(6 16 22 / 0.6) 38%, rgb(6 16 22 / 0.12) 58%, transparent 66%)',
        }}
      />
    </div>
  )
}
