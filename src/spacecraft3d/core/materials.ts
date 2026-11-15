// Shared, cached PBR materials for spacecraft parts. Materials live for the whole app session
// (never disposed by individual parts); views that need per-instance changes (x-ray fade) clone.
import * as THREE from 'three'
import {
  brushedRoughness,
  carbonMap,
  crinkleNormal,
  hexHoleMap,
  pcbMap,
  ridgeNormal,
  solarCellMap,
  solarCellRough,
  windingMap,
} from './textures'

export type MatKey =
  | 'alu' | 'aluDark' | 'aluGold' | 'aluBlue' | 'steel' | 'titanium' | 'screw'
  | 'mliGold' | 'mliSilver' | 'mliBlack' | 'kapton' | 'tape'
  | 'solar' | 'solarBack' | 'cfrp'
  | 'pcbGreen' | 'pcbBlue' | 'pcbBlack' | 'pcbRed'
  | 'chip' | 'chipLid' | 'goldPin' | 'copper' | 'winding'
  | 'plasticBlack' | 'plasticWhite' | 'whitePaint' | 'blackPaint' | 'greyPaint'
  | 'glass' | 'germanium' | 'mirror' | 'sapphire'
  | 'cellBlue' | 'cellGreen' | 'cellPurple' | 'ferrite' | 'magnet' | 'rubber'
  | 'cable' | 'cableWhite' | 'cableRed' | 'cableAmber' | 'nylon'
  | 'deck' | 'nozzle' | 'copv' | 'ionGrid' | 'ceramic' | 'led' | 'ledRed' | 'beryllium'

/**
 * Metres per texture repeat for world-scaled UVs (scaled again by PartBuilder.texScale).
 * 0 = UVs are set by the geometry helper itself (no scaling).
 */
export const TILE: Partial<Record<MatKey, number>> = {
  deck: 0.3, alu: 0.12, aluDark: 0.12, aluGold: 0.12, aluBlue: 0.12, titanium: 0.15,
  mliGold: 0.07, mliSilver: 0.07, mliBlack: 0.07, kapton: 0.07,
  cfrp: 0.03, solarBack: 0.03, copv: 0.04,
  pcbGreen: 0.09, pcbBlue: 0.09, pcbBlack: 0.09, pcbRed: 0.09,
  winding: 0.01, ionGrid: 0.05,
}

const cache = new Map<MatKey, THREE.Material>()

const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(p)
const phys = (p: THREE.MeshPhysicalMaterialParameters) => new THREE.MeshPhysicalMaterial(p)

