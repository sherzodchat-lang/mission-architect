// Real planet imagery for the 3D view (public-domain NASA / USGS data, see public/textures/planets/CREDITS.md).
// Progressive: a ~50–100 KB 1K colour map is awaited first (Suspense), the 4K colour map and the
// 2K data maps stream in afterwards and are swapped into the material uniforms as they arrive.
// Every file listed here ships in public/ — no probing, so no 404s. If even the 1K map fails
// (offline file:// build, blocked request …) the procedural textures (texgen.ts) are used instead.
// Decoding uses createImageBitmap (off the main thread) where available. Textures are ref-counted
// and disposed shortly after the last view using them unmounts (mission switch / screen change).
import * as THREE from 'three'
import type { BodyKind } from './model'
import { bodyPixels } from './textures'
import { publicUrl } from '../lib/publicUrl'

export interface PlanetFiles {
  low: string
  high: string
  /** RG = east/north slope (0.5 = flat), B = Earth ocean mask / Moon+Mars height */
  data: string
  clouds?: string
  lights?: string
}

const DIR = 'textures/planets/'
export const PLANET_FILES: Record<BodyKind, PlanetFiles> = {
  earth: {
    low: 'earth_day_1k.webp',
    high: 'earth_day_4k.webp',
    data: 'earth_data_2k.jpg',
    clouds: 'earth_clouds_2k.jpg',
    lights: 'earth_lights_4k.jpg',
  },
  moon: { low: 'moon_color_1k.webp', high: 'moon_color_4k.webp', data: 'moon_data_2k.jpg' },
  mars: { low: 'mars_color_1k.webp', high: 'mars_color_4k.webp', data: 'mars_data_2k.jpg' },
}

type Slot = 'color' | 'data' | 'clouds' | 'lights'

/** Live texture set for one body; `version` bumps whenever a slot is upgraded. */
export class PlanetSet {
  color: THREE.Texture
  data: THREE.Texture
  clouds: THREE.Texture
  lights: THREE.Texture
  procedural = false
  version = 0
  private listeners = new Set<() => void>()
  private refs = 0
  private disposeTimer: number | undefined
  private upgrading = false
  private owned: THREE.Texture[] = []
  readonly kind: BodyKind

  constructor(kind: BodyKind, color: THREE.Texture) {
    this.kind = kind
    this.color = color
    this.data = NEUTRAL.data
    this.clouds = NEUTRAL.black
    this.lights = NEUTRAL.black
    this.owned.push(color)
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  set(slot: Slot, t: THREE.Texture) {
    const prev = this[slot]
    this[slot] = t
    this.owned.push(t)
    if (prev && !isNeutral(prev)) {
      this.owned = this.owned.filter((x) => x !== prev)
      // let the GPU finish frames still using it
      window.setTimeout(() => prev.dispose(), 500)
    }
    this.version++
    this.listeners.forEach((l) => l())
  }

  acquire(gl: THREE.WebGLRenderer) {
    this.refs++
    window.clearTimeout(this.disposeTimer)
    if (!this.procedural && !this.upgrading) {
      this.upgrading = true
      void this.upgrade(gl)
    }
  }

  release() {
    this.refs = Math.max(0, this.refs - 1)
    if (this.refs > 0) return
    window.clearTimeout(this.disposeTimer)
    this.disposeTimer = window.setTimeout(() => {
      if (this.refs > 0) return
      this.owned.forEach((t) => t.dispose())
      this.owned = []
      sets.delete(this.kind)
      promises.delete(this.kind)
    }, 4000)
  }

  private async upgrade(gl: THREE.WebGLRenderer) {
    const f = PLANET_FILES[this.kind]
    const aniso = Math.min(8, gl.capabilities.getMaxAnisotropy())
    const jobs: [Slot, string, boolean][] = []
    if (f.clouds) jobs.push(['clouds', f.clouds, false])
    jobs.push(['data', f.data, false], ['color', f.high, true])
    if (f.lights) jobs.push(['lights', f.lights, false])
    // sequential: keeps decode + upload hitches apart (one texture per frame at most)
    for (const [slot, file, srgb] of jobs) {
      if (!sets.has(this.kind) || this.refs === 0) break
      try {
        const t = await loadTexture(file, srgb, aniso)
        if (!sets.has(this.kind)) {
          t.dispose()
          break
        }
        gl.initTexture(t)
        this.set(slot, t)
        await nextFrame()
      } catch {
        /* keep the lower-quality slot */
      }
    }
    this.upgrading = false
  }
}

const sets = new Map<BodyKind, PlanetSet>()
/** one stable promise per body (React `use` needs the same object across renders) */
const promises = new Map<BodyKind, Promise<PlanetSet>>()

const isNeutral = (t: THREE.Texture) => t === NEUTRAL.data || t === NEUTRAL.black

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()))

