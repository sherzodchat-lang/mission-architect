// Shared scene model for the celestial views (SVG and 3D). Pure math, no three.js import —
// this file is part of the main bundle. Units: body radius = 1. World axes follow three.js
// (y = north / up, z = toward the default camera).

export type Vec3 = [number, number, number]

const D2R = Math.PI / 180

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s]
export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const len = (a: Vec3) => Math.hypot(a[0], a[1], a[2])
export const norm = (a: Vec3): Vec3 => {
  const l = len(a) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
export const smooth = (t: number) => t * t * (3 - 2 * t)

/** Direction toward the Sun (day on the left, terminator on the right, as in mockup 04). */
export const SUN_DIR: Vec3 = norm([-1, 0.3, 0.55])
/** Default camera direction (from the body toward the viewer). */
export const CAM_DIR: Vec3 = norm([0.32, 0.3, 1])

// ---------------------------------------------------------------- bodies

export type BodyKind = 'earth' | 'moon' | 'mars'

export interface BodyStyle {
  kind: BodyKind
  name: string
  /** SVG gradient stops: light → base → dark */
  light: string
  base: string
  dark: string
  /** atmosphere / glow colour (null = airless) */
  atmo: string | null
  atmoStrength: number
}

export const BODY_STYLES: Record<BodyKind, BodyStyle> = {
  earth: { kind: 'earth', name: 'Earth', light: '#5fb4ff', base: '#1f63c4', dark: '#0a2456', atmo: '#4fb8ff', atmoStrength: 1 },
  moon: { kind: 'moon', name: 'Moon', light: '#e4e0d8', base: '#a9a49b', dark: '#4d4a46', atmo: null, atmoStrength: 0 },
  mars: { kind: 'mars', name: 'Mars', light: '#f0a070', base: '#c0573a', dark: '#5a2216', atmo: '#ff9a66', atmoStrength: 0.45 },
}

export function bodyKindOf(missionId: string): BodyKind {
  if (missionId === 'lunar' || missionId === 'moon') return 'moon'
  if (missionId === 'mars') return 'mars'
  return 'earth'
}

/** Earth-based ground stations serve every mission; on Lunar/Mars they sit on a distant Earth. */
export const remoteEarth = (kind: BodyKind) => kind !== 'earth'

// ---------------------------------------------------------------- geography

/** lat/lon (deg) → unit vector, consistent with three.js SphereGeometry UVs (u = (lon+180)/360). */
export function latLonToVec(latDeg: number, lonDeg: number, r = 1): Vec3 {
  const phi = (lonDeg + 180) * D2R
  const theta = (90 - latDeg) * D2R
  return [-Math.cos(phi) * Math.sin(theta) * r, Math.cos(theta) * r, Math.sin(phi) * Math.sin(theta) * r]
}

/** Rotate a vector around the y (polar) axis. */
export function rotY(v: Vec3, a: number): Vec3 {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c]
}

/** Real station coordinates [lat, lon]. */
export const STATION_GEO: Record<string, [number, number]> = {
  wal: [37.94, -75.47],
  san: [-33.15, -70.67],
  fai: [64.86, -147.5],
  sva: [78.23, 15.4],
  gold: [35.43, -116.89],
  madrid: [40.43, -4.25],
  canb: [-35.4, 148.98],
  com: [19.0, -155.66],
}

export function stationLatLon(id: string): [number, number] {
  return STATION_GEO[id] ?? [0, 0]
}

