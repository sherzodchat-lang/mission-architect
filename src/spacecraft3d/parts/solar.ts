// Solar arrays for all missions. Built directly in the bus frame (busFrame = true).
// Every movable piece is a child group with userData.explodeDir (unit vector) and, for panels
// that can hide the interior, userData.xray (outward normal, for the camera-facing fade).
import * as THREE from 'three'
import { PartBuilder, type V3 } from '../core/builder'
import { cornerScrews, hinge, screwRow, solarPanel } from './common'
import type { PartCtx, PartFactory, PartResult } from './types'

const H = Math.PI / 2

function tag(g: THREE.Object3D, explode: V3, xray?: V3, amount = 1) {
  g.userData.explodeDir = explode
  g.userData.explodeAmount = amount
  if (xray) g.userData.xray = xray
  return g
}

/** rotation that maps local +X → spanDir and local +Z → normal */
function basis(span: V3, normal: V3) {
  const x = new THREE.Vector3(...span).normalize()
  const z = new THREE.Vector3(...normal).normalize()
  const y = z.clone().cross(x).normalize()
  z.copy(x).cross(y).normalize()
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z))
}

const FACES: { n: V3; r: V3 }[] = [
  { n: [0, 0, 1], r: [0, 0, 0] },
  { n: [0, 0, -1], r: [Math.PI, 0, 0] },
  { n: [0, 1, 0], r: [-H, 0, 0] },
  { n: [0, -1, 0], r: [H, 0, 0] },
]

// ------------------------------------------------------------------ CubeSat faces

/** aluminium skin plate with two lightening cut-outs (XY plane, normal +Z) */
function skin(pb: PartBuilder, L: number, W: number) {
  const s = new THREE.Shape()
  s.moveTo(-L / 2, -W / 2)
  s.lineTo(L / 2, -W / 2)
  s.lineTo(L / 2, W / 2)
  s.lineTo(-L / 2, W / 2)
  s.closePath()
  const hole = (x0: number, x1: number) => {
    const h = new THREE.Path()
    const r = 0.006
    const y0 = -W / 2 + 0.012
    const y1 = W / 2 - 0.012
    h.moveTo(x0 + r, y0)
    h.lineTo(x1 - r, y0)
    h.quadraticCurveTo(x1, y0, x1, y0 + r)
    h.lineTo(x1, y1 - r)
    h.quadraticCurveTo(x1, y1, x1 - r, y1)
    h.lineTo(x0 + r, y1)
    h.quadraticCurveTo(x0, y1, x0, y1 - r)
    h.lineTo(x0, y0 + r)
    h.quadraticCurveTo(x0, y0, x0 + r, y0)
    return h
  }
  const n = Math.max(1, Math.round(L / 0.11))
  const seg = L / n
  for (let i = 0; i < n; i++) s.holes.push(hole(-L / 2 + i * seg + 0.012, -L / 2 + (i + 1) * seg - 0.012))
  pb.extrude(s, 0.0015, 'alu', [0, 0, -0.00075])
  if (pb.hi) {
    screwRow(pb, [-L / 2 + 0.005, W / 2 - 0.005, 0.0008], [L / 2 - 0.005, W / 2 - 0.005, 0.0008], 7)
    screwRow(pb, [-L / 2 + 0.005, -W / 2 + 0.005, 0.0008], [L / 2 - 0.005, -W / 2 + 0.005, 0.0008], 7)
  }
}

function cubesatFaces(pb: PartBuilder, ctx: PartCtx, cells: boolean[]) {
  const [L, w] = [ctx.bus.size[0], ctx.bus.size[1]]
  const PL = L - 0.014
  const PW = w - 0.017
  FACES.forEach((f, i) => {
    const off: V3 = [f.n[0] * (w / 2 + 0.0009), f.n[1] * (w / 2 + 0.0009), f.n[2] * (w / 2 + 0.0009)]
    const sb = pb.sub(cells[i] ? 'face_cells' : 'face_skin', off, f.r)
    if (cells[i]) {
      solarPanel(sb, PL, PW, 7, 2, 0.0016, { back: 'solarBack', margin: 0.003 })
      if (sb.hi) cornerScrews(sb, PL, PW, 0.0012, 0.003, 0.0011)
    } else skin(sb, PL, PW)
    tag(sb.root, f.n, f.n, 0.06)
  })
}

