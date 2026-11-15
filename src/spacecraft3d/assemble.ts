// buildSpacecraft(design, mission, opts): assembles a detailed procedural spacecraft from the
// player's components. Earth = 3U CubeSat (long axis X, payload looking −X). Lunar / Mars = box
// bus (up +Y, engine −Y, payload on +X, wings ±Z). Supports an explode factor, label anchors per
// category and ghost placeholders for empty slots.
import * as THREE from 'three'
import type { CategoryId, Design, Mission, SlotKey } from '../data/types'
import { PartBuilder, disposeObject, triangleCount, type Detail, type V3 } from './core/builder'
import { ghostMaterials } from './core/materials'
import { harness, pcb, screwRow, standoffs } from './parts/common'
import { partFactory, type BusSpec, type Extra, type PartCtx, type PartResult } from './parts'

const H = Math.PI / 2

export interface BuildOptions {
  detail?: Detail
  /** wireframe placeholders for empty slots (default true) */
  ghosts?: boolean
}

export interface PlacedPart {
  category: CategoryId
  slot: SlotKey
  componentId: string
  /** the placed group(s) (main + extras) — animate these for install effects */
  objects: THREE.Object3D[]
  /** outward direction used for fly-in animation (root space) */
  dir: THREE.Vector3
}

export interface BuiltSpacecraft {
  root: THREE.Group
  missionId: Mission['id']
  /** categories of this mission in tab order */
  categories: CategoryId[]
  /** label anchor per category (moves with explode) */
  anchors: Partial<Record<CategoryId, THREE.Object3D>>
  parts: PlacedPart[]
  /** objects whose materials fade when they face the camera in exploded view */
  xray: THREE.Object3D[]
  setExplode(t: number): void
  /** assembled bounding box (root space) */
  bounds: THREE.Box3
  /** main body box (CubeSat frame / bus decks), root space */
  core: THREE.Box3
  /** dimension line in root space + label */
  dimension: { a: THREE.Vector3; b: THREE.Vector3; label: string }
  /** a rough characteristic size (m) */
  scale: number
  stats: { triangles: number; meshes: number }
  dispose(): void
}

interface Explodable {
  obj: THREE.Object3D
  base: THREE.Vector3
  vec: THREE.Vector3
}

// ------------------------------------------------------------------ helpers

function tagCategory(o: THREE.Object3D, c: CategoryId) {
  o.traverse((x) => (x.userData.category = c))
}

function ghostBox(w: number, h: number, d: number, p: V3, category: CategoryId) {
  const g = new THREE.Group()
  const gm = ghostMaterials()
  const geo = new THREE.BoxGeometry(w, h, d)
  const fill = new THREE.Mesh(geo, gm.fill)
  fill.userData.ownedGeometry = true
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), gm.line)
  edges.userData.ownedGeometry = true
  edges.raycast = () => {}
  g.add(fill, edges)
  g.position.set(...p)
  g.userData.ghost = true
  tagCategory(g, category)
  return g
}

/** uniformly scale an object so its bbox fits (never enlarges beyond maxGrow) */
function fitInto(o: THREE.Object3D, max: V3, maxGrow = 1) {
  const s = new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3())
  const k = Math.min(maxGrow, max[0] / Math.max(1e-6, s.x), max[1] / Math.max(1e-6, s.y), max[2] / Math.max(1e-6, s.z))
  o.scale.multiplyScalar(k)
  return k
}

// ---- template cache: factories run once per (mission, part, detail); placements get cheap clones
// that share geometry. Templates are evicted (and disposed) beyond MAX_TEMPLATES.
const MAX_TEMPLATES = 140
const templates = new Map<string, THREE.Object3D | PartResult>()

function shareClone<T extends THREE.Object3D>(o: T): T {
  const c = o.clone(true)
  c.traverse((x) => (x.userData.ownedGeometry = false))
  return c
}

function remember<T extends THREE.Object3D | PartResult>(key: string, v: T) {
  templates.set(key, v)
  while (templates.size > MAX_TEMPLATES) {
    const [k, old] = templates.entries().next().value as [string, THREE.Object3D | PartResult]
    templates.delete(k)
    if ((old as THREE.Object3D).isObject3D) disposeObject(old as THREE.Object3D)
    else {
      disposeObject((old as PartResult).main)
      ;(old as PartResult).extras.forEach((e) => disposeObject(e.object))
    }
  }
  return v
}

/** cached builder output (structure pieces) */
function cachedGroup(key: string, make: () => THREE.Group): THREE.Group {
  let t = templates.get(key) as THREE.Group | undefined
  if (!t) t = remember(key, make())
  else {
    templates.delete(key)
    templates.set(key, t)
  }
  return shareClone(t)
}

