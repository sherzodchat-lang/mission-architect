import { create } from 'zustand'

const KEY = 'ma_settings'

interface Persisted {
  soundOn: boolean
  tutorialDone: boolean
  hintsDismissed: boolean
}

const DEFAULTS: Persisted = { soundOn: true, tutorialDone: false, hintsDismissed: false }

function load(): Persisted {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULTS
    const j = JSON.parse(raw) as Partial<Persisted>
    return {
      soundOn: typeof j.soundOn === 'boolean' ? j.soundOn : DEFAULTS.soundOn,
      tutorialDone: typeof j.tutorialDone === 'boolean' ? j.tutorialDone : DEFAULTS.tutorialDone,
      hintsDismissed: typeof j.hintsDismissed === 'boolean' ? j.hintsDismissed : DEFAULTS.hintsDismissed,
    }
  } catch {
    return DEFAULTS
  }
}

function save(s: Persisted) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* storage unavailable: game still works */
  }
}

interface SettingsState extends Persisted {
  setSoundOn: (on: boolean) => void
  toggleSound: () => void
  setTutorialDone: (done: boolean) => void
  setHintsDismissed: (dismissed: boolean) => void
}

export const useSettingsStore = create<SettingsState>((set, get) => {
  const commit = (patch: Partial<Persisted>) => {
    set(patch)
    const { soundOn, tutorialDone, hintsDismissed } = get()
    save({ soundOn, tutorialDone, hintsDismissed })
  }
  return {
    ...load(),
    setSoundOn: (soundOn) => commit({ soundOn }),
    toggleSound: () => commit({ soundOn: !get().soundOn }),
    setTutorialDone: (tutorialDone) => commit({ tutorialDone }),
    setHintsDismissed: (hintsDismissed) => commit({ hintsDismissed }),
  }
})
