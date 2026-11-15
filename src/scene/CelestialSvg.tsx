// P0 celestial view: stylized SVG body + orbit + spacecraft + ground-station beam.
// Static artwork is memoized; the spacecraft and beam are moved imperatively in one rAF loop,
// React only re-renders while an orbit change is being animated.
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { MISSIONS, type MissionId } from '../data'
import type { CelestialViewProps } from './CelestialView'
import {
  BODY_STYLES,
  BODY_YAW,
  CAM_DIR,
  LAND,
  MARS_BRIGHT,
  MARS_DARK,
  MOON_MARIA,
  REMOTE_EARTH,
  SUN_DIR,
  WATER,
  alongPath,
  bodyKindOf,
  chasePhase,
  clamp,
  craters,
  cross,
  cruiseScene,
  latLonToVec,
  lerpEl,
  lineOfSight,
  makeProjector,
  norm,
  orbitPath,
  orbitPoint,
  orbitSpec,
  project,
  rng,
  rotY,
  scale,
  smooth,
  stationLatLon,
  type BodyKind,
  type OrbitEl,
  type Projector,
  type Vec3,
} from './model'

const VW = 800
const VH = 520
const CYAN = '#14f3fd'
const TRANSITION_MS = 900

export interface CelestialSvgProps extends CelestialViewProps {}

type P2 = [number, number]

interface Layout {
  s: number
  cx: number
  cy: number
}

const reducedMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

// ---------------------------------------------------------------- geometry helpers

function blob3(lat: number, lon: number, rDeg: number, seed: number, n = 22, rough = 0.22): Vec3[] {
  const c = latLonToVec(lat, lon)
  const ref: Vec3 = Math.abs(c[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0]
  const u = norm(cross(ref, c))
  const v = cross(c, u)
  const r = rng(seed)
  const t = Math.tan((rDeg * Math.PI) / 180)
  const out: Vec3[] = []
  const w1 = r() * 6
  const w2 = r() * 6
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const k = t * (1 + rough * (Math.sin(a * 3 + w1) * 0.6 + Math.sin(a * 5 + w2) * 0.4))
    out.push(norm([c[0] + (u[0] * Math.cos(a) + v[0] * Math.sin(a)) * k, c[1] + (u[1] * Math.cos(a) + v[1] * Math.sin(a)) * k, c[2] + (u[2] * Math.cos(a) + v[2] * Math.sin(a)) * k]))
  }
  return out
}

/** Projects a closed polygon on the unit sphere onto the disk; back vertices are pushed to the limb. */
function spherePath(P: Projector, pts: Vec3[], yaw: number, R: number): string | null {
  let front = 0
  const xy: P2[] = pts.map((p) => {
    const [x, y, z] = project(P, rotY(p, yaw))
    if (z >= 0) {
      front++
      return [x * R, y * R]
    }
    const h = Math.hypot(x, y) || 1
    return [(x / h) * R, (y / h) * R]
  })
  if (front === 0) return null
  return 'M' + xy.map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join('L') + 'Z'
}

const lonLatPoly = (poly: [number, number][]): Vec3[] => {
  // densify long edges so they bend with the sphere
  const out: Vec3[] = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 8))
    for (let k = 0; k < steps; k++) {
      const t = k / steps
      out.push(latLonToVec(a[1] + (b[1] - a[1]) * t, a[0] + (b[0] - a[0]) * t))
    }
  }
  return out
}

// ---------------------------------------------------------------- body artwork