/** small burn-wire release (resistor board + nylon line + tie-down) */
function burnWire(pb: PartBuilder, p: V3, rot: V3 = [0, 0, 0]) {
  pb.at(p, rot, () => {
    pb.box(0.012, 0.008, 0.0016, 'pcbGreen', [0, 0, 0.0008])
    pb.box(0.003, 0.0016, 0.001, 'chip', [0, 0, 0.0021])
    pb.box(0.004, 0.004, 0.006, 'aluDark', [0.008, 0, 0.003])
    pb.rod([0.008, 0, 0.006], [-0.008, 0.002, 0.0025], 0.0004, 'nylon', 6)
  })
}

const cubesatBody = (ctx: PartCtx): PartResult => {
  const pb = new PartBuilder(ctx.detail, ctx.texScale, 'solar_body')
  cubesatFaces(pb, ctx, [true, true, true, true])
  return { main: pb.build(), extras: [], busFrame: true }
}

const cubesatDeploy = (ctx: PartCtx): PartResult => {
  const pb = new PartBuilder(ctx.detail, ctx.texScale, 'solar_deploy')
  cubesatFaces(pb, ctx, [true, false, false, false])
  const [L, w] = [ctx.bus.size[0], ctx.bus.size[1]]
  const PL = L - 0.014
  const PW = 0.09
  for (const s of [-1, 1]) {
    // hinge line on the +Z face long edge; wing extends along ±Y, cells facing +Z
    const wing = pb.sub('wing', [0, s * (w / 2 + 0.002), -(w / 2 + 0.003)])
    wing.root.quaternion.copy(basis([0, s, 0], [0, -0.16 * s, 1]))
    // in wing frame: span +X, length along Y (bus X)
    for (let k = 0; k < 2; k++) {
      wing.at([0.004 + PW / 2 + k * (PW + 0.004), 0, 0], [0, 0, H], () => {
        solarPanel(wing, PL, PW, 7, 2, 0.0018, { margin: 0.003 })
      })
      hinge(wing, [0.002 + k * (PW + 0.004), 0, 0], PL * 0.25, 0.0018, 'y')
      hinge(wing, [0.002 + k * (PW + 0.004), PL * 0.35, 0], PL * 0.12, 0.0018, 'y')
      hinge(wing, [0.002 + k * (PW + 0.004), -PL * 0.35, 0], PL * 0.12, 0.0018, 'y')
    }
    const nb = ctx.burnWire ? 2 : 1
    for (let b = 0; b < nb; b++) burnWire(wing, [2 * PW - 0.01, (b - (nb - 1) / 2) * 0.12, -0.003], [Math.PI, 0, 0])
    tag(wing.root, [0, s, 0], undefined, 0.05)
  }
  return { main: pb.build(), extras: [], busFrame: true }
}