function buildPart(mission: Mission, slot: SlotKey, id: string, ctx: PartCtx): PartResult | null {
  const key = `${mission.id}|${slot}|${id}|${ctx.detail}|${ctx.burnWire ? 1 : 0}|${ctx.preview ? 1 : 0}`
  let t = templates.get(key) as PartResult | undefined
  if (!t) {
    const f = partFactory(mission.id, slot, id)
    if (!f) return null
    try {
      t = remember(key, f(ctx))
    } catch (e) {
      console.warn('[spacecraft3d] part failed', id, e)
      return null
    }
  }
  return { main: shareClone(t.main), extras: t.extras.map((e) => ({ object: shareClone(e.object), mount: e.mount })), busFrame: t.busFrame }
}

/** clone materials of x-ray objects so they can fade independently */
function prepareXray(o: THREE.Object3D) {
  o.traverse((c) => {
    const m = c as THREE.Mesh
    if (!m.isMesh) return
    const src = m.material as THREE.Material
    if (src.userData.owned) return
    const cl = src.clone()
    cl.userData = { owned: true }
    m.material = cl
  })
}

function anchorAt(parent: THREE.Object3D, target: THREE.Object3D | null, fallback: V3) {
  const a = new THREE.Object3D()
  a.name = 'anchor'
  if (target) {
    parent.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(target)
    if (!box.isEmpty()) {
      const c = box.getCenter(new THREE.Vector3())
      parent.worldToLocal(c)
      a.position.copy(c)
    } else a.position.set(...fallback)
  } else a.position.set(...fallback)
  parent.add(a)
  return a
}

// ------------------------------------------------------------------ main

export function buildSpacecraft(design: Design, mission: Mission, opts: BuildOptions = {}): BuiltSpacecraft {
  return mission.id === 'earth' ? buildCubeSat(design, mission, opts) : buildBus(design, mission, opts)
}

function finish(
  root: THREE.Group,
  mission: Mission,
  anchors: Partial<Record<CategoryId, THREE.Object3D>>,
  parts: PlacedPart[],
  explodables: Explodable[],
  dimension: BuiltSpacecraft['dimension'],
  scale: number,
  core: THREE.Box3,
): BuiltSpacecraft {
  root.updateMatrixWorld(true)
  const bounds = new THREE.Box3().setFromObject(root)
  const xray: THREE.Object3D[] = []
  root.traverse((o) => {
    if (o.userData.xray) {
      prepareXray(o)
      xray.push(o)
    }
    // solar wings / faces tagged by part factories
    if (o.userData.explodeDir && !explodables.some((e) => e.obj === o)) {
      const d = o.userData.explodeDir as V3
      explodables.push({ obj: o, base: o.position.clone(), vec: new THREE.Vector3(...d).multiplyScalar(o.userData.explodeAmount ?? scale * 0.2) })
    }
  })
  let meshes = 0
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) meshes++
  })
  let cur = 0
  return {
    root,
    missionId: mission.id,
    categories: mission.categories.map((c) => c.id),
    anchors,
    parts,
    xray,
    bounds,
    core,
    dimension,
    scale,
    stats: { triangles: triangleCount(root), meshes },
    setExplode(t: number) {
      if (t === cur) return
      cur = t
      for (const e of explodables) e.obj.position.copy(e.base).addScaledVector(e.vec, t)
    },
    dispose() {
      disposeObject(root)
    },
  }
}

// ================================================================== CubeSat (Earth, 3U)

const CS = { L: 0.3405, W: 0.1 }
const CS_MODULES: { cat: CategoryId; len: number }[] = [
  { cat: 'instruments', len: 0.125 },
  { cat: 'computer', len: 0.048 },
  { cat: 'comms', len: 0.048 },
  { cat: 'attitude', len: 0.0585 },
  { cat: 'power', len: 0.061 },
]

