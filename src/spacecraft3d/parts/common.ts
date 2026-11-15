// Reusable sub-assemblies shared by many part factories. All dimensions in metres.
import * as THREE from 'three'
import type { M, PartBuilder, V3 } from '../core/builder'
import { knurled } from '../core/materials'
import { rng } from '../core/textures'

const PI = Math.PI
const H = PI / 2

// ------------------------------------------------------------------ fasteners

/** Socket-head screw lying on a surface whose normal is +Z (local); head radius r. */
export function screw(pb: PartBuilder, p: V3, r: V3 = [0, 0, 0], rad = 0.0014) {
  if (!pb.hi) return
  pb.at(p, r, () => {
    pb.cylZ(rad, rad, rad * 0.9, 'screw', [0, 0, rad * 0.45], { seg: 8 })
    pb.cylZ(rad * 0.45, rad * 0.45, rad * 0.3, 'blackPaint', [0, 0, rad * 0.8], { seg: 6 })
  })
}

/** n screws evenly between a and b on a surface with the given rotation */
export function screwRow(pb: PartBuilder, a: V3, b: V3, n: number, r: V3 = [0, 0, 0], rad = 0.0014) {
  if (!pb.hi) return
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1)
    screw(pb, [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t], r, rad)
  }
}

/** four screws in the corners of a w×h rectangle facing +Z at z */
export function cornerScrews(pb: PartBuilder, w: number, h: number, z: number, inset: number, rad = 0.0014) {
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) screw(pb, [sx * (w / 2 - inset), sy * (h / 2 - inset), z], [0, 0, 0], rad)
}

// ------------------------------------------------------------------ electronics

export interface PcbOpts {
  mask?: 'green' | 'blue' | 'black' | 'red'
  seed?: number
  chips?: number
  thick?: number
  /** PC/104-style stack-through header along one edge */
  header?: boolean
  /** big processor with metal lid */
  cpu?: boolean
  caps?: number
  leds?: boolean
}

/** PCB lying in XY, top face at z = thick/2 (board centred at origin). */
export function pcb(pb: PartBuilder, w: number, h: number, o: PcbOpts = {}) {
  const t = o.thick ?? 0.0016
  const r = rng(o.seed ?? 1)
  const key = (`pcb${(o.mask ?? 'green')[0].toUpperCase()}${(o.mask ?? 'green').slice(1)}`) as M
  pb.box(w, h, t, key)
  const top = t / 2
  const s = Math.min(w, h)
  // CPU / FPGA
  if (o.cpu) {
    const cw = s * 0.28
    pb.box(cw, cw, 0.0018, 'chip', [w * 0.05, 0, top + 0.0009])
    pb.box(cw * 0.7, cw * 0.7, 0.0008, 'chipLid', [w * 0.05, 0, top + 0.0022])
  }
  const n = o.chips ?? 5
  for (let i = 0; i < n; i++) {
    const cw = s * (0.08 + r() * 0.12)
    const ch = cw * (0.6 + r() * 0.6)
    const x = (r() - 0.5) * (w - cw - s * 0.12)
    const y = (r() - 0.5) * (h - ch - s * 0.12)
    if (o.cpu && Math.abs(x - w * 0.05) < s * 0.25 && Math.abs(y) < s * 0.25) continue
    const ht = 0.0009 + r() * 0.0012
    pb.box(cw, ch, ht, 'chip', [x, y, top + ht / 2])
    if (pb.hi && r() < 0.7) {
      // gull-wing pins on two sides
      const pins = Math.max(3, Math.round(cw / 0.0013))
      for (let k = 0; k < pins; k++) {
        const px = x - cw / 2 + (k + 0.5) * (cw / pins)
        pb.box(0.0004, 0.0012, 0.0004, 'goldPin', [px, y + ch / 2 + 0.0005, top + 0.0002])
        pb.box(0.0004, 0.0012, 0.0004, 'goldPin', [px, y - ch / 2 - 0.0005, top + 0.0002])
      }
    }
  }
  // capacitors / small parts
  if (pb.hi) {
    const caps = o.caps ?? 10
    for (let i = 0; i < caps; i++) {
      const x = (r() - 0.5) * w * 0.85
      const y = (r() - 0.5) * h * 0.85
      if (r() < 0.4) pb.cyl(0.0012, 0.0012, 0.0024, r() < 0.5 ? 'chipLid' : 'cellBlue', [x, y, top + 0.0012], [H, 0, 0], { seg: 8 })
      else pb.box(0.0018, 0.001, 0.0008, r() < 0.5 ? 'ceramic' : 'chip', [x, y, top + 0.0004])
    }
  }
  if (o.header) {
    pb.box(w * 0.55, 0.005, 0.0085, 'plasticBlack', [-w * 0.1, h / 2 - 0.006, top + 0.00425])
    if (pb.hi) for (let k = 0; k < 26; k++) pb.box(0.0006, 0.0006, 0.003, 'goldPin', [-w * 0.1 - w * 0.26 + k * (w * 0.52) / 25, h / 2 - 0.006, top + 0.0098])
  }
  if (o.leds && pb.hi) {
    for (let k = 0; k < 3; k++) pb.box(0.0016, 0.0008, 0.0006, k === 1 ? 'ledRed' : 'led', [w / 2 - 0.006 - k * 0.003, -h / 2 + 0.004, top + 0.0003])
  }
}

