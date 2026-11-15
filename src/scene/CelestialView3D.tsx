// Interactive cinematic 3D celestial view (lazy chunk: three + @react-three/fiber + drei).
// Real NASA / USGS imagery (planetTextures.ts, procedural fallback), physically-inspired shading
// (shaders.ts): day/night terminator, city lights, ocean glint, relief, cloud deck with shadows,
// single-scattering atmosphere shell; procedural star sky; thin glowing orbit ribbons; the player's
// procedural spacecraft (src/spacecraft3d, low detail); ground stations with a downlink beam;
// damped drag/zoom with a gentle idle drift; cruise transfer scenes.
import { use, useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, PerformanceMonitor } from '@react-three/drei'
import * as THREE from 'three'
import type { CelestialViewProps } from './CelestialView'
import {
  BODY_STYLES,
  BODY_YAW,
  CAM_DIR,
  REMOTE_EARTH,
  alongPath,
  bodyKindOf,
  chasePhase,
  clamp,
  cruiseScene,
  latLonToVec,
  lerpEl,
  lineOfSight,
  orbitPath,
  orbitPoint,
  orbitSpec,
  smooth,
  stationLatLon,
  yawToFace,
  type BodyKind,
  type CruiseScene,
  type OrbitEl,
  type Vec3,
} from './model'
import { planetSet, type PlanetSet } from './planetTextures'
import { ATMO_FRAG, ATMO_VERT, CLOUD_FRAG, GLARE_FRAG, GLARE_VERT, PLANET_FRAG, PLANET_VERT, SKY_FRAG, STAR_FRAG, STAR_VERT } from './shaders'
import { GlowLine, type GlowLineApi } from './GlowLine'
import { makeMilkyWay, makeStars } from './sky'
import { MISSIONS } from '../data/missions'
import type { Design, MissionId } from '../data/types'
import { useGameStore } from '../store/gameStore'
import { buildSpacecraft } from '../spacecraft3d/assemble'
import { getEnvironment } from '../spacecraft3d/core/lighting'
import { designKey, showcaseDesign } from '../spacecraft3d/meta'

const MINT = '#a3f0d4'
const ORBIT_COLOR = '#9fe9ff'
const AMBER = '#f4c069'
const FOV = 34
const ORBIT_SAMPLES = 256
const TRANSITION_S = 1.1
const EXPOSURE = 1.0
/** 3D key light: ~55° off the default view axis, upper left → a lit gibbous disc with a curved
 *  terminator on the right (the SVG fallback keeps model.SUN_DIR). */
const SUN_DIR: Vec3 = (() => {
  const v: Vec3 = [-0.62, 0.3, 0.74]
  const l = Math.hypot(...v)
  return [v[0] / l, v[1] / l, v[2] / l]
})()

type Props = CelestialViewProps & { onFail?: () => void }

const v3 = (v: Vec3) => new THREE.Vector3(v[0], v[1], v[2])
const reducedMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

// ---------------------------------------------------------------- body look

interface AtmoCfg {
  top: number
  hr: number
  hm: number
  tauR: Vec3
  tauM: Vec3
  scatM: Vec3
  g: number
  intensity: number
}
interface BodyCfg {
  bump: number
  sunI: number
  tint: Vec3
  atmo: AtmoCfg | null
}

const BODY: Record<BodyKind, BodyCfg> = {
  earth: {
    bump: 2.2,
    sunI: 2.9,
    tint: [1, 1, 1],
    atmo: { top: 1.055, hr: 0.0072, hm: 0.0018, tauR: [0.048, 0.112, 0.27], tauM: [0.012, 0.012, 0.012], scatM: [1, 1, 1], g: 0.8, intensity: 16 },
  },
  moon: { bump: 1.3, sunI: 2.5, tint: [1, 1, 1], atmo: null },
  mars: {
    bump: 2.6,
    sunI: 3.2,
    tint: [1, 1, 1],
    atmo: { top: 1.045, hr: 0.009, hm: 0.0075, tauR: [0.004, 0.007, 0.013], tauM: [0.03, 0.04, 0.055], scatM: [1, 0.56, 0.33], g: 0.62, intensity: 11 },
  },
}

// ---------------------------------------------------------------- shared sprites

function makeCanvasTexture(draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!, w, h)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function useDotTexture() {
  const t = useMemo(
    () =>
      makeCanvasTexture(
        (g, w) => {
          const grd = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2)
          grd.addColorStop(0, 'rgba(255,255,255,1)')
          grd.addColorStop(0.18, 'rgba(255,255,255,0.75)')
          grd.addColorStop(0.45, 'rgba(255,255,255,0.12)')
          grd.addColorStop(1, 'rgba(255,255,255,0)')
          g.fillStyle = grd
          g.fillRect(0, 0, w, w)
        },
        64,
        64,
      ),
    [],
  )
  useEffect(() => () => t.dispose(), [t])
  return t
}

// ---------------------------------------------------------------- planets

const geoCache = new Map<number, THREE.SphereGeometry>()
function sphereGeo(seg: number) {
  let g = geoCache.get(seg)
  if (!g) {
    g = new THREE.SphereGeometry(1, seg, seg / 2)
    geoCache.set(seg, g)
  }
  return g
}

interface PlanetProps {
  kind: BodyKind
  set: PlanetSet
  radius: number
  position?: Vec3
  sunDir: THREE.Vector3
  yawRef?: MutableRefObject<number>
  children?: ReactNode
  segments?: number
  still: boolean
}

