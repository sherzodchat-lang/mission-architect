// Procedural textures for spacecraft materials. Everything is generated in code (canvas / typed
// arrays) once and cached for the lifetime of the app. No downloaded imagery.
import * as THREE from 'three'

/** Small deterministic PRNG (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const cache = new Map<string, THREE.Texture>()

function canvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return { c, g: c.getContext('2d')! }
}

function finish(t: THREE.Texture, color: boolean, aniso = 8) {
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = aniso
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace
  t.generateMipmaps = true
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.needsUpdate = true
  return t
}

function cached(key: string, make: () => THREE.Texture) {
  let t = cache.get(key)
  if (!t) {
    t = make()
    cache.set(key, t)
  }
  return t
}

/** Height field (0..1, tileable) → tangent-space normal map. */
function heightToNormal(h: Float32Array, n: number, strength: number) {
  const data = new Uint8Array(n * n * 4)
  const at = (x: number, y: number) => h[((y + n) % n) * n + ((x + n) % n)]
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength
      const l = Math.hypot(dx, dy, 1)
      const i = (y * n + x) * 4
      data[i] = ((-dx / l) * 0.5 + 0.5) * 255
      data[i + 1] = ((dy / l) * 0.5 + 0.5) * 255
      data[i + 2] = ((1 / l) * 0.5 + 0.5) * 255
      data[i + 3] = 255
    }
  }
  const t = new THREE.DataTexture(data, n, n, THREE.RGBAFormat)
  return finish(t, false)
}

/**
 * Crumpled multi-layer-insulation foil: a tileable Voronoi field where every cell is a flat facet
 * with a random tilt (two scales), giving sharp creases between facets.
 */
export function crinkleNormal() {
  return cached('crinkle', () => {
    const n = 512
    const h = new Float32Array(n * n)
    const layer = (cells: number, amp: number, seed: number) => {
      const r = rng(seed)
      const pts: { x: number; y: number; gx: number; gy: number; o: number }[] = []
      for (let j = 0; j < cells; j++)
        for (let i = 0; i < cells; i++)
          pts.push({ x: (i + r()) / cells, y: (j + r()) / cells, gx: (r() - 0.5) * 2, gy: (r() - 0.5) * 2, o: r() })
      for (let y = 0; y < n; y++) {
        const fy = y / n
        const cj = Math.floor(fy * cells)
        for (let x = 0; x < n; x++) {
          const fx = x / n
          const ci = Math.floor(fx * cells)
          let best = 1e9
          let val = 0
          for (let dj = -1; dj <= 1; dj++)
            for (let di = -1; di <= 1; di++) {
              const ii = (ci + di + cells) % cells
              const jj = (cj + dj + cells) % cells
              const p = pts[jj * cells + ii]
              const px = p.x + Math.floor((ci + di) / cells)
              const py = p.y + Math.floor((cj + dj) / cells)
              const ddx = fx - px
              const ddy = fy - py
              const d = ddx * ddx + ddy * ddy
              if (d < best) {
                best = d
                val = (ddx * p.gx + ddy * p.gy) * cells + p.o * 0.3
              }
            }
          h[y * n + x] += val * amp
        }
      }
    }
    layer(9, 0.6, 11)
    layer(23, 0.25, 29)
    return heightToNormal(h, n, 3.2)
  })
}

/** Brushed metal: fine horizontal streaks, used as a roughness map (values around 0.5–0.8 → scaled by material.roughness). */
export function brushedRoughness() {
  return cached('brushed', () => {
    const { c, g } = canvas(256, 256)
    const r = rng(5)
    g.fillStyle = '#b8b8b8'
    g.fillRect(0, 0, 256, 256)
    for (let i = 0; i < 900; i++) {
      const y = r() * 256
      const v = 150 + r() * 100
      g.strokeStyle = `rgba(${v},${v},${v},${0.25 + r() * 0.35})`
      g.lineWidth = 0.5 + r() * 1.2
      const x = r() * 256
      const len = 40 + r() * 220
      g.beginPath()
      g.moveTo(x, y)
      g.lineTo(x + len, y)
      g.stroke()
      if (x + len > 256) {
        g.beginPath()
        g.moveTo(x - 256, y)
        g.lineTo(x + len - 256, y)
        g.stroke()
      }
    }
    return finish(new THREE.CanvasTexture(c), false)
  })
}

/**
 * One solar cell tile (triple-junction GaAs look): deep blue cell with fine grid fingers, a silver
 * busbar along one edge, cropped corners and a light gap (substrate) around it.
 */