function make(k: MatKey): THREE.Material {
  switch (k) {
    case 'alu':
      return std({ color: '#c3c8cf', metalness: 1, roughness: 0.42, roughnessMap: brushedRoughness() })
    case 'aluDark':
      return std({ color: '#2a2d33', metalness: 0.75, roughness: 0.5, roughnessMap: brushedRoughness() })
    case 'aluGold':
      return std({ color: '#c9a35a', metalness: 1, roughness: 0.38, roughnessMap: brushedRoughness() })
    case 'aluBlue':
      return std({ color: '#3a5f8f', metalness: 0.8, roughness: 0.4, roughnessMap: brushedRoughness() })
    case 'steel':
      return std({ color: '#b4bac2', metalness: 1, roughness: 0.25 })
    case 'screw':
      return std({ color: '#9fa6ae', metalness: 1, roughness: 0.3 })
    case 'titanium':
      return std({ color: '#9a9ca0', metalness: 1, roughness: 0.33, roughnessMap: brushedRoughness() })
    case 'mliGold':
      return phys({ color: '#f0b74a', metalness: 1, roughness: 0.3, normalMap: crinkleNormal(), normalScale: new THREE.Vector2(1.2, 1.2), envMapIntensity: 2 })
    case 'mliSilver':
      return phys({ color: '#dfe3e8', metalness: 1, roughness: 0.18, normalMap: crinkleNormal(), normalScale: new THREE.Vector2(1, 1), envMapIntensity: 1.6 })
    case 'mliBlack':
      return phys({ color: '#1b1c1f', metalness: 0.4, roughness: 0.35, normalMap: crinkleNormal(), normalScale: new THREE.Vector2(0.6, 0.6), clearcoat: 0.4 })
    case 'kapton':
      return phys({ color: '#b8641c', metalness: 0.55, roughness: 0.3, normalMap: crinkleNormal(), normalScale: new THREE.Vector2(0.5, 0.5), clearcoat: 0.7, clearcoatRoughness: 0.2 })
    case 'tape':
      return std({ color: '#d3d7dc', metalness: 1, roughness: 0.28 })
    case 'solar':
      return phys({
        map: solarCellMap(), roughnessMap: solarCellRough(), metalness: 0.35, roughness: 0.55,
        clearcoat: 1, clearcoatRoughness: 0.05, iridescence: 0.35, iridescenceIOR: 1.5, iridescenceThicknessRange: [180, 420], envMapIntensity: 1.1,
      })
    case 'solarBack':
      return std({ map: carbonMap(), color: '#9aa0a8', metalness: 0.3, roughness: 0.45 })
    case 'cfrp':
      return phys({ map: carbonMap(), metalness: 0.2, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.15 })
    case 'pcbGreen':
      return phys({ map: pcbMap('green'), metalness: 0.05, roughness: 0.6, clearcoat: 0.2, clearcoatRoughness: 0.45 })
    case 'pcbBlue':
      return phys({ map: pcbMap('blue'), metalness: 0.05, roughness: 0.6, clearcoat: 0.2, clearcoatRoughness: 0.45 })
    case 'pcbBlack':
      return phys({ map: pcbMap('black'), metalness: 0.05, roughness: 0.55, clearcoat: 0.25, clearcoatRoughness: 0.4 })
    case 'pcbRed':
      return phys({ map: pcbMap('red'), metalness: 0.05, roughness: 0.6, clearcoat: 0.2, clearcoatRoughness: 0.45 })
    case 'chip':
      return std({ color: '#16171a', metalness: 0.1, roughness: 0.55 })
    case 'chipLid':
      return std({ color: '#a7adb5', metalness: 1, roughness: 0.28 })
    case 'goldPin':
      return std({ color: '#e5b54d', metalness: 1, roughness: 0.22 })
    case 'copper':
      return std({ color: '#c8713f', metalness: 1, roughness: 0.3 })
    case 'winding':
      return std({ map: windingMap(), color: '#ffffff', metalness: 0.9, roughness: 0.35 })
    case 'plasticBlack':
      return std({ color: '#1a1b1e', metalness: 0, roughness: 0.6 })
    case 'plasticWhite':
      return std({ color: '#e7e5df', metalness: 0, roughness: 0.55 })
    case 'whitePaint':
      return std({ color: '#eceeee', metalness: 0, roughness: 0.62 })
    case 'blackPaint':
      return std({ color: '#0a0b0c', metalness: 0, roughness: 0.9 })
    case 'greyPaint':
      return std({ color: '#6c727a', metalness: 0.2, roughness: 0.6 })
    case 'glass':
      return phys({
        color: '#0d1026', metalness: 0.1, roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0.02,
        iridescence: 1, iridescenceIOR: 1.8, iridescenceThicknessRange: [300, 650], envMapIntensity: 2.2, specularIntensity: 1,
      })
    case 'germanium':
      return phys({ color: '#3b3e48', metalness: 0.85, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.04, iridescence: 0.7, iridescenceIOR: 2.2, iridescenceThicknessRange: [200, 500], envMapIntensity: 1.6 })
    case 'mirror':
      return std({ color: '#eef3f8', metalness: 1, roughness: 0.04 })
    case 'sapphire':
      return phys({ color: '#1b2533', metalness: 0.2, roughness: 0.05, clearcoat: 1, envMapIntensity: 1.8 })
    case 'beryllium':
      return std({ color: '#b2b0a8', metalness: 1, roughness: 0.3 })
    case 'cellBlue':
      return phys({ color: '#2459a8', metalness: 0.1, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.1 })
    case 'cellGreen':
      return phys({ color: '#2f7d4c', metalness: 0.1, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.1 })
    case 'cellPurple':
      return phys({ color: '#5a3c8e', metalness: 0.1, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.1 })
    case 'ferrite':
      return std({ color: '#38393c', metalness: 0.3, roughness: 0.75 })
    case 'magnet':
      return std({ color: '#b22a22', metalness: 0.25, roughness: 0.4 })
    case 'rubber':
      return std({ color: '#222326', metalness: 0, roughness: 0.85 })
    case 'cable':
      return std({ color: '#2c2d31', metalness: 0, roughness: 0.6 })
    case 'cableWhite':
      return std({ color: '#d9d5cc', metalness: 0, roughness: 0.65 })
    case 'cableRed':
      return std({ color: '#a8261e', metalness: 0, roughness: 0.55 })
    case 'cableAmber':
      return std({ color: '#c58a2b', metalness: 0.4, roughness: 0.45 })
    case 'nylon':
      return std({ color: '#f2efe6', metalness: 0, roughness: 0.7 })
    case 'deck':
      return std({ color: '#7f878e', metalness: 0.6, roughness: 0.68, roughnessMap: brushedRoughness() })
    case 'nozzle':
      return phys({ color: '#4a4852', metalness: 1, roughness: 0.32, iridescence: 0.35, iridescenceIOR: 1.6, iridescenceThicknessRange: [250, 500] })
    case 'copv':
      return phys({ map: carbonMap(), color: '#c0c4ca', metalness: 0.3, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 })
    case 'ionGrid':
      return std({ map: hexHoleMap(), metalness: 0.9, roughness: 0.4 })
    case 'ceramic':
      return std({ color: '#e7dcc1', metalness: 0, roughness: 0.5 })
    case 'led':
      return std({ color: '#103a1a', emissive: '#3dff7a', emissiveIntensity: 2.2 })
    case 'ledRed':
      return std({ color: '#3a1010', emissive: '#ff4a3d', emissiveIntensity: 2 })
  }
}

