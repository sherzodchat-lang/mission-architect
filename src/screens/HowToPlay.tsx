import { useState, type ReactNode } from 'react'
import { ActionBar, Button, Icon, PageHeader, cx } from '../components'
import type { IconName } from '../components'
import { useGameStore } from '../store/gameStore'
import { useSettingsStore } from '../store/settingsStore'

interface Tile {
  icon: IconName
  title: string
  text: string
  tone?: string
}

function Tiles({ items, cols }: { items: Tile[]; cols: number }) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {items.map((t) => (
        <div key={t.title} className="glass-inset flex flex-col gap-4 p-7">
          <span className="flex h-12 w-12 items-center justify-center rounded-control bg-white/[0.06] text-mint">
            <Icon name={t.icon} size={24} />
          </span>
          <div>
            <h3 className="text-2xl leading-tight font-medium text-text">{t.title}</h3>
            <p className="mt-2 text-lg leading-snug text-text-dim">{t.text}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function Flow({ steps }: { steps: { icon: IconName; label: string }[] }) {
  return (
    <ol className="flex items-center gap-2">
      {steps.map((s, i) => (
        <li key={s.label} className="contents">
          <div className="glass-inset flex min-w-0 flex-1 flex-col items-center gap-3 px-2 py-12 text-center">
            <Icon name={s.icon} size={34} className="text-mint" />
            <span className="num text-sm text-text-dim">{String(i + 1).padStart(2, '0')}</span>
            <span className="text-base font-medium text-text">{s.label}</span>
          </div>
          {i < steps.length - 1 && <Icon name="arrowRight" size={22} className="shrink-0 text-text-faint" />}
        </li>
      ))}
    </ol>
  )
}

interface Slide {
  /** short name used for the slide tab */
  kicker: string
  title: string
  lead: string
  body: ReactNode
}

const SLIDES: Slide[] = [
  {
    kicker: 'The goal',
    title: 'Design a space mission, then see how it flies',
    lead: 'You are the mission architect. Choose a science goal, build the spacecraft, pick an orbit and a rocket, then watch it work for 12 months.',
    body: (
      <>
        <Flow
          steps={[
            { icon: 'flag', label: 'Pick a mission' },
            { icon: 'satellite', label: 'Build the craft' },
            { icon: 'orbit', label: 'Orbit and launch' },
            { icon: 'pulse', label: 'Fly 12 months' },
            { icon: 'flask', label: 'Read the report' },
          ]}
        />
        <p className="mt-6 text-lg text-text-dim">
          There is no single right answer. Different designs can all succeed, for different reasons.
        </p>
      </>
    ),
  },
  {
    kicker: 'Six resources',
    title: 'Every design is a balance of six resources',
    lead: 'The resource bars update live as you build. Keep each one inside its limit, with a little room to spare.',
    body: (
      <Tiles
        cols={3}
        items={[
          { icon: 'mass', title: 'Mass', text: 'Kilograms of spacecraft. The mission and the rocket both set a limit.' },
          { icon: 'bolt', title: 'Power', text: 'Watts used by every system, against what the solar panels make in sunlight.' },
          { icon: 'coins', title: 'Budget', text: 'Millions of dollars for parts, launch, ground stations and testing.' },
          { icon: 'database', title: 'Data', text: 'Onboard memory. It must hold data while the link to Earth is down.' },
          { icon: 'antenna', title: 'Comms', text: 'Gigabytes per month the instruments create, against what the radio can send home.' },
          { icon: 'calendar', title: 'Time', text: 'Months of development before launch. Late designs cost money and score.' },
        ]}
      />
    ),
  },
  {
    kicker: 'Trade-offs',
    title: 'Every decision costs something',
    lead: 'A better part usually pushes another resource toward its limit. Your job is to find a combination that works.',
    body: (
      <Tiles
        cols={2}
        items={[
          { icon: 'antenna', title: 'A bigger antenna', text: 'Sends more data home, but weighs more, draws more power and costs more.' },
          { icon: 'sun', title: 'More solar panels', text: 'Make more power, but add mass and money, and larger panels can fail to unfold.' },
          { icon: 'camera', title: 'More instruments', text: 'Collect more science, but need more power and a radio that can carry the data.' },
          { icon: 'flask', title: 'More testing', text: 'Cuts the chance of in-flight failures, but takes months and money.' },
        ]}
      />
    ),
  },
  {
    kicker: 'In flight',
    title: 'Flight events ask for your call',
    lead: 'During the 12 months, surprises happen: solar flares, software glitches, a ground station going offline. The simulation pauses until you decide.',
    body: (
      <div className="grid grid-cols-2 gap-3">
        <div className="glass-inset p-8">
          <div className="flex items-center gap-3 text-2xl font-medium text-text">
            <Icon name="shield" size={26} className="text-green" /> Play it safe
          </div>
          <p className="mt-3 text-lg leading-snug text-text-dim">
            Protect the spacecraft. You lose a little science this month, but nothing breaks.
          </p>
        </div>
        <div className="glass-inset p-8">
          <div className="flex items-center gap-3 text-2xl font-medium text-text">
            <Icon name="warning" size={26} className="text-amber" /> Take the risk
          </div>
          <p className="mt-3 text-lg leading-snug text-text-dim">
            Keep collecting data. You get full science, but there is a stated chance of damage.
          </p>
        </div>
        <p className="col-span-2 mt-2 text-lg text-text-dim">
          The chance is always shown before you choose, and it depends on how you designed the spacecraft.
        </p>
      </div>
    ),
  },
  {
    kicker: 'The report',
    title: 'Read the report, then try again',
    lead: 'You get a score out of 100 and a plain-language explanation of what worked and what did not.',
    body: (
      <Tiles
        cols={2}
        items={[
          { icon: 'flask', title: 'Score and stars', text: 'Science return, resource efficiency, reliability and operations. Two stars unlock the next mission.' },
          { icon: 'info', title: 'What happened and why', text: 'Green cards for good calls, amber for lessons, red for losses, each with a tip for next time.' },
          { icon: 'rocket', title: 'A real mission like yours', text: 'See the real spacecraft your design resembles and add it to your collection.' },
          { icon: 'reset', title: 'Redesign and relaunch', text: 'Change one thing, fly again and see how the result moves.' },
        ]}
      />
    ),
  },
]

export default function HowToPlay() {
  const goTo = useGameStore((s) => s.goTo)
  const unlockAll = useGameStore((s) => s.unlockAll)
  const setUnlockAll = useGameStore((s) => s.setUnlockAll)
  const setTutorialDone = useSettingsStore((s) => s.setTutorialDone)
  const [i, setI] = useState(0)
  const slide = SLIDES[i]
  const last = i === SLIDES.length - 1

  const leave = () => {
    setTutorialDone(true)
    goTo('menu')
  }
  const skip = () => {
    setTutorialDone(true)
    goTo('missions')
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        breadcrumb={['Overview', 'How to play']}
        title="How to play"
        subtitle="Five short slides. You can come back any time from the settings menu."
        step={[i + 1, SLIDES.length]}
        actions={
          <>
            {unlockAll && (
              <span className="glass-inset flex h-9 items-center gap-2 !rounded-full px-4 text-sm text-amber">
                <Icon name="info" size={16} />
                Demo mode: all missions unlocked
              </span>
            )}
            <Button variant="secondary" iconRight="arrowRight" onClick={skip}>
              Skip to game
            </Button>
          </>
        }
      />

      <div className="min-h-0 flex-1 px-4">
        <section key={i} className="glass animate-fade-in flex h-full min-h-0 flex-col px-10 pt-9 pb-6" aria-live="polite">
          <div className="grid min-h-0 flex-1 items-center gap-14" style={{ gridTemplateColumns: '440px minmax(0,1fr)' }}>
            <div>
              <h2 className="text-3xl leading-tight font-normal text-text">{slide.title}</h2>
              <p className="mt-4 text-lg leading-relaxed text-text-dim">{slide.lead}</p>
            </div>
            <div className="min-w-0">{slide.body}</div>
          </div>
          <div className="flex items-center justify-center gap-3 pt-4" role="tablist" aria-label="Slides">
            {SLIDES.map((s, n) => (
              <button
                key={s.kicker}
                type="button"
                role="tab"
                aria-selected={n === i}
                aria-label={`Slide ${n + 1}: ${s.kicker}`}
                onClick={() => setI(n)}
                className={cx(
                  'h-2.5 rounded-full transition-all duration-300',
                  n === i ? 'w-10 bg-mint' : 'w-2.5 bg-white/25 hover:bg-white/50',
                )}
              />
            ))}
          </div>
        </section>
      </div>

      <div className="shrink-0 px-4 pt-3 pb-3.5">
        <ActionBar
          onBack={leave}
          backLabel="Back to menu"
          center={
            <span className="text-sm text-text-dim select-none" onDoubleClick={() => setUnlockAll(true)}>
              Illustrative game values • not an engineering tool
            </span>
          }
          action={
            <>
              <Button variant="secondary" icon="arrowLeft" disabled={i === 0} onClick={() => setI(i - 1)}>
                Previous
              </Button>
              {last ? (
                <Button iconRight="check" onClick={leave}>
                  Got it
                </Button>
              ) : (
                <Button iconRight="arrowRight" onClick={() => setI(i + 1)}>
                  Next
                </Button>
              )}
            </>
          }
        />
      </div>
    </div>
  )
}
