import { useEffect, useMemo, useState } from 'react'
import { audio } from '../audio/audioManager'
import { Button, PageHeader, StatTile } from '../components'
import { MISSIONS, MISSION_ORDER } from '../data'
import { DISCLAIMER } from '../data/disclaimer'
import { evaluateDesign } from '../engine'
import { experimentsRun, loadDraft } from '../store/persistence'
import { useGameStore } from '../store/gameStore'
import { CollectionModal } from './menu/CollectionModal'
import { ContinueCard } from './menu/ContinueCard'
import { OverviewBackdrop } from './menu/HeroArt'
import { MissionCollection } from './menu/MissionCollection'

/** The welcome line plays once per browser session, on the first click anywhere on the menu. */
let welcomed = false

const pad2 = (n: number) => String(n).padStart(2, '0')

export default function MainMenu() {
  const goTo = useGameStore((s) => s.goTo)
  const continueDraft = useGameStore((s) => s.continueDraft)
  const selectMission = useGameStore((s) => s.selectMission)
  const progress = useGameStore((s) => s.progress)
  const unlockAll = useGameStore((s) => s.unlockAll)
  const isUnlocked = useGameStore((s) => s.isUnlocked)
  const [showAll, setShowAll] = useState(false)

  const draft = useMemo(() => loadDraft(), [])
  const draftMission = draft && MISSIONS[draft.missionId] ? MISSIONS[draft.missionId] : null
  const draftDesign = draftMission && draft ? draft.design : null
  const designReady = useMemo(
    () => (draftMission && draftDesign ? evaluateDesign(draftDesign, draftMission).designReady : false),
    [draftMission, draftDesign],
  )

  // The backdrop photo shows Earth, so only an Earth draft may relabel the orbit callout.
  const orbit = useMemo(() => {
    const o = draftMission?.id === 'earth' && draftDesign?.orbit ? draftMission.orbits.find((x) => x.id === draftDesign.orbit) : null
    if (!o) return { name: 'Low Earth orbit', altitude: '600 km' }
    const label = o.name.split(' · ')[0]
    return { name: label === o.short ? 'Low Earth orbit' : label, altitude: o.altitude }
  }, [draftMission, draftDesign])

  const unlockedCount = MISSION_ORDER.filter((id) => isUnlocked(id)).length
  // `unlockAll` and `progress` are read so the tiles refresh when they change
  void unlockAll
  const experiments = experimentsRun(progress)

  const newMission = () => goTo('missions')
  const open = (id: (typeof MISSION_ORDER)[number]) => {
    selectMission(id)
    goTo('missions')
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'n' || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      if (document.querySelector('[role="dialog"]')) return
      e.preventDefault()
      audio.playSfx('ui_click')
      goTo('missions')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goTo])

  return (
    <div
      className="relative flex h-full flex-col"
      style={{ containerType: 'size' }}
      onPointerDownCapture={() => {
        if (welcomed) return
        welcomed = true
        audio.say('v01_welcome')
      }}
    >
      <OverviewBackdrop orbit={orbit} />

      {/* Title and actions sit in the vertical middle of the open area above the cards. */}
      <div className="relative flex min-h-[300px] flex-1 flex-col justify-center">
        <div className="relative z-[1]">
          <div className="w-[700px] max-w-[52%]">
            <PageHeader
              size="hero"
              breadcrumb={['Workspace', 'Overview']}
              title="Design your next mission."
              subtitle="From scientific objective to an operational spacecraft."
              className="!pb-0 [&_h1]:leading-[1.02] [&_h1]:tracking-[-0.004em] [&_h1]:font-light [&_h1]:text-balance [&_p]:!text-xl"
            />
          </div>
          <div className="mt-7 flex items-center gap-5 pl-10">
            <Button size="lg" iconRight="arrowUpRight" onClick={newMission}>
              New mission
            </Button>
            <Button variant="link" size="lg" className="ml-2 text-base" onClick={() => goTo('howto')}>
              How it works
            </Button>
            <Button variant="link" size="lg" icon="globe" className="text-base" onClick={() => goTo('nasa')}>
              Built on NASA data
            </Button>
          </div>
        </div>
      </div>

      <div
        className="relative z-[1] grid shrink-0 gap-3.5 pt-4 pr-7 pl-10"
        style={{ gridTemplateColumns: 'minmax(0,3.7fr) repeat(3, minmax(0,1fr))' }}
      >
        <ContinueCard
          mission={draftMission}
          design={draftDesign}
          designReady={designReady}
          onResume={() => continueDraft()}
          onNew={newMission}
        />
        <StatTile variant="hero" value={pad2(unlockedCount)} label={<>missions<br />unlocked</>} className="h-full justify-between !py-4" />
        <StatTile variant="hero" value={pad2(draftMission ? 1 : 0)} label={<>active<br />design</>} className="h-full justify-between !py-4" />
        <StatTile variant="hero" value={pad2(experiments)} label={<>experiments<br />run</>} className="h-full justify-between !py-4" />
      </div>

      <div className="relative z-[1] shrink-0 pt-5 pb-11" style={{ height: 'clamp(340px, calc(27cqh + 120px), 460px)' }}>
        <MissionCollection
          isUnlocked={isUnlocked}
          selected={draftMission?.id ?? null}
          stars={progress.stars}
          onOpen={open}
          onViewAll={() => setShowAll(true)}
        />
      </div>

      <p className="pointer-events-none absolute bottom-[18px] left-10 z-[1] text-sm text-text-faint">{DISCLAIMER}</p>

      <div className="pointer-events-none absolute right-7 bottom-3.5 z-[1] flex items-center gap-3 text-base text-text-dim">
        <kbd className="num glass-inset flex h-8 w-8 items-center justify-center !rounded-[9px] text-sm text-text-dim">N</kbd>
        New mission
      </div>

      <CollectionModal open={showAll} onClose={() => setShowAll(false)} discovered={progress.analogs} />
    </div>
  )
}
