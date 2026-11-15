// Interactive 3D spacecraft view (screen 03 centre panel). Lazy chunk: three + R3F + drei.
// Usage: const SpacecraftView = lazy(() => import('../spacecraft3d/SpacecraftView')) — or use
// SpacecraftViewLazy from 'src/spacecraft3d' which adds Suspense, WebGL detection and fallback.
import { Component, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MutableRefObject, type ReactNode, type Ref } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { MISSIONS } from '../data/missions'
import type { CategoryId, Design, MissionId } from '../data/types'
import { buildSpacecraft, type BuiltSpacecraft } from './assemble'
import { createRig, getEnvironment } from './core/lighting'
import { rimMaterial } from './core/materials'
import { CATEGORY_LABEL, designKey, hasWebGL } from './meta'

export interface SpacecraftViewApi {
  zoomIn(): void
  zoomOut(): void
  fit(): void
  resetView(): void
  setAutoRotate(on: boolean): void
  toggleAutoRotate(): boolean
}

export interface SpacecraftViewProps {
  missionId: MissionId
  design: Design
  /** exploded (true) or assembled (false); animated */
  exploded?: boolean
  /** when given, a built-in `Exploded | Assembled` switch is shown (top-right) */
  onExplodedChange?: (exploded: boolean) => void
  /** click on a part / label → its builder tab */
  onSelectCategory?: (category: CategoryId) => void
  /** externally highlighted category (e.g. the open tab) */
  highlightCategory?: CategoryId | null
  showLabels?: boolean
  showDimensions?: boolean
  /** built-in glass toolbar (rotate / zoom out / zoom in / fit / reset view) */
  toolbar?: boolean
  /** axis gizmo bottom-left */
  showAxes?: boolean
  /** start with a slow auto-spin */
  autoRotate?: boolean
  /** label text overrides */
  labels?: Partial<Record<CategoryId, string>>
  detail?: 'high' | 'low'
  className?: string
  /** rendered when WebGL is unavailable or crashes */
  fallback?: ReactNode
  /** imperative API (for an external toolbar) */
  apiRef?: Ref<SpacecraftViewApi | null>
}

const FOV = 30
const MINT = '#79f2cf'

const reducedMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

function camDir(missionId: MissionId) {
  return missionId === 'earth' ? new THREE.Vector3(-0.42, 0.42, 1).normalize() : new THREE.Vector3(1, 0.5, 0.95).normalize()
}

/** distance so a sphere of radius r fits the viewport */
function fitDistance(r: number, aspect: number) {
  const v = (FOV / 2) * (Math.PI / 180)
  const h = Math.atan(Math.tan(v) * aspect)
  return r / Math.sin(Math.min(v, h)) * 1.02
}

/**
 * Earth (CubeSat): the box the craft will occupy once the explode animation has finished, so tall exploded layouts
 * (sun-tracking wings) are framed as a whole. Measured by briefly applying the target explode state.
 */
function targetBox(b: BuiltSpacecraft, exploded: boolean, shown: number) {
  const t = exploded ? 1 : 0
  b.setExplode(t)
  b.root.updateMatrixWorld(true)
  // visible meshes only: hidden helpers (inactive ghosts, rims) must not inflate the frame
  const box = new THREE.Box3()
  const part = new THREE.Box3()
  b.root.traverseVisible((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh || o.userData.isRim || o.parent?.userData.ghost) return
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox()
    box.union(part.copy(m.geometry.boundingBox!).applyMatrix4(m.matrixWorld))
  })
  b.setExplode(shown < 0 ? t : shown)
  b.root.updateMatrixWorld(true)
  if (box.isEmpty()) box.copy(b.bounds)
  return box
}

/**
 * Screen space kept free around the craft, in CSS px: the top label row needs ~54 px, the bottom label row plus the
 * toolbar ~110 px. The fit uses the sum; the view is then shifted up by half the difference.
 */
const LABEL_RESERVE = { top: 54, bottom: 110, v: 164, h: 48 }

/** world-space up vector of a camera looking along -dir with world up +Y */
function screenUp(dir: THREE.Vector3) {
  const f = dir.clone().negate()
  const right = new THREE.Vector3().crossVectors(f, new THREE.Vector3(0, 1, 0)).normalize()
  return new THREE.Vector3().crossVectors(right, f).normalize()
}

/**
 * Camera distance so every corner of `box` fits the frustum minus the label reserve (box fit, tighter than a
 * bounding sphere for long thin craft).
 */