export function solarCellMap() {
  return cached('solar', () => {
    const s = 256
    const { c, g } = canvas(s, s)
    // substrate / gap
    g.fillStyle = '#9aa3ad'
    g.fillRect(0, 0, s, s)
    const m = 5
    const cut = 22
    g.beginPath()
    g.moveTo(m + cut, m)
    g.lineTo(s - m - cut, m)
    g.lineTo(s - m, m + cut)
    g.lineTo(s - m, s - m - cut)
    g.lineTo(s - m - cut, s - m)
    g.lineTo(m + cut, s - m)
    g.lineTo(m, s - m - cut)
    g.lineTo(m, m + cut)
    g.closePath()
    const grd = g.createLinearGradient(0, 0, s, s)
    grd.addColorStop(0, '#1c2f6e')
    grd.addColorStop(0.5, '#142659')
    grd.addColorStop(1, '#0f1d48')
    g.fillStyle = grd
    g.fill()
    g.save()
    g.clip()
    // subtle crystalline mottling
    const r = rng(77)
    for (let i = 0; i < 260; i++) {
      g.fillStyle = `rgba(${40 + r() * 40},${60 + r() * 50},${140 + r() * 80},${0.05 + r() * 0.06})`
      g.fillRect(r() * s, r() * s, 6 + r() * 30, 6 + r() * 30)
    }
    // grid fingers
    g.strokeStyle = 'rgba(190,200,215,0.55)'
    g.lineWidth = 1
    for (let x = m + 10; x < s - m; x += 9) {
      g.beginPath()
      g.moveTo(x + 0.5, m)
      g.lineTo(x + 0.5, s - m - 14)
      g.stroke()
    }
    g.restore()
    // busbar
    g.fillStyle = '#d7dde4'
    g.fillRect(m + cut, s - m - 14, s - 2 * m - 2 * cut, 9)
    g.fillStyle = '#eef2f6'
    for (let x = m + cut + 6; x < s - m - cut - 10; x += 26) g.fillRect(x, s - m - 17, 12, 4)
    return finish(new THREE.CanvasTexture(c), true, 12)
  })
}

/** Roughness for the solar tile: busbars/gaps rougher than the glassy cell. */
export function solarCellRough() {
  return cached('solarR', () => {
    const s = 128
    const { c, g } = canvas(s, s)
    g.fillStyle = '#7a7a7a'
    g.fillRect(0, 0, s, s)
    g.fillStyle = '#2a2a2a'
    g.fillRect(3, 3, s - 6, s - 13)
    g.fillStyle = '#555'
    g.fillRect(14, s - 10, s - 28, 5)
    return finish(new THREE.CanvasTexture(c), false)
  })
}