/** Hex standoffs at the 4 corners of a w×h board, height along +Z from z0 */
export function standoffs(pb: PartBuilder, w: number, h: number, z0: number, height: number, inset = 0.0045) {
  for (const sx of [-1, 1])
    for (const sy of [-1, 1]) pb.cylZ(0.0024, 0.0024, height, 'steel', [sx * (w / 2 - inset), sy * (h / 2 - inset), z0 + height / 2], { seg: 6 })
}

/** Circular connector (MIL-type) facing +Z at p */
export function roundConnector(pb: PartBuilder, p: V3, r: V3 = [0, 0, 0], size = 0.006) {
  pb.at(p, r, () => {
    pb.box(size * 2.2, size * 2.2, size * 0.25, 'aluGold', [0, 0, size * 0.125])
    pb.cylZ(size, size, size * 1.1, 'aluGold', [0, 0, size * 0.8])
    pb.cylZ(size * 0.75, size * 0.75, size * 0.1, 'plasticBlack', [0, 0, size * 1.38])
  })
}

/** D-sub / micro-D connector facing +Z */
export function dsub(pb: PartBuilder, p: V3, r: V3 = [0, 0, 0], w = 0.016) {
  pb.at(p, r, () => {
    pb.box(w * 1.35, w * 0.45, 0.0008, 'steel', [0, 0, 0.0004])
    pb.rbox(w, w * 0.3, 0.004, 0.0008, 'steel', [0, 0, 0.0028])
    pb.box(w * 0.86, w * 0.18, 0.001, 'plasticBlack', [0, 0, 0.0048])
    if (pb.hi) for (const sx of [-1, 1]) pb.cylZ(0.0009, 0.0009, 0.004, 'steel', [sx * w * 0.6, 0, 0.0024], { seg: 6 })
  })
}

/** SMA coax connector facing +Z */
export function sma(pb: PartBuilder, p: V3, r: V3 = [0, 0, 0], s = 1) {
  pb.at(p, r, () => {
    pb.box(0.0064 * s, 0.0064 * s, 0.0015 * s, 'goldPin', [0, 0, 0.00075 * s])
    pb.cylZ(0.0028 * s, 0.0028 * s, 0.0075 * s, 'goldPin', [0, 0, 0.005 * s], { seg: 6 })
    pb.cylZ(0.0013 * s, 0.0013 * s, 0.0005 * s, 'plasticWhite', [0, 0, 0.0088 * s], { seg: 10 })
  })
}