function pixel(r: number, g: number, b: number) {
  const t = new THREE.DataTexture(new Uint8Array([r, g, b, 255]), 1, 1)
  t.needsUpdate = true
  return t
}
const NEUTRAL = { data: pixel(128, 128, 0), black: pixel(0, 0, 0) }

function configure(t: THREE.Texture, srgb: boolean, aniso: number) {
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  t.wrapS = THREE.RepeatWrapping
  t.wrapT = THREE.ClampToEdgeWrapping
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.magFilter = THREE.LinearFilter
  t.generateMipmaps = true
  t.anisotropy = aniso
  t.needsUpdate = true
  return t
}

const bitmapOk = typeof createImageBitmap !== 'undefined'

function loadTexture(file: string, srgb: boolean, aniso: number): Promise<THREE.Texture> {
  const url = publicUrl(DIR + file)
  return new Promise((resolve, reject) => {
    if (bitmapOk) {
      const l = new THREE.ImageBitmapLoader()
      l.setOptions({ imageOrientation: 'flipY', premultiplyAlpha: 'none', colorSpaceConversion: 'none' })
      l.load(
        url,
        (bmp) => {
          const t = new THREE.Texture(bmp as unknown as HTMLImageElement)
          t.flipY = false
          resolve(configure(t, srgb, aniso))
        },
        undefined,
        reject,
      )
    } else {
      new THREE.TextureLoader().load(url, (t) => resolve(configure(t, srgb, aniso)), undefined, reject)
    }
  })
}

/** Procedural fallback, repacked into the same slot layout as the real data. */
async function proceduralSet(kind: BodyKind): Promise<PlanetSet> {
  const px = await bodyPixels(kind)
  const mk = (data: Uint8Array | Uint8ClampedArray, srgb: boolean) =>
    configure(new THREE.DataTexture(new Uint8Array(data.buffer.slice(0)), px.w, px.h, THREE.RGBAFormat), srgb, 4)
  const set = new PlanetSet(kind, mk(px.map, true))
  set.procedural = true
  const n = px.w * px.h
  if (kind === 'earth') {
    const data = new Uint8Array(n * 4)
    const lights = new Uint8Array(n * 4)
    for (let i = 0; i < n; i++) {
      data[i * 4] = 128
      data[i * 4 + 1] = 128
      data[i * 4 + 2] = px.aux[i * 4 + 1]
      data[i * 4 + 3] = 255
      lights[i * 4] = lights[i * 4 + 1] = lights[i * 4 + 2] = px.aux[i * 4]
      lights[i * 4 + 3] = 255
    }
    set.set('data', mk(data, false))
    set.set('lights', mk(lights, false))
    if (px.clouds) set.set('clouds', mk(px.clouds, false))
  }
  return set
}

/** Resolves once the low-res colour map (or the procedural fallback) is ready. Cached per body. */
export function planetSet(kind: BodyKind): Promise<PlanetSet> {
  let p = promises.get(kind)
  if (!p) {
    p = loadTexture(PLANET_FILES[kind].low, true, 4)
      .then((t) => new PlanetSet(kind, t))
      .catch(() => proceduralSet(kind))
      .then((s) => {
        sets.set(kind, s)
        return s
      })
    promises.set(kind, p)
  }
  return p
}
