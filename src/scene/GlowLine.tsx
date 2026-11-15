// Thin anti-aliased screen-space ribbon with a soft glow, depth-tested against the planets.
// Additive. Width is in CSS pixels. Supports closed loops, dashes, a progress split
// (travelled = solid, ahead = dashed & dim) and dimming of the far side of a body.
import { forwardRef, useEffect, useImperativeHandle, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { LINE_FRAG, LINE_VERT } from './shaders'
import type { Vec3 } from './model'

export interface GlowLineApi {
  setPoints(pts: ArrayLike<Vec3 | THREE.Vector3>): void
  material: THREE.ShaderMaterial
  mesh: THREE.Mesh
}

export interface GlowLineProps {
  points: (Vec3 | THREE.Vector3)[]
  color?: THREE.ColorRepresentation
  /** total ribbon width incl. glow (px) */
  width?: number
  /** solid core width (px) */
  core?: number
  glow?: number
  opacity?: number
  closed?: boolean
  /** body the line goes around: its far side is dimmed to `far` */
  center?: Vec3
  far?: number
  dashes?: number
  fadeEnds?: number
  depthTest?: boolean
  renderOrder?: number
  visible?: boolean
}

const get = (p: Vec3 | THREE.Vector3, i: number) => (p instanceof THREE.Vector3 ? (i === 0 ? p.x : i === 1 ? p.y : p.z) : p[i])

function build(n: number) {
  const g = new THREE.BufferGeometry()
  const vc = n * 2
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vc * 3), 3))
  g.setAttribute('aPrev', new THREE.BufferAttribute(new Float32Array(vc * 3), 3))
  g.setAttribute('aNext', new THREE.BufferAttribute(new Float32Array(vc * 3), 3))
  const side = new Float32Array(vc)
  for (let i = 0; i < n; i++) {
    side[i * 2] = -1
    side[i * 2 + 1] = 1
  }
  g.setAttribute('aSide', new THREE.BufferAttribute(side, 1))
  g.setAttribute('aAlong', new THREE.BufferAttribute(new Float32Array(vc), 1))
  const idx: number[] = []
  for (let i = 0; i < n - 1; i++) {
    const a = i * 2
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
  }
  g.setIndex(idx)
  return g
}

function fill(g: THREE.BufferGeometry, pts: ArrayLike<Vec3 | THREE.Vector3>, closed: boolean) {
  const n = pts.length
  const pos = g.getAttribute('position') as THREE.BufferAttribute
  const prev = g.getAttribute('aPrev') as THREE.BufferAttribute
  const next = g.getAttribute('aNext') as THREE.BufferAttribute
  const along = g.getAttribute('aAlong') as THREE.BufferAttribute
  const P = pos.array as Float32Array
  const A = prev.array as Float32Array
  const N = next.array as Float32Array
  const S = along.array as Float32Array
  let total = 0
  const cum = new Float32Array(n)
  for (let i = 1; i < n; i++) {
    const dx = get(pts[i], 0) - get(pts[i - 1], 0)
    const dy = get(pts[i], 1) - get(pts[i - 1], 1)
    const dz = get(pts[i], 2) - get(pts[i - 1], 2)
    total += Math.hypot(dx, dy, dz)
    cum[i] = total
  }
  for (let i = 0; i < n; i++) {
    const ip = i > 0 ? i - 1 : closed ? n - 2 : 0
    const inx = i < n - 1 ? i + 1 : closed ? 1 : n - 1
    for (let s = 0; s < 2; s++) {
      const o = (i * 2 + s) * 3
      for (let k = 0; k < 3; k++) {
        P[o + k] = get(pts[i], k)
        A[o + k] = get(pts[ip], k)
        N[o + k] = get(pts[inx], k)
      }
      S[i * 2 + s] = total > 0 ? cum[i] / total : 0
    }
  }
  pos.needsUpdate = prev.needsUpdate = next.needsUpdate = along.needsUpdate = true
  g.computeBoundingSphere()
}

export const GlowLine = forwardRef<GlowLineApi, GlowLineProps>(function GlowLine(
  { points, color = '#a3f0d4', width = 6, core = 1.3, glow = 0.3, opacity = 1, closed = false, center = [0, 0, 0], far = 1, dashes = 0, fadeEnds = 0, depthTest = true, renderOrder = 2, visible = true },
  ref,
) {
  const size = useThree((s) => s.size)
  const n = points.length
  const geo = useMemo(() => build(n), [n])
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: LINE_VERT,
        fragmentShader: LINE_FRAG,
        uniforms: {
          uRes: { value: new THREE.Vector2(1, 1) },
          uWidth: { value: width },
          uCore: { value: core },
          uGlow: { value: glow },
          uColor: { value: new THREE.Color(color) },
          uOpacity: { value: opacity },
          uCenter: { value: new THREE.Vector3(...center) },
          uFar: { value: far },
          uProgress: { value: -1 },
          uDashes: { value: dashes },
          uDashMove: { value: 0 },
          uFadeEnds: { value: fadeEnds },
        },
        transparent: true,
        depthWrite: false,
        depthTest,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const mesh = useMemo(() => {
    const m = new THREE.Mesh(geo, mat)
    m.frustumCulled = false
    return m
  }, [geo, mat])
  useEffect(() => {
    const u = mat.uniforms
    u.uWidth.value = width
    u.uCore.value = core
    u.uGlow.value = glow
    ;(u.uColor.value as THREE.Color).set(color)
    u.uOpacity.value = opacity
    ;(u.uCenter.value as THREE.Vector3).set(...center)
    u.uFar.value = far
    u.uDashes.value = dashes
    u.uFadeEnds.value = fadeEnds
    mat.depthTest = depthTest
  }, [mat, width, core, glow, color, opacity, center, far, dashes, fadeEnds, depthTest])
  useEffect(() => fill(geo, points, closed), [geo, points, closed])
  useEffect(() => {
    ;(mat.uniforms.uRes.value as THREE.Vector2).set(size.width, size.height)
  }, [mat, size.width, size.height])
  useEffect(() => () => geo.dispose(), [geo])
  useEffect(() => () => mat.dispose(), [mat])
  useImperativeHandle(ref, () => ({ setPoints: (p) => fill(geo, p, closed), material: mat, mesh }), [geo, closed, mat, mesh])
  useEffect(() => {
    mesh.renderOrder = renderOrder
    mesh.visible = visible
  }, [mesh, renderOrder, visible])
  return <primitive object={mesh} />
})
