// Procedural planet textures, generated in code from value noise and the coarse outlines in
// model.ts — no downloaded or generated imagery. Pure functions: runs in a Web Worker
// (texture.worker.ts) or on the main thread as a fallback. Output rows are bottom-up
// (row 0 = south) so they upload directly as THREE.DataTexture.
import { LAND, MARS_BRIGHT, MARS_DARK, MOON_MARIA, WATER, craters, latLonToVec, rng, type BodyKind } from './model'

export const TEX_W = 1024
export const TEX_H = 512
const W = TEX_W
const H = TEX_H

export interface BodyPixels {
  w: number
  h: number
  /** albedo / day colour, RGBA sRGB */
  map: Uint8ClampedArray
  /** Earth: R = city lights, G = ocean mask (specular). Moon/Mars: grey height (bump map). */
  aux: Uint8ClampedArray
  /** Earth only: cloud coverage (grey) */
  clouds?: Uint8ClampedArray
}

/** Something with a 2D context (HTMLCanvasElement or OffscreenCanvas). */
export type CanvasFactory = (w: number, h: number) => {
  getContext(id: '2d'): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null
}

// ---------------------------------------------------------------- noise

function makeNoise(seed: number) {
  const r = rng(seed)
  const p = Array.from({ length: 256 }, (_, i) => i)
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[p[i], p[j]] = [p[j], p[i]]
  }
  const perm = new Uint8Array(512)
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255]
  const val = new Float32Array(256)
  for (let i = 0; i < 256; i++) val[i] = r()
  const noise = (x: number, y: number, z: number) => {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const zi = Math.floor(z)
    let xf = x - xi
    let yf = y - yi
    let zf = z - zi
    xf = xf * xf * (3 - 2 * xf)
    yf = yf * yf * (3 - 2 * yf)
    zf = zf * zf * (3 - 2 * zf)
    const X = xi & 255
    const Y = yi & 255
    const Z = zi & 255
    const A = perm[X] + Y
    const B = perm[X + 1] + Y
    const AA = perm[A] + Z
    const AB = perm[A + 1] + Z
    const BA = perm[B] + Z
    const BB = perm[B + 1] + Z
    const a0 = val[perm[AA]] + (val[perm[BA]] - val[perm[AA]]) * xf
    const a1 = val[perm[AB]] + (val[perm[BB]] - val[perm[AB]]) * xf
    const b0 = val[perm[AA + 1]] + (val[perm[BA + 1]] - val[perm[AA + 1]]) * xf
    const b1 = val[perm[AB + 1]] + (val[perm[BB + 1]] - val[perm[AB + 1]]) * xf
    const a = a0 + (a1 - a0) * yf
    const b = b0 + (b1 - b0) * yf
    return a + (b - a) * zf
  }
  const fbm = (x: number, y: number, z: number, oct: number) => {
    let a = 0.5
    let f = 1
    let s = 0
    let n = 0
    for (let i = 0; i < oct; i++) {
      s += a * noise(x * f + i * 17.3, y * f + i * 5.1, z * f + i * 9.7)
      n += a
      a *= 0.5
      f *= 2.03
    }
    return s / n
  }
  return { noise, fbm }
}

const sstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const mix = (a: number, b: number, t: number) => a + (b - a) * t

// ---------------------------------------------------------------- sphere sampling helpers

interface Dirs {
  cosP: Float32Array
  sinP: Float32Array
  cosT: Float32Array
  sinT: Float32Array
}

function dirs(w: number, h: number): Dirs {
  const cosP = new Float32Array(w)
  const sinP = new Float32Array(w)
  for (let x = 0; x < w; x++) {
    const phi = ((x + 0.5) / w) * Math.PI * 2
    cosP[x] = Math.cos(phi)
    sinP[x] = Math.sin(phi)
  }
  const cosT = new Float32Array(h)
  const sinT = new Float32Array(h)
  for (let y = 0; y < h; y++) {
    const th = ((y + 0.5) / h) * Math.PI
    cosT[y] = Math.cos(th)
    sinT[y] = Math.sin(th)
  }
  return { cosP, sinP, cosT, sinT }
}

/** Evaluates f on a coarse lat/lon grid (wrapping in x) for cheap low-frequency fields. */
function coarse(gw: number, gh: number, f: (dx: number, dy: number, dz: number) => number): Float32Array {
  const d = dirs(gw, gh)
  const out = new Float32Array(gw * gh)
  for (let y = 0; y < gh; y++)
    for (let x = 0; x < gw; x++) out[y * gw + x] = f(-d.cosP[x] * d.sinT[y], d.cosT[y], d.sinP[x] * d.sinT[y])
  return out
}