// Coarse continent outlines [lon, lat] — drawn by code (no downloaded imagery). Edges are
// roughened with noise in the 3D texture generator.
type Poly = [number, number][]
export const LAND: Poly[] = [
  // North America
  [[-168,66],[-162,70],[-156,71.3],[-140,69.6],[-128,70],[-115,68],[-95,68],[-85,70],[-82,68],[-80,64],[-75,62],[-68,60],[-62,58],[-56,52],[-60,47],[-66,45],[-70,42],[-74,40.5],[-76,37],[-75.5,35],[-81,31],[-80,26],[-81.5,25.5],[-82.5,28],[-84,30],[-89,30],[-94,29.5],[-97,27.5],[-97.5,22],[-95,18.5],[-91,18.5],[-90.5,21],[-87,21.5],[-88,16],[-83.5,15],[-83.5,11],[-79.5,9],[-77.5,8],[-80,7.5],[-83,8.5],[-86,11],[-88,13],[-92,14.5],[-96,15.7],[-100,17],[-105,19.5],[-106,23],[-109.5,26],[-112.5,29.5],[-114.7,31.5],[-112,27],[-110,23],[-112,25],[-114.5,28],[-117,32.5],[-120.5,34.5],[-124,40],[-124.5,46],[-123,49],[-128,51],[-133,55],[-138,59],[-146,61],[-152,59],[-158,56],[-164,54.5],[-158,58.5],[-162,60],[-165,62.5],[-166,64.5]],
  // Greenland
  [[-73,78],[-60,82],[-30,83.5],[-20,81],[-18,76],[-22,70],[-32,68],[-40,65],[-43,60],[-48,61],[-52,65],[-54,69],[-57,74],[-66,76]],
  // Canadian Arctic islands
  [[-120,77],[-95,81],[-62,82.5],[-75,78],[-80,74],[-71,70.5],[-62,66.5],[-66,62],[-73,65.5],[-80,69],[-90,72],[-100,73],[-120,72]],
  // South America
  [[-80,9],[-77,8],[-72,12],[-63,10.7],[-60,8],[-52,5],[-50,1],[-44,-2.5],[-35,-5],[-35,-9],[-39,-14],[-39,-18],[-42,-22.5],[-48,-26],[-48.5,-28.5],[-53,-34],[-57,-35],[-56.7,-36.5],[-58,-38.5],[-62,-39],[-65,-41],[-64,-43],[-67.5,-46.5],[-66,-48],[-69,-51],[-68.5,-53],[-65,-55],[-72,-54],[-75,-50],[-74,-44],[-73.5,-37],[-71.5,-30],[-70.3,-18],[-75,-15],[-77,-12],[-79,-8],[-81,-5],[-80,-2],[-80,1],[-78.5,2.5],[-77.5,4],[-77.4,7]],
  // Eurasia
  [[-9.5,43],[-9,38.7],[-6,36.2],[-2,36.7],[0,38.7],[3,42.5],[4,43.4],[8,44],[10,44],[12.5,41.5],[16,38],[15.7,40],[18.5,40.2],[13,45.5],[19,42],[22,37],[24,38],[26.5,40.5],[29,41],[27.5,37],[30,36.3],[36,36.5],[35,33],[34.5,31],[32.5,30],[34.5,28],[38,22],[43,13],[45,12.8],[52,15.5],[57,18.5],[59.8,22.5],[56.5,24.5],[56,26.5],[51.5,24.5],[50,26],[48,29.5],[50.5,30],[56,27],[61,25],[66.5,25.5],[68,23.5],[72.8,21],[73.5,16],[76,9],[77.5,8],[80,10],[80.3,15],[82.5,17],[87,21.5],[90,22],[91.8,22.5],[94,19],[94.5,16],[97.5,16.5],[98.5,11],[98.5,8],[100.5,6.5],[103.5,1.3],[104,1.5],[102,6],[100.5,13.5],[102,12.5],[105,8.6],[106.7,10.5],[109.2,11.5],[109,15],[106,18],[106.5,20.5],[108,21.5],[110.5,21],[113,22.2],[117,23],[120,26],[121.8,30],[121,32.5],[119,35],[122,37],[121,39],[118,39],[121.5,40.5],[122,40],[125,39.5],[126.6,37.5],[126,35],[129.3,35.2],[129.5,37],[128,39],[130,42.5],[133,42.8],[140,48],[141,53],[137,54],[135,56],[142,59],[151,59.5],[155,59],[162,61],[163,57],[160,53],[162.5,55.5],[156.5,51],[156,57.5],[163,62],[179.9,62.5],[179.9,69],[170,70],[160,70.5],[150,71.5],[140,72.5],[130,71],[113,73.5],[105,77.5],[95,76],[80,73.5],[72,72.5],[68,69],[60,69.5],[55,68],[45,68],[40,66],[34,69.4],[28,71],[20,70],[15,68],[10,63.5],[5,62],[5.5,58.5],[8,58],[10.5,59.5],[12.5,56],[14,55.5],[18,59.5],[17,61],[21.5,64.5],[25,65.5],[22.5,62.5],[21,60.5],[23,60],[29.5,60],[24,59.3],[21.5,57],[21,55.5],[14,54],[10,54],[8.5,55.5],[8.6,57],[10.6,57.7],[10.5,56],[9.5,54.8],[8.7,53.9],[5,53.4],[3.5,51.5],[1.5,50.8],[-1.5,49.5],[-1.5,48.6],[-4.6,48.5],[-1.2,46],[-1.6,43.4],[-8,43.7]],
  // Africa
  [[-17,21],[-16.5,15],[-17.3,14.7],[-15,11],[-13,8],[-11,6.8],[-7.5,4.4],[-2,4.8],[2,6.2],[5,5.8],[6.5,4.3],[8.7,4.5],[9.8,2.5],[9,-1],[11.8,-5],[13,-9],[13.5,-12],[12,-17],[14.5,-23],[15.5,-28],[18,-32],[18.5,-34.3],[20,-34.8],[25.6,-34],[28,-33],[32.5,-28.5],[32.8,-25.8],[35.5,-24],[35.3,-21.3],[34.8,-19.8],[36.8,-18],[40.5,-15],[40.3,-10.5],[39,-7],[39.5,-4.8],[41.5,-1.8],[46,2.5],[51,10.5],[51.2,11.8],[45,10.6],[43.3,11.5],[41.5,14],[38.5,18],[37.2,21],[35.5,24],[33.5,28],[32.5,30],[29,30.9],[25,31.6],[20,30.9],[19,30.3],[15.5,31.4],[11,33.2],[10.5,36.5],[9.5,37.3],[3,36.8],[-1.3,35.5],[-5.9,35.8],[-9.5,32.5],[-9.8,30],[-13,27.7],[-15,24]],
  // Madagascar
  [[43.3,-12],[49.3,-12],[50.4,-15.5],[47,-25],[45,-25.5],[43.5,-22],[44.3,-16.5]],
  // Australia
  [[114,-22],[113.5,-26],[115,-34],[118,-35],[123.5,-33.9],[129,-31.6],[131.2,-31.5],[135,-34.8],[137.8,-32.6],[138.2,-35.6],[140,-38],[146,-39],[150,-37.5],[153.5,-28],[153,-25],[146,-19],[145.4,-14.8],[142.5,-10.7],[141.6,-12.7],[141.6,-17],[140,-17.7],[136,-15],[137,-12],[132.5,-11.4],[130,-13],[129,-15],[126,-14],[122,-18],[121,-19.5],[118.5,-20.3]],
  // Antarctica
  [[-180,-90],[180,-90],[180,-72],[170,-71],[160,-70],[140,-66.5],[120,-66.5],[100,-66],[80,-67.5],[70,-68],[60,-67],[40,-69],[20,-70],[0,-70],[-20,-73],[-40,-78],[-60,-73],[-57,-63.5],[-63,-65],[-70,-72],[-80,-73],[-100,-73],[-120,-74],[-140,-76],[-160,-78],[-180,-78]],
  // UK, Ireland, Iceland
  [[-5.7,50],[1.5,51.2],[1.7,52.7],[0,53.5],[-1.7,55.6],[-2,57.6],[-3.3,58.6],[-5,58.6],[-6.2,57],[-5,55],[-3,54.5],[-4.7,52.8],[-5.2,51.7]],
  [[-6,52],[-6,54],[-7.5,55.3],[-10,54.3],[-10,51.6]],
  [[-24,65.5],[-22,66.4],[-14.5,66.2],[-13.5,65],[-18,63.4],[-22.5,63.8]],
  // Japan
  [[130,31],[132,34],[135,33.6],[140,35],[141,38.3],[141.5,41.4],[140,39.5],[139,37.8],[137,37],[133,35.6],[130.8,34.2]],
  [[140,41.5],[141.5,45.4],[145.5,43.3],[143,42]],
  // Indonesia, New Guinea, Philippines
  [[95.3,5.6],[98,4],[104,-1],[106,-5.9],[102,-4],[100,-0.5],[97.5,2.2]],
  [[109,1.5],[110,-2.5],[114,-3.5],[116.5,-2],[119,5],[117,7],[114,4.5],[111,2.8]],
  [[105.5,-6.8],[114.5,-7.8],[114,-8.7],[106,-7.8]],
  [[131,-1],[135,-3.5],[138,-1.6],[141,-2.6],[147.5,-6],[150.5,-10.6],[147,-10],[143,-9],[138.7,-8.3],[137.6,-5.2],[133,-4]],
  [[120,18.5],[122.5,18.4],[124,12.5],[126.5,7],[125,6],[122,7],[121.5,13.5],[119.8,16]],
  // New Zealand
  [[172.6,-34.4],[175.5,-37],[178.5,-37.6],[176.8,-40],[174.6,-41.3],[172,-41],[170,-44],[166.5,-46],[169,-46.6],[173.3,-43.6],[174.3,-41.5]],
  // Caribbean, Taiwan, Svalbard, Hawaii, Sri Lanka
  [[-85,21.8],[-81,23.1],[-77,21.6],[-74.2,20.2],[-77.6,19.9],[-80,21.7]],
  [[-74.4,19.8],[-68.5,19],[-68.5,18.3],[-74.2,18.3]],
  [[120.1,23],[121.9,25],[121,22]],
  [[11,78.5],[17,80.5],[27,80],[22,77.5],[16,76.5]],
  [[-156.2,20.9],[-154.8,19.5],[-155.9,18.9]],
  [[79.8,9.8],[81.9,7.5],[80.5,5.9],[79.8,7]],
]