/** Printed circuit board: solder mask, Manhattan traces, pads, vias and silkscreen marks. */
export function pcbMap(mask: 'green' | 'blue' | 'black' | 'red') {
  return cached('pcb-' + mask, () => {
    const s = 512
    const { c, g } = canvas(s, s)
    const base = { green: '#1d5e34', blue: '#1b3f7a', black: '#17191c', red: '#7a1f1f' }[mask]
    const trace = { green: '#2f8a4c', blue: '#2f5fa6', black: '#2e3238', red: '#a03030' }[mask]
    g.fillStyle = base
    g.fillRect(0, 0, s, s)
    const r = rng(mask.length * 131)
    g.lineCap = 'round'
    g.lineJoin = 'round'
    for (let i = 0; i < 260; i++) {
      g.strokeStyle = trace
      g.lineWidth = r() < 0.15 ? 4 : 1.6
      let x = Math.round(r() * s)
      let y = Math.round(r() * s)
      g.beginPath()
      g.moveTo(x, y)
      const segs = 2 + Math.floor(r() * 4)
      for (let k = 0; k < segs; k++) {
        const d = 10 + r() * 80
        const dir = Math.floor(r() * 8)
        const a = (dir * Math.PI) / 4
        x += Math.round(Math.cos(a) * d)
        y += Math.round(Math.sin(a) * d)
        g.lineTo(x, y)
      }
      g.stroke()
    }
    // vias
    for (let i = 0; i < 220; i++) {
      const x = r() * s
      const y = r() * s
      g.fillStyle = '#c9a54a'
      g.beginPath()
      g.arc(x, y, 2.6, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = '#1a1a1a'
      g.beginPath()
      g.arc(x, y, 1, 0, Math.PI * 2)
      g.fill()
    }
    // pads rows
    for (let i = 0; i < 40; i++) {
      const x = r() * s
      const y = r() * s
      const n = 3 + Math.floor(r() * 10)
      const vert = r() < 0.5
      g.fillStyle = r() < 0.5 ? '#d8b552' : '#c8ccd2'
      for (let k = 0; k < n; k++) g.fillRect(vert ? x : x + k * 6, vert ? y + k * 6 : y, 3.5, 3.5)
    }
    // silkscreen
    g.strokeStyle = 'rgba(235,235,225,0.75)'
    g.fillStyle = 'rgba(235,235,225,0.75)'
    g.lineWidth = 1.2
    for (let i = 0; i < 26; i++) {
      const x = r() * s
      const y = r() * s
      g.strokeRect(x, y, 12 + r() * 40, 8 + r() * 30)
      for (let k = 0; k < 3; k++) g.fillRect(x + k * 5, y - 7, 3, 4)
    }
    // mounting holes
    for (const [x, y] of [[18, 18], [s - 18, 18], [18, s - 18], [s - 18, s - 18]]) {
      g.fillStyle = '#d6b04e'
      g.beginPath()
      g.arc(x, y, 11, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = '#0d0d0d'
      g.beginPath()
      g.arc(x, y, 6, 0, Math.PI * 2)
      g.fill()
    }
    return finish(new THREE.CanvasTexture(c), true)
  })
}

/** 2×2 twill carbon-fibre weave (color map). */
export function carbonMap() {
  return cached('carbon', () => {
    const s = 128
    const { c, g } = canvas(s, s)
    const n = 8
    const w = s / n
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const horiz = ((i + j) >> 1) % 2 === 0
        const grd = horiz ? g.createLinearGradient(0, j * w, 0, j * w + w) : g.createLinearGradient(i * w, 0, i * w + w, 0)
        grd.addColorStop(0, '#15171a')
        grd.addColorStop(0.5, '#3a3e45')
        grd.addColorStop(1, '#15171a')
        g.fillStyle = grd
        g.fillRect(i * w, j * w, w, w)
      }
    return finish(new THREE.CanvasTexture(c), true)
  })
}

/** Hex hole pattern for ion-engine grids and vent screens (color map: dark holes on metal). */
export function hexHoleMap() {
  return cached('hex', () => {
    const s = 256
    const { c, g } = canvas(s, s)
    g.fillStyle = '#9ba1a8'
    g.fillRect(0, 0, s, s)
    g.fillStyle = '#0a0b0d'
    const step = 16
    const rows = s / (step * 0.866)
    for (let j = 0; j <= rows + 1; j++)
      for (let i = -1; i <= s / step + 1; i++) {
        const x = i * step + (j % 2 ? step / 2 : 0)
        const y = j * step * 0.866
        g.beginPath()
        g.arc(x, y, 5.6, 0, Math.PI * 2)
        g.fill()
      }
    return finish(new THREE.CanvasTexture(c), true)
  })
}

/** Fine copper winding stripes (for magnetorquer coils / wound rods). */
export function windingMap() {
  return cached('winding', () => {
    const s = 64
    const { c, g } = canvas(s, s)
    for (let y = 0; y < s; y += 4) {
      const grd = g.createLinearGradient(0, y, 0, y + 4)
      grd.addColorStop(0, '#5a2c12')
      grd.addColorStop(0.5, '#e09060')
      grd.addColorStop(1, '#5a2c12')
      g.fillStyle = grd
      g.fillRect(0, y, s, 4)
    }
    return finish(new THREE.CanvasTexture(c), true)
  })
}

/** Knurled grip / ribbed normal (vertical ridges). */
export function ridgeNormal() {
  return cached('ridge', () => {
    const n = 64
    const h = new Float32Array(n * n)
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) h[y * n + x] = Math.abs(Math.sin((x / n) * Math.PI * 8))
    return heightToNormal(h, n, 2.5)
  })
}

/** Soft radial glow sprite (for engine glow / highlights). */
export function glowTexture() {
  return cached('glow', () => {
    const s = 128
    const { c, g } = canvas(s, s)
    const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
    grd.addColorStop(0, 'rgba(255,255,255,1)')
    grd.addColorStop(0.25, 'rgba(255,255,255,0.45)')
    grd.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grd
    g.fillRect(0, 0, s, s)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  })
}

/** Tiny label decal: white text on a dark plate (e.g. "SN-01" plates). */
export function labelMap(text: string, bg = '#1b1d21', fg = '#e8e6df') {
  return cached('label-' + text + bg + fg, () => {
    const { c, g } = canvas(256, 64)
    g.fillStyle = bg
    g.fillRect(0, 0, 256, 64)
    g.fillStyle = fg
    g.font = '600 34px ui-monospace, "SFMono-Regular", Menlo, monospace'
    g.textBaseline = 'middle'
    g.fillText(text, 14, 34)
    const t = finish(new THREE.CanvasTexture(c), true)
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
    return t
  })
}
