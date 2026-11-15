// Procedural night sky: a star catalogue (magnitude + colour-temperature distribution, denser along
// the galactic plane) and a faint equirectangular Milky Way band. Deterministic, generated once.
import { norm, rng, type Vec3 } from './model'

/** Galactic north pole in view space-ish world coords: the band crosses the default view diagonally. */
export const GALACTIC_POLE: Vec3 = norm([0.42, 0.78, -0.46])

export interface StarData {
  positions: Float32Array
  colors: Float32Array
  sizes: Float32Array
}

// rough blackbody tints, O/B → M
const TINTS: [number, [number, number, number]][] = [
  [0.08, [0.66, 0.76, 1.0]],
  [0.22, [0.82, 0.88, 1.0]],
  [0.38, [1.0, 1.0, 1.0]],
  [0.2, [1.0, 0.94, 0.82]],
  [0.08, [1.0, 0.82, 0.62]],
  [0.04, [1.0, 0.7, 0.5]],
]

function basis(pole: Vec3) {
  const a: Vec3 = Math.abs(pole[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]
  const u = norm([a[1] * pole[2] - a[2] * pole[1], a[2] * pole[0] - a[0] * pole[2], a[0] * pole[1] - a[1] * pole[0]])
  const v: Vec3 = [pole[1] * u[2] - pole[2] * u[1], pole[2] * u[0] - pole[0] * u[2], pole[0] * u[1] - pole[1] * u[0]]
  return { u, v }
}

export function makeStars(count: number, radius: number): StarData {
  const r = rng(7)
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const { u, v } = basis(GALACTIC_POLE)
  const P = GALACTIC_POLE
  for (let i = 0; i < count; i++) {
    let d: Vec3
    if (r() < 0.38) {
      // galactic disc population: gaussian latitude
      const lon = r() * Math.PI * 2
      const g = (r() + r() + r() - 1.5) * 0.22
      const c = Math.cos(g)
      d = norm([
        (u[0] * Math.cos(lon) + v[0] * Math.sin(lon)) * c + P[0] * Math.sin(g),
        (u[1] * Math.cos(lon) + v[1] * Math.sin(lon)) * c + P[1] * Math.sin(g),
        (u[2] * Math.cos(lon) + v[2] * Math.sin(lon)) * c + P[2] * Math.sin(g),
      ])
    } else {
      const z = r() * 2 - 1
      const t = r() * Math.PI * 2
      const s = Math.sqrt(1 - z * z)
      d = [s * Math.cos(t), z, s * Math.sin(t)]
    }
    positions.set([d[0] * radius, d[1] * radius, d[2] * radius], i * 3)
    // brightness: many faint, few bright (power law)
    const m = Math.pow(r(), 9)
    const b = 0.18 + 2.4 * m + 0.25 * r()
    let pick = r()
    let tint = TINTS[2][1]
    for (const [w, c] of TINTS) {
      if ((pick -= w) <= 0) {
        tint = c
        break
      }
    }
    colors.set([tint[0] * b, tint[1] * b, tint[2] * b], i * 3)
    sizes[i] = 1.6 + 3.2 * Math.pow(m, 0.6) + r() * 0.5
  }
  return { positions, colors, sizes }
}

/** Equirectangular Milky Way (RGBA, rows bottom-up for DataTexture). */
export function makeMilkyWay(w = 512, h = 256): Uint8Array {
  const out = new Uint8Array(w * h * 4)
  const r = rng(11)
  // value noise on a 3-D lattice
  const N = 64
  const lat = new Float32Array(N * N * N)
  for (let i = 0; i < lat.length; i++) lat[i] = r()
  const at = (x: number, y: number, z: number) => lat[((x & 63) * N + (y & 63)) * N + (z & 63)]
  const sm = (t: number) => t * t * (3 - 2 * t)
  const noise = (x: number, y: number, z: number) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z)
    const xf = sm(x - xi), yf = sm(y - yi), zf = sm(z - zi)
    const l = (a: number, b: number, t: number) => a + (b - a) * t
    return l(
      l(l(at(xi, yi, zi), at(xi + 1, yi, zi), xf), l(at(xi, yi + 1, zi), at(xi + 1, yi + 1, zi), xf), yf),
      l(l(at(xi, yi, zi + 1), at(xi + 1, yi, zi + 1), xf), l(at(xi, yi + 1, zi + 1), at(xi + 1, yi + 1, zi + 1), xf), yf),
      zf,
    )
  }
  const fbm = (x: number, y: number, z: number) => {
    let s = 0, a = 0.5, f = 1
    for (let o = 0; o < 5; o++) {
      s += a * noise(x * f, y * f, z * f)
      f *= 2.03
      a *= 0.5
    }
    return s
  }
  const P = GALACTIC_POLE
  const { u, v } = basis(P)
  for (let j = 0; j < h; j++) {
    // three.js sphere uv: v = 1 at the north (+y)
    const theta = (1 - (j + 0.5) / h) * Math.PI
    for (let i = 0; i < w; i++) {
      const phi = ((i + 0.5) / w) * Math.PI * 2
      // same mapping as SphereGeometry
      const d: Vec3 = [-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta)]
      const gl = d[0] * P[0] + d[1] * P[1] + d[2] * P[2]
      const glon = Math.atan2(d[0] * v[0] + d[1] * v[1] + d[2] * v[2], d[0] * u[0] + d[1] * u[1] + d[2] * u[2])
      // brighter toward the galactic centre (glon ≈ 0)
      const core = 0.45 + 0.55 * Math.exp(-glon * glon * 0.9)
      const band = Math.exp(-(gl * gl) / (0.03 + 0.05 * core))
      const n = fbm(d[0] * 3 + 10, d[1] * 3 + 10, d[2] * 3 + 10)
      const dust = Math.max(0, 1 - Math.exp(-(gl * gl) / 0.0035) * smoothDust(fbm(d[0] * 6 + 3, d[1] * 6 + 3, d[2] * 6 + 3)))
      let k = band * core * (0.35 + 1.1 * n * n) * dust
      k += Math.pow(n, 4) * 0.12
      const o = (j * w + i) * 4
      out[o] = Math.min(255, k * 150)
      out[o + 1] = Math.min(255, k * 140)
      out[o + 2] = Math.min(255, k * 158)
      out[o + 3] = 255
    }
  }
  return out
}

function smoothDust(n: number) {
  const t = Math.min(1, Math.max(0, (n - 0.45) / 0.2))
  return t * t * (3 - 2 * t) * 0.85
}
