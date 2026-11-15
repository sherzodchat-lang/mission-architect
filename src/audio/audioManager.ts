import { Howl, Howler } from 'howler'
import { loadPublicIndex } from '../lib/publicIndex'
import { useSettingsStore } from '../store/settingsStore'
import { useSubtitleStore } from './subtitleStore'
import {
  SFX,
  VOICE,
  ambientPath,
  audioUrl,
  sfxPath,
  voicePath,
  type AmbientId,
  type SfxId,
  type VoiceId,
} from './audioManifest'

/**
 * Audio engine (GAME_DESIGN 14.5): three channels - voice (queued, never overlapping, radio beep first,
 * ducks the ambient), sfx, ambient loop. Sound starts only after the first user gesture, honours the
 * `soundOn` setting, and a missing file is a silent no-op: files are checked against public/audio/index.json
 * (so they are never requested when absent) and any Howler load/play error is swallowed and remembered.
 */

const AMBIENT_VOL = 0.25
const AMBIENT_DUCKED = 0.1
/** per-sfx tuning: ui_click is by far the most frequent sound, so it is quiet and throttled */
const SFX_VOL: Partial<Record<SfxId, number>> = { ui_click: 0.7 }
const SFX_MIN_GAP_MS: Partial<Record<SfxId, number>> = { ui_click: 60 }
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

interface HowlOpts {
  volume?: number
  loop?: boolean
}

class AudioManager {
  private enabled = useSettingsStore.getState().soundOn
  private unlocked = false
  private wantAmbient = false
  private ducked = false
  private index: Promise<Set<string> | null> = loadPublicIndex('audio')
  /** path -> Howl, or null when known to be missing / failed */
  private howls = new Map<string, Promise<Howl | null>>()
  private queue: { id: VoiceId; text: string }[] = []
  private speaking = false
  private currentVoice: Howl | null = null
  private ambient: Howl | null = null
  private lastSfxAt = new Map<SfxId, number>()

  constructor() {
    if (typeof window === 'undefined') return
    const unlock = () => {
      if (this.unlocked) return
      this.unlocked = true
      for (const ev of ['pointerdown', 'keydown', 'touchstart'] as const) {
        window.removeEventListener(ev, unlock, true)
      }
      void this.preloadSfx()
      void this.syncAmbient()
    }
    for (const ev of ['pointerdown', 'keydown', 'touchstart'] as const) {
      window.addEventListener(ev, unlock, true)
    }
    useSettingsStore.subscribe((s) => this.apply(s.soundOn))
  }

  /* ---------------- public API ---------------- */

  /** True once the user has interacted with the page. */
  get isUnlocked() {
    return this.unlocked
  }

  setEnabled(on: boolean) {
    useSettingsStore.getState().setSoundOn(on)
    this.apply(on)
  }

  playSfx(id: SfxId) {
    if (!this.enabled || !this.unlocked) return
    const gap = SFX_MIN_GAP_MS[id]
    if (gap) {
      const now = performance.now()
      if (now - (this.lastSfxAt.get(id) ?? -Infinity) < gap) return
      this.lastSfxAt.set(id, now)
    }
    void this.getHowl(sfxPath(id), { volume: 0.8 }).then((h) => {
      if (!h || !this.enabled) return
      // the Howl is shared by every play of this sound: set the volume per call (ui_click is much quieter)
      const sid = h.play()
      h.volume(SFX_VOL[id] ?? 0.8, sid)
    })
  }

  /**
   * Mission Control line. The subtitle is ALWAYS pushed (even with sound off / file missing).
   * If sound is available the line is queued: radio beep, then the voice, ambient ducked meanwhile.
   */
  say(id: VoiceId, subtitleText?: string) {
    const text = subtitleText ?? VOICE[id].text
    if (!this.enabled || !this.unlocked) {
      useSubtitleStore.getState().push(text)
      return
    }
    this.queue.push({ id, text })
    if (this.queue.length > 4) this.queue.shift()
    void this.pump()
  }