function cubesatFrameSegment(pb: PartBuilder, len: number, first: boolean, last: boolean) {
  const w = CS.W / 2
  const t = 0.0016
  const fl = 0.0085
  for (const sy of [-1, 1])
    for (const sz of [-1, 1]) {
      pb.box(len, t, fl, 'alu', [0, sy * (w - t / 2), sz * (w - fl / 2)])
      pb.box(len, fl, t, 'alu', [0, sy * (w - fl / 2), sz * (w - t / 2)])
      if (pb.hi) {
        const n = Math.max(2, Math.round(len / 0.03))
        screwRow(pb, [-len / 2 + 0.006, sy * w, sz * (w - fl / 2)], [len / 2 - 0.006, sy * w, sz * (w - fl / 2)], n, [sy > 0 ? -H : H, 0, 0], 0.0011)
        screwRow(pb, [-len / 2 + 0.006, sy * (w - fl / 2), sz * w], [len / 2 - 0.006, sy * (w - fl / 2), sz * w], n, [sz > 0 ? 0 : Math.PI, 0, 0], 0.0011)
      }
    }
  // rib rings at both ends of the segment
  const rib = (x: number) => {
    const b = 0.004
    for (const s of [-1, 1]) {
      pb.box(0.003, CS.W - 0.004, b, 'alu', [x, 0, s * (w - 0.0035)])
      pb.box(0.003, b, CS.W - 0.004, 'alu', [x, s * (w - 0.0035), 0])
    }
  }
  rib(-len / 2 + 0.0015)
  rib(len / 2 - 0.0015)
  // rail feet + separation springs at the ends of the stack
  const feet = (x: number, dir: number) => {
    for (const sy of [-1, 1])
      for (const sz of [-1, 1]) {
        pb.box(0.007, 0.0085, 0.0085, 'aluDark', [x + dir * 0.0035, sy * (w - 0.00425), sz * (w - 0.00425)])
        if (pb.hi && dir < 0 && sy > 0) pb.cylX(0.0018, 0.0018, 0.004, 'steel', [x + dir * 0.009, sy * (w - 0.00425), sz * (w - 0.00425)], { seg: 8 })
      }
  }
  if (first) {
    feet(-len / 2, -1)
    // open front frame (payload apertures look through it)
    const b = 0.007
    for (const s of [-1, 1]) {
      pb.box(0.002, CS.W - 0.01, b, 'alu', [-len / 2 - 0.001, 0, s * (w - b / 2 - 0.004)])
      pb.box(0.002, b, CS.W - 0.01, 'alu', [-len / 2 - 0.001, s * (w - b / 2 - 0.004), 0])
    }
  }
  if (last) {
    feet(len / 2, 1)
    // top plate with lightening holes
    const s = new THREE.Shape()
    const a = CS.W / 2 - 0.005
    s.moveTo(-a, -a)
    s.lineTo(a, -a)
    s.lineTo(a, a)
    s.lineTo(-a, a)
    s.closePath()
    const hole = new THREE.Path()
    hole.absarc(0, 0, 0.022, 0, Math.PI * 2, true)
    s.holes.push(hole)
    for (const [hx, hy] of [[-0.028, -0.028], [0.028, -0.028], [-0.028, 0.028], [0.028, 0.028]]) {
      const h = new THREE.Path()
      h.absarc(hx, hy, 0.008, 0, Math.PI * 2, true)
      s.holes.push(h)
    }
    pb.extrude(s, 0.002, 'alu', [len / 2 - 0.002, 0, 0], [0, H, 0])
    if (pb.hi) {
      // kill-switch + RBF plunger hint
      pb.box(0.003, 0.008, 0.006, 'plasticBlack', [len / 2 + 0.0015, 0.04, -0.03])
    }
  }
}