/** Cable from a to b sagging a bit, through optional mid points */
export function cable(pb: PartBuilder, pts: V3[], r = 0.0012, m: M = 'cable') {
  pb.tube(pts, r, m, { radial: pb.hi ? 6 : 4 })
}

/** Harness bundle: 3 twisted wires */
export function harness(pb: PartBuilder, pts: V3[], r = 0.0012, colors: M[] = ['cable', 'cableWhite', 'cableRed']) {
  if (!pb.hi) {
    cable(pb, pts, r * 1.8, colors[0])
    return
  }
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)))
  const N = Math.max(12, pts.length * 10)
  const frames = curve.computeFrenetFrames(N, false)
  colors.forEach((c, k) => {
    const out: V3[] = []
    for (let i = 0; i <= N; i++) {
      const t = i / N
      const p = curve.getPointAt(t)
      const a = (k / colors.length) * PI * 2 + t * 18
      const n = frames.normals[i]
      const b = frames.binormals[i]
      out.push([p.x + (n.x * Math.cos(a) + b.x * Math.sin(a)) * r, p.y + (n.y * Math.cos(a) + b.y * Math.sin(a)) * r, p.z + (n.z * Math.cos(a) + b.z * Math.sin(a)) * r])
    }
    pb.tube(out, r * 0.75, c, { seg: N, radial: 5 })
  })
}

// ------------------------------------------------------------------ optics

export interface LensOpts {
  /** aperture radius */
  r: number
  len: number
  glass?: M
  /** number of stepped rings */
  rings?: number
  hood?: boolean
  body?: M
}

/** Lens barrel along +Z from z=0, front glass at z=len. */
export function lensBarrel(pb: PartBuilder, o: LensOpts) {
  const { r, len } = o
  const body = o.body ?? 'aluDark'
  const rings = o.rings ?? 3
  // stepped outer profile
  const pts: [number, number][] = [[r * 0.82, 0]]
  for (let i = 0; i < rings; i++) {
    const z0 = (i / rings) * len * 0.82
    const z1 = ((i + 1) / rings) * len * 0.82
    const rr = r * (0.88 + (i / rings) * 0.18)
    pts.push([rr, z0], [rr, z1 - len * 0.015], [rr * 0.97, z1])
  }
  pts.push([r * 1.08, len * 0.82], [r * 1.08, len], [r * 0.93, len])
  pb.lathe(pts.map(([a, b]) => [a, b] as [number, number]), body, [0, 0, 0], [H, 0, 0])
  // knurled focus ring
  pb.cylZ(r * 1.1, r * 1.1, len * 0.14, knurled(), [0, 0, len * 0.55], { seg: pb.seg(40) })
  // gold index line
  if (pb.hi) pb.box(r * 0.04, r * 0.05, len * 0.14, 'goldPin', [0, r * 1.11, len * 0.55])
  // inner black throat + glass
  pb.cylZ(r * 0.93, r * 0.93, len * 0.06, 'blackPaint', [0, 0, len - len * 0.03], { open: true })
  pb.sphere(r * 2.2, o.glass ?? 'glass', [0, 0, len - r * 2.2 + r * 0.22 - len * 0.05], [H, 0, 0], { thetaLength: Math.asin(0.42), seg: pb.seg(36) })
  pb.torus(r * 0.9, r * 0.035, 'aluDark', [0, 0, len - len * 0.04], [0, 0, 0], { seg: pb.seg(36) })
  if (o.hood) {
    pb.lathe([[r * 1.0, len], [r * 1.25, len + r * 0.9], [r * 1.22, len + r * 0.9], [r * 0.97, len]], 'blackPaint', [0, 0, 0], [H, 0, 0])
  }
}