/** Bilinear sample of a w×h field at texel-space (u,v in 0..1, wraps in u). */
function sample(m: Float32Array, w: number, h: number, u: number, v: number): number {
  const x = ((((u * w - 0.5) % w) + w) % w)
  const y = Math.min(h - 1.001, Math.max(0, v * h - 0.5))
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const x1 = (x0 + 1) % w
  const tx = x - x0
  const ty = y - y0
  const a = m[y0 * w + x0] * (1 - tx) + m[y0 * w + x1] * tx
  const b = m[(y0 + 1) * w + x0] * (1 - tx) + m[(y0 + 1) * w + x1] * tx
  return a * (1 - ty) + b * ty
}

function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(w * h)
  const out = new Float32Array(w * h)
  const k = 1 / (2 * r + 1)
  for (let y = 0; y < h; y++) {
    let acc = 0
    for (let i = -r; i <= r; i++) acc += src[y * w + ((i + w) % w)]
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = acc * k
      acc += src[y * w + ((x + r + 1) % w)] - src[y * w + ((x - r + w) % w)]
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0
    for (let i = -r; i <= r; i++) acc += tmp[Math.min(h - 1, Math.max(0, i)) * w + x]
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc * k
      acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x]
    }
  }
  return out
}

/** Output index for texel (x, y-from-top), stored bottom-up. */
const outIdx = (x: number, y: number) => ((H - 1 - y) * W + x) * 4

function put(d: Uint8ClampedArray, o: number, r: number, g: number, b: number) {
  d[o] = r
  d[o + 1] = g
  d[o + 2] = b
  d[o + 3] = 255
}

// ---------------------------------------------------------------- Earth

function landMask(mk: CanvasFactory): Float32Array {
  const g = mk(W, H).getContext('2d')
  if (!g) throw new Error('2d context unavailable')
  g.fillStyle = '#000'
  g.fillRect(0, 0, W, H)
  const draw = (polys: [number, number][][], color: string) => {
    g.fillStyle = color
    for (const poly of polys) {
      g.beginPath()
      poly.forEach(([lon, lat], i) => {
        const x = ((lon + 180) / 360) * W
        const y = ((90 - lat) / 180) * H
        if (i === 0) g.moveTo(x, y)
        else g.lineTo(x, y)
      })
      g.closePath()
      g.fill()
    }
  }
  draw(LAND, '#fff')
  draw(WATER, '#000')
  const d = g.getImageData(0, 0, W, H).data
  const m = new Float32Array(W * H)
  for (let i = 0; i < W * H; i++) m[i] = d[i * 4] / 255
  return m
}