function Planet({ kind, set, radius, position = [0, 0, 0], sunDir, yawRef, children, segments = 128, still }: PlanetProps) {
  const group = useRef<THREE.Group>(null)
  const spin = useRef<THREE.Group>(null)
  const cfg = BODY[kind]
  const a = cfg.atmo
  const mats = useMemo(() => {
    const common = {
      uTauR: { value: v3(a?.tauR ?? [0, 0, 0]) },
      uTauM: { value: v3(a?.tauM ?? [0, 0, 0]) },
      uHr: { value: a?.hr ?? 1 },
      uHm: { value: a?.hm ?? 1 },
    }
    const sun = { value: sunDir }
    const cloudU = { value: 0 }
    const surface = new THREE.ShaderMaterial({
      vertexShader: PLANET_VERT,
      fragmentShader: PLANET_FRAG,
      defines: { [`BODY_${kind.toUpperCase()}`]: '' },
      uniforms: {
        ...common,
        uColor: { value: set.color },
        uData: { value: set.data },
        uClouds: { value: set.clouds },
        uLights: { value: set.lights },
        uSun: sun,
        uSunI: { value: cfg.sunI },
        uBump: { value: cfg.bump },
        uCloudU: cloudU,
        uCloudH: { value: 0.0045 },
        uHasAtmo: { value: a ? 1 : 0 },
        uTint: { value: v3(cfg.tint) },
      },
    })
    const clouds =
      kind === 'earth'
        ? new THREE.ShaderMaterial({
            vertexShader: PLANET_VERT,
            fragmentShader: CLOUD_FRAG,
            uniforms: {
              ...common,
              uClouds: { value: set.clouds },
              uSun: sun,
              uSunI: { value: cfg.sunI },
              uCloudU: cloudU,
              uAlt: { value: 0.006 },
              uTexel: { value: new THREE.Vector2(1 / 2048, 1 / 1024) },
            },
            transparent: true,
            depthWrite: false,
          })
        : null
    const atmo = a
      ? new THREE.ShaderMaterial({
          vertexShader: ATMO_VERT,
          fragmentShader: ATMO_FRAG,
          uniforms: {
            ...common,
            uCenter: { value: new THREE.Vector3(...position) },
            uRadius: { value: radius },
            uTop: { value: a.top },
            uSun: sun,
            uSunI: { value: a.intensity },
            uScatM: { value: v3(a.scatM) },
            uG: { value: a.g },
          },
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      : null
    return { surface, clouds, atmo, cloudU }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, set, sunDir, radius])
  useEffect(
    () => () => {
      mats.surface.dispose()
      mats.clouds?.dispose()
      mats.atmo?.dispose()
    },
    [mats],
  )

  useFrame((_, dt) => {
    if (spin.current) spin.current.rotation.y = yawRef ? yawRef.current : BODY_YAW[kind]
    const u = mats.surface.uniforms
    u.uColor.value = set.color
    u.uData.value = set.data
    u.uClouds.value = set.clouds
    u.uLights.value = set.lights
    if (mats.clouds) mats.clouds.uniforms.uClouds.value = set.clouds
    if (!still) mats.cloudU.value = (mats.cloudU.value + Math.min(dt, 0.1) * 0.0011) % 1
    if (mats.atmo && group.current) group.current.getWorldPosition(mats.atmo.uniforms.uCenter.value)
  })

  const geo = sphereGeo(segments)
  return (
    <group ref={group} position={position} scale={radius}>
      <group ref={spin} rotation-y={BODY_YAW[kind]}>
        <mesh geometry={geo} material={mats.surface} />
        {mats.clouds && <mesh geometry={geo} material={mats.clouds} scale={1.006} renderOrder={1} />}
        {children}
      </group>
      {mats.atmo && a && <mesh geometry={sphereGeo(96)} material={mats.atmo} scale={a.top} renderOrder={3} />}
    </group>
  )
}

/** Keep the textures of a body alive (and streaming to high-res) while mounted. */
function useHoldSet(set: PlanetSet | null) {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    if (!set) return
    set.acquire(gl)
    return () => set.release()
  }, [set, gl])
}

// ---------------------------------------------------------------- sky

let starCache: ReturnType<typeof makeStars> | null = null
let milkyCache: Uint8Array | null = null