/** Telescope sun-baffle tube along +Z: white outside, black inside, with internal vane rings. */
export function baffleTube(pb: PartBuilder, r: number, len: number, z0 = 0, outer: M = 'whitePaint', vanes = 4) {
  pb.cylZ(r, r, len, outer, [0, 0, z0 + len / 2], { open: true, seg: pb.seg(40) })
  pb.cylZ(r * 0.985, r * 0.985, len, 'blackPaint', [0, 0, z0 + len / 2], { open: true, inside: true, seg: pb.seg(40) })
  pb.torus(r, r * 0.03, outer, [0, 0, z0 + len], [0, 0, 0], { seg: pb.seg(40) })
  if (pb.hi) for (let i = 1; i <= vanes; i++) pb.disc(r * 0.98, 'blackPaint', [0, 0, z0 + (i / (vanes + 1)) * len], [0, 0, 0], pb.seg(40), r * 0.8)
}

// ------------------------------------------------------------------ power

/**
 * Solar panel in XY (cells on +Z face), size w×h, nx×ny cells; substrate thickness t.
 * Includes a thin aluminium edge frame and (high detail) interconnect tabs.
 */
export function solarPanel(pb: PartBuilder, w: number, h: number, nx: number, ny: number, t = 0.0016, opts: { back?: M; frame?: boolean; margin?: number } = {}) {
  const m = opts.margin ?? Math.min(w, h) * 0.035
  pb.box(w, h, t, opts.back ?? 'solarBack')
  pb.plane(w - 2 * m, h - 2 * m, 'solar', [0, 0, t / 2 + 0.0002], [0, 0, 0], nx, ny)
  if (opts.frame !== false) {
    const f = Math.max(0.0012, m * 0.6)
    pb.box(w, f, t * 1.6, 'alu', [0, h / 2 - f / 2, 0])
    pb.box(w, f, t * 1.6, 'alu', [0, -h / 2 + f / 2, 0])
    pb.box(f, h - 2 * f, t * 1.6, 'alu', [w / 2 - f / 2, 0, 0])
    pb.box(f, h - 2 * f, t * 1.6, 'alu', [-w / 2 + f / 2, 0, 0])
  }
}

/** Barrel hinge along X of length len at p */
export function hinge(pb: PartBuilder, p: V3, len: number, r = 0.002, axis: 'x' | 'y' | 'z' = 'x') {
  const rot: V3 = axis === 'x' ? [0, 0, H] : axis === 'z' ? [H, 0, 0] : [0, 0, 0]
  pb.at(p, rot, () => {
    pb.cyl(r, r, len, 'steel', [0, 0, 0], [0, 0, 0], { seg: 10 })
    if (pb.hi) for (let i = 0; i < 3; i++) pb.cyl(r * 1.25, r * 1.25, len * 0.18, 'alu', [0, (i - 1) * len * 0.38, 0], [0, 0, 0], { seg: 10 })
  })
}

/** 18650-style cylindrical cell along axis Z, centred at p */
export function cell18650(pb: PartBuilder, p: V3, wrap: M = 'cellBlue', r = 0.009, len = 0.065) {
  pb.at(p, undefined, () => {
    pb.cylZ(r, r, len * 0.94, wrap, [0, 0, 0], { seg: pb.seg(20) })
    pb.cylZ(r * 0.96, r * 0.96, len * 0.03, 'steel', [0, 0, len * 0.485], { seg: pb.seg(20) })
    pb.cylZ(r * 0.96, r * 0.96, len * 0.03, 'steel', [0, 0, -len * 0.485], { seg: pb.seg(20) })
    if (pb.hi) pb.cylZ(r * 0.35, r * 0.35, len * 0.02, 'steel', [0, 0, len * 0.505], { seg: 10 })
  })
}

// ------------------------------------------------------------------ attitude