function BodyArt({ kind, R, uid, P }: { kind: BodyKind; R: number; uid: string; P: Projector }) {
  const st = BODY_STYLES[kind]
  const yaw = BODY_YAW[kind]
  const sp = project(P, SUN_DIR)
  const sl = Math.hypot(sp[0], sp[1]) || 1
  const sd: P2 = [sp[0] / sl, sp[1] / sl]
  const gT = (1 + sp[2]) / 2

  const features = useMemo(() => {
    const els: { d: string; fill: string; opacity: number }[] = []
    if (kind === 'earth') {
      LAND.forEach((poly) => {
        const d = spherePath(P, lonLatPoly(poly), yaw, R)
        const polar = poly.some((q) => q[1] > 70 || q[1] < -62) && poly.every((q) => q[1] > 58 || q[1] < -55)
        if (d) els.push({ d, fill: polar ? '#e6f1f7' : '#3f8a4a', opacity: polar ? 0.9 : 0.95 })
      })
      WATER.forEach((poly) => {
        const d = spherePath(P, lonLatPoly(poly), yaw, R)
        if (d) els.push({ d, fill: st.base, opacity: 1 })
      })
      // deserts and highlands as soft overlays
      ;[[23, 12, 12], [24, 45, 8], [-25, 133, 10], [40, 95, 9], [35, -110, 6], [-12, -60, 9]].forEach(([la, lo, r], i) => {
        const d = spherePath(P, blob3(la, lo, r, 40 + i), yaw, R)
        if (d) els.push({ d, fill: i < 3 || i === 4 ? '#c9a66b' : '#2f6e3a', opacity: i < 3 || i === 4 ? 0.55 : 0.5 })
      })
      // cloud wisps
      const r = rng(7)
      for (let i = 0; i < 16; i++) {
        const la = (r() * 2 - 1) * 65
        const lo = r() * 360 - 180
        const d = spherePath(P, blob3(la, lo, 3 + r() * 6, 100 + i, 18, 0.45), yaw, R)
        if (d) els.push({ d, fill: '#ffffff', opacity: 0.22 + r() * 0.18 })
      }
    } else if (kind === 'moon') {
      MOON_MARIA.forEach(([la, lo, r], i) => {
        const d = spherePath(P, blob3(la, lo, r, 10 + i, 24, 0.3), yaw, R)
        if (d) els.push({ d, fill: '#5e5a55', opacity: 0.55 })
      })
    } else {
      MARS_DARK.forEach(([la, lo, r], i) => {
        const d = spherePath(P, blob3(la, lo, r, 20 + i, 24, 0.35), yaw, R)
        if (d) els.push({ d, fill: '#6e2a1a', opacity: 0.5 })
      })
      MARS_BRIGHT.forEach(([la, lo, r], i) => {
        const d = spherePath(P, blob3(la, lo, r, 30 + i), yaw, R)
        if (d) els.push({ d, fill: '#f2a77c', opacity: 0.35 })
      })
      const cap = spherePath(P, blob3(88, 0, 9, 3, 30, 0.15), yaw, R)
      if (cap) els.push({ d: cap, fill: '#fbefe6', opacity: 0.92 })
      const cap2 = spherePath(P, blob3(-88, 0, 6, 4, 30, 0.15), yaw, R)
      if (cap2) els.push({ d: cap2, fill: '#fbefe6', opacity: 0.85 })
    }
    return els
  }, [kind, P, yaw, R, st.base])

  const craterEls = useMemo(() => {
    if (kind === 'earth') return []
    const list = craters(kind === 'moon' ? 11 : 12, kind === 'moon' ? 70 : 30, kind === 'moon' ? 7 : 5)
    return list
      .map(([la, lo, r]) => {
        const [x, y, z] = project(P, rotY(latLonToVec(la, lo), yaw))
        if (z < 0.2) return null
        const rad = Math.sin((r * Math.PI) / 180) * R
        return { x: x * R, y: y * R, rx: rad, ry: rad * z, rot: (Math.atan2(y, x) * 180) / Math.PI + 90 }
      })
      .filter(Boolean) as { x: number; y: number; rx: number; ry: number; rot: number }[]
  }, [kind, P, yaw, R])

  return (
    <g>
      <defs>
        <radialGradient id={`${uid}-body`} cx={0.5 + sd[0] * 0.22} cy={0.5 + sd[1] * 0.22} r="0.75">
          <stop offset="0" stopColor={st.light} />
          <stop offset="0.55" stopColor={st.base} />
          <stop offset="1" stopColor={st.dark} />
        </radialGradient>
        <radialGradient id={`${uid}-glow`} cx="0.5" cy="0.5" r="0.5">
          <stop offset={0.84} stopColor={st.atmo ?? st.light} stopOpacity={st.atmo ? 0.55 * st.atmoStrength : 0.12} />
          <stop offset={1} stopColor={st.atmo ?? st.light} stopOpacity={0} />
        </radialGradient>
        <linearGradient
          id={`${uid}-night`}
          gradientUnits="userSpaceOnUse"
          x1={sd[0] * R}
          y1={sd[1] * R}
          x2={-sd[0] * R}
          y2={-sd[1] * R}
        >
          <stop offset={0} stopColor="#010816" stopOpacity={0} />
          <stop offset={clamp(gT - 0.14, 0, 1)} stopColor="#010816" stopOpacity={0} />
          <stop offset={clamp(gT + 0.06, 0, 1)} stopColor="#010816" stopOpacity={0.74} />
          <stop offset={1} stopColor="#010816" stopOpacity={0.9} />
        </linearGradient>
        <clipPath id={`${uid}-clip`}>
          <circle r={R} />
        </clipPath>
      </defs>
      <circle r={R * (st.atmo ? 1.2 : 1.1)} fill={`url(#${uid}-glow)`} />
      <g clipPath={`url(#${uid}-clip)`}>
        <circle r={R} fill={`url(#${uid}-body)`} />
        {features.map((f, i) => (
          <path key={i} d={f.d} fill={f.fill} fillOpacity={f.opacity} />
        ))}
        {craterEls.map((c, i) => (
          <ellipse
            key={i}
            cx={c.x}
            cy={c.y}
            rx={c.rx}
            ry={c.ry}
            transform={`rotate(${c.rot.toFixed(1)} ${c.x.toFixed(1)} ${c.y.toFixed(1)})`}
            fill="#000"
            fillOpacity={0.14}
            stroke="#fff"
            strokeOpacity={0.16}
            strokeWidth={0.8}
          />
        ))}
        <circle r={R} fill={`url(#${uid}-night)`} />
      </g>
      <circle r={R} fill="none" stroke={st.atmo ?? st.light} strokeOpacity={st.atmo ? 0.55 : 0.18} strokeWidth={st.atmo ? 2 : 1} />
    </g>
  )
}

