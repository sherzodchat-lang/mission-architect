import type { CSSProperties } from 'react'
import { Icon, ImageSlot, StarRating, Tooltip, cx } from '../../components'
import type { MissionId } from '../../data'
import type { Stars } from '../../store/persistence'

interface Entry {
  id: string
  name: string
  mission: MissionId | null
  /** which mission's ★★ unlocks this one */
  after?: string
}

export const COLLECTION: Entry[] = [
  { id: 'earth', name: 'Earth Observer', mission: 'earth' },
  { id: 'lunar', name: 'Lunar Orbiter', mission: 'lunar', after: 'Earth' },
  { id: 'mars', name: 'Mars Probe', mission: 'mars', after: 'Moon' },
  { id: 'asteroid', name: 'Asteroid Scout', mission: null },
  { id: 'venus', name: 'Venus Orbiter', mission: null },
  { id: 'europa', name: 'Europa Probe', mission: null },
  { id: 'solar', name: 'Solar Observer', mission: null },
]

const LOCK_HINT = 'Earn ★★ on the previous mission to unlock'

/**
 * The card art is square (640²) with a baked-in rounded frame: it is drawn as a square anchored to the
 * top of the card (overscanned ~3.5% to crop the frame) so the whole spacecraft stays visible; a blurred
 * cover-scaled copy fills the rest of a tall card and the planet runs into the bottom scrim under the title.
 */
const ART: CSSProperties = {
  position: 'absolute',
  left: 0,
  top: 0,
  width: '100%',
  // fade the square's lower edge into the blurred fill below it (no seam on tall cards)
  maskImage: 'linear-gradient(180deg, #000 80%, transparent 99%)',
  WebkitMaskImage: 'linear-gradient(180deg, #000 80%, transparent 99%)',
}
/** Same art, cover-scaled and blurred: fills whatever the square leaves free at the bottom. */
const FILL: CSSProperties = { position: 'absolute', inset: '-12%', filter: 'blur(14px)', opacity: 0.85 }

function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex h-6 items-center gap-1.5 rounded-full border border-white/15 bg-[#06141b]/65 px-2.5 text-xs text-text backdrop-blur-md',
        className,
      )}
    >
      {children}
    </span>
  )
}

