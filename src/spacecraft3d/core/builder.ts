// PartBuilder: a tiny geometry DSL. Parts add primitives with a material and a local transform;
// build() merges everything that shares a material into ONE mesh (few draw calls, cheap shadows).
// Sub-builders become child groups that can move independently (wings, explode pieces, hinges).
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { TILE, mat, type MatKey } from './materials'

export type Detail = 'high' | 'low'
export type V3 = [number, number, number]
export type M = MatKey | THREE.Material

const _q = new THREE.Quaternion()
const _e = new THREE.Euler()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()

function local(p?: V3, r?: V3, s?: V3 | number) {
  _p.set(p?.[0] ?? 0, p?.[1] ?? 0, p?.[2] ?? 0)
  _q.setFromEuler(_e.set(r?.[0] ?? 0, r?.[1] ?? 0, r?.[2] ?? 0))
  if (typeof s === 'number') _s.setScalar(s)
  else _s.set(s?.[0] ?? 1, s?.[1] ?? 1, s?.[2] ?? 1)
  return new THREE.Matrix4().compose(_p, _q, _s)
}

/** Keep only position/normal/uv and make sure the geometry is indexed (mergeGeometries needs uniform sets). */
function normalize(g: THREE.BufferGeometry) {
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k)
  const n = g.attributes.position.count
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2))
  if (!g.attributes.normal) g.computeVertexNormals()
  if (!g.index) {
    const idx = new (n > 65535 ? Uint32Array : Uint16Array)(n)
    for (let i = 0; i < n; i++) idx[i] = i
    g.setIndex(new THREE.BufferAttribute(idx, 1))
  }
  g.clearGroups()
  return g
}

function scaleUV(g: THREE.BufferGeometry, su: number, sv: number) {
  const uv = g.attributes.uv as THREE.BufferAttribute
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv)
}

export interface CylOpts {
  seg?: number
  open?: boolean
  thetaStart?: number
  thetaLength?: number
  hseg?: number
  /** faces point inward (inside of tubes / baffles) */
  inside?: boolean
}

/** reverse winding + normals so the inside of a surface is visible */
export function flipGeo(g: THREE.BufferGeometry) {
  normalize(g)
  const idx = g.index!
  for (let i = 0; i < idx.count; i += 3) {
    const a = idx.getX(i + 1)
    idx.setX(i + 1, idx.getX(i + 2))
    idx.setX(i + 2, a)
  }
  const n = g.attributes.normal as THREE.BufferAttribute
  for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i))
  return g
}

export class PartBuilder {
  readonly root: THREE.Group
  readonly detail: Detail
  /** multiplies material tile sizes (bigger spacecraft → coarser texture tiling). */
  texScale: number
  private lists = new Map<THREE.Material, THREE.BufferGeometry[]>()
  private stack: THREE.Matrix4[] = [new THREE.Matrix4()]
  private kids: PartBuilder[] = []

  constructor(detail: Detail = 'high', texScale = 1, name = '') {
    this.detail = detail
    this.texScale = texScale
    this.root = new THREE.Group()
    this.root.name = name
  }

  get hi() {
    return this.detail === 'high'
  }

  /** radial segments for the current detail level */
  seg(n: number) {
    return this.hi ? n : Math.max(6, Math.round(n / 2))
  }

  private get cur() {
    return this.stack[this.stack.length - 1]
  }

  /** run fn with an extra transform pushed */
  at(p: V3 | undefined, r: V3 | undefined, fn: () => void, s?: V3 | number) {
    this.stack.push(this.cur.clone().multiply(local(p, r, s)))
    try {
      fn()
    } finally {
      this.stack.pop()
    }
    return this
  }

