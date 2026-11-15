import { Icon, Panel, cx } from '../../components'
import type { IconName } from '../../components'
import type { ChainNode, MissionReport } from '../../engine'
import { paperForCard } from '../../nasa/ntrs'

type Card = MissionReport['cards'][number]

const COLOR = {
  good: { text: 'text-green' },
  lesson: { text: 'text-amber' },
  loss: { text: 'text-red' },
} as const

const ICON_BY_ID: Record<string, IconName> = {
  antenna: 'antenna',
  power: 'bolt',
  battery: 'bolt',
  blurry: 'camera',
  overflow: 'database',
  overrun: 'calendar',
  unused: 'info',
  decay: 'orbit',
  lost: 'cross',
  link_ok: 'antenna',
  required_ok: 'flask',
  schedule_ok: 'calendar',
  health_ok: 'heart',
  balanced: 'check',
  improve_science: 'flask',
  improve_reliability: 'heart',
  improve_operations: 'antenna',
  improve_margin_mass: 'mass',
  improve_margin_power: 'bolt',
  improve_margin_budget: 'coins',
  improve_margin_time: 'calendar',
}

const CHAIN_ICON: IconName[] = ['layers', 'database', 'antenna', 'globe']

/** Sensor → Onboard storage → Antenna → Earth; the limiting node is amber and underlined. */
function DataChain({ nodes }: { nodes: ChainNode[] }) {
  const lost = nodes.some((n) => n.bottleneck)
  return (
    <section className="mx-[10px] shrink-0 border-t border-hairline px-3 pt-2.5 pb-3" aria-label="Where the data went">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-base font-medium text-text">Where the data went</h3>
        <span className={cx('text-sm', lost ? 'text-amber' : 'text-green')}>
          {lost ? 'Data was lost at the amber step' : 'Every gigabyte reached Earth'}
        </span>
      </div>
      <ol className="mt-2 flex items-start justify-between">
        {nodes.map((n, i) => (
          <li key={n.label} className="contents">
            <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5 text-center">
              <Icon name={CHAIN_ICON[i] ?? 'info'} size={22} className={n.bottleneck ? 'text-amber' : 'text-text'} />
              <span
                className={cx(
                  'text-sm text-text',
                  n.bottleneck && 'border-b-2 border-amber pb-0.5',
                )}
              >
                {n.label}
              </span>
              <span className={cx('text-sm tabular-nums', n.bottleneck ? 'text-amber' : 'text-text-dim')}>{n.value}</span>
            </div>
            {i < nodes.length - 1 && (
              <Icon
                name="arrowRight"
                size={20}
                className={cx('mt-1 shrink-0', n.bottleneck ? 'text-amber' : 'text-text-faint')}
              />
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}

function ReportCardView({ card }: { card: Card }) {
  const c = COLOR[card.color]
  const icon: IconName = card.color === 'good' ? 'shield' : (ICON_BY_ID[card.id] ?? 'warning')
  const paper = card.color !== 'good' || card.id.startsWith('decision_') ? paperForCard(card.id) : null
  return (
    <article className="flex items-start gap-4 py-3 first:pt-1">
      <span className={cx('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center', c.text)}>
        <Icon name={icon} size={28} />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-lg leading-tight font-medium text-text">{card.title}</h3>
        <p className="mt-0.5 text-sm leading-snug text-text-dim">{card.text}</p>
        {card.nextTime && (
          <p className="mt-1 text-sm leading-snug text-text-dim italic">
            {'Next time: '}
            {card.nextTime}
          </p>
        )}
        {paper && (
          <a
            href={paper.url}
            target="_blank"
            rel="noopener noreferrer"
            title={`${paper.title} (${paper.year ?? 'n.d.'}) · NASA Technical Reports Server`}
            className="mt-1 inline-flex items-center gap-1 text-sm text-text-dim transition hover:text-mint"
          >
            <Icon name="document" size={15} />
            Read the NASA paper
            <Icon name="arrowUpRight" size={15} />
          </a>
        )}
      </div>
    </article>
  )
}

/** "Decisions & outcomes": good = green, lesson = amber, loss = red; the data chain closes the panel. */
export function CardsPanel({ cards, chain }: { cards: Card[]; chain: ChainNode[] }) {
  return (
    <Panel title="Decisions & outcomes" divided className="h-full" bodyClassName="flex min-h-0 flex-col !p-0">
      <div
        className="min-h-0 flex-1 divide-y divide-hairline overflow-y-auto px-[22px] pt-3"
        style={{ maskImage: 'linear-gradient(to bottom, #000 calc(100% - 20px), transparent)' }}
      >
        {cards.map((c) => (
          <ReportCardView key={c.id} card={c} />
        ))}
      </div>
      <DataChain nodes={chain} />
    </Panel>
  )
}