/** Inland seas cut out of the land mask. */
export const WATER: Poly[] = [
  [[-94.5,59],[-92.5,57],[-87,55.5],[-82,55],[-79.5,51.5],[-79,54.5],[-76.5,56.5],[-78,60.5],[-78,62.5],[-84,63.5],[-90,64],[-94,61]],
  [[28,41.2],[28.5,43.5],[30,45.5],[33,46],[36.5,45.3],[38,47],[39.5,47],[37.5,44.5],[41.6,41.6],[36,41.7],[31,41.1]],
  [[47,45],[50,46.5],[53,47],[54,45],[51,44],[53,40],[54,37],[51,36.7],[49,38],[49.5,40.5],[47.6,43]],
]

// ---------------------------------------------------------------- orbits

export interface OrbitEl {
  /** periapsis / apoapsis radius (body radii) */
  rp: number
  ra: number
  /** inclination, argument of periapsis, ascending node (radians) */
  inc: number
  argp: number
  raan: number
  /** out-of-plane wobble (halo look) */
  halo: number
}

export interface OrbitSpec {
  el: OrbitEl
  /** a second faint orbit (e.g. aerobraking passes) */
  ghost?: OrbitEl
  /** display period of one lap in seconds */
  lapSeconds: number
}

const el = (rp: number, ra: number, incDeg: number, argpDeg = 0, raanDeg = 0, halo = 0): OrbitEl => ({
  rp,
  ra,
  inc: incDeg * D2R,
  argp: argpDeg * D2R,
  raan: raanDeg * D2R,
  halo,
})