/** Reaction wheel housing, axis +Z, base at z=0 */
export function reactionWheel(pb: PartBuilder, r: number, h: number, p: V3 = [0, 0, 0], rot: V3 = [0, 0, 0], housing: M = 'alu') {
  pb.at(p, rot, () => {
    pb.cylZ(r * 1.12, r * 1.12, h * 0.12, housing, [0, 0, h * 0.06], { seg: pb.seg(40) })
    pb.lathe(
      [[r, h * 0.1], [r, h * 0.78], [r * 0.92, h * 0.92], [r * 0.6, h], [r * 0.25, h * 1.02], [0, h * 1.02]],
      housing,
      [0, 0, 0],
      [H, 0, 0],
      pb.seg(40),
    )
    if (pb.hi) {
      // radial stiffening ribs on the cover
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * PI * 2
        pb.box(r * 0.55, r * 0.05, h * 0.06, housing, [Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, h * 0.95], [0, 0, a])
      }
      pb.cylZ(r * 0.22, r * 0.22, h * 0.08, 'steel', [0, 0, h * 1.04], { seg: 16 })
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * PI * 2
        screw(pb, [Math.cos(a) * r * 1.05, Math.sin(a) * r * 1.05, h * 0.12], [0, 0, 0], r * 0.04)
      }
    }
    dsub(pb, [r * 0.98, 0, h * 0.4], [0, H, 0], r * 0.5)
  })
}

/** Star tracker: electronics box + conical baffle, boresight +Z, base at z=0. size ≈ box edge */
export function starTracker(pb: PartBuilder, s: number, p: V3 = [0, 0, 0], rot: V3 = [0, 0, 0], body: M = 'aluDark') {
  pb.at(p, rot, () => {
    pb.rbox(s, s, s * 0.6, s * 0.06, body, [0, 0, s * 0.3])
    pb.cylZ(s * 0.28, s * 0.28, s * 0.2, 'aluDark', [0, 0, s * 0.7])
    // conical baffle with vanes
    const L = s * 1.4
    pb.lathe([[s * 0.28, 0], [s * 0.62, L], [s * 0.6, L], [s * 0.26, 0]], 'blackPaint', [0, 0, s * 0.8], [H, 0, 0], pb.seg(32))
    pb.lathe([[s * 0.29, 0], [s * 0.64, L]], body, [0, 0, s * 0.8], [H, 0, 0], pb.seg(32))
    if (pb.hi) for (let i = 1; i <= 3; i++) {
      const t = i / 4
      const rr = s * (0.28 + 0.34 * t)
      pb.disc(rr, 'blackPaint', [0, 0, s * 0.8 + L * t], [0, 0, 0], 32, rr * 0.8)
    }
    pb.disc(s * 0.2, 'glass', [0, 0, s * 0.82], [0, 0, 0], 24)
    pb.torus(s * 0.635, s * 0.015, 'alu', [0, 0, s * 0.8 + L], [0, 0, 0], { seg: pb.seg(32) })
    cornerScrews(pb, s, s, s * 0.6, s * 0.08, s * 0.03)
  })
}

/** Rectangular air-core magnetorquer coil lying in XY (normal +Z) */
export function coilRect(pb: PartBuilder, w: number, h: number, bw: number, t: number, p: V3 = [0, 0, 0], rot: V3 = [0, 0, 0]) {
  pb.at(p, rot, () => {
    pb.box(w, bw, t, 'winding', [0, h / 2 - bw / 2, 0])
    pb.box(w, bw, t, 'winding', [0, -h / 2 + bw / 2, 0])
    pb.box(bw, h - 2 * bw, t, 'winding', [w / 2 - bw / 2, 0, 0])
    pb.box(bw, h - 2 * bw, t, 'winding', [-w / 2 + bw / 2, 0, 0])
    if (pb.hi) {
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) pb.box(bw * 1.3, bw * 1.3, t * 1.3, 'kapton', [sx * (w / 2 - bw / 2), sy * (h / 2 - bw / 2), 0])
    }
  })
}