function SmallBody({ kind, x, y, r, uid }: { kind: BodyKind | 'sun'; x: number; y: number; r: number; uid: string }) {
  if (kind === 'sun') {
    return (
      <g transform={`translate(${x} ${y})`}>
        <defs>
          <radialGradient id={`${uid}-sun`}>
            <stop offset="0" stopColor="#fff6d8" />
            <stop offset="0.35" stopColor="#fecc4a" />
            <stop offset="1" stopColor="#f4ad19" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle r={r * 2.6} fill={`url(#${uid}-sun)`} />
        <circle r={r} fill="#ffe08a" />
      </g>
    )
  }
  const st = BODY_STYLES[kind]
  return (
    <g transform={`translate(${x} ${y})`}>
      <defs>
        <radialGradient id={`${uid}-sb-${kind}`} cx="0.35" cy="0.35" r="0.8">
          <stop offset="0" stopColor={st.light} />
          <stop offset="0.6" stopColor={st.base} />
          <stop offset="1" stopColor={st.dark} />
        </radialGradient>
      </defs>
      {st.atmo && <circle r={r * 1.35} fill={st.atmo} fillOpacity={0.14} />}
      <circle r={r} fill={`url(#${uid}-sb-${kind})`} />
      {kind === 'earth' && (
        <path d={`M${-r * 0.5},${-r * 0.3} q${r * 0.3},${-r * 0.4} ${r * 0.6},${-r * 0.1} q${-r * 0.1},${r * 0.5} ${-r * 0.3},${r * 0.9} q${-r * 0.3},${-r * 0.3} ${-r * 0.3},${-r * 0.8}z`} fill="#3f8a4a" fillOpacity={0.85} />
      )}
    </g>
  )
}