export function mat(k: MatKey): THREE.Material {
  let m = cache.get(k)
  if (!m) {
    m = make(k)
    m.name = k
    cache.set(k, m)
  }
  return m
}

/** Knurled lens grip uses the ridge normal on aluDark. */
export function knurled(): THREE.Material {
  return cachedExtra('knurl', () => std({ color: '#25282d', metalness: 0.8, roughness: 0.45, normalMap: ridgeNormal() }))
}

const extra = new Map<string, THREE.Material>()
function cachedExtra(key: string, f: () => THREE.Material) {
  let m = extra.get(key)
  if (!m) {
    m = f()
    m.name = key
    extra.set(key, m)
  }
  return m
}

/** Material used for missing-slot placeholders. */
export function ghostMaterials() {
  return {
    line: cachedExtra('ghostLine', () => new THREE.LineBasicMaterial({ color: '#6ff0c8', transparent: true, opacity: 0.55, depthWrite: false })) as THREE.LineBasicMaterial,
    fill: cachedExtra('ghostFill', () => new THREE.MeshBasicMaterial({ color: '#6ff0c8', transparent: true, opacity: 0.05, depthWrite: false, side: THREE.DoubleSide })) as THREE.MeshBasicMaterial,
  }
}

/** Additive fresnel rim used for hover/selection highlight overlays. */
export function rimMaterial(color = '#79f2cf') {
  return cachedExtra('rim' + color, () => {
    const m = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color) }, uStrength: { value: 1 } },
      vertexShader: /* glsl */ `
        varying vec3 vN; varying vec3 vV;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vN = normalize(normalMatrix * normal);
          vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; uniform float uStrength;
        varying vec3 vN; varying vec3 vV;
        void main() {
          float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
          gl_FragColor = vec4(uColor * (0.03 + f * 0.6) * uStrength, 1.0);
        }`,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthFunc: THREE.LessEqualDepth,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
    return m
  }) as THREE.ShaderMaterial
}