function fitDistanceBox(box: THREE.Box3, center: THREE.Vector3, dir: THREE.Vector3, w: number, h: number) {
  const tanV = Math.tan(((FOV / 2) * Math.PI) / 180) * Math.max(0.35, (h - LABEL_RESERVE.v) / Math.max(1, h))
  const tanH = Math.tan(((FOV / 2) * Math.PI) / 180) * (w / Math.max(1, h)) * Math.max(0.35, (w - LABEL_RESERVE.h) / Math.max(1, w))
  const f = dir.clone().negate()
  const right = new THREE.Vector3().crossVectors(f, new THREE.Vector3(0, 1, 0)).normalize()
  const up = new THREE.Vector3().crossVectors(right, f).normalize()
  const q = new THREE.Vector3()
  let d = 0
  for (let i = 0; i < 8; i++) {
    q.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).sub(center)
    const depth = q.dot(dir)
    d = Math.max(d, depth + Math.abs(q.dot(right)) / tanH, depth + Math.abs(q.dot(up)) / tanV)
  }
  return d * 1.04
}

function focusSphere(b: BuiltSpacecraft, exploded: boolean) {
  const full = b.bounds.getBoundingSphere(new THREE.Sphere())
  if (b.missionId === 'earth') return new THREE.Sphere(full.center.clone(), full.radius * (exploded ? 1.12 : 0.92))
  const core = b.scale * 1.05
  return new THREE.Sphere(new THREE.Vector3(0, 0, 0), Math.max(core, full.radius * 0.5) * (exploded ? 1.15 : 1))
}

// ------------------------------------------------------------------ highlight overlays

function setHighlight(root: THREE.Object3D, cat: CategoryId | null) {
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh || o.userData.isRim) return
    const on = !!cat && o.userData.category === cat && !o.parent?.userData.ghost
    let rim = o.userData.rim as THREE.Mesh | undefined
    if (on && !rim) {
      rim = new THREE.Mesh(m.geometry, rimMaterial(MINT))
      rim.userData.isRim = true
      rim.raycast = () => {}
      rim.renderOrder = 5
      m.add(rim)
      o.userData.rim = rim
    }
    if (rim) rim.visible = on
  })
}

// ------------------------------------------------------------------ overlay refs

interface OverlayRefs {
  labels: Map<CategoryId, HTMLDivElement>
  leaders: Map<CategoryId, SVGLineElement>
  dots: Map<CategoryId, SVGCircleElement>
  dim: { line: SVGLineElement | null; t1: SVGLineElement | null; t2: SVGLineElement | null; text: HTMLDivElement | null }
  axes: { x: SVGLineElement | null; y: SVGLineElement | null; z: SVGLineElement | null; lx: SVGTextElement | null; ly: SVGTextElement | null; lz: SVGTextElement | null }
}

// ------------------------------------------------------------------ scene

interface SceneProps {
  missionId: MissionId
  design: Design
  exploded: boolean
  highlight: CategoryId | null
  detail: 'high' | 'low'
  spin: boolean
  overlay: OverlayRefs
  showLabels: boolean
  showDimensions: boolean
  onHover: (c: CategoryId | null) => void
  onSelect?: (c: CategoryId) => void
  apiImpl: MutableRefObject<Partial<SpacecraftViewApi>>
  onStats?: (s: BuiltSpacecraft['stats']) => void
}