const cubesatTrack = (ctx: PartCtx): PartResult => {
  const pb = new PartBuilder(ctx.detail, ctx.texScale, 'solar_track')
  cubesatFaces(pb, ctx, [true, true, false, false])
  const w = ctx.bus.size[1]
  const x0 = ctx.bus.size[0] / 2 - 0.07
  for (const s of [-1, 1]) {
    const root = pb.sub('wing', [x0, s * (w / 2 + 0.001), 0])
    root.root.quaternion.copy(basis([0, s, 0], [0, 0, 1]))
    // SADA motor (drive) on the face
    root.cylX(0.014, 0.014, 0.012, 'aluDark', [0.006, 0, 0])
    root.cylX(0.016, 0.016, 0.003, 'alu', [0.0015, 0, 0])
    root.cylX(0.004, 0.004, 0.03, 'steel', [0.025, 0, 0])
    if (root.hi) for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      root.cylX(0.0012, 0.0012, 0.002, 'screw', [0.0035, Math.cos(a) * 0.012, Math.sin(a) * 0.012], { seg: 6 })
    }
    const drive = root.sub('drive', [0.04, 0, 0], [0.45 * s, 0, 0])
    // yoke
    drive.box(0.008, 0.16, 0.004, 'aluDark', [0, 0, 0])
    drive.rod([-0.012, 0, 0], [0.004, 0.07, 0], 0.0025, 'cfrp')
    drive.rod([-0.012, 0, 0], [0.004, -0.07, 0], 0.0025, 'cfrp')
    const PW = 0.095
    const PL = 0.2
    for (let k = 0; k < 3; k++) {
      drive.at([0.008 + PW / 2 + k * (PW + 0.004), 0, 0], [0, 0, H], () => solarPanel(drive, PL, PW, 4, 2, 0.0018, { margin: 0.003 }))
      hinge(drive, [0.006 + k * (PW + 0.004), PL * 0.3, 0], PL * 0.18, 0.0018, 'y')
      hinge(drive, [0.006 + k * (PW + 0.004), -PL * 0.3, 0], PL * 0.18, 0.0018, 'y')
    }
    const nb = ctx.burnWire ? 2 : 1
    for (let b = 0; b < nb; b++) burnWire(drive, [3 * PW - 0.004, (b - (nb - 1) / 2) * 0.08, -0.003], [Math.PI, 0, 0])
    tag(root.root, [0, s, 0], undefined, 0.05)
  }
  return { main: pb.build(), extras: [], busFrame: true }
}

// ------------------------------------------------------------------ big bus wings

interface WingOpts {
  panels: number
  /** panel length along the span */
  pw: number
  /** panel width (across the span) */
  ph: number
  cell: number
  yoke: number
  drive: boolean
  tilt: number
  fan?: number
}

/** Wing in its own frame: span +X from the root at the bus face, cells facing +Z. */
function bigWing(pb: PartBuilder, o: WingOpts) {
  const s = o.ph
  // root bracket / SADA
  pb.box(s * 0.12, s * 0.22, s * 0.22, 'aluDark', [s * 0.06, 0, 0])
  if (o.drive) {
    pb.cylX(s * 0.1, s * 0.1, s * 0.12, 'alu', [s * 0.17, 0, 0])
    pb.cylX(s * 0.12, s * 0.12, s * 0.02, 'aluDark', [s * 0.12, 0, 0])
    pb.cylX(s * 0.04, s * 0.04, s * 0.2, 'steel', [s * 0.3, 0, 0])
  }
  const d = pb.sub('drive', [o.drive ? s * 0.38 : s * 0.12, 0, 0], [o.tilt, 0, 0])
  // yoke (V-truss) to the first panel
  const yl = o.yoke
  d.rod([0, 0, 0], [yl, o.ph * 0.42, 0], s * 0.012, 'cfrp')
  d.rod([0, 0, 0], [yl, -o.ph * 0.42, 0], s * 0.012, 'cfrp')
  d.rod([yl * 0.5, o.ph * 0.21, 0], [yl * 0.5, -o.ph * 0.21, 0], s * 0.008, 'cfrp')
  d.box(s * 0.03, o.ph * 0.9, s * 0.03, 'alu', [yl, 0, 0])
  if (o.fan) {
    const R = o.fan
    const cx = yl + R * 0.98
    d.at([cx, 0, 0], undefined, () => {
      const g = new THREE.CircleGeometry(R, 10)
      const uv = g.attributes.uv as THREE.BufferAttribute
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * ((2 * R) / o.cell), uv.getY(i) * ((2 * R) / o.cell))
      d.add(g, 'solar', [0, 0, 0.004])
      const b = new THREE.CircleGeometry(R, 10)
      d.add(b, 'solarBack', [0, 0, 0.002], [Math.PI, 0, 0])
      // radial spars + hub
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2
        d.rod([0, 0, 0.006], [Math.cos(a) * R, Math.sin(a) * R, 0.006], R * 0.008, 'cfrp', 8)
      }
      d.cylZ(R * 0.08, R * 0.08, R * 0.04, 'aluDark', [0, 0, 0])
      d.torus(R * 0.995, R * 0.004, 'alu', [0, 0, 0.004], [0, 0, 0], { seg: 10 })
    })
    return d
  }
  for (let k = 0; k < o.panels; k++) {
    const x = yl + s * 0.02 + o.pw / 2 + k * (o.pw + s * 0.03)
    d.at([x, 0, 0], undefined, () => {
      solarPanel(d, o.pw, o.ph, Math.round(o.pw / o.cell), Math.round(o.ph / (o.cell * 1.6)), s * 0.025, { margin: s * 0.03 })
    })
    if (k > 0 || true) {
      const hx = x - o.pw / 2 - s * 0.015
      hinge(d, [hx, o.ph * 0.3, 0], o.ph * 0.15, s * 0.02, 'y')
      hinge(d, [hx, -o.ph * 0.3, 0], o.ph * 0.15, s * 0.02, 'y')
    }
  }
  return d
}