  startAmbient() {
    this.wantAmbient = true
    void this.syncAmbient()
  }

  stopAmbient() {
    this.wantAmbient = false
    this.ambient?.stop()
  }

  /** Cut the current voice line and clear the queue (e.g. on screen change). */
  stopVoice() {
    this.queue = []
    this.currentVoice?.stop()
  }

  /* ---------------- internals ---------------- */

  private apply(on: boolean) {
    if (this.enabled === on) return
    this.enabled = on
    if (!on) {
      this.queue = []
      Howler.stop()
    } else {
      void this.syncAmbient()
    }
  }

  /** Resolves to a loaded Howl, or null when the file is missing / unplayable (cached). */
  private getHowl(path: string, opts: HowlOpts = {}): Promise<Howl | null> {
    let p = this.howls.get(path)
    if (!p) {
      p = this.index.then((idx) => {
        if (idx && !idx.has(path)) return null
        return new Promise<Howl | null>((resolve) => {
          try {
            const h = new Howl({
              src: [audioUrl(path)],
              volume: opts.volume ?? 1,
              loop: opts.loop ?? false,
              preload: true,
              onload: () => resolve(h),
              onloaderror: () => resolve(null),
              onplayerror: () => {
                /* swallow: autoplay policy etc. */
              },
            })
          } catch {
            resolve(null)
          }
        })
      })
      this.howls.set(path, p)
    }
    return p
  }

  private async preloadSfx() {
    for (const id of Object.keys(SFX) as SfxId[]) void this.getHowl(sfxPath(id), { volume: 0.8 })
  }

  private async syncAmbient() {
    if (!this.wantAmbient || !this.enabled || !this.unlocked) return
    const h = await this.getHowl(ambientPath('space_loop'), { loop: true, volume: AMBIENT_VOL })
    if (!h || !this.wantAmbient || !this.enabled) return
    this.ambient = h
    h.volume(this.ducked ? AMBIENT_DUCKED : AMBIENT_VOL)
    if (!h.playing()) h.play()
  }

  private duck(on: boolean) {
    this.ducked = on
    const a = this.ambient
    if (a && a.playing()) a.fade(a.volume(), on ? AMBIENT_DUCKED : AMBIENT_VOL, 300)
  }

  private playAndWait(h: Howl, capMs: number): Promise<void> {
    return new Promise((resolve) => {
      let done = false
      const fin = () => {
        if (done) return
        done = true
        clearTimeout(timer)
        h.off('end', fin)
        h.off('stop', fin)
        h.off('playerror', fin)
        resolve()
      }
      const timer = setTimeout(fin, capMs)
      h.once('end', fin)
      h.once('stop', fin)
      h.once('playerror', fin)
      h.play()
    })
  }

  private async pump() {
    if (this.speaking) return
    this.speaking = true
    const subs = useSubtitleStore.getState()
    try {
      while (this.queue.length) {
        const item = this.queue.shift()!
        if (!this.enabled) {
          subs.push(item.text)
          continue
        }
        const voice = await this.getHowl(voicePath(item.id))
        if (!voice) {
          // missing file: subtitle only, keep lines readable one after another
          subs.push(item.text)
          if (this.queue.length) await sleep(2200)
          continue
        }
        const beep = await this.getHowl(sfxPath('radio_beep'), { volume: 0.8 })
        if (beep && this.enabled) await this.playAndWait(beep, 1400)
        if (!this.enabled) {
          subs.push(item.text)
          continue
        }
        const ms = (voice.duration() || 3) * 1000
        subs.push(item.text, ms + 1500)
        this.duck(true)
        this.currentVoice = voice
        await this.playAndWait(voice, ms + 1500)
        this.currentVoice = null
        this.duck(false)
      }
    } finally {
      this.speaking = false
      this.currentVoice = null
      this.duck(false)
    }
  }
}

export const audio = new AudioManager()
export type { SfxId, VoiceId, AmbientId }