function Scene(p: SceneProps) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  const invalidate = useThree((s) => s.invalidate)
  const controls = useRef<React.ComponentRef<typeof OrbitControls>>(null)
  const still = useMemo(reducedMotion, [])

  useEffect(() => {
    scene.environment = getEnvironment(gl)
    scene.environmentIntensity = 0.95
    invalidate()
  }, [gl, scene, invalidate])

  const rig = useMemo(() => createRig(true), [])

  // ---- build (memoised on the spacecraft-relevant design key)
  const key = designKey(p.design)
  const built = useMemo(
    () => buildSpacecraft(p.design, MISSIONS[p.missionId], { detail: p.detail }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [p.missionId, key, p.detail],
  )
  useEffect(() => () => built.dispose(), [built])
  const onStats = p.onStats
  useEffect(() => onStats?.(built.stats), [built, onStats])

  // ---- explode state
  const ex = useRef(p.exploded ? 1 : 0)
  const shownEx = useRef(-1)

  // ---- install fly-in animations
  const prev = useRef<{ mission: MissionId; design: Design } | null>(null)
  const fly = useRef<{ obj: THREE.Object3D; base: THREE.Vector3; dir: THREE.Vector3; t: number; scale: THREE.Vector3 }[]>([])
  useEffect(() => {
    const before = prev.current
    prev.current = { mission: p.missionId, design: p.design }
    fly.current = []
    if (!before || before.mission !== p.missionId || still) return
    const had = (slot: string, id: string) => {
      const d = before.design as unknown as Record<string, unknown>
      const v = d[slot]
      return Array.isArray(v) ? v.includes(id) : v === id
    }
    for (const part of built.parts) {
      if (had(part.slot, part.componentId)) continue
      for (const obj of part.objects) fly.current.push({ obj, base: obj.position.clone(), dir: part.dir.clone(), t: 0, scale: obj.scale.clone() })
    }
    invalidate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [built])

  // ---- camera fit
  const camAnim = useRef<{ fp: THREE.Vector3; tp: THREE.Vector3; ft: THREE.Vector3; tt: THREE.Vector3; t: number } | null>(null)
  const fitted = useRef(0)
  const fitTo = useCallback(
    (resetDir: boolean, animate: boolean, factor = 1) => {
      const ctl = controls.current
      const dir = resetDir || !ctl ? camDir(p.missionId) : camera.position.clone().sub(ctl.target).normalize()
      let s: THREE.Sphere
      let dist: number
      if (built.missionId === 'earth') {
        const box = targetBox(built, p.exploded, shownEx.current)
        s = box.getBoundingSphere(new THREE.Sphere())
        dist = fitDistanceBox(box, s.center, dir, size.width, size.height) * factor
        fitted.current = s.radius
        // look slightly below the centre so the craft sits between the top label row and the bottom row + toolbar
        const px = (LABEL_RESERVE.bottom - LABEL_RESERVE.top) / 2
        const worldPerPx = (2 * dist * Math.tan(((FOV / 2) * Math.PI) / 180)) / Math.max(1, size.height)
        s = new THREE.Sphere(s.center.clone().addScaledVector(screenUp(dir), -px * worldPerPx), s.radius)
      } else {
        s = focusSphere(built, p.exploded)
        dist = fitDistance(s.radius, size.width / Math.max(1, size.height)) * factor
      }
      const tp = s.center.clone().addScaledVector(dir, dist)
      if (ctl) {
        // zoom limits relative to the fitted view: close-ups stay readable, zooming out never loses the craft
        ctl.minDistance = Math.min(dist * 0.4, s.radius * 0.9)
        ctl.maxDistance = dist * 2.2
      }
      camera.near = s.radius * 0.02
      camera.far = s.radius * 60
      camera.updateProjectionMatrix()
      if (!animate || still || !ctl) {
        camera.position.copy(tp)
        ctl?.target.copy(s.center)
        camera.lookAt(s.center)
        ctl?.update()
        camAnim.current = null
      } else camAnim.current = { fp: camera.position.clone(), tp, ft: ctl.target.clone(), tt: s.center.clone(), t: 0 }
      invalidate()
    },
    [built, camera, size.width, size.height, p.missionId, p.exploded, still, invalidate],
  )
  const fittedMission = useRef<MissionId | null>(null)
  useEffect(() => {
    const first = fittedMission.current === null
    if (fittedMission.current !== p.missionId) {
      fitTo(true, !first)
      fittedMission.current = p.missionId
    } else if (built.missionId === 'earth' && fitted.current > 0) {
      // a part changed the craft's size (e.g. sun-tracking wings): re-frame, keeping the view direction
      const r = targetBox(built, p.exploded, shownEx.current).getBoundingSphere(new THREE.Sphere()).radius
      if (Math.abs(r - fitted.current) / fitted.current > 0.06) fitTo(false, true)
    }
    const s = built.bounds.getBoundingSphere(new THREE.Sphere())
    rig.fit(s.center, s.radius)
    invalidate()
  }, [built, p.missionId, fitTo, rig, invalidate])

  // re-frame (keeping the view direction) when switching exploded / assembled
  const lastEx = useRef(p.exploded)
  useEffect(() => {
    if (lastEx.current === p.exploded) return
    lastEx.current = p.exploded
    fitTo(false, true)
  }, [p.exploded, fitTo])

  const zoom = useCallback(
    (k: number) => {
      const ctl = controls.current
      if (!ctl) return
      const off = camera.position.clone().sub(ctl.target)
      const len = THREE.MathUtils.clamp(off.length() * k, ctl.minDistance, ctl.maxDistance)
      camAnim.current = { fp: camera.position.clone(), tp: ctl.target.clone().addScaledVector(off.normalize(), len), ft: ctl.target.clone(), tt: ctl.target.clone(), t: 0 }
      invalidate()
    },
    [camera, invalidate],
  )
  useEffect(() => {
    p.apiImpl.current.zoomIn = () => zoom(0.78)
    p.apiImpl.current.zoomOut = () => zoom(1.28)
    p.apiImpl.current.fit = () => fitTo(false, true)
    p.apiImpl.current.resetView = () => fitTo(true, true)
  }, [zoom, fitTo, p.apiImpl])

  // ---- highlight
  useEffect(() => {
    setHighlight(built.root, p.highlight)
    invalidate()
  }, [built, p.highlight, invalidate])

  useEffect(() => invalidate(), [p.exploded, p.spin, p.showLabels, p.showDimensions, invalidate])

  // ---- per frame
  const tmp = useMemo(
    () => ({ v: new THREE.Vector3(), n: new THREE.Vector3(), q: new THREE.Quaternion(), q2: new THREE.Quaternion(), c: new THREE.Vector3(), w: new THREE.Vector3(), corners: Array.from({ length: 8 }, () => new THREE.Vector3()) }),
    [],
  )
  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    let busy = false

    // explode
    const target = p.exploded ? 1 : 0
    if (still) ex.current = target
    else ex.current += (target - ex.current) * (1 - Math.exp(-dt * 5.5))
    if (Math.abs(target - ex.current) < 0.001) ex.current = target
    else busy = true
    const e = ex.current * ex.current * (3 - 2 * ex.current)
    if (e !== shownEx.current) {
      built.setExplode(e)
      shownEx.current = e
    }

    // fly-in of newly installed parts
    if (fly.current.length) {
      busy = true
      fly.current = fly.current.filter((f) => {
        f.t = Math.min(1, f.t + dt / 0.75)
        const k = 1 - Math.pow(1 - f.t, 3)
        f.obj.position.copy(f.base).addScaledVector(f.dir, (1 - k) * built.scale * 0.8)
        f.obj.scale.copy(f.scale).multiplyScalar(0.55 + 0.45 * k)
        return f.t < 1
      })
    }

    // camera animation
    const ca = camAnim.current
    const ctl = controls.current
    if (ca && ctl) {
      ca.t = Math.min(1, ca.t + dt / 0.6)
      const k = ca.t * ca.t * (3 - 2 * ca.t)
      camera.position.lerpVectors(ca.fp, ca.tp, k)
      ctl.target.lerpVectors(ca.ft, ca.tt, k)
      ctl.update()
      busy = true
      if (ca.t >= 1) camAnim.current = null
    }
    if (p.spin && !still) busy = true

    // x-ray: panels facing the camera fade while exploded
    const camPos = state.camera.position
    for (const o of built.xray) {
      const n = o.userData.xray as [number, number, number]
      o.getWorldPosition(tmp.w)
      if (o.parent) o.parent.getWorldQuaternion(tmp.q2)
      else tmp.q2.identity()
      tmp.n.set(n[0], n[1], n[2]).applyQuaternion(tmp.q2)
      const facing = tmp.n.dot(tmp.v.copy(camPos).sub(tmp.w).normalize())
      const f = e * THREE.MathUtils.smoothstep(facing, 0.05, 0.45)
      const op = 1 - 0.86 * f
      o.traverse((c) => {
        const m = (c as THREE.Mesh).material as THREE.Material | undefined
        if (!m || c.userData.isRim) return
        const tr = op < 0.999
        if (m.transparent !== tr) {
          m.transparent = tr
          m.needsUpdate = true
        }
        m.opacity = op
        m.depthWrite = op > 0.6
        c.castShadow = op > 0.6
      })
    }

    if (busy) invalidate()
    updateOverlay(state.camera as THREE.PerspectiveCamera, state.size, e)
  })

  // ---- HTML/SVG overlay (labels, leader lines, dimension, axes)
  const updateOverlay = (cam: THREE.PerspectiveCamera, sz: { width: number; height: number }, e: number) => {
    const o = p.overlay
    const proj = (v: THREE.Vector3) => {
      tmp.v.copy(v).project(cam)
      return { x: (tmp.v.x * 0.5 + 0.5) * sz.width, y: (-tmp.v.y * 0.5 + 0.5) * sz.height, z: tmp.v.z }
    }
    // craft screen bbox (assembled bounds grown with explode)
    const b = built.bounds
    const grow = e * built.scale * 0.35
    let minY = Infinity
    let maxY = -Infinity
    for (let i = 0; i < 8; i++) {
      tmp.c.set(i & 1 ? b.max.x + grow : b.min.x - grow, i & 2 ? b.max.y + grow * 0.3 : b.min.y - grow * 0.3, i & 4 ? b.max.z : b.min.z)
      const s = proj(tmp.c)
      minY = Math.min(minY, s.y)
      maxY = Math.max(maxY, s.y)
    }
    const topRow = THREE.MathUtils.clamp(minY - 26, 22, sz.height * 0.42)
    const botRow = THREE.MathUtils.clamp(maxY + 26, sz.height * 0.58, sz.height - 70)

    if (p.showLabels) {
      const items: { c: CategoryId; x: number; y: number }[] = []
      for (const c of built.categories) {
        const a = built.anchors[c]
        if (!a) continue
        a.getWorldPosition(tmp.w)
        const s = proj(tmp.w)
        items.push({ c, x: s.x, y: s.y })
      }
      const place = (it: { c: CategoryId; x: number; y: number }, lx: number, ly: number, side: 'top' | 'bottom' | 'left' | 'right') => {
        const el = o.labels.get(it.c)
        if (!el) return
        const w = el.offsetWidth || 90
        const hgt = el.offsetHeight || 22
        el.style.transform = `translate(${(lx - w / 2).toFixed(1)}px, ${(ly - hgt / 2).toFixed(1)}px)`
        el.style.opacity = '1'
        const ln = o.leaders.get(it.c)
        const dot = o.dots.get(it.c)
        if (ln) {
          const ex2 = side === 'left' ? lx + w / 2 : side === 'right' ? lx - w / 2 : lx
          const ey2 = side === 'top' ? ly + hgt / 2 : side === 'bottom' ? ly - hgt / 2 : ly
          ln.setAttribute('x1', it.x.toFixed(1))
          ln.setAttribute('y1', it.y.toFixed(1))
          ln.setAttribute('x2', ex2.toFixed(1))
          ln.setAttribute('y2', ey2.toFixed(1))
        }
        if (dot) {
          dot.setAttribute('cx', it.x.toFixed(1))
          dot.setAttribute('cy', it.y.toFixed(1))
        }
      }
      const width = (c: CategoryId) => o.labels.get(c)?.offsetWidth || 90
      if (built.missionId === 'earth') {
        items.sort((a, b2) => a.x - b2.x)
        const nTop = Math.ceil(items.length / 2)
        ;[items.slice(0, nTop), items.slice(nTop)].forEach((row, ri) => {
          let lastRight = -Infinity
          row.forEach((it) => {
            const w = width(it.c)
            let lx = THREE.MathUtils.clamp(it.x, w / 2 + 6, sz.width - w / 2 - 6)
            if (lx - w / 2 < lastRight + 8) lx = lastRight + 8 + w / 2
            lastRight = lx + w / 2
            place(it, lx, ri === 0 ? topRow : botRow, ri === 0 ? 'top' : 'bottom')
          })
        })
      } else {
        // columns left / right of the bus body
        const cb = built.core
        let cMinX = Infinity
        let cMaxX = -Infinity
        for (let i = 0; i < 8; i++) {
          tmp.c.set(i & 1 ? cb.max.x : cb.min.x, i & 2 ? cb.max.y : cb.min.y, i & 4 ? cb.max.z : cb.min.z)
          const s = proj(tmp.c)
          cMinX = Math.min(cMinX, s.x)
          cMaxX = Math.max(cMaxX, s.x)
        }
        items.sort((a, b2) => a.x - b2.x)
        const nLeft = Math.floor(items.length / 2)
        ;[items.slice(0, nLeft), items.slice(nLeft)].forEach((col, ci) => {
          col.sort((a, b2) => a.y - b2.y)
          let lastY = -Infinity
          col.forEach((it) => {
            const w = width(it.c)
            const gap = 46 + e * 30
            const lx = ci === 0 ? THREE.MathUtils.clamp(cMinX - gap - w / 2, w / 2 + 8, sz.width / 2 - w / 2) : THREE.MathUtils.clamp(cMaxX + gap + w / 2, sz.width / 2 + w / 2, sz.width - w / 2 - 8)
            let ly = THREE.MathUtils.clamp(it.y, 24, sz.height - 70)
            if (ly < lastY + 32) ly = lastY + 32
            lastY = ly
            place(it, lx, ly, ci === 0 ? 'left' : 'right')
          })
        })
      }
    }

    if (p.showDimensions && o.dim.line) {
      const dimOp = built.missionId === 'earth' ? 1 : 1 - e
      o.dim.line.parentElement?.setAttribute('opacity', dimOp.toFixed(2))
      if (o.dim.text) o.dim.text.style.opacity = dimOp.toFixed(2)
      const a = proj(tmp.c.copy(built.dimension.a))
      const bb = proj(tmp.c.copy(built.dimension.b))
      const off = built.missionId === 'earth' ? 34 + e * 30 : 30
      const ax = a.x
      const ay = a.y + off
      const bx = bb.x
      const by = bb.y + off
      o.dim.line.setAttribute('x1', ax.toFixed(1))
      o.dim.line.setAttribute('y1', ay.toFixed(1))
      o.dim.line.setAttribute('x2', bx.toFixed(1))
      o.dim.line.setAttribute('y2', by.toFixed(1))
      const dx = bx - ax
      const dy = by - ay
      const l = Math.hypot(dx, dy) || 1
      const nx = (-dy / l) * 6
      const ny = (dx / l) * 6
      o.dim.t1?.setAttribute('x1', (ax - nx).toFixed(1))
      o.dim.t1?.setAttribute('y1', (ay - ny).toFixed(1))
      o.dim.t1?.setAttribute('x2', (ax + nx).toFixed(1))
      o.dim.t1?.setAttribute('y2', (ay + ny).toFixed(1))
      o.dim.t2?.setAttribute('x1', (bx - nx).toFixed(1))
      o.dim.t2?.setAttribute('y1', (by - ny).toFixed(1))
      o.dim.t2?.setAttribute('x2', (bx + nx).toFixed(1))
      o.dim.t2?.setAttribute('y2', (by + ny).toFixed(1))
      if (o.dim.text) {
        if (o.dim.text.textContent !== built.dimension.label) o.dim.text.textContent = built.dimension.label
        const w = o.dim.text.offsetWidth || 60
        o.dim.text.style.transform = `translate(${((ax + bx) / 2 - w / 2).toFixed(1)}px, ${((ay + by) / 2 - 10).toFixed(1)}px)`
      }
    }

    // axis gizmo (engineering axes: x = X, y = −Z, z = Y)
    const ax = o.axes
    if (ax.x) {
      const qi = cam.quaternion.clone().invert()
      const put = (line: SVGLineElement | null, label: SVGTextElement | null, v: THREE.Vector3) => {
        v.applyQuaternion(qi)
        const x = 30 + v.x * 22
        const y = 40 - v.y * 22
        line?.setAttribute('x2', x.toFixed(1))
        line?.setAttribute('y2', y.toFixed(1))
        label?.setAttribute('x', (30 + v.x * 31).toFixed(1))
        label?.setAttribute('y', (44 - v.y * 31).toFixed(1))
      }
      put(ax.x, ax.lx, new THREE.Vector3(1, 0, 0))
      put(ax.y, ax.ly, new THREE.Vector3(0, 0, -1))
      put(ax.z, ax.lz, new THREE.Vector3(0, 1, 0))
    }
  }

  // ---- pointer
  const catOf = (e: ThreeEvent<PointerEvent | MouseEvent>) => {
    for (const h of e.intersections) {
      const c = h.object.userData.category as CategoryId | undefined
      if (c) return c
    }
    return null
  }

  return (
    <>
      <primitive object={rig.group} />
      <primitive
        object={built.root}
        onPointerMove={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation()
          const c = catOf(e)
          p.onHover(c)
          document.body.style.cursor = c && p.onSelect ? 'pointer' : ''
        }}
        onPointerOut={() => {
          p.onHover(null)
          document.body.style.cursor = ''
        }}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          if (e.delta > 4) return
          const c = catOf(e)
          if (c && p.onSelect) {
            e.stopPropagation()
            p.onSelect(c)
          }
        }}
      />
      <OrbitControls
        ref={controls}
        makeDefault
        enablePan={false}
        enableDamping
        dampingFactor={0.09}
        rotateSpeed={0.6}
        zoomSpeed={0.8}
        autoRotate={p.spin && !still}
        autoRotateSpeed={0.7}
        onStart={() => (camAnim.current = null)}
      />
    </>
  )
}