/** Torque rod (ferrite core with winding) along X */
export function torqueRod(pb: PartBuilder, len: number, r: number, p: V3 = [0, 0, 0], rot: V3 = [0, 0, 0]) {
  pb.at(p, rot, () => {
    pb.cylX(r, r, len * 0.84, 'winding', [0, 0, 0], { seg: pb.seg(16) })
    pb.cylX(r * 0.55, r * 0.55, len, 'ferrite', [0, 0, 0], { seg: pb.seg(12) })
    for (const s of [-1, 1]) pb.cylX(r * 1.15, r * 1.15, len * 0.05, 'aluDark', [s * len * 0.44, 0, 0], { seg: pb.seg(16) })
  })
}

/** Small thruster nozzle along -Z from z=0 (valve body above) */
export function smallThruster(pb: PartBuilder, s: number, p: V3 = [0, 0, 0], rot: V3 = [0, 0, 0]) {
  pb.at(p, rot, () => {
    pb.cylZ(s * 0.35, s * 0.35, s * 0.9, 'steel', [0, 0, s * 0.45], { seg: 12 })
    pb.cylZ(s * 0.5, s * 0.5, s * 0.25, 'goldPin', [0, 0, s * 0.95], { seg: 12 })
    pb.lathe([[s * 0.45, -s * 0.9], [s * 0.2, -s * 0.2], [s * 0.18, 0]], 'nozzle', [0, 0, 0], [H, 0, 0], pb.seg(20))
    pb.lathe([[s * 0.17, -s * 0.2], [s * 0.43, -s * 0.9]], 'blackPaint', [0, 0, 0], [H, 0, 0], pb.seg(20))
  })
}

// ------------------------------------------------------------------ propulsion

/**
 * Bell nozzle along -Z, throat at z=0. Outer shell + darker inner surface (separate lathe with
 * reversed profile so its faces point inward).
 */
export function bellNozzle(pb: PartBuilder, throat: number, exit: number, len: number, p: V3 = [0, 0, 0], m: M = 'nozzle') {
  const N = pb.hi ? 14 : 7
  const prof: [number, number][] = []
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const r = throat + (exit - throat) * (1 - Math.pow(1 - t, 1.8))
    prof.push([r, -len * t])
  }
  pb.at(p, [H, 0, 0], () => {
    pb.lathe(prof.slice().reverse(), m, [0, 0, 0], [0, 0, 0], pb.seg(48))
    pb.lathe(prof.map(([r, y]) => [r * 0.985, y] as [number, number]), 'blackPaint', [0, 0, 0], [0, 0, 0], pb.seg(48))
    pb.torus(exit, exit * 0.012, m, [0, -len, 0], [H, 0, 0], { seg: pb.seg(48) })
    // stiffening rings
    if (pb.hi) for (const t of [0.35, 0.7]) {
      const r = throat + (exit - throat) * (1 - Math.pow(1 - t, 1.8))
      pb.torus(r * 1.005, exit * 0.008, m, [0, -len * t, 0], [H, 0, 0], { seg: pb.seg(48) })
    }
  })
}

/** Spherical / capsule tank with girth flange, axis Z, centred at p */
export function tank(pb: PartBuilder, r: number, cylLen: number, p: V3, m: M = 'titanium', rot: V3 = [0, 0, 0]) {
  pb.at(p, rot, () => {
    if (cylLen <= 0) pb.sphere(r, m, [0, 0, 0], [H, 0, 0], { seg: pb.seg(36) })
    else {
      pb.sphere(r, m, [0, 0, cylLen / 2], [H, 0, 0], { thetaLength: H, seg: pb.seg(36) })
      pb.sphere(r, m, [0, 0, -cylLen / 2], [-H, 0, 0], { thetaLength: H, seg: pb.seg(36) })
      pb.cylZ(r, r, cylLen, m, [0, 0, 0], { open: true, seg: pb.seg(36) })
    }
    pb.torus(r * 1.01, r * 0.035, 'alu', [0, 0, 0], [0, 0, 0], { seg: pb.seg(40) })
    // mounting tabs
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * PI * 2 + PI / 4
      pb.box(r * 0.22, r * 0.08, r * 0.1, 'alu', [Math.cos(a) * r * 1.08, Math.sin(a) * r * 1.08, 0], [0, 0, a])
    }
    // ports
    pb.cylZ(r * 0.06, r * 0.06, r * 0.25, 'steel', [0, 0, r + cylLen / 2 + r * 0.08], { seg: 10 })
    pb.cylZ(r * 0.09, r * 0.09, r * 0.06, 'steel', [0, 0, r + cylLen / 2 - r * 0.02], { seg: 10 })
  })
}

