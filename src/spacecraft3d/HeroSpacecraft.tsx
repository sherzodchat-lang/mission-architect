// Showcase render for the Overview / menu hero: fully assembled craft, panels deployed, slowly
// rotating, rim-lit, transparent background. Lazy chunk (three + R3F) — default export.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { MISSIONS } from '../data/missions'
import type { Design, MissionId } from '../data/types'
import { buildSpacecraft } from './assemble'
import { createRig, getEnvironment } from './core/lighting'
import { designKey, hasWebGL, showcaseDesign } from './meta'

export interface HeroSpacecraftProps {
  missionId?: MissionId
  /** defaults to a complete showcase design for the mission */
  design?: Design | null
  className?: string
  /** rotation speed (rad/s), default 0.18 */
  speed?: number
  /** framing: >1 = smaller craft */
  zoom?: number
  fallback?: ReactNode
}

const FOV = 28

function HeroScene({ missionId, design, speed, zoom, running }: { missionId: MissionId; design: Design; speed: number; zoom: number; running: boolean }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  const invalidate = useThree((s) => s.invalidate)
  const rig = useMemo(() => {
    const r = createRig(true)
    r.key.intensity = 2.6
    return r
  }, [])
  const rim = useMemo(() => {
    const l = new THREE.DirectionalLight('#7ff5dc', 3.2)
    return l
  }, [])
  const key = designKey(design)
  const built = useMemo(
    () => buildSpacecraft(design, MISSIONS[missionId], { detail: 'high', ghosts: false }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [missionId, key],
  )
  useEffect(() => () => built.dispose(), [built])

  const spin = useRef<THREE.Group>(null)
  const tilt = useMemo(() => {
    const g = new THREE.Group()
    return g
  }, [])

  useEffect(() => {
    scene.environment = getEnvironment(gl)
    scene.environmentIntensity = 1.05
  }, [gl, scene])

  useEffect(() => {
    // orientation: CubeSat stands on its long axis with wings left/right; bus upright
    tilt.clear()
    tilt.add(built.root)
    built.root.rotation.set(0, 0, 0)
    if (missionId === 'earth') {
      built.root.rotation.set(0, 0, Math.PI / 2)
      tilt.rotation.set(-0.15, 0.5, -0.42)
    } else tilt.rotation.set(0.18, 0, -0.12)
    tilt.updateMatrixWorld(true)
    const sphere = new THREE.Box3().setFromObject(tilt).getBoundingSphere(new THREE.Sphere())
    const aspect = size.width / Math.max(1, size.height)
    const v = (FOV / 2) * (Math.PI / 180)
    const h = Math.atan(Math.tan(v) * aspect)
    const r = missionId === 'earth' ? sphere.radius : Math.max(built.scale * 1.4, sphere.radius * 0.62)
    const dist = (r / Math.sin(Math.min(v, h))) * zoom
    const dir = new THREE.Vector3(0.25, 0.32, 1).normalize()
    camera.position.copy(sphere.center).addScaledVector(dir, dist)
    camera.near = dist * 0.02
    camera.far = dist * 10
    camera.lookAt(sphere.center)
    camera.updateProjectionMatrix()
    rig.fit(sphere.center, sphere.radius)
    rim.position.copy(sphere.center).add(new THREE.Vector3(-1, 0.4, -1.2).multiplyScalar(sphere.radius * 4))
    rim.target.position.copy(sphere.center)
    invalidate()
  }, [built, tilt, missionId, camera, size.width, size.height, zoom, rig, rim, invalidate])

  useFrame((_, dt) => {
    if (!spin.current) return
    spin.current.rotation.y += Math.min(dt, 0.1) * speed
    if (running) invalidate()
  })

  return (
    <>
      <primitive object={rig.group} />
      <primitive object={rim} />
      <primitive object={rim.target} />
      <group ref={spin}>
        <primitive object={tilt} />
      </group>
    </>
  )
}

export default function HeroSpacecraft({ missionId = 'earth', design, className, speed = 0.18, zoom = 1, fallback = null }: HeroSpacecraftProps) {
  const d = design ?? showcaseDesign(missionId)
  const wrap = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(true)
  const [ok] = useState(hasWebGL)
  const reduced = useMemo(() => {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    } catch {
      return false
    }
  }, [])
  useEffect(() => {
    const el = wrap.current
    if (!el || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver((en) => setVisible(en.some((x) => x.isIntersecting) && !document.hidden))
    io.observe(el)
    const onVis = () => setVisible(!document.hidden)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      io.disconnect()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])
  if (!ok) return <div className={className}>{fallback}</div>
  const running = visible && !reduced
  return (
    <div ref={wrap} className={`relative h-full w-full ${className ?? ''}`} aria-hidden>
      <Canvas
        className="absolute inset-0"
        frameloop={visible ? 'demand' : 'never'}
        shadows="soft"
        dpr={[1, 2]}
        resize={{ offsetSize: true }}
        camera={{ fov: FOV, position: [0, 0, 3] }}
        gl={{ antialias: true, alpha: true }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0)
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1.1
        }}
        style={{ pointerEvents: 'none' }}
      >
        <HeroScene missionId={missionId} design={d} speed={speed} zoom={zoom} running={running} />
      </Canvas>
    </div>
  )
}