const ORBITS: Record<string, OrbitEl> = {
  // Earth (5.6) — not to scale, LEO lower than SSO
  leo: el(1.17, 1.17, 51.6, 0, 180),
  sso: el(1.27, 1.27, 97.8, 0, 72),
  geo: el(2.9, 2.9, 0, 0, 0),
  // Moon (5A.5)
  llo: el(1.11, 1.11, 90, 0, 68),
  frozen: el(1.14, 1.95, 86, 90, 62),
  nrho: el(1.25, 5.4, 90, 90, 58, 0.22),
  // Mars (5B.5)
  capture: el(1.12, 3.7, 75, -35, -20),
  aerobrake: el(1.1, 1.1, 93, 0, 66),
  direct: el(1.1, 1.1, 93, 0, 66),
}

export function orbitSpec(orbitId: string | null | undefined): OrbitSpec | null {
  if (!orbitId) return null
  const e = ORBITS[orbitId]
  if (!e) return null
  const a = (e.rp + e.ra) / 2
  const lapSeconds = clamp(15 * Math.pow(a / 1.17, 1.5), 12, 60)
  const spec: OrbitSpec = { el: e, lapSeconds }
  if (orbitId === 'aerobrake') spec.ghost = el(1.06, 2.6, 93, -60, 66)
  return spec
}