function Card({
  entry,
  unlocked,
  selected,
  stars,
  onOpen,
}: {
  entry: Entry
  unlocked: boolean
  selected: boolean
  stars: number
  onOpen: () => void
}) {
  const soon = entry.mission == null
  const playable = !soon && unlocked
  const art = `collection_${entry.id}${playable ? '' : '_locked'}`
  const body = (
    <>
      <div
        className={cx(
          'absolute inset-0 transition-transform duration-700 ease-out-expo',
          playable ? 'group-hover:scale-[1.045]' : 'brightness-[0.92] saturate-[0.7]',
        )}
      >
        <div style={FILL} aria-hidden="true">
          <ImageSlot aspect={1} id={art} className="!h-full !rounded-none !border-0 !shadow-none [&_img]:object-[50%_85%]" />
        </div>
        <div style={ART}>
          <ImageSlot aspect={1} id={art} className="!rounded-none !border-0 !shadow-none" />
        </div>
      </div>
      {/* bottom scrim: the title always sits on calm dark */}
      <div
        className="absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            'linear-gradient(180deg, transparent 38%, rgb(5 15 21 / 0.55) 62%, rgb(5 15 21 / 0.92) 82%, rgb(5 15 21 / 0.97) 100%)',
        }}
      />
      {/* inner highlight + hairline, drawn over the art */}
      <div
        className={cx(
          'pointer-events-none absolute inset-0 rounded-[inherit] border transition-colors duration-300',
          selected && playable ? 'border-mint/70' : 'border-white/[0.13]',
          playable && 'group-hover:border-mint/55 group-focus-visible:border-mint/70',
        )}
        style={{ boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.14), inset 0 0 0 1px rgb(255 255 255 / 0.02)' }}
        aria-hidden="true"
      />

      <div className="absolute inset-x-0 bottom-0 px-4 pb-4 text-left">
        <div className={cx('text-lg leading-tight', playable ? 'text-text' : 'text-text/85')}>{entry.name}</div>
        {playable ? (
          <div className="mt-1.5 flex h-6 items-center gap-2 text-sm text-text-dim">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-mint shadow-[0_0_6px_rgb(163_240_212/0.9)]" />
            {selected ? (
              <span className="text-text">In progress</span>
            ) : stars > 0 ? (
              <StarRating value={stars} size={15} />
            ) : (
              <span className="flex items-center gap-1 transition-colors group-hover:text-mint">
                Available <Icon name="arrowRight" size={15} className="opacity-0 transition-opacity group-hover:opacity-100" />
              </span>
            )}
          </div>
        ) : (
          <div className="mt-1.5">
            <Chip className="max-w-full text-text-dim">
              <Icon name="lock" size={13} className="shrink-0" />
              <span className="truncate">{soon ? 'Coming soon' : `Earn ★★ on ${entry.after}`}</span>
            </Chip>
          </div>
        )}
      </div>
    </>
  )
  const frame = cx(
    'group relative block h-full w-full overflow-hidden rounded-[18px] bg-[#0a1a22] text-left outline-none',
    'shadow-[0_14px_34px_-14px_rgb(0_0_0/0.7)] transition-[transform,box-shadow] duration-300 ease-out-expo',
    playable && 'cursor-pointer hover:-translate-y-1 hover:shadow-[0_22px_44px_-16px_rgb(0_0_0/0.8),0_0_0_1px_rgb(163_240_212/0.08)] focus-visible:-translate-y-1 focus-visible:ring-2 focus-visible:ring-mint/70 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
    selected && playable && 'shadow-[0_14px_34px_-14px_rgb(0_0_0/0.7),0_0_24px_-6px_rgb(163_240_212/0.35)]',
    !playable && 'cursor-default',
  )
  if (soon) {
    return (
      <div className="h-full min-w-0" role="img" aria-label={`${entry.name}, coming soon`}>
        <div className={frame}>{body}</div>
      </div>
    )
  }
  return (
    <Tooltip content={LOCK_HINT} disabled={unlocked} className="!flex h-full min-w-0" bubbleClassName="whitespace-nowrap">
      <button
        type="button"
        onClick={unlocked ? onOpen : undefined}
        aria-disabled={!unlocked || undefined}
        aria-label={unlocked ? `${entry.name}, open mission` : `${entry.name}, locked. ${LOCK_HINT}`}
        className={frame}
      >
        {body}
      </button>
    </Tooltip>
  )
}

/** Seven tall glass cards: three playable missions (colour when unlocked, dark + lock when not) and four coming soon. */
export function MissionCollection({
  isUnlocked,
  selected,
  stars,
  onOpen,
  onViewAll,
}: {
  isUnlocked: (id: MissionId) => boolean
  selected: MissionId | null
  stars: Partial<Record<MissionId, Stars>>
  onOpen: (id: MissionId) => void
  onViewAll: () => void
}) {
  const available = COLLECTION.filter((c) => c.mission).length
  return (
    <section aria-label="Mission collection" className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-5 pr-7 pl-10">
        <h2 className="text-3xl font-normal text-text">Mission collection</h2>
        <span className="h-7 w-px bg-hairline" aria-hidden="true" />
        <span className="text-lg text-text-dim">
          <span className="num">{available}</span> of <span className="num">{COLLECTION.length}</span> available
        </span>
        <button
          type="button"
          onClick={onViewAll}
          className="group ml-auto flex items-center gap-2 rounded-control px-2 py-1 text-lg text-text transition-colors hover:text-mint focus-visible:ring-2 focus-visible:ring-mint/70"
        >
          View all <Icon name="arrowRight" size={22} className="transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
      <div className="mt-3.5 grid min-h-0 flex-1 grid-cols-7 gap-3.5 pr-7 pl-10">
        {COLLECTION.map((c) => (
          <Card
            key={c.id}
            entry={c}
            unlocked={c.mission ? isUnlocked(c.mission) : false}
            selected={c.mission != null && c.mission === selected}
            stars={c.mission ? (stars[c.mission] ?? 0) : 0}
            onOpen={() => c.mission && onOpen(c.mission)}
          />
        ))}
      </div>
    </section>
  )
}