function buildCubeSat(design: Design, mission: Mission, opts: BuildOptions): BuiltSpacecraft {
  const detail = opts.detail ?? 'high'
  const ghosts = opts.ghosts ?? true
  const bus: BusSpec = { kind: 'cubesat', size: [CS.L, CS.W, CS.W] }
  const ctx: PartCtx = { missionId: 'earth', detail, texScale: 1, preview: false, bus, burnWire: design.burnWire }
  const root = new THREE.Group()
  root.name = 'spacecraft'
  const anchors: Partial<Record<CategoryId, THREE.Object3D>> = {}
  const parts: PlacedPart[] = []
  const explodables: Explodable[] = []
  const inner = 0.084

  let x = -CS.L / 2
  const modules = new Map<CategoryId, { g: THREE.Group; x0: number; x1: number }>()
  CS_MODULES.forEach((m, i) => {
    const g = new THREE.Group()
    g.name = 'module_' + m.cat
    const cx = x + m.len / 2
    g.position.set(cx, 0, 0)
    g.add(
      cachedGroup(`cs-frame|${m.len}|${i}|${detail}`, () => {
        const fb = new PartBuilder(detail, 1, 'frame')
        cubesatFrameSegment(fb, m.len, i === 0, i === CS_MODULES.length - 1)
        return fb.build()
      }),
    )
    root.add(g)
    modules.set(m.cat, { g, x0: -m.len / 2, x1: m.len / 2 })
    explodables.push({ obj: g, base: g.position.clone(), vec: new THREE.Vector3(cx * 0.62 + (i - 2) * 0.012, 0, 0) })
    x += m.len
  })

  /** place an internal part (base z=0, footprint XY) in a module, rotated so +Z → +X */
  const placeInternal = (cat: CategoryId, slot: SlotKey, id: string | null) => {
    const mod = modules.get(cat)!
    if (!id) {
      if (ghosts) mod.g.add(ghostBox((mod.x1 - mod.x0) * 0.8, inner, inner, [0, 0, 0], cat))
      return null
    }
    const r = buildPart(mission, slot, id, ctx)
    if (!r) return null
    const holder = new THREE.Group()
    holder.add(r.main)
    r.main.rotation.set(0, -H, 0)
    fitInto(r.main, [(mod.x1 - mod.x0) - 0.004, 0.092, 0.092])
    holder.position.set(mod.x1 - 0.002, 0, 0)
    mod.g.add(holder)
    tagCategory(holder, cat)
    const objs: THREE.Object3D[] = [holder]
    r.extras.forEach((e) => objs.push(placeCubeSatExtra(e, cat, mod)))
    parts.push({ category: cat, slot, componentId: id, objects: objs, dir: new THREE.Vector3(0, 1, 0) })
    return holder
  }

  const placeCubeSatExtra = (e: Extra, cat: CategoryId, mod: { g: THREE.Group }) => {
    const h = new THREE.Group()
    h.add(e.object)
    if (e.mount === 'endDeck') {
      h.position.set(CS.L / 2 + 0.002, 0, 0)
      h.rotation.set(0, H, 0)
      root.add(h)
      h.userData.explodeDir = [1, 0, 0]
      h.userData.explodeAmount = 0.16
    } else {
      // sideFace: −Z long face at the module's position (outside the panels)
      const wp = new THREE.Vector3()
      mod.g.getWorldPosition(wp)
      h.position.set(wp.x, 0, -(CS.W / 2 + 0.0035))
      h.rotation.set(Math.PI, 0, 0)
      root.add(h)
      h.userData.explodeDir = [0, 0, -1]
      h.userData.explodeAmount = 0.1
      // follow the module along X when exploding
      const me = explodables.find((q) => q.obj === mod.g)
      if (me) {
        explodables.push({ obj: h, base: h.position.clone(), vec: new THREE.Vector3(me.vec.x, 0, -0.1) })
        h.userData.explodeDir = undefined
      }
    }
    tagCategory(h, cat)
    return h
  }

  // payload: up to 3 instruments in the bay, boresight −X
  {
    const mod = modules.get('instruments')!
    const ids = design.instruments.slice(0, 3)
    const len = mod.x1 - mod.x0 - 0.006
    // stacked vertically so every aperture is visible from the default 3/4 view
    const a = inner * 0.56
    const b = inner - a
    const cells: { y: number; z: number; w: number; h: number }[] =
      ids.length <= 1
        ? [{ y: 0, z: 0, w: inner, h: inner }]
        : ids.length === 2
          ? [{ y: inner / 2 - a / 2, z: 0, w: a, h: inner }, { y: -inner / 2 + b / 2, z: 0, w: b, h: inner }]
          : [{ y: inner / 2 - a / 2, z: 0, w: a, h: inner }, { y: -inner / 2 + b / 2, z: inner / 4, w: b, h: inner / 2 }, { y: -inner / 2 + b / 2, z: -inner / 4, w: b, h: inner / 2 }]
    if (!ids.length && ghosts) mod.g.add(ghostBox(len, inner, inner, [0, 0, 0], 'instruments'))
    const holders: THREE.Object3D[] = []
    ids.forEach((id, i) => {
      const r = buildPart(mission, 'instruments', id, ctx)
      if (!r) return
      const c = cells[i]
      const holder = new THREE.Group()
      holder.add(r.main)
      // boresight +Z → −X ; part local X → world Z? (rotation about Y by −90°: +X → +Z)
      r.main.rotation.set(0, -H, 0)
      fitInto(r.main, [len - 0.016, c.w, c.h])
      // apertures flush with the front (−X) end of the bay
      const depth = new THREE.Box3().setFromObject(r.main).getSize(new THREE.Vector3()).x
      holder.position.set(mod.x0 + 0.003 + depth, c.y, c.z)
      mod.g.add(holder)
      tagCategory(holder, 'instruments')
      holders.push(holder)
      parts.push({ category: 'instruments', slot: 'instruments', componentId: id, objects: [holder], dir: new THREE.Vector3(-1, 0, 0) })
    })
    // payload interface board behind the instruments
    if (ids.length) {
      const pb = new PartBuilder(detail, 1, 'payload_if')
      pb.at([mod.x1 - 0.012, 0, 0], [0, -H, 0], () => {
        standoffs(pb, 0.086, 0.086, 0, 0.008)
        pb.at([0, 0, 0.009], undefined, () => pcb(pb, 0.086, 0.086, { mask: 'green', seed: 61, chips: 6, header: true, leds: true }))
      })
      harness(pb, [[mod.x1 - 0.02, 0.03, 0.032], [mod.x0 + len * 0.6, 0.036, 0.034], [mod.x0 + len * 0.35, 0.02, 0.03]], 0.0012)
      const g = pb.build()
      tagCategory(g, 'instruments')
      mod.g.add(g)
    }
    anchors.instruments = anchorAt(mod.g, holders[0] ?? null, [0, 0, 0])
  }

  const comp = placeInternal('computer', 'computer', design.computer)
  anchors.computer = anchorAt(modules.get('computer')!.g, comp, [0, 0, 0])
  const radio = placeInternal('comms', 'radio', design.radio)
  anchors.comms = anchorAt(modules.get('comms')!.g, radio, [0, 0, 0])
  const att = placeInternal('attitude', 'attitude', design.attitude)
  anchors.attitude = anchorAt(modules.get('attitude')!.g, att, [0, 0, 0])
  const bat = placeInternal('power', 'battery', design.battery)
  anchors.power = anchorAt(modules.get('power')!.g, bat, [0, 0, 0])

  // solar arrays (bus frame)
  if (design.solar) {
    const r = buildPart(mission, 'solar', design.solar, ctx)
    if (r) {
      root.add(r.main)
      tagCategory(r.main, 'power')
      parts.push({ category: 'power', slot: 'solar', componentId: design.solar, objects: [r.main], dir: new THREE.Vector3(0, 0, 1) })
    }
  } else if (ghosts) {
    for (const s of [-1, 1]) root.add(ghostBox(CS.L * 0.9, 0.003, CS.W * 0.85, [0, s * (CS.W / 2 + 0.004), 0], 'power'))
    for (const s of [-1, 1]) root.add(ghostBox(CS.L * 0.9, CS.W * 0.85, 0.003, [0, 0, s * (CS.W / 2 + 0.004)], 'power'))
  }

  const dimension = {
    a: new THREE.Vector3(-CS.L / 2, -CS.W / 2, CS.W / 2 + 0.02),
    b: new THREE.Vector3(CS.L / 2, -CS.W / 2, CS.W / 2 + 0.02),
    label: '340 mm',
  }
  const core = new THREE.Box3(new THREE.Vector3(-CS.L / 2, -CS.W / 2, -CS.W / 2), new THREE.Vector3(CS.L / 2, CS.W / 2, CS.W / 2))
  return finish(root, mission, anchors, parts, explodables, dimension, CS.L, core)
}

