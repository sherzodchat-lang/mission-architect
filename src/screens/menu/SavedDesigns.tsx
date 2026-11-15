import { MISSIONS } from '../../data'
import { Button, Icon, StarRating } from '../../components'
import { MAX_SAVES, isMissionUnlocked } from '../../store/persistence'
import { useGameStore } from '../../store/gameStore'

/** Up to five saved designs: load or delete. */
export function SavedDesigns({ onLoaded }: { onLoaded?: () => void }) {
  const saves = useGameStore((s) => s.saves)
  const progress = useGameStore((s) => s.progress)
  const unlockAll = useGameStore((s) => s.unlockAll)
  const load = useGameStore((s) => s.loadSavedDesign)
  const del = useGameStore((s) => s.deleteSavedDesign)

  return (
    <section aria-label="Saved designs">
      <div className="flex items-baseline gap-4">
        <h3 className="text-xl font-medium text-text">Saved designs</h3>
        <span className="num text-base text-text-dim">
          {saves.length} / {MAX_SAVES}
        </span>
      </div>
      {saves.length === 0 ? (
        <p className="glass-inset mt-4 px-4 py-4 text-base text-text-dim">
          Nothing saved yet. Press <span className="text-text">Save design</span> on a mission report to keep a design here.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {saves.map((s) => {
            const unlocked = isMissionUnlocked(s.missionId, progress, unlockAll)
            return (
              <li key={s.id} className="glass-inset flex items-center gap-3 py-2 pr-2 pl-4">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-base leading-tight text-text">{s.name}</div>
                  <div className="truncate text-sm text-text-dim">
                    {MISSIONS[s.missionId].name}
                    {s.score != null && (
                      <>
                        {' '}
                        - <span className="num">{s.score}</span> / 100
                      </>
                    )}
                  </div>
                </div>
                {s.stars != null && <StarRating value={s.stars} size={18} />}
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!unlocked}
                  title={unlocked ? undefined : 'Unlock this mission first'}
                  onClick={() => {
                    load(s.id)
                    onLoaded?.()
                  }}
                >
                  Load
                </Button>
                <button
                  type="button"
                  aria-label={`Delete ${s.name}`}
                  onClick={() => del(s.id)}
                  className="flex h-9 w-9 items-center justify-center rounded-[10px] text-text-dim transition-colors hover:bg-red/15 hover:text-red"
                >
                  <Icon name="cross" size={18} />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