function Pill({ x, y, text, tone = CYAN, anchor = 'start', fs = 15 }: { x: number; y: number; text: string; tone?: string; anchor?: 'start' | 'end' | 'middle'; fs?: number }) {
  const w = text.length * fs * 0.54 + fs * 1.33
  const h = fs * 1.87
  const left = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2
  return (
    <g pointerEvents="none">
      <rect x={left} y={y - h / 2} width={w} height={h} rx={8} fill="#021f2b" fillOpacity={0.88} stroke={tone} strokeOpacity={0.85} strokeWidth={1.5} />
      <text x={left + w / 2} y={y + fs / 3} textAnchor="middle" fill="#fdf8ef" fontSize={fs} fontWeight={700} className="font-heading">
        {text}
      </text>
    </g>
  )
}

function Spacecraft({ gRef }: { gRef: React.Ref<SVGGElement> }) {
  return (
    <g ref={gRef} style={{ willChange: 'transform' }}>
      <circle r={16} fill={CYAN} fillOpacity={0.14} />
      <circle r={7} fill={CYAN} fillOpacity={0.25} />
      <g data-rot="">
        <rect x={-21} y={-4} width={13} height={8} rx={1} fill="#1d4fb8" stroke="#8fd8ff" strokeWidth={0.8} />
        <rect x={8} y={-4} width={13} height={8} rx={1} fill="#1d4fb8" stroke="#8fd8ff" strokeWidth={0.8} />
        <rect x={-5} y={-5} width={10} height={10} rx={1.5} fill="#e0a83e" stroke="#ffe3a0" strokeWidth={0.8} />
      </g>
    </g>
  )
}

// ---------------------------------------------------------------- main component

const STARS = (() => {
  const r = rng(3)
  return Array.from({ length: 90 }, () => ({ x: (r() - 0.5) * VW, y: (r() - 0.5) * VH, r: 0.4 + r() * 1.1, o: 0.2 + r() * 0.6 }))
})()

function bbox(pts: P2[]) {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const [x, y] of pts) {
    if (x < x0) x0 = x
    if (y < y0) y0 = y
    if (x > x1) x1 = x
    if (y > y1) y1 = y
  }
  return { x0, y0, x1, y1 }
}