function Sky() {
  const camera = useThree((s) => s.camera)
  const dpr = useThree((s) => s.viewport.dpr)
  const group = useRef<THREE.Group>(null)
  const { points, band } = useMemo(() => {
    starCache ??= makeStars(5200, 180)
    milkyCache ??= makeMilkyWay(512, 256)
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(starCache.positions, 3))
    g.setAttribute('aColor', new THREE.BufferAttribute(starCache.colors, 3))
    g.setAttribute('aSize', new THREE.BufferAttribute(starCache.sizes, 1))
    const pm = new THREE.ShaderMaterial({
      vertexShader: STAR_VERT,
      fragmentShader: STAR_FRAG,
      uniforms: { uDpr: { value: 1 }, uOpacity: { value: 0.85 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })
    const pts = new THREE.Points(g, pm)
    pts.frustumCulled = false
    const tex = new THREE.DataTexture(milkyCache, 512, 256, THREE.RGBAFormat)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.magFilter = THREE.LinearFilter
    tex.minFilter = THREE.LinearFilter
    tex.wrapS = THREE.RepeatWrapping
    tex.needsUpdate = true
    const bm = new THREE.ShaderMaterial({
      vertexShader: PLANET_VERT,
      fragmentShader: SKY_FRAG,
      uniforms: { uMap: { value: tex }, uOpacity: { value: 0.32 } },
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(190, 48, 24), bm)
    mesh.frustumCulled = false
    return { points: pts, band: mesh }
  }, [])
  useEffect(
    () => () => {
      points.geometry.dispose()
      ;(points.material as THREE.Material).dispose()
      band.geometry.dispose()
      const m = band.material as THREE.ShaderMaterial
      ;(m.uniforms.uMap.value as THREE.Texture).dispose()
      m.dispose()
    },
    [points, band],
  )
  useEffect(() => {
    ;(points.material as THREE.ShaderMaterial).uniforms.uDpr.value = dpr
  }, [dpr, points])
  useFrame(() => group.current?.position.copy(camera.position))
  return (
    <group ref={group} renderOrder={-10}>
      <primitive object={band} renderOrder={-10} />
      <primitive object={points} renderOrder={-9} />
    </group>
  )
}

/** Sun glare: at infinity along `dir` (orbit views) or at a world position (cruise), with analytic occlusion by bodies. */
function SunGlare({ dir, position, size, occluders, intensity = 1 }: { dir?: THREE.Vector3; position?: Vec3; size: number; occluders: { c: Vec3; r: number }[]; intensity?: number }) {
  const camera = useThree((s) => s.camera)
  const mesh = useRef<THREE.Mesh>(null)
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: GLARE_VERT,
        fragmentShader: GLARE_FRAG,
        uniforms: { uColor: { value: new THREE.Color('#ffd9a0') }, uIntensity: { value: intensity }, uDisc: { value: 0.035 } },
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [intensity],
  )
  useEffect(() => () => mat.dispose(), [mat])
  const tmp = useMemo(() => ({ p: new THREE.Vector3(), d: new THREE.Vector3(), c: new THREE.Vector3() }), [])
  useFrame(() => {
    const m = mesh.current
    if (!m) return
    const far = 150
    if (position) tmp.p.set(...position)
    else if (dir) tmp.p.copy(camera.position).addScaledVector(dir, far)
    m.position.copy(tmp.p)
    const dist = camera.position.distanceTo(tmp.p)
    m.scale.setScalar(position ? size : size * (dist / far))
    // occlusion by the planets (soft over the limb)
    tmp.d.copy(tmp.p).sub(camera.position).normalize()
    let vis = 1
    for (const o of occluders) {
      tmp.c.set(o.c[0], o.c[1], o.c[2]).sub(camera.position)
      const t = tmp.c.dot(tmp.d)
      if (t <= 0 || t > dist) continue
      const miss = Math.sqrt(Math.max(0, tmp.c.lengthSq() - t * t))
      vis *= smooth(clamp((miss - o.r * 0.995) / (o.r * 0.06), 0, 1))
    }
    mat.uniforms.uIntensity.value = intensity * vis
    m.visible = vis > 0.001
  })
  return (
    <mesh ref={mesh} material={mat} renderOrder={20} frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  )
}

// ---------------------------------------------------------------- stations

interface StationRegistry {
  current: Map<string, THREE.Object3D>
}

function StationMarkers({ ids, active, registry, dot, size }: { ids: string[]; active: string | null; registry: StationRegistry; dot: THREE.Texture; size: number }) {
  return (
    <>
      {ids.map((id) => {
        const [la, lo] = stationLatLon(id)
        return <StationMarker key={id} id={id} pos={latLonToVec(la, lo, 1.002)} on={id === active} registry={registry} dot={dot} size={size} />
      })}
    </>
  )
}

function StationMarker({ id, pos, on, registry, dot, size }: { id: string; pos: Vec3; on: boolean; registry: StationRegistry; dot: THREE.Texture; size: number }) {
  const g = useRef<THREE.Group>(null)
  const ring = useRef<THREE.Mesh>(null)
  useEffect(() => {
    const o = g.current
    if (!o) return
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), o.position.clone().normalize())
    registry.current.set(id, o)
    return () => {
      registry.current.delete(id)
    }
  }, [id, registry])
  useFrame(({ clock }) => {
    const r = ring.current
    if (!r) return
    const t = (clock.elapsedTime * 0.5) % 1
    r.scale.setScalar(1 + t * 2.4)
    ;(r.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.7
  })
  const color = on ? MINT : AMBER
  return (
    <group ref={g} position={pos}>
      <mesh renderOrder={4}>
        <circleGeometry args={[size * 0.55, 20]} />
        <meshBasicMaterial color={color} transparent opacity={0.95} depthWrite={false} toneMapped={false} polygonOffset polygonOffsetFactor={-4} />
      </mesh>
      <mesh renderOrder={4}>
        <ringGeometry args={[size * 1.15, size * 1.35, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.65} depthWrite={false} toneMapped={false} polygonOffset polygonOffsetFactor={-4} />
      </mesh>
      {on && (
        <mesh ref={ring} renderOrder={4}>
          <ringGeometry args={[size * 1.2, size * 1.32, 40]} />
          <meshBasicMaterial color={MINT} transparent opacity={0.7} depthWrite={false} toneMapped={false} polygonOffset polygonOffsetFactor={-4} />
        </mesh>
      )}
      <sprite scale={size * (on ? 5 : 3.5)} position-z={0.004} renderOrder={4}>
        <spriteMaterial map={dot} color={color} transparent blending={THREE.AdditiveBlending} depthWrite={false} opacity={on ? 0.6 : 0.35} toneMapped={false} />
      </sprite>
    </group>
  )
}

// ---------------------------------------------------------------- spacecraft

function SpacecraftModel({ groupRef, missionId, design }: { groupRef: MutableRefObject<THREE.Group | null>; missionId: MissionId; design: Design }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const key = designKey(design)
  const built = useMemo(
    () => buildSpacecraft(design, MISSIONS[missionId], { detail: 'low', ghosts: false }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [missionId, key],
  )
  useEffect(() => () => built.dispose(), [built])
  // image-based fill for the spacecraft materials only (planets use their own shaders); kept low so
  // the sun stays the key light and the shadow side reads dark, as in flight footage
  useEffect(() => {
    const prev = scene.environment
    const prevI = scene.environmentIntensity
    scene.environment = getEnvironment(gl)
    scene.environmentIntensity = 0.38
    return () => {
      scene.environment = prev
      scene.environmentIntensity = prevI
    }
  }, [gl, scene])
  const fit = useMemo(() => {
    const size = built.bounds.getSize(new THREE.Vector3())
    const c = built.bounds.getCenter(new THREE.Vector3())
    const k = 3.6 / Math.max(size.x, size.y, size.z, 1e-6)
    return { k, c }
  }, [built])
  return (
    <group ref={groupRef}>
      {/* +Z of the outer group points along the velocity */}
      <group rotation-y={missionId === 'earth' ? -Math.PI / 2 : 0} scale={fit.k}>
        <group position={[-fit.c.x, -fit.c.y, -fit.c.z]}>
          <primitive object={built.root} />
        </group>
      </group>
    </group>
  )
}

/** Screen-constant reticle + label that follows the spacecraft. */
function CraftMarker({ target, label }: { target: MutableRefObject<THREE.Group | null>; label: string | null }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  const g = useRef<THREE.Group>(null)
  const reticle = useMemo(
    () =>
      makeCanvasTexture(
        (c, w) => {
          const r = w / 2
          c.strokeStyle = 'rgba(214,250,236,0.95)'
          c.lineWidth = 3
          for (let k = 0; k < 4; k++) {
            const a0 = (k * Math.PI) / 2 + 0.28
            c.beginPath()
            c.arc(r, r, r - 4, a0, a0 + Math.PI / 2 - 0.56)
            c.stroke()
          }
        },
        96,
        96,
      ),
    [],
  )
  const text = useMemo(() => (label ? labelTexture(label, 'rgba(214,250,236,0.92)') : null), [label])
  useEffect(() => () => reticle.dispose(), [reticle])
  useEffect(() => () => text?.t.dispose(), [text])
  useFrame(() => {
    const o = g.current
    const t = target.current
    if (!o || !t) return
    o.visible = t.visible
    o.position.copy(t.position)
    // sizeAttenuation=false sprites: scale is in units of the view height
    const px = 2 * Math.tan(((camera.fov / 2) * Math.PI) / 180) / Math.max(1, size.height)
    const rs = 30 * px
    const rc = o.children[0] as THREE.Sprite
    rc.scale.set(rs, rs, 1)
    if (text) {
      const ls = o.children[1] as THREE.Sprite
      ls.scale.set(15 * px * text.aspect, 15 * px, 1)
    }
  })
  return (
    <group ref={g}>
      <sprite renderOrder={30}>
        <spriteMaterial map={reticle} transparent depthTest={false} depthWrite={false} sizeAttenuation={false} toneMapped={false} opacity={0.75} />
      </sprite>
      {text && (
        <sprite renderOrder={30} center={new THREE.Vector2(-0.18, -0.55)}>
          <spriteMaterial map={text.t} transparent depthTest={false} depthWrite={false} sizeAttenuation={false} toneMapped={false} />
        </sprite>
      )}
    </group>
  )
}

/** the design to draw: explicit prop, else the store's design for this mission, else a showcase */
function useCraftDesign(missionId: MissionId, explicit: Design | null | undefined): Design {
  const storeMission = useGameStore((s) => s.missionId)
  const storeDesign = useGameStore((s) => s.design)
  if (explicit) return explicit
  if (storeMission === missionId && hasAnyPart(storeDesign)) return storeDesign
  return showcaseDesign(missionId)
}

function hasAnyPart(d: Design) {
  return d.instruments.length > 0 || !!(d.solar || d.battery || d.radio || d.computer || d.attitude || d.propulsion)
}

// ---------------------------------------------------------------- labels

function labelTexture(text: string, color = 'rgba(207,227,232,0.9)') {
  const font = '500 30px "DM Sans", ui-sans-serif, system-ui, sans-serif'
  const c = document.createElement('canvas')
  const g = c.getContext('2d')!
  g.font = font
  const spaced = text.toUpperCase().split('').join(' ')
  const w = Math.ceil(g.measureText(spaced).width) + 20
  c.width = w
  c.height = 44
  g.font = font
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.shadowColor = 'rgba(0,0,0,0.85)'
  g.shadowBlur = 8
  g.fillStyle = color
  g.fillText(spaced, w / 2, 23)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return { t, aspect: w / 44 }
}

function TextLabel({ text, position }: { text: string; position: Vec3 }) {
  const tex = useMemo(() => labelTexture(text), [text])
  useEffect(() => () => tex.t.dispose(), [tex])
  return (
    <sprite position={position} scale={[0.026 * tex.aspect, 0.026, 1]} center={new THREE.Vector2(0.5, 1)} renderOrder={30}>
      <spriteMaterial map={tex.t} transparent depthWrite={false} depthTest={false} sizeAttenuation={false} toneMapped={false} />
    </sprite>
  )
}

// ---------------------------------------------------------------- scene

interface SceneProps {
  props: Props
  kind: BodyKind
  main: PlanetSet
  earth: PlanetSet | null
}

function Scene({ props, kind, main, earth }: SceneProps) {
  const { orbitId, stations = [], activeStation = null, cruise = false } = props
  const craftMission: MissionId = props.missionId === 'lunar' || props.missionId === 'mars' ? props.missionId : 'earth'
  const craftDesign = useCraftDesign(craftMission, props.design)
  const dot = useDotTexture()
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  const invalidate = useThree((s) => s.invalidate)
  const controls = useRef<React.ComponentRef<typeof OrbitControls>>(null)
  const remote = kind !== 'earth'
  const still = useMemo(reducedMotion, [])
  const labels = props.labels !== false

  const live = useRef(props)
  live.current = props

  const sunDir = useMemo(() => v3(SUN_DIR), [])
  const cr: CruiseScene | null = useMemo(() => (cruise ? cruiseScene(kind, orbitId) : null), [cruise, kind, orbitId])

  // ---- orbit element morph
  const targetEl = orbitSpec(orbitId)?.el ?? null
  const curEl = useRef<OrbitEl | null>(targetEl)
  const morph = useRef<{ from: OrbitEl; to: OrbitEl; t: number } | null>(null)
  const orbitLine = useRef<GlowLineApi>(null)
  const initialPts = useMemo(() => orbitPath(curEl.current ?? orbitSpec('leo')!.el, ORBIT_SAMPLES), [])
  const pushOrbit = (el: OrbitEl | null) => {
    const l = orbitLine.current
    if (!l) return
    l.mesh.visible = !!el
    if (el) l.setPoints(orbitPath(el, ORBIT_SAMPLES))
  }
  useEffect(() => {
    const to = orbitSpec(orbitId)?.el ?? null
    if (to && curEl.current && !still) morph.current = { from: curEl.current, to, t: 0 }
    else {
      curEl.current = to
      morph.current = null
      pushOrbit(to)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orbitId])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => pushOrbit(curEl.current), [cruise])

  const ghost = !cr ? orbitSpec(orbitId)?.ghost : undefined
  const ghostPts = useMemo(() => (ghost ? orbitPath(ghost, 160) : null), [ghost])

  // ---- stations
  const registry = useRef(new Map<string, THREE.Object3D>())
  const earthYaw = useRef(0)
  const remoteCfg = remote ? REMOTE_EARTH[kind === 'mars' ? 'mars' : 'moon'] : null

  // ---- spacecraft + beam state
  const sc = useRef<THREE.Group | null>(null)
  const beam = useRef<GlowLineApi>(null)
  const beamPts = useMemo(() => Array.from({ length: 24 }, () => new THREE.Vector3()), [])
  const beamDot = useRef<THREE.Sprite>(null)
  const shown = useRef(props.phase ?? 0)
  const beamA = useRef(0)
  const travelled = useRef<GlowLineApi>(null)
  const tmp = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), d: new THREE.Vector3() }), [])

  // ---- camera fit
  const fit = useRef<{ fromT: THREE.Vector3; toT: THREE.Vector3; fromD: number; toD: number; fromDir: THREE.Vector3; toDir: THREE.Vector3 | null; t: number } | null>(null)
  const fitKey = `${kind}|${cruise ? 'c' : 'o'}|${cruise ? '' : (orbitId ?? '')}`
  const modeKey = `${kind}|${cruise}`
  const lastMode = useRef<string | null>(null)

  // composition: push the body right of / below centre (rule of thirds) so the caption
  // (top-left) and the planet don't fight; cruise scenes stay centred
  useEffect(() => {
    const w = size.width
    const h = size.height
    if (w < 2 || h < 2) return
    const ox = cr ? 0 : w > h * 1.15 ? 0.085 : 0.02
    const oy = cr ? -0.02 : 0.05
    camera.setViewOffset(w, h, -w * ox, -h * oy, w, h)
    camera.updateProjectionMatrix()
    invalidate()
  }, [camera, size.width, size.height, cr, invalidate])

  useEffect(() => {
    const aspect = Math.max(0.3, size.width / Math.max(1, size.height))
    const half = Math.tan(((FOV / 2) * Math.PI) / 180)
    const halfMin = Math.min(half, half * aspect)
    let target = new THREE.Vector3()
    let radius = 1.25
    let dir: THREE.Vector3 | null = null
    let dist: number
    if (cr) {
      const pts = [...cr.path.map(v3), ...cr.bodies.flatMap((b) => [v3(b.pos).addScalar(b.r), v3(b.pos).addScalar(-b.r)])]
      cr.rings.forEach((r) => pts.push(new THREE.Vector3(r.r, 0, 0), new THREE.Vector3(-r.r, 0, 0), new THREE.Vector3(0, 0, r.r), new THREE.Vector3(0, 0, -r.r)))
      const box = new THREE.Box3().setFromPoints(pts)
      box.getCenter(target)
      radius = Math.max(...pts.map((p) => p.distanceTo(target))) * 0.95
      dir = v3(cr.camDir)
      dist = Math.max(3.4, (radius / halfMin) * 0.98)
    } else {
      const spec = orbitSpec(orbitId)
      const el = spec?.el
      if (el) {
        const pts = [...orbitPath(el, 64), ...(spec.ghost ? orbitPath(spec.ghost, 64) : [])].map(v3)
        const box = new THREE.Box3().setFromPoints(pts)
        box.getCenter(target).multiplyScalar(0.45)
        radius = Math.max(1.1, ...pts.map((p) => p.distanceTo(target)))
      } else {
        radius = 1.1
      }
      if (lastMode.current !== modeKey) dir = v3(CAM_DIR)
      // the planet fills the frame; the orbit may brush the edges (it is a thin line)
      dist = Math.max(remote ? 4.6 : 3.6, (radius / halfMin) * 1.08)
    }
    const first = lastMode.current === null
    lastMode.current = modeKey
    const ctl = controls.current
    if (first || still || !ctl) {
      const d = dir ?? v3(CAM_DIR)
      camera.position.copy(target).addScaledVector(d.normalize(), dist)
      ctl?.target.copy(target)
      camera.lookAt(target)
      fit.current = null
    } else {
      const fromDir = camera.position.clone().sub(ctl.target).normalize()
      fit.current = { fromT: ctl.target.clone(), toT: target, fromD: camera.position.distanceTo(ctl.target), toD: dist, fromDir, toDir: dir ? dir.normalize() : null, t: 0 }
    }
    if (ctl) {
      ctl.minDistance = cr ? dist * 0.35 : 1.5
      ctl.maxDistance = dist * 2
    }
    invalidate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, size.width, size.height])

  // ---- idle drift (gentle azimuth sway + breathing elevation) instead of a full spin
  const idleTimer = useRef<number | undefined>(undefined)
  const idle = useRef(true)
  const sway = useRef({ t: 0, amp: 0, last: 0, lastE: 0 })
  useEffect(() => () => window.clearTimeout(idleTimer.current), [])

  // ---- per-frame
  const startT = useRef<number | null>(null)
  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    if (startT.current === null) startT.current = clock.elapsedTime
    const el = clock.elapsedTime - startT.current
    const P = live.current
    const animate = (P.animate ?? true) && !still

    // camera transition
    const f = fit.current
    const ctl = controls.current
    if (f && ctl) {
      f.t = Math.min(1, f.t + dt / TRANSITION_S)
      const k = smooth(f.t)
      ctl.target.lerpVectors(f.fromT, f.toT, k)
      const d = THREE.MathUtils.lerp(f.fromD, f.toD, k)
      const dir = f.toDir ? tmp.c.copy(f.fromDir).lerp(f.toDir, k).normalize() : tmp.c.copy(camera.position).sub(ctl.target).normalize()
      camera.position.copy(ctl.target).addScaledVector(dir, d)
      if (f.t >= 1) fit.current = null
    }

    // idle drift: a slow ±24° pendulum around the current view (keeps the day side in shot)
    if (ctl && !still) {
      const s = sway.current
      s.amp += ((idle.current && !f ? 1 : 0) - s.amp) * (1 - Math.exp(-0.6 * dt))
      s.t += dt
      const az = Math.sin(s.t * 0.11) * 0.42 * s.amp
      const elv = Math.sin(s.t * 0.073 + 1.3) * 0.06 * s.amp
      const dAz = az - s.last
      const dEl = elv - s.lastE
      s.last = az
      s.lastE = elv
      if (Math.abs(dAz) + Math.abs(dEl) > 1e-7) {
        const off = tmp.d.copy(camera.position).sub(ctl.target)
        off.applyAxisAngle(THREE.Object3D.DEFAULT_UP, dAz)
        const right = tmp.b.set(off.z, 0, -off.x).normalize()
        if (right.lengthSq() > 0.5) off.applyAxisAngle(right, -dEl)
        camera.position.copy(ctl.target).add(off)
      }
    }

    // orbit morph
    const m = morph.current
    if (m) {
      m.t = Math.min(1, m.t + dt / TRANSITION_S)
      curEl.current = m.t >= 1 ? m.to : lerpEl(m.from, m.to, smooth(m.t))
      pushOrbit(curEl.current)
      if (m.t >= 1) morph.current = null
    }

    // spacecraft position
    let pos: THREE.Vector3 | null = null
    let ahead: THREE.Vector3 | null = null
    if (cr) {
      const tgt = P.phase ?? (animate ? (el / 18) % 1 : 0.5)
      shown.current = chasePhase(shown.current, tgt, dt, false)
      pos = tmp.a.set(...alongPath(cr.path, shown.current))
      ahead = tmp.b.set(...alongPath(cr.path, Math.min(1, shown.current + 0.01)))
      const tl = travelled.current
      if (tl) tl.material.uniforms.uProgress.value = shown.current
    } else if (curEl.current) {
      const spec = orbitSpec(P.orbitId)
      shown.current = chasePhase(shown.current, P.phase ?? 0, dt, true)
      const mm = shown.current + (animate ? el / (spec?.lapSeconds ?? 16) : 0)
      pos = tmp.a.set(...orbitPoint(curEl.current, mm))
      ahead = tmp.b.set(...orbitPoint(curEl.current, mm + 0.004))
    }
    const g = sc.current
    if (g) {
      g.visible = !!pos
      if (pos && ahead) {
        g.position.copy(pos)
        if (ahead.distanceToSquared(pos) > 1e-10) g.lookAt(ahead)
        g.scale.setScalar(clamp(camera.position.distanceTo(pos) * 0.009, 0.01, 0.25))
      }
    }

    // remote Earth turns the active station toward the target body
    if (remoteCfg) {
      const sid = P.activeStation ?? P.stations?.[0]
      if (sid) {
        const want = yawToFace(sid, remoteCfg.pos, [0, 0, 0])
        let d = want - earthYaw.current
        d = Math.atan2(Math.sin(d), Math.cos(d))
        earthYaw.current += d * (1 - Math.exp(-2.5 * dt))
      }
    }

    // downlink beam: thin flowing dashed ribbon station → spacecraft
    const st = P.activeStation ? registry.current.get(P.activeStation) : undefined
    let want = 0
    const sPos = tmp.c
    if (st && pos && !cr) {
      st.getWorldPosition(sPos)
      const spheres: { c: Vec3; r: number }[] = [{ c: [0, 0, 0], r: 1 }]
      if (remoteCfg) spheres.push({ c: remoteCfg.pos, r: remoteCfg.r })
      const lift = remoteCfg ? sPos.clone().sub(v3(remoteCfg.pos)).multiplyScalar(0.02).add(sPos) : sPos.clone().multiplyScalar(1.02)
      want = lineOfSight([lift.x, lift.y, lift.z], [pos.x, pos.y, pos.z], spheres) ? 1 : 0
    }
    beamA.current += (want - beamA.current) * (1 - Math.exp(-5 * dt))
    const bl = beam.current
    if (bl) {
      const on = beamA.current > 0.01 && !!st && !!pos
      bl.mesh.visible = on
      if (beamDot.current) beamDot.current.visible = on
      if (on && pos) {
        for (let i = 0; i < beamPts.length; i++) beamPts[i].lerpVectors(sPos, pos, i / (beamPts.length - 1))
        bl.setPoints(beamPts)
        const L = sPos.distanceTo(pos)
        bl.material.uniforms.uOpacity.value = 0.9 * beamA.current
        bl.material.uniforms.uDashes.value = Math.max(6, L * 16)
        bl.material.uniforms.uDashMove.value = still ? 0 : -clock.elapsedTime * 1.4
        if (beamDot.current) {
          beamDot.current.position.copy(sPos)
          beamDot.current.scale.setScalar(clamp(camera.position.distanceTo(sPos) * 0.03, 0.02, 0.4))
          ;(beamDot.current.material as THREE.SpriteMaterial).opacity = 0.8 * beamA.current
        }
      }
    }
  })

  const stationSize = 0.016
  const cruiseStatic = useMemo(() => (cr ? cr.path.map((p) => new THREE.Vector3(...p)) : null), [cr])
  const cruiseOrbit = useMemo(() => (cr && kind === 'earth' && orbitSpec(orbitId) ? orbitPath(orbitSpec(orbitId)!.el, 200) : null), [cr, kind, orbitId])
  const ringPts = useMemo(
    () => (cr ? cr.rings.map((r) => Array.from({ length: 193 }, (_, k): Vec3 => [Math.cos((k / 192) * Math.PI * 2) * r.r, 0, Math.sin((k / 192) * Math.PI * 2) * r.r])) : []),
    [cr],
  )
  const occluders = useMemo(() => {
    const o: { c: Vec3; r: number }[] = []
    if (cr) cr.bodies.forEach((b) => b.kind !== 'sun' && o.push({ c: b.pos, r: b.r }))
    else {
      o.push({ c: [0, 0, 0], r: 1 })
      if (remoteCfg) o.push({ c: remoteCfg.pos, r: remoteCfg.r })
    }
    return o
  }, [cr, remoteCfg])
  const marsCruise = !!cr && kind === 'mars'

  return (
    <>
      <ambientLight intensity={0.05} color="#9fb8ff" />
      {marsCruise ? (
        <pointLight position={[0, 0, 0]} intensity={3.4} decay={0} color="#fff3e2" />
      ) : (
        <directionalLight position={[SUN_DIR[0] * 20, SUN_DIR[1] * 20, SUN_DIR[2] * 20]} intensity={3.4} color="#fff4e6" />
      )}
      <Sky />
      {!marsCruise && <SunGlare dir={sunDir} size={46} occluders={occluders} intensity={0.9} />}

      {!cr && (
        <>
          <Planet kind={kind} set={main} radius={1} sunDir={sunDir} still={still}>
            {kind === 'earth' && <StationMarkers ids={stations} active={activeStation} registry={registry} dot={dot} size={stationSize} />}
          </Planet>
          {remoteCfg && earth && (
            <Planet kind="earth" set={earth} radius={remoteCfg.r} position={remoteCfg.pos} sunDir={sunDir} yawRef={earthYaw} segments={64} still={still}>
              <StationMarkers ids={stations} active={activeStation} registry={registry} dot={dot} size={stationSize * 2.2} />
            </Planet>
          )}
          <GlowLine ref={orbitLine} points={initialPts} closed color={ORBIT_COLOR} width={7} core={1.25} glow={0.22} opacity={0.95} far={0.38} visible={!!curEl.current} />
          {ghostPts && <GlowLine points={ghostPts} closed color={ORBIT_COLOR} width={4} core={1} glow={0.1} opacity={0.55} far={0.35} dashes={90} />}
          <GlowLine ref={beam} points={beamPts} color={MINT} width={6} core={1.1} glow={0.35} opacity={0} dashes={20} visible={false} renderOrder={5} />
          <sprite ref={beamDot} visible={false} renderOrder={5}>
            <spriteMaterial map={dot} color={MINT} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
          </sprite>
        </>
      )}

      {cr && cruiseStatic && (
        <>
          <CruiseBodies cr={cr} main={main} earth={earth} kind={kind} sunDir={sunDir} still={still} />
          <GlowLine ref={travelled} points={cruiseStatic} color={ORBIT_COLOR} width={7} core={1.4} glow={0.25} opacity={0.95} dashes={70} />
          {cruiseOrbit && <GlowLine points={cruiseOrbit} closed color={ORBIT_COLOR} width={4} core={1} glow={0.12} opacity={0.4} far={0.3} />}
          {labels &&
            cr.bodies.map((b, i) => (b.r < 0.5 ? <TextLabel key={i} text={b.label} position={[b.pos[0], b.pos[1] - b.r * (b.kind === 'sun' ? 1.6 : 1.35), b.pos[2]]} /> : null))}
          {cr.rings.map((r, i) => (
            <GlowLine key={i} points={ringPts[i]} closed color={r.color} width={4} core={0.9} glow={0.12} opacity={0.4} />
          ))}
        </>
      )}

      <SpacecraftModel groupRef={sc} missionId={craftMission} design={craftDesign} />
      {labels && <CraftMarker target={sc} label={cr ? null : 'Spacecraft'} />}

      <OrbitControls
        ref={controls}
        makeDefault
        enablePan={false}
        enableDamping
        dampingFactor={0.07}
        rotateSpeed={0.5}
        zoomSpeed={0.6}
        onStart={() => {
          window.clearTimeout(idleTimer.current)
          fit.current = null
          idle.current = false
        }}
        onEnd={() => {
          window.clearTimeout(idleTimer.current)
          idleTimer.current = window.setTimeout(() => {
            idle.current = true
            sway.current.t = 0
            sway.current.last = 0
            sway.current.lastE = 0
          }, 5000)
        }}
      />
    </>
  )
}