// ================================================================== big bus (Lunar / Mars)

interface DeckSpec {
  cat: CategoryId
  h: number
}

const BUS: Record<'lunar' | 'mars', { X: number; Z: number; decks: DeckSpec[]; mli: 'mliGold' | 'mliSilver'; tex: number }> = {
  lunar: {
    X: 1.0,
    Z: 1.0,
    mli: 'mliGold',
    tex: 4,
    decks: [
      { cat: 'propulsion', h: 0.44 },
      { cat: 'power', h: 0.2 },
      { cat: 'attitude', h: 0.2 },
      { cat: 'computer', h: 0.18 },
      { cat: 'comms', h: 0.16 },
    ],
  },
  mars: {
    X: 1.5,
    Z: 1.5,
    mli: 'mliGold',
    tex: 5,
    decks: [
      { cat: 'propulsion', h: 0.68 },
      { cat: 'power', h: 0.3 },
      { cat: 'attitude', h: 0.28 },
      { cat: 'computer', h: 0.26 },
      { cat: 'comms', h: 0.22 },
    ],
  },
}

function deckStructure(pb: PartBuilder, X: number, Z: number, h: number, top: boolean, mli: 'mliGold' | 'mliSilver', cat: CategoryId) {
  const t = 0.02
  // honeycomb deck plate with edge closeouts
  pb.box(X - 0.01, t, Z - 0.01, 'deck', [0, t / 2, 0])
  pb.box(X, t * 0.4, Z, 'aluDark', [0, t * 0.2, 0])
  if (top) pb.box(X - 0.01, t, Z - 0.01, 'deck', [0, h - t / 2, 0])
  // corner posts
  const p = 0.04
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) pb.box(p, h, p, 'alu', [sx * (X / 2 - p / 2), h / 2, sz * (Z / 2 - p / 2)])
  if (pb.hi) {
    for (const sx of [-1, 1]) {
      screwRow(pb, [sx * (X / 2), 0.01, -Z / 2 + 0.05], [sx * (X / 2), 0.01, Z / 2 - 0.05], Math.round(Z / 0.08), [0, (sx * Math.PI) / 2, 0], 0.004)
    }
    // inserts along the deck edges
    for (const sz of [-1, 1]) screwRow(pb, [-X / 2 + 0.05, 0.01, sz * Z / 2], [X / 2 - 0.05, 0.01, sz * Z / 2], Math.round(X / 0.08), [sz > 0 ? 0 : Math.PI, 0, 0], 0.004)
  }
  void mli
  void cat
}

