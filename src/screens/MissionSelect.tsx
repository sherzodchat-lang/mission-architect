import { audio } from '../audio/audioManager'
import { ActionBar, Button, Icon, ImageSlot, PageHeader, SelectCard, StarRating, cx } from '../components'
import { MISSIONS, MISSION_ORDER } from '../data'
import type { Mission, MissionId } from '../data'
import { devEndDate, fmtDate, moonDistanceKm, moonLightTimeSec, nextMarsWindow } from '../data/nasa/horizons'
import { LOCKED_TEXT, isMissionUnlocked } from '../store/persistence'
import { useGameStore } from '../store/gameStore'

const DIFFICULTY_DOT: Record<Mission['difficulty'], string> = {
  Easy: 'bg-green',
  Medium: 'bg-amber',
  Hard: 'bg-red',
}

function limitRows(m: Mission): { label: string; value: string }[] {
  return [
    { label: 'Budget', value: `$${m.limits.budgetM} M` },
    { label: 'Mass limit', value: `${m.limits.massKg} kg` },
    { label: 'Development', value: `${m.limits.devMonths} months` },
    { label: 'Science data', value: m.limits.requiredLabel },
  ]
}

/** One line of real ephemeris data per deep-space mission (NASA/JPL Horizons snapshot, see src/data/nasa/horizons.ts). */
function horizonsLine(m: Mission): { label: string; value: string; tip: string } | null {
  const launch = devEndDate(m.limits.devMonths)
  if (m.id === 'mars') {
    const w = nextMarsWindow(launch)
    if (!w) return null
    return {
      label: 'Next launch window',
      value: fmtDate(w.optimal),
      tip: `Real Earth–Mars geometry: window ${fmtDate(w.open)} – ${fmtDate(w.close)}, about ${Math.round(w.tofDays)} days to Mars.`,
    }
  }
  if (m.id === 'lunar') {
    const km = Math.round(moonDistanceKm(launch) / 1000) * 1000
    return {
      label: 'Moon at launch',
      value: `${km.toLocaleString('en-US')} km · ${moonLightTimeSec(launch).toFixed(1)} s`,
      tip: `Real Earth–Moon distance and one-way signal time on ${fmtDate(launch)}, the end of a 24-month build.`,
    }
  }
  return null
}

const HORIZONS: Partial<Record<MissionId, ReturnType<typeof horizonsLine>>> = {}