function busWings(name: string, o: WingOpts) {
  return (ctx: PartCtx): PartResult => {
    const pb = new PartBuilder(ctx.detail, ctx.texScale, name)
    const [, , Z] = ctx.bus.size
    for (const s of [-1, 1]) {
      const w = pb.sub('wing', [0, 0, s * (Z / 2)])
      w.root.quaternion.copy(basis([0, 0, s], [0, 1, 0]))
      bigWing(w, { ...o, tilt: -o.tilt * s })
      tag(w.root, [0, 0, s], undefined, 0.5)
    }
    const g = pb.build()
    g.userData.mountDeck = 'power'
    return { main: g, extras: [], busFrame: true }
  }
}

/** Lunar fixed array: rigid panels body-mounted on ±Z and −X faces of the bus. */
const lunarFixed = (ctx: PartCtx): PartResult => {
  const pb = new PartBuilder(ctx.detail, ctx.texScale, 'solar_fixed')
  const [X, Y, Z] = ctx.bus.size
  const faces: { n: V3; q: THREE.Quaternion; w: number }[] = [
    { n: [0, 0, 1], q: basis([1, 0, 0], [0, 0, 1]), w: X },
    { n: [0, 0, -1], q: basis([-1, 0, 0], [0, 0, -1]), w: X },
  ]
  faces.forEach((f) => {
    const sb = pb.sub('face_cells', [f.n[0] * (X / 2 + 0.03), f.n[1], f.n[2] * (Z / 2 + 0.03)])
    sb.root.quaternion.copy(f.q)
    const h = Y * 0.62
    solarPanel(sb, f.w * 0.94, h, Math.round(f.w / 0.07), Math.round(h / 0.11), 0.02, { margin: 0.02 })
    // stand-off brackets
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) sb.box(0.03, 0.03, 0.03, 'alu', [sx * f.w * 0.4, sy * h * 0.4, -0.02])
    tag(sb.root, f.n, f.n, 0.25)
  })
  const g = pb.build()
  g.userData.mountDeck = 'upper'
  return { main: g, extras: [], busFrame: true }
}

export const SOLAR_PARTS: Record<string, Record<string, PartFactory>> = {
  earth: { body: cubesatBody, deploy: cubesatDeploy, track: cubesatTrack },
  lunar: {
    fixed: lunarFixed,
    wings: busWings('solar_wings', { panels: 3, pw: 0.62, ph: 0.75, cell: 0.07, yoke: 0.35, drive: false, tilt: 0.3 }),
    track: busWings('solar_track', { panels: 4, pw: 0.7, ph: 0.85, cell: 0.07, yoke: 0.4, drive: true, tilt: 0.6 }),
  },
  mars: {
    wings: busWings('solar_wings', { panels: 3, pw: 1.0, ph: 1.15, cell: 0.08, yoke: 0.5, drive: true, tilt: 0.45 }),
    large: busWings('solar_large', { panels: 5, pw: 1.05, ph: 1.3, cell: 0.08, yoke: 0.55, drive: true, tilt: 0.55 }),
    ultra: busWings('solar_ultra', { panels: 0, pw: 0, ph: 1.0, cell: 0.08, yoke: 0.45, drive: true, tilt: 0.55, fan: 2.1 }),
  },
}
