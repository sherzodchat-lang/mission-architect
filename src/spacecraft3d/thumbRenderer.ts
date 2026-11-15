// ONE shared offscreen WebGLRenderer that renders single parts (3/4 view, transparent background)
// to cached data URLs for catalog cards. Lazy chunk (imports three) — loaded by Thumbnail.tsx.
import * as THREE from 'three'
import { MISSIONS } from '../data/missions'
import type { MissionId } from '../data/types'
import { PartBuilder, disposeObject } from './core/builder'
import { createRig, getEnvironment } from './core/lighting'
import { slotOf } from './meta'
import { partFactory, type BusSpec, type PartCtx } from './parts'

const BUS: Record<MissionId, BusSpec> = {
  earth: { kind: 'cubesat', size: [0.3405, 0.1, 0.1] },
  lunar: { kind: 'bus', size: [1.0, 1.18, 1.0] },
  mars: { kind: 'bus', size: [1.5, 1.74, 1.5] },
}

let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene | null = null
let rig: ReturnType<typeof createRig> | null = null
let failed = false

function ensure() {
  if (failed) return null
  if (renderer) return renderer
  try {
    const canvas = document.createElement('canvas')
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true })
    renderer.setClearColor(0x000000, 0)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.1
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault()
      renderer = null
      scene = null
      rig = null
    })
    scene = new THREE.Scene()
    scene.environment = getEnvironment(renderer)
    scene.environmentIntensity = 1
    rig = createRig(true)
    scene.add(rig.group)
    return renderer
  } catch {
    failed = true
    return null
  }
}

/** build a preview object for a component (main + extras arranged side by side) */
function previewObject(missionId: MissionId, componentId: string) {
  const slot = slotOf(missionId, componentId)
  if (!slot) return null
  const f = partFactory(missionId, slot, componentId)
  if (!f) return null
  const ctx: PartCtx = { missionId, detail: 'high', texScale: missionId === 'earth' ? 1 : 4, preview: true, bus: BUS[missionId], burnWire: false }
  const r = f(ctx)
  const root = new THREE.Group()
  if (r.busFrame) {
    // solar arrays: show around a simple body so the layout reads
    const pb = new PartBuilder('low', ctx.texScale, 'body')
    const [x, y, z] = BUS[missionId].size
    if (missionId === 'earth') pb.box(x, y * 0.98, z * 0.98, 'aluDark')
    else pb.box(x, y * 0.45, z, 'mliGold')
    root.add(pb.build(), r.main)
    return { root, slot }
  }
  // main part: instruments keep boresight toward the camera; boxes stand up (+Z → +Y)
  if (slot !== 'instruments') r.main.rotation.x = -Math.PI / 2
  root.add(r.main)
  const box = new THREE.Box3().setFromObject(r.main)
  let x = box.max.x
  r.extras.forEach((e) => {
    const holder = new THREE.Group()
    holder.add(e.object)
    // antennas look up-and-forward
    holder.rotation.x = -Math.PI / 2 + 0.5
    const eb = new THREE.Box3().setFromObject(holder)
    const gap = (box.max.y - box.min.y) * 0.15 + 0.01
    holder.position.x = x + gap - eb.min.x
    holder.position.y = box.min.y - eb.min.y
    root.add(holder)
    x = holder.position.x + eb.max.x
  })
  return { root, slot }
}

const cache = new Map<string, string>()
const pending = new Map<string, Promise<string | null>>()
let chain: Promise<unknown> = Promise.resolve()

const nextFrame = () =>
  new Promise<void>((res) => {
    if (typeof requestIdleCallback === 'function') requestIdleCallback(() => res(), { timeout: 120 })
    else requestAnimationFrame(() => res())
  })

function renderNow(missionId: MissionId, componentId: string, size: number): string | null {
  const r = ensure()
  if (!r || !scene || !rig) return null
  const built = previewObject(missionId, componentId)
  if (!built) return null
  const { root, slot } = built
  scene.add(root)
  root.updateMatrixWorld(true)
  const sphere = new THREE.Box3().setFromObject(root).getBoundingSphere(new THREE.Sphere())
  rig.fit(sphere.center, sphere.radius)
  const dir = slot === 'instruments' ? new THREE.Vector3(0.75, 0.55, 1.1) : new THREE.Vector3(0.9, 0.85, 1.1)
  if (slot === 'solar') dir.set(0.55, 0.9, 1)
  if (slot === 'propulsion') dir.set(0.9, 0.12, 1.1)
  dir.normalize()
  const fov = 26
  const cam = new THREE.PerspectiveCamera(fov, 1, sphere.radius * 0.05, sphere.radius * 40)
  const dist = (sphere.radius / Math.sin((fov / 2) * (Math.PI / 180))) * (slot === 'solar' && missionId !== 'earth' ? 0.62 : 0.92)
  cam.position.copy(sphere.center).addScaledVector(dir, dist)
  cam.lookAt(sphere.center)
  const px = Math.round(size * Math.min(2, window.devicePixelRatio || 1))
  r.setPixelRatio(1)
  r.setSize(px, px, false)
  r.render(scene, cam)
  const url = r.domElement.toDataURL('image/png')
  scene.remove(root)
  disposeObject(root)
  return url
}

/** Render (or fetch from cache) a component thumbnail. Renders are queued one per idle frame. */
export function getThumbnail(missionId: MissionId, componentId: string, size = 128): Promise<string | null> {
  const key = `${missionId}:${componentId}:${size}`
  const hit = cache.get(key)
  if (hit) return Promise.resolve(hit)
  const p0 = pending.get(key)
  if (p0) return p0
  const p = (chain = chain.then(async () => {
    await nextFrame()
    try {
      const url = renderNow(missionId, componentId, size)
      if (url) cache.set(key, url)
      return url
    } catch (e) {
      console.warn('[spacecraft3d] thumbnail failed', componentId, e)
      return null
    } finally {
      pending.delete(key)
    }
  })) as Promise<string | null>
  pending.set(key, p)
  return p
}

export function peekThumbnail(missionId: MissionId, componentId: string, size = 128) {
  return cache.get(`${missionId}:${componentId}:${size}`) ?? null
}

/** Pre-render every component of a mission (e.g. while the player reads the brief). */
export function prewarm(missionId: MissionId, size = 128) {
  const cat = MISSIONS[missionId].catalog
  Object.values(cat).flat().forEach((c) => void getThumbnail(missionId, c.id, size))
}