/** MLI blanket side panels for one deck: four panels, each an x-ray object */
function deckSkins(detail: Detail, tex: number, X: number, Z: number, h: number, mli: 'mliGold' | 'mliSilver', radiator: boolean) {
  const out: THREE.Group[] = []
  const faces: { n: V3; w: number; p: V3; r: V3 }[] = [
    { n: [1, 0, 0], w: Z, p: [X / 2 + 0.006, h / 2, 0], r: [0, H, 0] },
    { n: [-1, 0, 0], w: Z, p: [-X / 2 - 0.006, h / 2, 0], r: [0, -H, 0] },
    { n: [0, 0, 1], w: X, p: [0, h / 2, Z / 2 + 0.006], r: [0, 0, 0] },
    { n: [0, 0, -1], w: X, p: [0, h / 2, -Z / 2 - 0.006], r: [0, Math.PI, 0] },
  ]
  faces.forEach((f, i) => {
    const pb = new PartBuilder(detail, tex, 'skin')
    const isRad = radiator && i === 1
    pb.box(f.w, h - 0.004, 0.01, isRad ? 'whitePaint' : mli)
    if (pb.hi) {
      // blanket seams + velcro tape + vent grommets
      pb.box(f.w, 0.012, 0.004, isRad ? 'alu' : 'kapton', [0, h / 2 - 0.012, 0.006])
      pb.box(0.012, h - 0.03, 0.004, isRad ? 'alu' : 'kapton', [f.w * 0.18, 0, 0.006])
      if (!isRad) for (const gx of [-0.3, 0.3]) pb.cylZ(0.008, 0.008, 0.004, 'alu', [gx * f.w, -h * 0.25, 0.006], { seg: 10 })
      if (isRad) for (let k = 0; k < 6; k++) pb.box(f.w * 0.9, 0.004, 0.012, 'alu', [0, -h / 2 + 0.02 + k * (h - 0.04) / 5, 0.008])
    }
    const g = pb.build()
    g.position.set(...f.p)
    g.rotation.set(...f.r)
    g.userData.xray = f.n
    g.userData.explodeDir = f.n
    g.userData.explodeAmount = Math.max(X, Z) * 0.12
    out.push(g)
  })
  return out
}