export function lerpEl(a: OrbitEl, b: OrbitEl, t: number): OrbitEl {
  const ang = (x: number, y: number) => {
    let d = y - x
    while (d > Math.PI) d -= 2 * Math.PI
    while (d < -Math.PI) d += 2 * Math.PI
    return x + d * t
  }
  return {
    rp: lerp(a.rp, b.rp, t),
    ra: lerp(a.ra, b.ra, t),
    inc: lerp(a.inc, b.inc, t),
    argp: ang(a.argp, b.argp),
    raan: ang(a.raan, b.raan),
    halo: lerp(a.halo, b.halo, t),
  }
}

/** Position on the orbit for mean anomaly fraction m (0..1) — Kepler's equation, so the
 *  spacecraft speeds up at periapsis. */
export function orbitPoint(o: OrbitEl, m: number): Vec3 {
  const a = (o.rp + o.ra) / 2
  const e = (o.ra - o.rp) / (o.ra + o.rp)
  const M = (((m % 1) + 1) % 1) * 2 * Math.PI
  let E = e > 0.8 ? Math.PI : M
  for (let k = 0; k < 8; k++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E))
  const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2))
  return orbitPointNu(o, nu, a, e)
}

function orbitPointNu(o: OrbitEl, nu: number, a: number, e: number): Vec3 {
  const r = (a * (1 - e * e)) / (1 + e * Math.cos(nu))
  // perifocal → equatorial (z = north)
  let x = r * Math.cos(nu)
  let y = r * Math.sin(nu)
  let z = o.halo * r * Math.sin(2 * nu) * 0.5
  // argp around z
  ;[x, y] = [x * Math.cos(o.argp) - y * Math.sin(o.argp), x * Math.sin(o.argp) + y * Math.cos(o.argp)]
  // inclination around x
  ;[y, z] = [y * Math.cos(o.inc) - z * Math.sin(o.inc), y * Math.sin(o.inc) + z * Math.cos(o.inc)]
  // raan around z
  ;[x, y] = [x * Math.cos(o.raan) - y * Math.sin(o.raan), x * Math.sin(o.raan) + y * Math.cos(o.raan)]
  // equatorial (z up) → three.js (y up)
  return [x, z, -y]
}

/** Evenly spaced (in true anomaly) closed loop of n points. */
export function orbitPath(o: OrbitEl, n = 256): Vec3[] {
  const a = (o.rp + o.ra) / 2
  const e = (o.ra - o.rp) / (o.ra + o.rp)
  const pts: Vec3[] = []
  for (let i = 0; i <= n; i++) pts.push(orbitPointNu(o, (i / n) * 2 * Math.PI, a, e))
  return pts
}

export const orbitExtent = (o: OrbitEl) => o.ra + o.halo * o.ra * 0.5

// ---------------------------------------------------------------- cruise (transfer) scenes

export interface CruiseScene {
  /** main body position + radius (Earth for 'earth', target for Moon/Mars) */
  bodies: { kind: BodyKind | 'sun'; pos: Vec3; r: number; label: string }[]
  /** transfer trajectory */
  path: Vec3[]
  /** faint reference rings (planet orbits around the Sun) */
  rings: { r: number; color: string }[]
  /** camera direction & fitted radius for framing */
  camDir: Vec3
  fit: number
}

function bezier(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, n: number): Vec3[] {
  const out: Vec3[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const u = 1 - t
    const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t]
    out.push([
      w[0] * p0[0] + w[1] * p1[0] + w[2] * p2[0] + w[3] * p3[0],
      w[0] * p0[1] + w[1] * p1[1] + w[2] * p2[1] + w[3] * p3[1],
      w[0] * p0[2] + w[1] * p1[2] + w[2] * p2[2] + w[3] * p3[2],
    ])
  }
  return out
}

export const MOON_CRUISE_POS: Vec3 = [2.9, 0.25, -0.6]
export const EARTH_CRUISE_POS_LUNAR: Vec3 = [-2.3, -0.15, 0.2]