// ------------------------------------------------------------------ chrome (icons, toolbar)

const Icon = ({ d, size = 18 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
)
const ICONS = {
  rotate: 'M20 12a8 8 0 1 1-2.34-5.66M20 4v4.5h-4.5',
  zoomOut: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM20 20l-4.8-4.8M7.5 10.5h6',
  zoomIn: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM20 20l-4.8-4.8M7.5 10.5h6M10.5 7.5v6',
  fit: 'M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4',
  cube: 'M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zM12 12l8-4.5M12 12v9M12 12L4 7.5',
}

const glass: CSSProperties = {
  background: 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))',
  border: '1px solid rgba(190,240,230,0.18)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  boxShadow: '0 8px 24px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.06)',
}

// ------------------------------------------------------------------ WebGL guard

class GLBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(e: unknown) {
    console.warn('[spacecraft3d] view failed', e)
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

const defaultFallback = (
  <div className="flex h-full w-full items-center justify-center text-sm" style={{ color: 'rgba(220,240,236,0.6)' }}>
    3D view unavailable on this device
  </div>
)

// ------------------------------------------------------------------ component

export default function SpacecraftView(props: SpacecraftViewProps) {
  const {
    missionId,
    design,
    exploded = false,
    onExplodedChange,
    onSelectCategory,
    highlightCategory = null,
    showLabels = true,
    showDimensions = true,
    toolbar = true,
    showAxes = true,
    autoRotate = false,
    labels,
    detail = 'high',
    className,
    fallback = defaultFallback,
    apiRef,
  } = props
  const mission = MISSIONS[missionId]
  const wrap = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(true)
  const [failed, setFailed] = useState(() => !hasWebGL())
  const [hover, setHover] = useState<CategoryId | null>(null)
  const [spin, setSpin] = useState(autoRotate)
  const apiImpl = useRef<Partial<SpacecraftViewApi>>({})
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    const el = wrap.current
    let io: IntersectionObserver | undefined
    const onVis = () => setVisible(!document.hidden && (io ? lastIntersect : true))
    let lastIntersect = true
    if (el && 'IntersectionObserver' in window) {
      io = new IntersectionObserver((en) => {
        lastIntersect = en.some((x) => x.isIntersecting)
        setVisible(lastIntersect && !document.hidden)
      })
      io.observe(el)
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      mounted.current = false
      io?.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      document.body.style.cursor = ''
    }
  }, [])

  // imperative API
  const api: SpacecraftViewApi = useMemo(
    () => ({
      zoomIn: () => apiImpl.current.zoomIn?.(),
      zoomOut: () => apiImpl.current.zoomOut?.(),
      fit: () => apiImpl.current.fit?.(),
      resetView: () => apiImpl.current.resetView?.(),
      setAutoRotate: (on: boolean) => setSpin(on),
      toggleAutoRotate: () => {
        let next = false
        setSpin((s) => (next = !s))
        return next
      },
    }),
    [],
  )
  useEffect(() => {
    if (!apiRef) return
    if (typeof apiRef === 'function') {
      apiRef(api)
      return () => {
        apiRef(null)
      }
    }
    ;(apiRef as MutableRefObject<SpacecraftViewApi | null>).current = api
    return () => {
      ;(apiRef as MutableRefObject<SpacecraftViewApi | null>).current = null
    }
  }, [api, apiRef])

  // overlay element registry
  const [overlay] = useState<OverlayRefs>(() => ({
    labels: new Map(),
    leaders: new Map(),
    dots: new Map(),
    dim: { line: null, t1: null, t2: null, text: null },
    axes: { x: null, y: null, z: null, lx: null, ly: null, lz: null },
  }))

  const highlight = hover ?? highlightCategory
  const cats = mission.categories.map((c) => c.id)

  if (failed) return <div className={`relative h-full w-full ${className ?? ''}`}>{fallback}</div>

  return (
    <div ref={wrap} className={`relative h-full w-full overflow-hidden select-none ${className ?? ''}`} style={{ touchAction: 'none' }}>
      <GLBoundary fallback={fallback}>
        <Canvas
          className="absolute inset-0"
          frameloop={visible ? 'demand' : 'never'}
          shadows="soft"
          dpr={[1, 2]}
          resize={{ offsetSize: true }}
          camera={{ fov: FOV, near: 0.005, far: 100, position: [-0.25, 0.25, 0.6] }}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          onCreated={({ gl }) => {
            gl.setClearColor(0x000000, 0)
            gl.toneMapping = THREE.ACESFilmicToneMapping
            gl.toneMappingExposure = 1.2
            gl.domElement.addEventListener(
              'webglcontextlost',
              (e) => {
                e.preventDefault()
                if (mounted.current && gl.domElement.isConnected) setFailed(true)
              },
              { once: true },
            )
          }}
          aria-label={`3D model of your ${mission.name} spacecraft. Drag to rotate, scroll to zoom.`}
        >
          <Scene
            missionId={missionId}
            design={design}
            exploded={exploded}
            highlight={highlight}
            detail={detail}
            spin={spin}
            overlay={overlay}
            showLabels={showLabels}
            showDimensions={showDimensions}
            onHover={setHover}
            onSelect={onSelectCategory}
            apiImpl={apiImpl}
          />
        </Canvas>
      </GLBoundary>

      {/* leader lines + dimension */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
        {showLabels &&
          cats.map((c) => (
            <g key={c} opacity={highlight && highlight !== c ? 0.35 : 1}>
              <line ref={(el) => void (el ? overlay.leaders.set(c, el) : overlay.leaders.delete(c))} stroke={highlight === c ? MINT : 'rgba(225,245,240,0.6)'} strokeWidth={1} />
              <circle ref={(el) => void (el ? overlay.dots.set(c, el) : overlay.dots.delete(c))} r={2.5} fill={highlight === c ? MINT : 'rgba(235,250,246,0.9)'} />
            </g>
          ))}
        {showDimensions && (
          <g stroke="rgba(225,245,240,0.55)" strokeWidth={1}>
            <line ref={(el) => void (overlay.dim.line = el)} />
            <line ref={(el) => void (overlay.dim.t1 = el)} />
            <line ref={(el) => void (overlay.dim.t2 = el)} />
          </g>
        )}
      </svg>
      {showDimensions && (
        <div
          ref={(el) => void (overlay.dim.text = el)}
          className="pointer-events-none absolute top-0 left-0 px-2 text-[12px] tracking-wide whitespace-nowrap"
          style={{ color: 'rgba(230,246,242,0.85)', background: 'rgba(8,26,30,0.55)', borderRadius: 6, fontVariantNumeric: 'tabular-nums' }}
        >
        </div>
      )}

      {/* labels */}
      {showLabels &&
        cats.map((c) => (
          <div
            key={c}
            ref={(el) => void (el ? overlay.labels.set(c, el) : overlay.labels.delete(c))}
            role={onSelectCategory ? 'button' : undefined}
            tabIndex={onSelectCategory ? 0 : undefined}
            onClick={() => onSelectCategory?.(c)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelectCategory?.(c)}
            onPointerEnter={() => setHover(c)}
            onPointerLeave={() => setHover(null)}
            className="absolute top-0 left-0 rounded-md px-2.5 py-[3px] text-[12.5px] leading-[18px] whitespace-nowrap transition-colors"
            style={{
              ...glass,
              opacity: 0,
              cursor: onSelectCategory ? 'pointer' : 'default',
              color: highlight === c ? MINT : 'rgba(236,250,246,0.94)',
              background: glass.background,
              borderColor: highlight === c ? 'rgba(121,242,207,0.75)' : 'rgba(190,240,230,0.28)',
              boxShadow: highlight === c ? '0 0 0 1px rgba(121,242,207,0.25), 0 0 14px rgba(121,242,207,0.18)' : undefined,
            }}
          >
            {labels?.[c] ?? CATEGORY_LABEL[c]}
          </div>
        ))}

      {/* axis gizmo */}
      {showAxes && (
        <svg className="pointer-events-none absolute bottom-3 left-3" width={64} height={72} aria-hidden>
          <g strokeWidth={1.4} strokeLinecap="round">
            <line ref={(el) => void (overlay.axes.x = el)} x1={30} y1={40} stroke="#8fe9ff" />
            <line ref={(el) => void (overlay.axes.y = el)} x1={30} y1={40} stroke="#8fe9ff" />
            <line ref={(el) => void (overlay.axes.z = el)} x1={30} y1={40} stroke="#8fe9ff" />
          </g>
          <g fontSize={11} fill="rgba(220,245,240,0.85)" textAnchor="middle">
            <text ref={(el) => void (overlay.axes.lx = el)}>x</text>
            <text ref={(el) => void (overlay.axes.ly = el)}>y</text>
            <text ref={(el) => void (overlay.axes.lz = el)}>z</text>
          </g>
        </svg>
      )}

      {/* exploded / assembled switch */}
      {onExplodedChange && (
        <div className="absolute top-3 right-3 flex rounded-xl p-1 text-[13px]" style={glass} role="group" aria-label="View mode">
          {([['Exploded', true], ['Assembled', false]] as const).map(([l, v]) => (
            <button
              key={l}
              type="button"
              aria-pressed={exploded === v}
              onClick={() => onExplodedChange(v)}
              className="rounded-lg px-3 py-1 transition-colors"
              style={exploded === v ? { background: MINT, color: '#062a22' } : { color: 'rgba(230,246,242,0.85)' }}
            >
              {l}
            </button>
          ))}
        </div>
      )}

      {/* toolbar */}
      {toolbar && (
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-xl px-2 py-1.5" style={glass} role="toolbar" aria-label="3D view controls">
          {(
            [
              ['rotate', spin ? 'Stop rotating' : 'Auto-rotate', () => setSpin((s) => !s), spin],
              ['zoomOut', 'Zoom out', api.zoomOut, false],
              ['zoomIn', 'Zoom in', api.zoomIn, false],
              ['fit', 'Fit to view', api.fit, false],
              ['cube', 'Reset view', api.resetView, false],
            ] as const
          ).map(([icon, label, fn, on], i) => (
            <span key={icon} className="flex items-center">
              {i === 1 && <span className="mx-1 h-5 w-px" style={{ background: 'rgba(200,240,232,0.2)' }} />}
              <button
                type="button"
                title={label}
                aria-label={label}
                aria-pressed={icon === 'rotate' ? on : undefined}
                onClick={fn}
                className="grid h-8 w-9 place-items-center rounded-lg transition-colors hover:bg-white/10"
                style={{ color: on ? MINT : 'rgba(230,246,242,0.88)' }}
              >
                <Icon d={ICONS[icon]} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