export default function CelestialSvg(props: CelestialSvgProps) {
  const { missionId, orbitId, stations = [], activeStation = null, cruise = false, className } = props
  // Label font in viewBox units: keeps text at least ~14 design px however small the panel is;
  // when the drawing is tiny the labels are dropped (the orbit cards carry the same information).
  const svgRef = useRef<SVGSVGElement>(null)
  const [fit, setFit] = useState({ fs: 15, show: true })
  useEffect(() => {
    const el = svgRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const measure = () => {
      const sc = Math.min(el.clientWidth / VW, el.clientHeight / VH)
      if (!(sc > 0)) return
      const fs = Math.min(26, Math.max(15, 14.4 / sc))
      setFit((f) => (Math.abs(f.fs - fs) < 0.4 && f.show === sc >= 0.55 ? f : { fs, show: sc >= 0.55 }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const labels = props.labels !== false && fit.show
  const fs = fit.fs
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const kind = bodyKindOf(missionId)
  const mission = MISSIONS[missionId as MissionId] as (typeof MISSIONS)[MissionId] | undefined
  const remote = kind !== 'earth'

  const target = orbitSpec(orbitId)
  const [curEl, setCurEl] = useState<OrbitEl | null>(target?.el ?? null)
  const fromRef = useRef<{ from: OrbitEl; to: OrbitEl; t0: number } | null>(null)
  const curRef = useRef(curEl)
  curRef.current = curEl

  useEffect(() => {
    const to = orbitSpec(orbitId)?.el ?? null
    const from = curRef.current
    if (!to || !from || reducedMotion()) {
      fromRef.current = null
      setCurEl(to)
      return
    }
    if (from === to) return
    fromRef.current = { from, to, t0: performance.now() }
  }, [orbitId])

  const P = useMemo(() => makeProjector(CAM_DIR), [])
  const cr = useMemo(() => (cruise ? cruiseScene(kind, orbitId) : null), [cruise, kind, orbitId])
  const PC = useMemo(() => (cr ? makeProjector(cr.camDir) : P), [cr, P])

  // --- layout (fit everything into the viewBox)
  const path = useMemo(() => (curEl ? orbitPath(curEl, 200) : []), [curEl])
  const ghost = useMemo(() => {
    const g = !cruise && target?.ghost ? target.ghost : null
    return g ? orbitPath(g, 160) : []
  }, [cruise, target?.ghost])

  const layout: Layout = useMemo(() => {
    if (cr) {
      const pts: P2[] = []
      cr.path.forEach((p) => pts.push(project(PC, p).slice(0, 2) as P2))
      cr.bodies.forEach((b) => {
        const [x, y] = project(PC, b.pos)
        const rr = b.kind === 'sun' ? b.r * 2 : b.r * 1.3
        pts.push([x - rr, y - rr], [x + rr, y + rr])
      })
      cr.rings.forEach((r) => {
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2
          pts.push(project(PC, [Math.cos(a) * r.r, 0, Math.sin(a) * r.r]).slice(0, 2) as P2)
        }
      })
      const b = bbox(pts)
      const s = Math.min((VW * 0.84) / (b.x1 - b.x0), (VH * 0.78) / (b.y1 - b.y0))
      return { s, cx: (b.x0 + b.x1) / 2, cy: (b.y0 + b.y1) / 2 + 0.03 * (b.y1 - b.y0) }
    }
    const pts: P2[] = [
      [-1.15, -1.15],
      [1.15, 1.15],
    ]
    path.forEach((p) => pts.push(project(P, p).slice(0, 2) as P2))
    ghost.forEach((p) => pts.push(project(P, p).slice(0, 2) as P2))
    const b = bbox(pts)
    // keep the body near the centre, then fit around that centre
    const cx = clamp((b.x0 + b.x1) / 2, -0.6, 0.6)
    const cy = clamp((b.y0 + b.y1) / 2, -1.2, 1.2)
    const hx = Math.max(cx - b.x0, b.x1 - cx)
    const hy = Math.max(cy - b.y0, b.y1 - cy)
    const s = Math.min((VW * 0.42) / hx, (VH * 0.43) / hy, 165)
    return { s, cx, cy }
  }, [cr, PC, P, path, ghost])

  const toScreen = (proj: Projector, v: Vec3, L: Layout): [number, number, number] => {
    const [x, y, z] = project(proj, v)
    return [(x - L.cx) * L.s, (y - L.cy) * L.s, z]
  }

  // --- orbit path strings (back = full dim loop, front = near-side segments)
  const orbitD = useMemo(() => {
    if (cr || path.length === 0) return null
    const scr = path.map((p) => toScreen(P, p, layout))
    const full = 'M' + scr.map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join('L')
    let front = ''
    let pen = false
    scr.forEach((q) => {
      const r = Math.hypot(q[0] + layout.cx * layout.s, q[1] + layout.cy * layout.s)
      const visible = q[2] >= 0 || r > layout.s * 1.0
      if (visible) {
        front += `${pen ? 'L' : 'M'}${q[0].toFixed(1)},${q[1].toFixed(1)}`
        pen = true
      } else pen = false
    })
    let top = scr[0]
    scr.forEach((q) => {
      if (q[1] < top[1]) top = q
    })
    return { full, front, top }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cr, path, layout, P])

  const ghostD = useMemo(() => {
    if (!ghost.length) return null
    return 'M' + ghost.map((p) => toScreen(P, p, layout)).map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join('L')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ghost, layout, P])

  const cruiseD = useMemo(() => {
    if (!cr) return null
    const scr = cr.path.map((p) => toScreen(PC, p, layout))
    const d = 'M' + scr.map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join('L')
    const rings = cr.rings.map((r) => {
      const pts: string[] = []
      for (let i = 0; i <= 96; i++) {
        const a = (i / 96) * Math.PI * 2
        const q = toScreen(PC, [Math.cos(a) * r.r, 0, Math.sin(a) * r.r], layout)
        pts.push(`${q[0].toFixed(1)},${q[1].toFixed(1)}`)
      }
      return { d: 'M' + pts.join('L'), color: r.color }
    })
    const bodies = cr.bodies.map((b) => {
      const q = toScreen(PC, b.pos, layout)
      return { ...b, x: q[0], y: q[1], rr: Math.max(b.r * layout.s, 6) }
    })
    return { d, rings, bodies }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cr, layout, PC])

  // --- stations
  const bodyR = layout.s
  const bodyX = -layout.cx * layout.s
  const bodyY = -layout.cy * layout.s
  const RE = { x: -VW / 2 + 74, y: -VH / 2 + 74, r: 30 }

  const stationPts = useMemo(() => {
    if (cr) return []
    return stations.map((id, i) => {
      if (remote) {
        // spread on the limb of the small Earth, facing the body
        const base = Math.atan2(bodyY - RE.y, bodyX - RE.x)
        const a = base + (i - (stations.length - 1) / 2) * 0.55
        return { id, x: RE.x + Math.cos(a) * RE.r, y: RE.y + Math.sin(a) * RE.r, z: 1, w: [0, 0, 0] as Vec3 }
      }
      const [la, lo] = stationLatLon(id)
      const w = rotY(latLonToVec(la, lo), BODY_YAW.earth)
      const [x, y, z] = project(P, w)
      if (z >= 0) return { id, x: bodyX + x * bodyR, y: bodyY + y * bodyR, z, w }
      const h = Math.hypot(x, y) || 1
      return { id, x: bodyX + (x / h) * bodyR, y: bodyY + (y / h) * bodyR, z, w }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cr, stations.join(','), remote, bodyX, bodyY, bodyR, P])

  const stationName = (id: string | null) => mission?.stations.find((s) => s.id === id)?.name ?? id ?? ''
  const orbitName = mission?.orbits.find((o) => o.id === orbitId)?.name ?? ''

  // --- animation loop (spacecraft + beam)
  const scRef = useRef<SVGGElement>(null)
  const beamRef = useRef<SVGGElement>(null)
  const beamPolyRef = useRef<SVGPolygonElement>(null)
  const beamLineRef = useRef<SVGLineElement>(null)
  const live = useRef({ props, layout, cr, stationPts, P, PC })
  live.current = { props, layout, cr, stationPts, P, PC }

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const start = last
    let shown = props.phase ?? 0
    let beamA = 0
    const still = reducedMotion()
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const L = live.current
      const animate = (L.props.animate ?? true) && !still
      const el = (now - start) / 1000

      // orbit morph
      const tr = fromRef.current
      if (tr) {
        const t = clamp((now - tr.t0) / TRANSITION_MS, 0, 1)
        setCurEl(t >= 1 ? tr.to : lerpEl(tr.from, tr.to, smooth(t)))
        if (t >= 1) fromRef.current = null
      }

      const g = scRef.current
      if (!g) return
      let pos: Vec3 | null = null
      let ahead: Vec3 | null = null
      let proj = L.P
      if (L.cr) {
        const tgt = L.props.phase ?? (animate ? (el / 18) % 1 : 0.5)
        shown = chasePhase(shown, tgt, dt, false)
        pos = alongPath(L.cr.path, shown)
        ahead = alongPath(L.cr.path, Math.min(1, shown + 0.01))
        proj = L.PC
      } else {
        const cur = curRef.current
        if (cur) {
          const spec = orbitSpec(L.props.orbitId)
          const lap = spec?.lapSeconds ?? 16
          shown = chasePhase(shown, L.props.phase ?? 0, dt, true)
          const m = shown + (animate ? el / lap : 0)
          pos = orbitPoint(cur, m)
          ahead = orbitPoint(cur, m + 0.004)
        }
      }
      if (!pos || !ahead) {
        g.style.opacity = '0'
        if (beamRef.current) beamRef.current.style.opacity = '0'
        return
      }
      const q = toScreen(proj, pos, L.layout)
      const qa = toScreen(proj, ahead, L.layout)
      const ang = (Math.atan2(qa[1] - q[1], qa[0] - q[0]) * 180) / Math.PI
      const bx = -L.layout.cx * L.layout.s
      const by = -L.layout.cy * L.layout.s
      const hidden = !L.cr && q[2] < 0 && Math.hypot(q[0] - bx, q[1] - by) < L.layout.s * 0.98
      g.setAttribute('transform', `translate(${q[0].toFixed(1)} ${q[1].toFixed(1)})`)
      const inner = g.lastElementChild as SVGGElement | null
      inner?.setAttribute('transform', `rotate(${ang.toFixed(1)})`)
      g.style.opacity = hidden ? '0' : '1'

      // beam to the active station (only with line of sight)
      const active = L.props.activeStation
      const st = active ? L.stationPts.find((s) => s.id === active) : undefined
      let want = 0
      if (st && !L.cr && !hidden) {
        if (remote) {
          const re = REMOTE_EARTH[kind === 'mars' ? 'mars' : 'moon'].pos
          want = lineOfSight(re, pos, [{ c: [0, 0, 0], r: 1 }]) ? 1 : 0
        } else {
          want = lineOfSight(scale(st.w, 1.01), pos, [{ c: [0, 0, 0], r: 1 }]) ? 1 : 0
        }
      }
      beamA += (want - beamA) * (1 - Math.exp(-6 * dt))
      const bg = beamRef.current
      if (bg) {
        bg.style.opacity = beamA.toFixed(3)
        if (st && beamA > 0.01) {
          const dx = q[0] - st.x
          const dy = q[1] - st.y
          const l = Math.hypot(dx, dy) || 1
          const nx = -dy / l
          const ny = dx / l
          const w0 = 11
          const w1 = 2
          beamPolyRef.current?.setAttribute(
            'points',
            `${st.x + nx * w0},${st.y + ny * w0} ${st.x - nx * w0},${st.y - ny * w0} ${q[0] - nx * w1},${q[1] - ny * w1} ${q[0] + nx * w1},${q[1] + ny * w1}`,
          )
          const ln = beamLineRef.current
          if (ln) {
            ln.setAttribute('x1', q[0].toFixed(1))
            ln.setAttribute('y1', q[1].toFixed(1))
            ln.setAttribute('x2', st.x.toFixed(1))
            ln.setAttribute('y2', st.y.toFixed(1))
          }
        }
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, remote])

  const activePt = stationPts.find((s) => s.id === activeStation)

  return (
    <svg
      ref={svgRef}
      viewBox={`${-VW / 2} ${-VH / 2} ${VW} ${VH}`}
      preserveAspectRatio="xMidYMid meet"
      className={className ?? 'h-full w-full'}
      role="img"
      aria-label={cruise ? `Transfer to ${BODY_STYLES[kind].name}` : `${BODY_STYLES[kind].name}${orbitName ? ' — ' + orbitName : ''}`}
    >
      <style>{`@keyframes ${uid}-flow{to{stroke-dashoffset:-24}}@keyframes ${uid}-pulse{0%{transform:scale(.6);opacity:.9}100%{transform:scale(2.4);opacity:0}}`}</style>
      <g>
        {STARS.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fdf8ef" fillOpacity={s.o * 0.7} />
        ))}
      </g>

      {cr && cruiseD ? (
        <g>
          {cruiseD.rings.map((r, i) => (
            <path key={i} d={r.d} fill="none" stroke={r.color} strokeOpacity={0.28} strokeWidth={1.2} strokeDasharray="3 6" />
          ))}
          {cruiseD.bodies.map((b, i) => (
            b.kind === 'sun' ? (
              <SmallBody key={i} kind="sun" x={b.x} y={b.y} r={b.rr} uid={`${uid}c${i}`} />
            ) : (
              <g key={i} transform={`translate(${b.x.toFixed(1)} ${b.y.toFixed(1)})`}>
                <BodyArt kind={b.kind} R={b.rr} uid={`${uid}c${i}`} P={PC} />
              </g>
            )
          ))}
          <path d={cruiseD.d} fill="none" stroke={CYAN} strokeOpacity={0.18} strokeWidth={7} />
          <path d={cruiseD.d} fill="none" stroke="#fdf8ef" strokeOpacity={0.8} strokeWidth={1.6} strokeDasharray="5 7" style={{ animation: `${uid}-flow 1.6s linear infinite` }} />
          {labels &&
            cruiseD.bodies.map((b, i) => (
              <text key={i} x={b.x} y={b.y + b.rr + 22} textAnchor="middle" fill="#9fb3c8" fontSize={fs} fontWeight={700} className="font-heading">
                {b.label}
              </text>
            ))}
          {labels && <Pill x={0} y={-VH / 2 + 30 + Math.round(fs * 3.8)} text="Transfer trajectory" anchor="middle" fs={fs} />}
        </g>
      ) : (
        <g>
          {remote && (
            <g>
              <SmallBody kind="earth" x={RE.x} y={RE.y} r={RE.r} uid={`${uid}re`} />
              {labels && (
                <text x={RE.x} y={RE.y + RE.r + 20} textAnchor="middle" fill="#9fb3c8" fontSize={fs} fontWeight={700} className="font-heading">
                  Earth
                </text>
              )}
            </g>
          )}
          {orbitD && <path d={orbitD.full} fill="none" stroke={CYAN} strokeOpacity={0.32} strokeWidth={1.6} />}
          {ghostD && <path d={ghostD} fill="none" stroke={CYAN} strokeOpacity={0.35} strokeWidth={1.2} strokeDasharray="4 6" />}
          <g transform={`translate(${bodyX} ${bodyY})`}>
            <BodyArt kind={kind} R={bodyR} uid={uid} P={P} />
          </g>
          {orbitD && (
            <g>
              <path d={orbitD.front} fill="none" stroke={CYAN} strokeOpacity={0.22} strokeWidth={8} strokeLinecap="round" />
              <path d={orbitD.front} fill="none" stroke={CYAN} strokeWidth={2.6} strokeLinecap="round" />
            </g>
          )}
          {labels && orbitD && orbitName && (
            <g>
              <line x1={orbitD.top[0]} y1={orbitD.top[1]} x2={orbitD.top[0] + (remote ? 40 : -40)} y2={Math.max(-VH / 2 + fs + 6, orbitD.top[1] - 22)} stroke={CYAN} strokeOpacity={0.8} strokeWidth={1.2} />
              <Pill x={orbitD.top[0] + (remote ? 40 : -40)} y={Math.max(-VH / 2 + fs + 6, orbitD.top[1] - 22)} text={orbitName} anchor={remote ? 'start' : 'end'} fs={fs} />
            </g>
          )}
        </g>
      )}

      {/* beam */}
      <g ref={beamRef} style={{ opacity: 0 }} pointerEvents="none">
        <defs>
          <linearGradient id={`${uid}-beam`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={CYAN} stopOpacity={0.3} />
            <stop offset="1" stopColor={CYAN} stopOpacity={0.12} />
          </linearGradient>
        </defs>
        <polygon ref={beamPolyRef} points="0,0 0,0 0,0" fill={`url(#${uid}-beam)`} />
        <line ref={beamLineRef} stroke={CYAN} strokeWidth={1.6} strokeDasharray="6 6" style={{ animation: `${uid}-flow 0.9s linear infinite` }} />
      </g>

      {/* stations */}
      {stationPts.map((s) => {
        const on = s.id === activeStation
        const dim = !remote && s.z < 0
        return (
          <g key={s.id} transform={`translate(${s.x.toFixed(1)} ${s.y.toFixed(1)})`} opacity={dim ? 0.45 : 1}>
            {on && <circle r={7} fill="none" stroke={CYAN} strokeWidth={1.5} style={{ animation: `${uid}-pulse 1.8s ease-out infinite`, transformBox: 'fill-box', transformOrigin: 'center' }} />}
            <circle r={on ? 6 : 4.5} fill="#021f2b" stroke={on ? CYAN : '#f4ad19'} strokeWidth={2} />
            <circle r={on ? 2.6 : 1.8} fill={on ? CYAN : '#f4ad19'} />
          </g>
        )
      })}
      {labels && activePt && !cr && (
        <Pill
          x={activePt.x + (remote ? 14 : activePt.x > bodyX ? 14 : -14)}
          y={activePt.y + (remote ? 26 : 0)}
          text={stationName(activeStation)}
          anchor={remote || activePt.x > bodyX ? 'start' : 'end'}
          fs={fs}
        />
      )}

      <Spacecraft gRef={scRef} />
    </svg>
  )
}