function CruiseBodies({ cr, main, earth, kind, sunDir, still }: { cr: CruiseScene; main: PlanetSet; earth: PlanetSet | null; kind: BodyKind; sunDir: THREE.Vector3; still: boolean }) {
  const dirs = useMemo(() => cr.bodies.map((b) => (kind === 'mars' ? v3(b.pos).negate().normalize() : sunDir)), [cr, kind, sunDir])
  return (
    <>
      {cr.bodies.map((b, i) => {
        if (b.kind === 'sun') return <SunBody key={i} position={b.pos} r={b.r} />
        const set = b.kind === 'earth' ? (kind === 'earth' ? main : earth) : main
        if (!set) return null
        return <Planet key={i} kind={b.kind} set={set} radius={b.r} position={b.pos} sunDir={dirs[i]} segments={b.r > 0.5 ? 128 : 64} still={still} />
      })}
    </>
  )
}

function SunBody({ position, r }: { position: Vec3; r: number }) {
  return (
    <>
      <mesh position={position}>
        <sphereGeometry args={[r * 0.55, 32, 16]} />
        <meshBasicMaterial color={new THREE.Color(1, 0.93, 0.8).multiplyScalar(4)} toneMapped={false} />
      </mesh>
      <SunGlare position={position} size={r * 6} occluders={[]} intensity={1.6} />
    </>
  )
}