function buildBus(design: Design, mission: Mission, opts: BuildOptions): BuiltSpacecraft {
  const detail = opts.detail ?? 'high'
  const ghosts = opts.ghosts ?? true
  const spec = BUS[mission.id as 'lunar' | 'mars']
  const { X, Z, decks, mli, tex } = spec
  const total = decks.reduce((a, d) => a + d.h, 0)
  const bus: BusSpec = { kind: 'bus', size: [X, total, Z] }
  const ctx: PartCtx = { missionId: mission.id, detail, texScale: tex, preview: false, bus, burnWire: false }
  const root = new THREE.Group()
  root.name = 'spacecraft'
  const anchors: Partial<Record<CategoryId, THREE.Object3D>> = {}
  const parts: PlacedPart[] = []
  const explodables: Explodable[] = []
  const S = Math.max(X, Z)

  // decks
  const deckMap = new Map<CategoryId, { g: THREE.Group; y0: number; h: number }>()
  let y = -total / 2
  decks.forEach((d, i) => {
    const g = new THREE.Group()
    g.name = 'deck_' + d.cat
    g.position.set(0, y, 0)
    g.add(
      cachedGroup(`deck|${mission.id}|${i}|${detail}`, () => {
        const pb = new PartBuilder(detail, tex, 'structure')
        deckStructure(pb, X, Z, d.h, i === decks.length - 1, mli, d.cat)
        return pb.build()
      }),
    )
    g.add(
      cachedGroup(`skins|${mission.id}|${i}|${detail}`, () => {
        const w = new THREE.Group()
        deckSkins(detail, tex, X, Z, d.h, mli, d.cat === 'computer').forEach((sk) => w.add(sk))
        return w
      }),
    )
    root.add(g)
    deckMap.set(d.cat, { g, y0: y, h: d.h })
    const cy = y + d.h / 2
    explodables.push({ obj: g, base: g.position.clone(), vec: new THREE.Vector3(0, cy * 0.75 + (i - 2) * S * 0.06, 0) })
    y += d.h
  })
  const top = total / 2
  const bottom = -total / 2

  const placeInternal = (cat: CategoryId, slot: SlotKey, id: string | null, offset: V3 = [0, 0, 0]) => {
    const deck = deckMap.get(cat)!
    if (!id) {
      if (ghosts) deck.g.add(ghostBox(X * 0.5, deck.h * 0.7, Z * 0.4, [offset[0], deck.h * 0.45, offset[2]], cat))
      return null
    }
    const r = buildPart(mission, slot, id, ctx)
    if (!r) return null
    const holder = new THREE.Group()
    holder.add(r.main)
    r.main.rotation.set(-H, 0, 0)
    fitInto(r.main, [(X - 0.12) * 0.8, deck.h - 0.03, (Z - 0.12) * 0.8], 1.8)
    holder.position.set(offset[0], 0.02, offset[2])
    deck.g.add(holder)
    tagCategory(holder, cat)
    const objs: THREE.Object3D[] = [holder]
    r.extras.forEach((e) => objs.push(...placeBusExtra(e, cat)))
    parts.push({ category: cat, slot, componentId: id, objects: objs, dir: new THREE.Vector3(0, 1, 0) })
    return holder
  }

  const placeBusExtra = (e: Extra, cat: CategoryId): THREE.Object3D[] => {
    const out: THREE.Object3D[] = []
    const put = (obj: THREE.Object3D, parent: THREE.Object3D, p: V3, dir: V3, explode: V3, amount: number) => {
      const h = new THREE.Group()
      h.add(obj)
      h.position.set(...p)
      h.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...dir).normalize())
      h.userData.explodeDir = explode
      h.userData.explodeAmount = amount
      parent.add(h)
      tagCategory(h, cat)
      out.push(h)
    }
    const commsDeck = deckMap.get('comms')!
    const attDeck = deckMap.get('attitude')!
    const propDeck = deckMap.get('propulsion')!
    switch (e.mount) {
      case 'top':
        put(e.object, commsDeck.g, [0, commsDeck.h, 0], [0, 1, 0], [0, 1, 0], S * 0.35)
        break
      case 'mast':
        put(e.object, commsDeck.g, [X * 0.28, commsDeck.h, -Z * 0.28], [0, 1, 0], [0, 1, 0], S * 0.3)
        break
      case 'boom':
        put(e.object, commsDeck.g, [-X / 2 - 0.01, commsDeck.h * 0.5, Z * 0.25], [-1, 0.35, 0], [-1, 0, 0], S * 0.35)
        break
      case 'lga': {
        put(e.object, commsDeck.g, [-X * 0.36, commsDeck.h, Z * 0.36], [0, 1, 0], [0, 1, 0], S * 0.3)
        put(e.object.clone(), propDeck.g, [-X * 0.36, 0, -Z * 0.36], [0, -1, 0], [0, -1, 0], S * 0.3)
        break
      }
      case 'corners':
        for (const sx of [-1, 1])
          for (const sz of [-1, 1]) put(sx === -1 && sz === -1 ? e.object : e.object.clone(), propDeck.g, [sx * (X / 2 + 0.01), 0.06, sz * (Z / 2 + 0.01)], [sx, 0, sz], [sx, 0, sz], S * 0.2)
        break
      case 'trackers':
        put(e.object, attDeck.g, [-X / 2 - 0.012, attDeck.h * 0.55, -Z * 0.3], [-1, 0.5, -0.3], [-1, 0, 0], S * 0.3)
        break
      default:
        put(e.object, commsDeck.g, [0, commsDeck.h, 0], [0, 1, 0], [0, 1, 0], S * 0.3)
    }
    return out
  }

  // internals
  const comp = placeInternal('computer', 'computer', design.computer)
  anchors.computer = anchorAt(deckMap.get('computer')!.g, comp, [0, deckMap.get('computer')!.h / 2, 0])
  const radio = placeInternal('comms', 'radio', design.radio)
  anchors.comms = anchorAt(deckMap.get('comms')!.g, radio, [0, deckMap.get('comms')!.h / 2, 0])
  const att = placeInternal('attitude', 'attitude', design.attitude)
  anchors.attitude = anchorAt(deckMap.get('attitude')!.g, att, [0, deckMap.get('attitude')!.h / 2, 0])
  const bat = placeInternal('power', 'battery', design.battery)
  anchors.power = anchorAt(deckMap.get('power')!.g, bat, [0, deckMap.get('power')!.h / 2, 0])

  // propulsion module (tanks inside the lowest deck, engine below)
  {
    const deck = deckMap.get('propulsion')!
    if (design.propulsion) {
      const r = buildPart(mission, 'propulsion', design.propulsion, ctx)
      if (r) {
        const holder = new THREE.Group()
        holder.add(r.main)
        r.main.rotation.set(-H, 0, 0)
        holder.position.set(0, 0.0, 0)
        deck.g.add(holder)
        tagCategory(holder, 'propulsion')
        parts.push({ category: 'propulsion', slot: 'propulsion', componentId: design.propulsion, objects: [holder], dir: new THREE.Vector3(0, -1, 0) })
        anchors.propulsion = anchorAt(deck.g, holder, [0, deck.h / 2, 0])
      }
    } else {
      if (ghosts) deck.g.add(ghostBox(X * 0.7, deck.h * 0.8, Z * 0.7, [0, deck.h * 0.45, 0], 'propulsion'))
      anchors.propulsion = anchorAt(deck.g, null, [0, deck.h / 2, 0])
    }
  }

  // payload on the +X face (boresight +X)
  {
    const ids = design.instruments.slice(0, 3)
    const pay = new THREE.Group()
    pay.name = 'payload'
    root.add(pay)
    const upperY0 = bottom + decks[0].h
    const cy = (upperY0 + top) / 2
    const availH = top - upperY0
    if (!ids.length && ghosts) pay.add(ghostBox(S * 0.3, availH * 0.7, Z * 0.7, [X / 2 + S * 0.15, cy, 0], 'instruments'))
    let first: THREE.Object3D | null = null
    ids.forEach((id, i) => {
      const r = buildPart(mission, 'instruments', id, ctx)
      if (!r) return
      const holder = new THREE.Group()
      holder.add(r.main)
      r.main.rotation.set(0, H, 0)
      const cellW = (Z * 1.05) / ids.length
      fitInto(r.main, [S * 1.2, availH * 0.95, Math.max(cellW, Z * 0.45)])
      const zz = ids.length === 1 ? 0 : -Z * 0.52 + cellW * (i + 0.5)
      holder.position.set(X / 2 + 0.012, cy + (i % 2 ? -availH * 0.08 : availH * 0.05), zz)
      pay.add(holder)
      tagCategory(holder, 'instruments')
      parts.push({ category: 'instruments', slot: 'instruments', componentId: id, objects: [holder], dir: new THREE.Vector3(1, 0, 0) })
      if (!first) first = holder
    })
    pay.userData.explodeDir = [1, 0, 0]
    pay.userData.explodeAmount = S * 0.45
    anchors.instruments = anchorAt(pay, first, [X / 2 + 0.1, cy, 0])
  }

  // solar arrays
  if (design.solar) {
    const r = buildPart(mission, 'solar', design.solar, ctx)
    if (r) {
      const deck = deckMap.get('power')!
      const holder = new THREE.Group()
      holder.add(r.main)
      const upper = r.main.userData.mountDeck === 'upper'
      holder.position.set(0, upper ? (bottom + decks[0].h + top) / 2 : deck.y0 + deck.h / 2, 0)
      root.add(holder)
      tagCategory(holder, 'power')
      parts.push({ category: 'power', slot: 'solar', componentId: design.solar, objects: [holder], dir: new THREE.Vector3(0, 0, 1) })
      // follow the power deck when exploding
      const de = explodables.find((q) => q.obj === deck.g)
      if (de && !upper) explodables.push({ obj: holder, base: holder.position.clone(), vec: de.vec.clone() })
    }
  } else if (ghosts) {
    const deck = deckMap.get('power')!
    for (const s of [-1, 1]) root.add(ghostBox(X * 0.8, 0.02, S * 1.6, [0, deck.y0 + deck.h / 2, s * (Z / 2 + S * 0.85)], 'power'))
  }

  // launch adapter ring at the bottom
  {
    const pb = new PartBuilder(detail, tex, 'adapter')
    const deck = deckMap.get('propulsion')!
    pb.cyl(S * 0.3, S * 0.3, 0.05, 'alu', [0, -0.025, 0], [0, 0, 0], { open: true, seg: pb.seg(48) })
    pb.torus(S * 0.3, 0.012, 'aluDark', [0, -0.05, 0], [H, 0, 0], { seg: pb.seg(48) })
    if (pb.hi) for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2
      pb.cylZ(0.006, 0.006, 0.01, 'screw', [Math.cos(a) * S * 0.3, -0.05, Math.sin(a) * S * 0.3], { seg: 6 })
    }
    deck.g.add(pb.build())
  }

  const dimension = {
    a: new THREE.Vector3(X / 2, bottom, Z / 2),
    b: new THREE.Vector3(X / 2, bottom, -Z / 2),
    label: `${X.toFixed(1)} m`,
  }
  const core = new THREE.Box3(new THREE.Vector3(-X / 2, bottom, -Z / 2), new THREE.Vector3(X / 2, top, Z / 2))
  return finish(root, mission, anchors, parts, explodables, dimension, S, core)
}