function earth(mk: CanvasFactory): BodyPixels {
  const { fbm, noise } = makeNoise(1)
  const raw = landMask(mk)
  const mask = boxBlur(boxBlur(raw, W, H, 2), W, H, 2)
  const coast = boxBlur(raw, W, H, 10)
  const { cosP, sinP, cosT, sinT } = dirs(W, H)

  // low-frequency fields on a coarse grid
  const GW = 256
  const GH = 128
  const warpX = coarse(GW, GH, (x, y, z) => fbm(x * 3 + 11, y * 3, z * 3, 3) - 0.5)
  const warpY = coarse(GW, GH, (x, y, z) => fbm(x * 3, y * 3 + 7, z * 3, 3) - 0.5)
  const cloudQx = coarse(GW, GH, (x, y, z) => fbm(x * 2 + 1.7, y * 2, z * 2, 3))
  const cloudQy = coarse(GW, GH, (x, y, z) => fbm(x * 2, y * 2 + 4.1, z * 2, 3))
  const region = coarse(GW, GH, (x, y, z) => fbm(x * 4 + 9, y * 4, z * 4, 3))
  const desertN = coarse(GW, GH, (x, y, z) => noise(x * 2.2 + 5, y * 2.2, z * 2.2))

  const map = new Uint8ClampedArray(W * H * 4)
  const aux = new Uint8ClampedArray(W * H * 4)
  const clouds = new Uint8ClampedArray(W * H * 4)

  for (let y = 0; y < H; y++) {
    const lat = 90 - ((y + 0.5) / H) * 180
    const alat = Math.abs(lat)
    const v = (y + 0.5) / H
    const band =
      0.06 * Math.exp(-(((lat - 6) / 8) ** 2)) - 0.08 * Math.exp(-(((alat - 24) / 9) ** 2)) + 0.08 * Math.exp(-(((alat - 56) / 12) ** 2))
    for (let x = 0; x < W; x++) {
      const dx = -cosP[x] * sinT[y]
      const dy = cosT[y]
      const dz = sinP[x] * sinT[y]
      const u = (x + 0.5) / W
      const lon = u * 360 - 180

      const wx = sample(warpX, GW, GH, u, v)
      const wy = sample(warpY, GW, GH, u, v)
      const n1 = fbm(dx * 6, dy * 6, dz * 6, 3)
      const mv = sample(mask, W, H, u + wx * 0.012, v + wy * 0.02) + (n1 - 0.5) * 0.32
      const land = sstep(0.45, 0.55, mv)

      const cv = sample(coast, W, H, u, v)
      const shallow = sstep(0.05, 0.45, cv)
      const on = n1 - 0.5
      let r = mix(6, 18, shallow) + on * 6
      let g = mix(30, 82, shallow) + on * 10
      let b = mix(78, 142, shallow) + on * 14

      if (land > 0) {
        const n2 = fbm(dx * 9 + 3, dy * 9, dz * 9, 4)
        const n3 = sample(desertN, GW, GH, u, v)
        let lr = mix(34, 92, n2)
        let lg = mix(80, 128, n2)
        let lb = mix(38, 58, n2)
        const desert =
          Math.exp(-(((alat - 22) / 11) ** 2)) *
          sstep(0.35, 0.62, n3 + (lon > -20 && lon < 75 && lat > 12 ? 0.25 : 0) + (lon > 115 && lon < 150 && lat < -18 ? 0.25 : 0))
        lr = mix(lr, mix(186, 224, n2), desert)
        lg = mix(lg, mix(150, 186, n2), desert)
        lb = mix(lb, mix(96, 128, n2), desert)
        const cold = sstep(52, 66, alat)
        lr = mix(lr, 104 + n2 * 30, cold * 0.7)
        lg = mix(lg, 104 + n2 * 26, cold * 0.7)
        lb = mix(lb, 82 + n2 * 20, cold * 0.7)
        const relief = (noise(dx * 22, dy * 22, dz * 22) - 0.5) * 30
        lr += relief
        lg += relief
        lb += relief
        const ice = Math.max(sstep(-62, -66, lat), lat > 59 && lon > -74 && lon < -12 ? sstep(0.45, 0.6, mv) : 0, sstep(76, 82, alat))
        lr = mix(lr, 236, ice)
        lg = mix(lg, 242, ice)
        lb = mix(lb, 248, ice)
        r = mix(r, lr, land)
        g = mix(g, lg, land)
        b = mix(b, lb, land)
      }
      const o = outIdx(x, y)
      put(map, o, r, g, b)

      let lights = 0
      if (land > 0.5 && alat < 64 && lat > -50) {
        const city = noise(dx * 140 + 0.37, dy * 140 + 0.71, dz * 140) * noise(dx * 47 + 0.13, dy * 47 + 0.29, dz * 47)
        const coastal = sstep(0.95, 0.55, cv)
        const dens = sample(region, GW, GH, u, v) + coastal * 0.18 - (lat < 60 && lat > 50 && lon > 60 ? 0.15 : 0)
        lights = sstep(0.55, 0.8, dens) * sstep(0.22, 0.6, city) * 0.8
      }
      put(aux, o, Math.min(255, lights * 300), (1 - land) * 255, 0)

      const qx = sample(cloudQx, GW, GH, u, v)
      const qy = sample(cloudQy, GW, GH, u, v)
      const c = fbm(dx * 3.2 + qx * 1.6, dy * 5.5 + qy * 1.6, dz * 3.2, 4)
      const cc = sstep(0.5, 0.74, c + band) * 0.95 * 255
      put(clouds, o, cc, cc, cc)
    }
  }
  return { w: W, h: H, map, aux, clouds }
}

// ---------------------------------------------------------------- Moon & Mars

interface Region {
  c: [number, number, number]
  r: number
  cosOuter: number
}
const regionsOf = (list: [number, number, number][], pad: number): Region[] =>
  list.map(([la, lo, r]) => ({ c: latLonToVec(la, lo), r, cosOuter: Math.cos(((r + pad) * Math.PI) / 180) }))