// ------------------------------------------------------------------ comms

export interface DishOpts {
  /** diameter */
  D: number
  /** focal ratio f/D */
  fd?: number
  /** Cassegrain sub-reflector instead of a prime-focus feed */
  cassegrain?: boolean
  struts?: number
  ribs?: boolean
  surface?: M
}

/** Parabolic dish, boresight +Z, vertex at z=0. Returns focal length. */
export function dish(pb: PartBuilder, o: DishOpts) {
  const R = o.D / 2
  const f = (o.fd ?? 0.38) * o.D
  const depth = (R * R) / (4 * f)
  const N = pb.hi ? 16 : 7
  const front: [number, number][] = []
  for (let i = 0; i <= N; i++) {
    const r = (i / N) * R
    front.push([r, (r * r) / (4 * f)])
  }
  const surf = o.surface ?? 'whitePaint'
  pb.at([0, 0, 0], [H, 0, 0], () => {
    // reflective face (inside, normals toward +Y after lathe → we want toward boresight)
    pb.lathe(front.slice().reverse(), surf, [0, 0, 0], [0, 0, 0], pb.seg(56))
    // back shell slightly offset
    pb.lathe(front.map(([r, y]) => [r, y - o.D * 0.012] as [number, number]), 'cfrp', [0, 0, 0], [0, 0, 0], pb.seg(56))
    pb.torus(R, o.D * 0.008, 'alu', [0, depth - o.D * 0.006, 0], [H, 0, 0], { seg: pb.seg(56) })
  })
  // back ribs
  if (o.ribs !== false && pb.hi) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * PI * 2
      const pts: V3[] = []
      for (let k = 1; k <= 6; k++) {
        const r = (k / 6) * R * 0.98
        pts.push([Math.cos(a) * r, Math.sin(a) * r, (r * r) / (4 * f) - o.D * 0.02])
      }
      pb.tube(pts, o.D * 0.006, 'cfrp', { radial: 5, seg: 10 })
    }
  }
  pb.cylZ(R * 0.16, R * 0.2, o.D * 0.05, 'alu', [0, 0, -o.D * 0.02])
  // feed / sub-reflector
  const struts = o.struts ?? (o.cassegrain ? 4 : 3)
  const fz = o.cassegrain ? f * 0.82 : f
  for (let i = 0; i < struts; i++) {
    const a = (i / struts) * PI * 2 + PI / 2
    const rr = R * 0.82
    pb.rod([Math.cos(a) * rr, Math.sin(a) * rr, (rr * rr) / (4 * f)], [Math.cos(a) * R * 0.08, Math.sin(a) * R * 0.08, fz], o.D * 0.006, 'whitePaint', 8)
  }
  if (o.cassegrain) {
    pb.sphere(R * 0.16, 'whitePaint', [0, 0, fz + R * 0.12], [H, 0, 0], { thetaLength: 0.7, seg: pb.seg(24) })
    pb.cylZ(R * 0.17, R * 0.17, R * 0.02, 'alu', [0, 0, fz + R * 0.02])
    // feed horn at the vertex
    pb.cylZ(R * 0.05, R * 0.09, R * 0.35, 'goldPin', [0, 0, depth * 0.3 + R * 0.17])
  } else {
    pb.cylZ(R * 0.07, R * 0.04, R * 0.22, 'goldPin', [0, 0, fz - R * 0.08])
    pb.cylZ(R * 0.075, R * 0.075, R * 0.04, 'alu', [0, 0, fz + R * 0.04])
  }
  return f
}