// ---------------------------------------------------------------- root

export default function CelestialView3D(props: Props) {
  const { missionId, onFail } = props
  const kind = bodyKindOf(missionId)
  const needEarth = kind !== 'earth'
  const main = use(planetSet(kind))
  const earth = needEarth ? use(planetSet('earth')) : null

  // pause rendering when hidden / off-screen
  const wrap = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(true)
  const [docVisible, setDocVisible] = useState(() => (typeof document === 'undefined' ? true : !document.hidden))
  const [dpr, setDpr] = useState(() => Math.min(typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1, 1.75))
  useEffect(() => {
    const onVis = () => setDocVisible(!document.hidden)
    document.addEventListener('visibilitychange', onVis)
    let io: IntersectionObserver | undefined
    if (wrap.current && 'IntersectionObserver' in window) {
      io = new IntersectionObserver((e) => setVisible(e.some((x) => x.isIntersecting)))
      io.observe(wrap.current)
    }
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      io?.disconnect()
    }
  }, [])
  const running = visible && docVisible
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  return (
    <div ref={wrap} className={`absolute inset-0 ${props.className ?? ''}`} style={{ touchAction: 'none' }}>
      <Canvas
        frameloop={running ? 'always' : 'never'}
        dpr={dpr}
        resize={{ offsetSize: true }}
        camera={{ fov: FOV, near: 0.02, far: 400, position: [CAM_DIR[0] * 4, CAM_DIR[1] * 4, CAM_DIR[2] * 4] }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0)
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = EXPOSURE
          // a real context loss (driver reset) → SVG fallback; ignore the loss R3F forces on unmount
          gl.domElement.addEventListener(
            'webglcontextlost',
            (e) => {
              e.preventDefault()
              if (mounted.current && gl.domElement.isConnected) onFail?.()
            },
            { once: true },
          )
        }}
        aria-label={`3D view of ${BODY_STYLES[kind].name}. Drag to rotate, scroll to zoom.`}
      >
        <PerformanceMonitor onDecline={() => setDpr((d) => Math.max(1, d - 0.5))} flipflops={2} />
        <SceneRoot props={props} kind={kind} main={main} earth={earth} />
      </Canvas>
    </div>
  )
}

function SceneRoot({ props, kind, main, earth }: { props: Props; kind: BodyKind; main: PlanetSet; earth: PlanetSet | null }) {
  useHoldSet(main)
  useHoldSet(earth)
  return <Scene props={props} kind={kind} main={main} earth={kind === 'earth' ? main : earth} />
}
