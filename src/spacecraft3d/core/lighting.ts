// Studio / space lighting rig shared by the view, the hero and the thumbnail renderer.
// A procedural environment (soft boxes in a dark teal room) is baked to PMREM once per renderer.
import * as THREE from 'three'

const envCache = new WeakMap<THREE.WebGLRenderer, THREE.Texture>()

function envScene() {
  const scene = new THREE.Scene()
  // dark teal room (inside of a sphere with a vertical gradient)
  const room = new THREE.Mesh(
    new THREE.SphereGeometry(20, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `varying vec3 vP; void main(){
        float h = normalize(vP).y;
        vec3 top = vec3(0.42, 0.50, 0.52);
        vec3 mid = vec3(0.12, 0.17, 0.18);
        vec3 bot = vec3(0.03, 0.06, 0.065);
        vec3 c = h > 0.0 ? mix(mid, top, h) : mix(mid, bot, -h);
        gl_FragColor = vec4(c, 1.0);
      }`,
    }),
  )
  scene.add(room)
  const box = (w: number, h: number, color: string, intensity: number, p: [number, number, number]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }))
    m.position.set(...p)
    m.lookAt(0, 0, 0)
    scene.add(m)
  }
  box(9, 6, '#fff6ea', 9, [6, 9, 7]) // key softbox (top right front)
  box(14, 3, '#bfefff', 4, [-9, 3, -6]) // cool rim strip behind
  box(3, 12, '#ffffff', 3, [-10, 1, 6]) // tall fill strip left
  box(10, 10, '#4fb7b0', 0.6, [0, -10, 0]) // teal bounce from below
  box(4, 4, '#ffd7a8', 1.8, [10, -2, -4]) // warm kicker
  return scene
}

/** PMREM environment for a renderer (cached). */
export function getEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  let t = envCache.get(renderer)
  if (!t) {
    const pm = new THREE.PMREMGenerator(renderer)
    const scene = envScene()
    t = pm.fromScene(scene, 0.035).texture
    pm.dispose()
    scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) {
        m.geometry.dispose()
        ;(m.material as THREE.Material).dispose()
      }
    })
    envCache.set(renderer, t)
  }
  return t
}

export interface Rig {
  group: THREE.Group
  key: THREE.DirectionalLight
  /** fit the key light's shadow frustum around a sphere */
  fit(center: THREE.Vector3, radius: number): void
}

/** key (shadow-casting) + cool rim + soft fill */
export function createRig(shadows = true): Rig {
  const group = new THREE.Group()
  const key = new THREE.DirectionalLight('#fff4e6', 2.8)
  key.position.set(4, 6, 5)
  key.castShadow = shadows
  key.shadow.mapSize.set(2048, 2048)
  key.shadow.bias = -0.0004
  key.shadow.normalBias = 0.02
  key.shadow.radius = 4
  const rim = new THREE.DirectionalLight('#9fe8ff', 2.4)
  rim.position.set(-5, 3, -6)
  const fill = new THREE.HemisphereLight('#bfe7f0', '#0c2226', 0.35)
  group.add(key, key.target, rim, rim.target, fill)
  return {
    group,
    key,
    fit(center, radius) {
      const dir = new THREE.Vector3(4, 6, 5).normalize()
      key.position.copy(center).addScaledVector(dir, radius * 4)
      key.target.position.copy(center)
      rim.position.copy(center).addScaledVector(new THREE.Vector3(-5, 3, -6).normalize(), radius * 4)
      rim.target.position.copy(center)
      const cam = key.shadow.camera
      cam.left = cam.bottom = -radius * 1.2
      cam.right = cam.top = radius * 1.2
      cam.near = radius * 0.5
      cam.far = radius * 8
      cam.updateProjectionMatrix()
      key.shadow.normalBias = radius * 0.012
      key.shadow.bias = -0.0008
    },
  }
}