export function cruiseScene(kind: BodyKind, orbitId?: string | null): CruiseScene {
  if (kind === 'moon') {
    const E = EARTH_CRUISE_POS_LUNAR
    const M = MOON_CRUISE_POS
    const p0 = add(E, scale(norm([0.25, 0.15, 1]), 1.08))
    const p3 = add(M, scale(norm([-0.4, 0.3, 0.9]), 0.42))
    return {
      bodies: [
        { kind: 'earth', pos: E, r: 0.85, label: 'Earth' },
        { kind: 'moon', pos: M, r: 0.32, label: 'Moon' },
      ],
      path: bezier(p0, [-1.2, 1.9, 1.9], [1.6, 2.0, 1.0], p3, 160),
      rings: [],
      camDir: norm([0.1, 0.42, 1]),
      fit: 3.6,
    }
  }
  if (kind === 'mars') {
    const rE = 2.0
    const rM = 3.1
    const a = (rE + rM) / 2
    const e = (rM - rE) / (rM + rE)
    const start = 200 * D2R
    const path: Vec3[] = []
    for (let i = 0; i <= 160; i++) {
      const nu = (i / 160) * Math.PI
      const r = (a * (1 - e * e)) / (1 + e * Math.cos(nu))
      const ang = start + nu
      path.push([Math.cos(ang) * r, 0, -Math.sin(ang) * r])
    }
    const ang = (d: number, r: number): Vec3 => [Math.cos(d) * r, 0, -Math.sin(d) * r]
    return {
      bodies: [
        { kind: 'sun', pos: [0, 0, 0], r: 0.3, label: 'Sun' },
        { kind: 'earth', pos: ang(start, rE), r: 0.17, label: 'Earth' },
        { kind: 'mars', pos: ang(start + Math.PI, rM), r: 0.14, label: 'Mars' },
      ],
      path,
      rings: [
        { r: rE, color: '#40a9fd' },
        { r: rM, color: '#f08a5d' },
      ],
      camDir: norm([0.15, 1.05, 1]),
      fit: 3.4,
    }
  }
  // Earth: ascent from the launch site up to the selected orbit
  const spec = orbitSpec(orbitId ?? 'leo') ?? orbitSpec('leo')!
  const o = spec.el
  const path: Vec3[] = []
  const n = 120
  const end = 0.32
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const m = end - 0.24 * (1 - t)
    const p = orbitPoint(o, m)
    const h = lerp(1.0, len(p), smooth(Math.min(1, t * 1.3)))
    path.push(scale(norm(p), h))
  }
  return {
    bodies: [{ kind: 'earth', pos: [0, 0, 0], r: 1, label: 'Earth' }],
    path,
    rings: [],
    camDir: CAM_DIR,
    fit: 1.45,
  }
}

/** Point along a polyline at fraction t (by arc length). */
export function alongPath(path: Vec3[], t: number): Vec3 {
  if (path.length === 0) return [0, 0, 0]
  const tt = clamp(t, 0, 1)
  let total = 0
  const seg: number[] = []
  for (let i = 1; i < path.length; i++) {
    const d = len(sub(path[i], path[i - 1]))
    seg.push(d)
    total += d
  }
  let target = tt * total
  for (let i = 0; i < seg.length; i++) {
    if (target <= seg[i] || i === seg.length - 1) return lerp3(path[i], path[i + 1], seg[i] ? clamp(target / seg[i], 0, 1) : 0)
    target -= seg[i]
  }
  return path[path.length - 1]
}

// ---------------------------------------------------------------- remote Earth (Lunar / Mars orbit views)

// Placed relative to the default camera so the small Earth shows in the upper-left of the view.
const remoteAt = (right: number, up: number, back: number): Vec3 => {
  const f = CAM_DIR
  const r = norm(cross([0, 1, 0], f))
  const u = cross(f, r)
  return [r[0] * right + u[0] * up - f[0] * back, r[1] * right + u[1] * up - f[1] * back, r[2] * right + u[2] * up - f[2] * back]
}
export const REMOTE_EARTH: Record<'moon' | 'mars', { pos: Vec3; r: number }> = {
  moon: { pos: remoteAt(-2.5, 1.25, 3), r: 0.42 },
  mars: { pos: remoteAt(-2.6, 1.3, 3.4), r: 0.3 },
}