/** Ceramic patch antenna on a small board, facing +Z, centred at p */
export function patchAntenna(pb: PartBuilder, s: number, p: V3 = [0, 0, 0], rot: V3 = [0, 0, 0], board: M = 'pcbBlack') {
  pb.at(p, rot, () => {
    pb.box(s, s, s * 0.04, board)
    pb.box(s * 0.62, s * 0.62, s * 0.08, 'ceramic', [0, 0, s * 0.06])
    pb.box(s * 0.5, s * 0.5, s * 0.01, 'goldPin', [0, 0, s * 0.105])
    if (pb.hi) {
      pb.cylZ(s * 0.03, s * 0.03, s * 0.012, 'steel', [s * 0.1, s * 0.08, s * 0.112], { seg: 8 })
      cornerScrews(pb, s, s, s * 0.02, s * 0.07, s * 0.025)
    }
  })
}

/** Simple boom of length len along +X from p (tube with end fittings) */
export function boom(pb: PartBuilder, p: V3, dir: V3, len: number, r: number, m: M = 'cfrp') {
  const a = p
  const b: V3 = [p[0] + dir[0] * len, p[1] + dir[1] * len, p[2] + dir[2] * len]
  pb.rod(a, b, r, m, pb.seg(12))
  pb.rod(a, [a[0] + dir[0] * r * 3, a[1] + dir[1] * r * 3, a[2] + dir[2] * r * 3], r * 1.5, 'alu', pb.seg(12))
  pb.rod(b, [b[0] - dir[0] * r * 3, b[1] - dir[1] * r * 3, b[2] - dir[2] * r * 3], r * 1.5, 'alu', pb.seg(12))
  if (pb.hi) {
    const n = Math.max(2, Math.floor(len / (r * 40)))
    for (let i = 1; i < n; i++) {
      const t = i / n
      pb.rod([a[0] + (b[0] - a[0]) * t - dir[0] * r, a[1] + (b[1] - a[1]) * t - dir[1] * r, a[2] + (b[2] - a[2]) * t - dir[2] * r], [a[0] + (b[0] - a[0]) * t + dir[0] * r, a[1] + (b[1] - a[1]) * t + dir[1] * r, a[2] + (b[2] - a[2]) * t + dir[2] * r], r * 1.2, 'alu', 10)
    }
  }
  return b
}

/** Box covered in MLI blanket with seams (tape) and corner stitches. Centred at p. */
export function mliBox(pb: PartBuilder, w: number, h: number, d: number, m: M = 'mliGold', p: V3 = [0, 0, 0]) {
  pb.at(p, undefined, () => {
    pb.box(w, h, d, m)
    if (pb.hi) {
      const tw = Math.min(w, h, d) * 0.03
      // seam tape along the edges of +Z face
      pb.box(w, tw, tw * 0.3, 'kapton', [0, h / 2 - tw, d / 2 + tw * 0.15])
      pb.box(tw, h, tw * 0.3, 'kapton', [w / 2 - tw, 0, d / 2 + tw * 0.15])
    }
  })
}

/** small label plate (unused text, just a plate with screws) */
export function plate(pb: PartBuilder, w: number, h: number, p: V3, rot: V3 = [0, 0, 0], m: M = 'aluDark') {
  pb.at(p, rot, () => {
    pb.box(w, h, 0.0006, m)
    cornerScrews(pb, w, h, 0.0003, Math.min(w, h) * 0.15, Math.min(w, h) * 0.06)
  })
}