export default function MissionSelect() {
  const goTo = useGameStore((s) => s.goTo)
  const selected = useGameStore((s) => s.missionId)
  const selectMission = useGameStore((s) => s.selectMission)
  const startDesign = useGameStore((s) => s.startDesign)
  const progress = useGameStore((s) => s.progress)
  const unlockAll = useGameStore((s) => s.unlockAll)

  const start = () => {
    startDesign()
    audio.say('v02_mission_selected')
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        breadcrumb={['Workspace', 'New mission']}
        title="Choose your mission"
        subtitle="Select a science goal. Work within the limits. Make every system count."
        step={[1, 5]}
      />

      <div className="grid min-h-0 flex-1 gap-[13px] px-4" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        {MISSION_ORDER.map((id) => {
          const m = MISSIONS[id]
          const unlocked = isMissionUnlocked(id, progress, unlockAll)
          const isSelected = selected === id && unlocked
          const stars = progress.stars[id] ?? 0
          const best = progress.bestScore[id]
          const real = (HORIZONS[id] ??= horizonsLine(m))
          return (
            <SelectCard
              key={id}
              selected={isSelected}
              disabled={!unlocked}
              disabledReason={LOCKED_TEXT}
              onSelect={() => selectMission(id)}
              aria-label={m.name}
              className="flex h-full min-h-0 flex-col overflow-hidden"
            >
              {/* cover: the picture fades into the glass so the title can sit on it */}
              <div className="relative h-[216px] shrink-0">
                <div
                  className="absolute inset-0"
                  style={{
                    maskImage: 'linear-gradient(to bottom, #000 70%, transparent 100%)',
                    WebkitMaskImage: 'linear-gradient(to bottom, #000 70%, transparent 100%)',
                  }}
                >
                  <ImageSlot
                    id={unlocked ? `mission_${id}` : `mission_${id}_locked`}
                    className="h-full rounded-none border-0 shadow-none"
                    position="50% 4%"
                    aiMark="tl"
                  />
                </div>
                {!unlocked && (
                  <div className="glass-strong absolute top-1/2 left-1/2 flex w-[320px] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 px-5 py-4 text-center">
                    <Icon name="lock" size={28} className="text-text-dim" />
                    <span className="text-base leading-snug text-text">{LOCKED_TEXT}</span>
                  </div>
                )}
                <span className="glass-inset absolute bottom-3 left-6 flex items-center gap-2 !rounded-full bg-bg/60 px-3.5 py-1 text-sm text-text">
                  <span className={cx('h-2 w-2 rounded-full', DIFFICULTY_DOT[m.difficulty])} aria-hidden="true" />
                  <span className="num">{String(MISSION_ORDER.indexOf(id) + 1).padStart(2, '0')}</span>
                  <span aria-hidden="true">·</span>
                  {m.difficulty}
                </span>
              </div>

              <div className="flex min-h-0 flex-1 flex-col px-6 pt-1 pb-5">
                <h2 className="text-3xl leading-tight font-normal text-text">{m.name}</h2>
                <p className="mt-1.5 text-base leading-snug text-text-dim">
                  <span className="text-text">Science goal. </span>
                  {m.objective}
                </p>

                <dl className="mt-2.5 divide-y divide-hairline border-y border-hairline">
                  {limitRows(m).map((r) => (
                    <div key={r.label} className="flex items-center justify-between py-1.5 text-base">
                      <dt className="text-text-dim">{r.label}</dt>
                      <dd className="num text-text">{r.value}</dd>
                    </div>
                  ))}
                </dl>

                {real && (
                  <p className="mt-2 flex items-center gap-2 text-sm text-text-dim" title={real.tip}>
                    <Icon name={id === 'mars' ? 'calendar' : 'globe'} size={16} className="shrink-0 text-text-faint" />
                    <span className="min-w-0 truncate">
                      {real.label}: <span className="num text-text">{real.value}</span>
                      <span className="text-text-faint"> · JPL Horizons</span>
                    </span>
                  </p>
                )}

                <p className="mt-3 flex gap-2.5 text-sm leading-snug text-text-dim">
                  <Icon name="warning" size={18} className="mt-0.5 shrink-0 text-amber" />
                  <span>
                    <span className="text-text">Challenge. </span>
                    {m.rules[0]}
                  </span>
                </p>

                <div className="mt-auto flex items-center justify-between gap-3 pt-3">
                  <span className="flex items-center gap-2.5 text-base text-text">
                    <span
                      className={cx(
                        'flex h-[22px] w-[22px] items-center justify-center rounded-full border',
                        isSelected ? 'border-mint' : 'border-white/30',
                      )}
                      aria-hidden="true"
                    >
                      {isSelected && <span className="h-2.5 w-2.5 rounded-full bg-mint" />}
                    </span>
                    {isSelected ? 'Selected mission' : unlocked ? 'Select mission' : 'Locked'}
                  </span>
                  <span className="flex items-center gap-3 text-sm text-text-dim">
                    {best != null && <span className="num">Best {best} / 100</span>}
                    <StarRating value={stars} size={22} />
                  </span>
                </div>
              </div>
            </SelectCard>
          )
        })}
      </div>

      <div className="shrink-0 px-4 pt-3 pb-3.5">
        <ActionBar
          onBack={() => goTo('menu')}
          backLabel="Overview"
          center={
            <span className="flex min-w-0 items-center gap-4 text-lg">
              <span className="font-medium whitespace-nowrap text-text">Selected: {MISSIONS[selected].name}</span>
              <span className="truncate text-base text-text-dim">Each scenario rewards different engineering decisions.</span>
            </span>
          }
          action={
            <Button size="lg" iconRight="arrowRight" onClick={start}>
              Start design
            </Button>
          }
        />
      </div>
    </div>
  )
}