/** Yaw (around y) that turns a station on Earth (at `earthPos`) to face `target`. */
export function yawToFace(stationId: string, earthPos: Vec3, target: Vec3): number {
  const [lat, lon] = stationLatLon(stationId)
  const s = latLonToVec(lat, lon)
  const d = sub(target, earthPos)
  const aS = Math.atan2(s[0], s[2])
  const aD = Math.atan2(d[0], d[2])
  return aD - aS
}

// ---------------------------------------------------------------- visibility

/** True when the segment a→b does not pass through any sphere (shrunk by `eps`). */
export function lineOfSight(a: Vec3, b: Vec3, spheres: { c: Vec3; r: number }[], eps = 0.985): boolean {
  const d = sub(b, a)
  const L2 = dot(d, d)
  if (L2 === 0) return true
  for (const s of spheres) {
    const t = clamp(dot(sub(s.c, a), d) / L2, 0, 1)
    const p = add(a, scale(d, t))
    if (len(sub(p, s.c)) < s.r * eps) return false
  }
  return true
}

// ---------------------------------------------------------------- simple 2D projection (SVG)

export interface Projector {
  right: Vec3
  up: Vec3
  fwd: Vec3
}

export function makeProjector(camDir: Vec3): Projector {
  const fwd = norm(camDir)
  const right = norm(cross([0, 1, 0], fwd))
  const up = cross(fwd, right)
  return { right, up, fwd }
}

/** → [screenX, screenY (down), depth (toward viewer)] in world units */
export function project(p: Projector, v: Vec3): [number, number, number] {
  return [dot(v, p.right), -dot(v, p.up), dot(v, p.fwd)]
}

/** Smoothly chase a target phase (0..1, wrapping when `wrap`). */
export function chasePhase(cur: number, target: number, dt: number, wrap: boolean, rate = 4): number {
  let d = target - cur
  if (wrap) {
    d = ((d % 1) + 1.5) % 1 - 0.5
  }
  if (Math.abs(d) < 1e-4) return target
  return cur + d * (1 - Math.exp(-rate * dt))
}

// ---------------------------------------------------------------- surface features (shared by SVG + 3D textures)

/** Body rotation around the polar axis so the interesting side faces the default camera. */
export const BODY_YAW: Record<BodyKind, number> = { earth: 0, moon: -1.25, mars: 0.15 }

/** [lat, lon, radiusDeg] dark lunar maria (near side). */
export const MOON_MARIA: [number, number, number][] = [
  [33, -16, 11], [28, 17, 8], [8, 31, 9], [17, 59, 5.5], [18, -52, 16], [-2, -40, 10],
  [-21, -17, 8], [-8, 51, 6.5], [-14, -4, 4], [-24, -38, 5], [56, 0, 4], [42, 12, 4],
]

/** [lat, lon, radiusDeg] dark albedo regions on Mars. */
export const MARS_DARK: [number, number, number][] = [
  [10, 70, 10], [45, -30, 11], [-25, -40, 14], [-3, 0, 7], [-25, 140, 16], [-15, 110, 9],
  [-20, -95, 8], [-30, 20, 12], [-35, 175, 10],
]
/** [lat, lon, radiusDeg] bright regions on Mars (Hellas, Argyre, Tharsis dust). */
export const MARS_BRIGHT: [number, number, number][] = [
  [-42, 70, 10], [-50, -42, 7], [5, -110, 14], [45, 110, 12],
]

/** Deterministic pseudo-random generator (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Crater list [lat, lon, radiusDeg] — deterministic. */
export function craters(seed: number, count: number, maxR: number): [number, number, number][] {
  const r = rng(seed)
  const out: [number, number, number][] = []
  for (let i = 0; i < count; i++) {
    const lat = Math.asin(r() * 2 - 1) / D2R
    const lon = r() * 360 - 180
    const rad = Math.max(0.6, maxR * Math.pow(r(), 2.6))
    out.push([lat, lon, rad])
  }
  return out
}