function addCraters(h: Float32Array, alb: Float32Array | null, list: [number, number, number][], depth: number) {
  for (const [lat, lon, rad] of list) {
    const c = latLonToVec(lat, lon)
    const cy = ((90 - lat) / 180) * H
    const ry = ((rad * 1.6) / 180) * H
    const cosLat = Math.max(0.08, Math.cos((lat * Math.PI) / 180))
    const rx = (((rad * 1.6) / 360) * W) / cosLat
    const cx = ((lon + 180) / 360) * W
    const y0 = Math.max(0, Math.floor(cy - ry))
    const y1 = Math.min(H - 1, Math.ceil(cy + ry))
    const radR = (rad * Math.PI) / 180
    const dep = depth * Math.sqrt(rad)
    const xr = Math.min(W / 2, Math.ceil(rx))
    for (let y = y0; y <= y1; y++) {
      const th = ((y + 0.5) / H) * Math.PI
      const st = Math.sin(th)
      const ct = Math.cos(th)
      for (let xx = Math.floor(cx - xr); xx <= Math.ceil(cx + xr); xx++) {
        const x = ((xx % W) + W) % W
        const phi = ((x + 0.5) / W) * Math.PI * 2
        const dd = -Math.cos(phi) * st * c[0] + ct * c[1] + Math.sin(phi) * st * c[2]
        const d = Math.acos(Math.min(1, dd)) / radR
        if (d > 1.6) continue
        const i = y * W + x
        if (d < 1) {
          h[i] -= (1 - d * d) * dep
          if (alb) alb[i] -= 0.03 * (1 - d)
        }
        h[i] += Math.exp(-(((d - 1) / 0.18) ** 2)) * dep * 0.45
        if (alb) alb[i] += Math.exp(-(((d - 1) / 0.2) ** 2)) * 0.04
      }
    }
  }
}