  /** run fn in a frame whose +Z points along dir (from p) */
  aim(p: V3, dir: V3, fn: () => void) {
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...dir).normalize())
    const e = new THREE.Euler().setFromQuaternion(q)
    return this.at(p, [e.x, e.y, e.z], fn)
  }

  /** add a geometry (consumed: the builder owns and transforms it). */
  add(geo: THREE.BufferGeometry, m: M, p?: V3, r?: V3, s?: V3 | number) {
    const material = typeof m === 'string' ? mat(m) : m
    normalize(geo)
    geo.applyMatrix4(this.cur.clone().multiply(local(p, r, s)))
    let l = this.lists.get(material)
    if (!l) this.lists.set(material, (l = []))
    l.push(geo)
    return this
  }

  private tile(m: M) {
    const k = typeof m === 'string' ? m : (m.name as MatKey)
    const t = TILE[k]
    return t ? t * this.texScale : 0
  }

  // ------------------------------------------------------------ primitives

  box(w: number, h: number, d: number, m: M, p?: V3, r?: V3) {
    const g = new THREE.BoxGeometry(w, h, d)
    const t = this.tile(m)
    if (t) {
      const uv = g.attributes.uv as THREE.BufferAttribute
      const dims: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]
      for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
        const k = f * 4 + i
        uv.setXY(k, uv.getX(k) * (dims[f][0] / t), uv.getY(k) * (dims[f][1] / t))
      }
    }
    return this.add(g, m, p, r)
  }

  /** rounded box (bevelled edges) – only in high detail, plain box otherwise */
  rbox(w: number, h: number, d: number, radius: number, m: M, p?: V3, r?: V3) {
    if (!this.hi || radius <= 0) return this.box(w, h, d, m, p, r)
    const rr = Math.min(radius, w / 2 - 1e-5, h / 2 - 1e-5, d / 2 - 1e-5)
    const shape = new THREE.Shape()
    const x0 = -w / 2 + rr
    const y0 = -h / 2 + rr
    shape.moveTo(-w / 2, y0)
    shape.lineTo(-w / 2, -y0)
    shape.quadraticCurveTo(-w / 2, h / 2, x0, h / 2)
    shape.lineTo(-x0, h / 2)
    shape.quadraticCurveTo(w / 2, h / 2, w / 2, -y0)
    shape.lineTo(w / 2, y0)
    shape.quadraticCurveTo(w / 2, -h / 2, -x0, -h / 2)
    shape.lineTo(x0, -h / 2)
    shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2, y0)
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: Math.max(1e-5, d - 2 * rr),
      bevelEnabled: true,
      bevelThickness: rr,
      bevelSize: 0,
      bevelSegments: 2,
      curveSegments: 3,
    })
    g.translate(0, 0, -(d - 2 * rr) / 2)
    const t = this.tile(m)
    if (t) scaleUV(g, 1 / t, 1 / t)
    return this.add(g, m, p, r)
  }

  /** cylinder along Y */
  cyl(rTop: number, rBot: number, h: number, m: M, p?: V3, r?: V3, o: CylOpts = {}) {
    const g = new THREE.CylinderGeometry(rTop, rBot, h, o.seg ?? this.seg(24), o.hseg ?? 1, o.open ?? false, o.thetaStart, o.thetaLength)
    const t = this.tile(m)
    if (t) scaleUV(g, (Math.PI * 2 * Math.max(rTop, rBot)) / t, h / t)
    if (o.inside) flipGeo(g)
    return this.add(g, m, p, r)
  }

  /** cylinder along Z (very common for lenses, wheels, nozzles) */
  cylZ(rTop: number, rBot: number, h: number, m: M, p?: V3, o: CylOpts = {}) {
    return this.cyl(rTop, rBot, h, m, p, [Math.PI / 2, 0, 0], o)
  }

  /** cylinder along X */
  cylX(rTop: number, rBot: number, h: number, m: M, p?: V3, o: CylOpts = {}) {
    return this.cyl(rTop, rBot, h, m, p, [0, 0, -Math.PI / 2], o)
  }

  sphere(r: number, m: M, p?: V3, rot?: V3, o: { seg?: number; phiStart?: number; phiLength?: number; thetaStart?: number; thetaLength?: number; scale?: V3 } = {}) {
    const sg = o.seg ?? this.seg(28)
    const g = new THREE.SphereGeometry(r, sg, Math.max(4, Math.round(sg * 0.6)), o.phiStart, o.phiLength, o.thetaStart, o.thetaLength)
    const t = this.tile(m)
    if (t) scaleUV(g, (Math.PI * 2 * r) / t, (Math.PI * r) / t)
    if (o.scale) g.scale(...o.scale)
    return this.add(g, m, p, rot)
  }

  torus(R: number, r: number, m: M, p?: V3, rot?: V3, o: { arc?: number; seg?: number; tube?: number } = {}) {
    const g = new THREE.TorusGeometry(R, r, o.tube ?? this.seg(8), o.seg ?? this.seg(32), o.arc ?? Math.PI * 2)
    const t = this.tile(m)
    if (t) scaleUV(g, (Math.PI * 2 * R) / t, (Math.PI * 2 * r) / t)
    return this.add(g, m, p, rot)
  }

  /** surface of revolution around Y from [radius, y] points */
  lathe(pts: [number, number][], m: M, p?: V3, rot?: V3, seg?: number) {
    const g = new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(Math.max(0, x), y)), seg ?? this.seg(36))
    const t = this.tile(m)
    if (t) {
      const maxR = Math.max(...pts.map((q) => q[0]))
      let len = 0
      for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
      scaleUV(g, (Math.PI * 2 * maxR) / t, len / t)
    }
    return this.add(g, m, p, rot)
  }

  /** tube along a smooth curve */
  tube(pts: V3[], radius: number, m: M, o: { seg?: number; radial?: number; closed?: boolean; tension?: number } = {}) {
    const curve = new THREE.CatmullRomCurve3(pts.map((q) => new THREE.Vector3(...q)), o.closed ?? false, 'catmullrom', o.tension ?? 0.5)
    const g = new THREE.TubeGeometry(curve, o.seg ?? (this.hi ? Math.max(8, pts.length * 6) : Math.max(4, pts.length * 2)), radius, o.radial ?? this.seg(8), o.closed ?? false)
    return this.add(g, m)
  }

  /** straight rod between two points */
  rod(a: V3, b: V3, radius: number, m: M, seg?: number) {
    const va = new THREE.Vector3(...a)
    const vb = new THREE.Vector3(...b)
    const len = va.distanceTo(vb)
    const g = new THREE.CylinderGeometry(radius, radius, len, seg ?? this.seg(10), 1, false)
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize())
    const mid = va.add(vb).multiplyScalar(0.5)
    g.applyQuaternion(q)
    g.translate(mid.x, mid.y, mid.z)
    return this.add(g, m)
  }

  /** extruded 2D shape (extrudes along +Z from z=0) */
  extrude(shape: THREE.Shape, depth: number, m: M, p?: V3, r?: V3, bevel = 0) {
    const g = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: bevel > 0 && this.hi,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 1,
      curveSegments: this.hi ? 12 : 6,
    })
    const t = this.tile(m)
    if (t) scaleUV(g, 1 / t, 1 / t)
    return this.add(g, m, p, r)
  }

  /** flat XY plane facing +Z; uv spans [0..ru]×[0..rv] */
  plane(w: number, h: number, m: M, p?: V3, r?: V3, ru = 1, rv = 1) {
    const g = new THREE.PlaneGeometry(w, h)
    scaleUV(g, ru, rv)
    return this.add(g, m, p, r)
  }

  /** flat disc facing +Z */
  disc(radius: number, m: M, p?: V3, r?: V3, seg?: number, inner = 0) {
    const g = inner > 0 ? new THREE.RingGeometry(inner, radius, seg ?? this.seg(32)) : new THREE.CircleGeometry(radius, seg ?? this.seg(32))
    return this.add(g, m, p, r)
  }

  /** child builder → becomes a child group (independent transform) */
  sub(name: string, p?: V3, r?: V3) {
    const c = new PartBuilder(this.detail, this.texScale, name)
    if (p) c.root.position.set(...p)
    if (r) c.root.rotation.set(...r)
    this.kids.push(c)
    return c
  }

  /** attach a ready object (sprite, light, line…) */
  attach(o: THREE.Object3D) {
    this.root.add(o)
    return this
  }

  /** merge per material, build children; returns root */
  build(): THREE.Group {
    for (const [material, list] of this.lists) {
      if (!list.length) continue
      const merged = list.length === 1 ? list[0] : mergeGeometries(list, false)
      if (!merged) {
        list.forEach((g) => this.addMesh(g, material))
        continue
      }
      if (merged !== list[0]) list.forEach((g) => g.dispose())
      this.addMesh(merged, material)
    }
    this.lists.clear()
    for (const k of this.kids) this.root.add(k.build())
    this.kids = []
    return this.root
  }

  private addMesh(g: THREE.BufferGeometry, material: THREE.Material) {
    g.computeBoundingSphere()
    g.computeBoundingBox()
    const mesh = new THREE.Mesh(g, material)
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.userData.ownedGeometry = true
    this.root.add(mesh)
  }
}

/** Dispose geometries owned by builders (and cloned per-instance materials). Shared materials stay. */
export function disposeObject(o: THREE.Object3D) {
  o.traverse((c) => {
    const m = c as THREE.Mesh
    if (m.isMesh || (c as THREE.LineSegments).isLineSegments) {
      if (c.userData.ownedGeometry) m.geometry.dispose()
      const mm = m.material
      const list = Array.isArray(mm) ? mm : [mm]
      list.forEach((x) => x?.userData?.owned && x.dispose())
    }
  })
}

/** Count triangles of an object tree (visible meshes only). */
export function triangleCount(o: THREE.Object3D) {
  let n = 0
  o.traverseVisible((c) => {
    const m = c as THREE.Mesh
    if (!m.isMesh) return
    const g = m.geometry
    n += (g.index ? g.index.count : g.attributes.position.count) / 3
  })
  return Math.round(n)
}