function rocky(kind: 'moon' | 'mars'): BodyPixels {
  const isMoon = kind === 'moon'
  const { fbm, noise } = makeNoise(isMoon ? 2 : 3)
  const { cosP, sinP, cosT, sinT } = dirs(W, H)
  const GW = 256
  const GH = 128
  const lowN = coarse(GW, GH, (x, y, z) => fbm(x * 4, y * 4, z * 4, 4))
  const edgeN = coarse(GW, GH, (x, y, z) => (fbm(x * 7 + 3, y * 7, z * 7, 3) - 0.5) * 8)
  const darkR = regionsOf(isMoon ? MOON_MARIA : MARS_DARK, 10)
  const brightR = regionsOf(MARS_BRIGHT, 10)
  const volcanoes = ([[18, -134, 5, 1.6], [12, -104, 3, 0.9], [2, -113, 3, 0.9], [-9, -121, 3, 0.9]] as const).map(([la, lo, r, hh]) => ({
    c: latLonToVec(la, lo),
    r,
    hh,
    cosOuter: Math.cos((r * 2.5 * Math.PI) / 180),
  }))
  const rays = isMoon
    ? ([[-43, -11, 40], [10, -20, 22]] as const).map(([la, lo, reach]) => ({ c: latLonToVec(la, lo), reach, cosOuter: Math.cos((reach * Math.PI) / 180) }))
    : []

  const alb = new Float32Array(W * H)
  const hgt = new Float32Array(W * H)
  const tint = new Float32Array(W * H)
  const D = 180 / Math.PI

  for (let y = 0; y < H; y++) {
    const lat = 90 - ((y + 0.5) / H) * 180
    const v = (y + 0.5) / H
    for (let x = 0; x < W; x++) {
      const i = y * W + x
      const dx = -cosP[x] * sinT[y]
      const dy = cosT[y]
      const dz = sinP[x] * sinT[y]
      const u = (x + 0.5) / W
      const n = sample(lowN, GW, GH, u, v) + (noise(dx * 64, dy * 64, dz * 64) - 0.5) * 0.06
      const fine = fbm(dx * 24, dy * 24, dz * 24, 2)
      const edge = sample(edgeN, GW, GH, u, v)
      let dark = 0
      for (const R of darkR) {
        const dd = dx * R.c[0] + dy * R.c[1] + dz * R.c[2]
        if (dd < R.cosOuter) continue
        const d = Math.acos(Math.min(1, dd)) * D
        dark = Math.max(dark, sstep(R.r + 2, R.r - 3, d + edge))
      }
      dark = Math.max(dark, isMoon ? sstep(0.62, 0.72, n) * 0.6 : sstep(0.6, 0.7, n) * 0.5)
      if (isMoon) {
        let a = 0.66 + (n - 0.5) * 0.18 + (fine - 0.5) * 0.08 - dark * 0.3
        for (const R of rays) {
          const dd = dx * R.c[0] + dy * R.c[1] + dz * R.c[2]
          if (dd < R.cosOuter) continue
          const d = Math.acos(Math.min(1, dd)) * D
          a += Math.max(0, fbm(dx * 40, dy * 40, dz * 40, 2) - 0.55) * 0.9 * (1 - d / R.reach)
        }
        alb[i] = a
        hgt[i] = (n - 0.5) * 0.6 + (fine - 0.5) * 0.25 - dark * 0.15
      } else {
        let bright = 0
        for (const R of brightR) {
          const dd = dx * R.c[0] + dy * R.c[1] + dz * R.c[2]
          if (dd < R.cosOuter) continue
          const d = Math.acos(Math.min(1, dd)) * D
          bright = Math.max(bright, sstep(R.r + 3, R.r - 3, d + edge))
        }
        const lonDeg = u * 360 - 180
        const valles = lonDeg > -112 && lonDeg < -42 ? sstep(2.2, 0.4, Math.abs(lat + 8 + Math.sin(lonDeg * 0.08) * 2 + edge * 0.15)) : 0
        const cap = Math.max(sstep(78, 83, lat + edge * 0.7), sstep(-81, -85, lat - edge * 0.5))
        tint[i] = dark * 0.85 + valles * 0.6 - bright * 0.6
        alb[i] = cap
        let hh = (n - 0.5) * 0.7 + (fine - 0.5) * 0.3 - valles * 0.8 - dark * 0.1
        for (const V of volcanoes) {
          const dd = dx * V.c[0] + dy * V.c[1] + dz * V.c[2]
          if (dd < V.cosOuter) continue
          const d = Math.acos(Math.min(1, dd)) * D
          hh += Math.exp(-((d / V.r) ** 2)) * V.hh
        }
        hgt[i] = hh
      }
    }
  }

  const list = craters(isMoon ? 41 : 42, isMoon ? 1400 : 380, 5)
  if (isMoon) list.push([-43, -11, 2.6], [10, -20, 2.8], [-9, -1, 1.5], [26, -44, 2])
  addCraters(hgt, isMoon ? alb : null, list, isMoon ? 0.32 : 0.3)

  const map = new Uint8ClampedArray(W * H * 4)
  const aux = new Uint8ClampedArray(W * H * 4)
  let hmin = Infinity
  let hmax = -Infinity
  for (let i = 0; i < W * H; i++) {
    if (hgt[i] < hmin) hmin = hgt[i]
    if (hgt[i] > hmax) hmax = hgt[i]
  }
  const span = hmax - hmin || 1
  const GW2 = 128
  const GH2 = 64
  const mottle = coarse(GW2, GH2, (x, y, z) => fbm(x * 5 + 2, y * 5, z * 5, 3))
  for (let y = 0; y < H; y++) {
    const v = (y + 0.5) / H
    for (let x = 0; x < W; x++) {
      const i = y * W + x
      const o = outIdx(x, y)
      if (isMoon) {
        const a = Math.min(1, Math.max(0, alb[i]))
        put(map, o, a * 236, a * 230, a * 220)
      } else {
        const m = sample(mottle, GW2, GH2, (x + 0.5) / W, v)
        const t = tint[i]
        let r = mix(186, 214, m)
        let g = mix(84, 112, m)
        let b = mix(50, 70, m)
        if (t > 0) {
          r = mix(r, 104, t)
          g = mix(g, 46, t)
          b = mix(b, 32, t)
        } else if (t < 0) {
          r = mix(r, 232, -t)
          g = mix(g, 160, -t)
          b = mix(b, 112, -t)
        }
        const ice = alb[i]
        put(map, o, mix(r, 246, ice), mix(g, 240, ice), mix(b, 234, ice))
      }
      const hv = ((hgt[i] - hmin) / span) * 255
      put(aux, o, hv, hv, hv)
    }
  }
  return { w: W, h: H, map, aux }
}

export function generateBody(kind: BodyKind, mk: CanvasFactory): BodyPixels {
  return kind === 'earth' ? earth(mk) : rocky(kind)
}
