# spacecraft3d — procedural 3D spacecraft

Detailed, fully procedural spacecraft built from the player's `Design` (no downloaded models or
textures — every texture is generated in code). three.js + react-three-fiber, always in **lazy
chunks**: the main bundle must never import `three`.

## What to import (screens)

Import from the light entry `src/spacecraft3d` (no three.js inside):

```tsx
import {
  SpacecraftViewLazy, HeroSpacecraftLazy, ComponentThumb, prewarmThumbnails,
  CATEGORY_LABEL, showcaseDesign, slotOf, hasWebGL,
  type SpacecraftViewApi,
} from '../spacecraft3d'
```

`SpacecraftViewLazy` / `HeroSpacecraftLazy` wrap `React.lazy` + `Suspense` (prop `loading` replaces the
default spinner). You can also lazy-load the default exports yourself:
`lazy(() => import('../spacecraft3d/SpacecraftView'))`, `lazy(() => import('../spacecraft3d/HeroSpacecraft'))`.

### `<SpacecraftViewLazy>` (screen 03 centre panel)

The view fills its parent (`h-full w-full`, canvas is transparent so the glass panel shows through).

| prop | type | default | notes |
|---|---|---|---|
| `missionId` | `MissionId` | — | `earth` = 3U CubeSat, `lunar` / `mars` = box bus |
| `design` | `Design` | — | the store design; rebuilds are cheap (parts are cached templates) |
| `exploded` | `boolean` | `false` | animated explode / assemble |
| `onExplodedChange` | `(v) => void` | — | if given, a built-in `Exploded \| Assembled` switch is shown top-right |
| `onSelectCategory` | `(c: CategoryId) => void` | — | click on a part or its label → open that builder tab (`instruments, power, comms, computer, attitude, propulsion`). Empty slots are clickable too (ghost box). |
| `highlightCategory` | `CategoryId \| null` | `null` | e.g. the open tab; hover overrides it |
| `showLabels` | `boolean` | `true` | leader-line labels: Payload, Flight computer, Radio, Attitude control, Power module, Propulsion |
| `labels` | `Partial<Record<CategoryId,string>>` | — | override label text |
| `showDimensions` | `boolean` | `true` | `340 mm` (3U) / bus width line |
| `toolbar` | `boolean` | `true` | glass toolbar: auto-rotate, zoom out, zoom in, fit, reset view |
| `showAxes` | `boolean` | `true` | axis gizmo bottom-left |
| `autoRotate` | `boolean` | `false` | start spinning |
| `detail` | `'high' \| 'low'` | `'high'` | low = no screws / fewer segments |
| `fallback` | `ReactNode` | text | shown when WebGL is missing or the context is lost |
| `apiRef` | `Ref<SpacecraftViewApi>` | — | `{ zoomIn, zoomOut, fit, resetView, setAutoRotate, toggleAutoRotate }` for an external toolbar (then pass `toolbar={false}`) |
| `className` | `string` | — | |

Behaviour: damped OrbitControls (no pan, zoom clamped to 0.4–2.2× the fitted distance). Earth framing is a box fit of the craft at its *target* explode state with screen space reserved for the label rows and toolbar (`LABEL_RESERVE`), and it re-frames when an installed part changes the craft's size by more than 6 % (e.g. sun-tracking wings). Tall layouts (projected height > 1.15 × width) switch the Earth labels from top/bottom rows to side columns (`SIDE_RESERVE`) so the craft keeps the full panel height. The highlighted category (open tab / hover) gets a faint additive fresnel rim and a mint-outlined label, not a mint fill. `frameloop="demand"` (renders only while
something moves; paused when off-screen or the tab is hidden), newly installed parts fly into their
slot, panels facing the camera fade (x-ray) while exploded, reduced-motion respected.

```tsx
const [exploded, setExploded] = useState(true)
<SpacecraftViewLazy
  missionId={mission.id}
  design={design}
  exploded={exploded}
  onExplodedChange={setExploded}
  highlightCategory={activeTab}
  onSelectCategory={(c) => setActiveTab(c)}
/>
```

### `<ComponentThumb componentId missionId size />` (catalog cards, menu tile)

Live render of one component in a 3/4 view as a cached PNG data URL (transparent background), drawn
by **one shared offscreen WebGLRenderer** (never one canvas per card). Renders are queued one per idle
frame; until ready a soft placeholder of the same size is shown. Safe to import statically.
Props: `componentId`, `missionId`, `size` (CSS px, default 96, rendered at up to 2×), `className`,
`style`, `alt`. Call `prewarmThumbnails(missionId, size)` when entering the builder to fill the cache early.
Solar arrays render around a plain body block so their layout reads.

For the menu "Continue your design" tile, use a `ComponentThumb` of the main instrument or a small
`HeroSpacecraftLazy` with `design={draft}`.

### `<HeroSpacecraftLazy missionId design? speed? zoom? className />` (Overview / menu hero)

Fully assembled craft (no ghosts), panels deployed, slowly rotating, rim-lit, transparent background,
pointer-events disabled. `design` defaults to `showcaseDesign(missionId)` (a complete good-looking
design). `speed` rad/s (default 0.18), `zoom` > 1 = smaller.

### Orbit / simulation view

`src/scene/CelestialView3D.tsx` now draws a low-detail `buildSpacecraft` model. `CelestialView` got an
optional `design?: Design | null` prop; without it the store's current design is used (or a showcase
design when the store holds another mission / an empty design).

## Lower-level API (inside lazy chunks only)

```ts
import { buildSpacecraft } from './assemble'
const sc = buildSpacecraft(design, MISSIONS[id], { detail: 'high', ghosts: true })
scene.add(sc.root); sc.setExplode(0..1); sc.anchors.power; sc.parts; sc.bounds; sc.core;
sc.dimension; sc.stats; sc.dispose()
```

- `parts/` — one factory per component id (`earth.ts`, `deep.ts` for Lunar + Mars, `solar.ts` for all
  arrays). A factory returns `{ main, extras, busFrame? }`; extras carry a `mount` (`endDeck`,
  `sideFace`, `top`, `mast`, `boom`, `lga`, `corners`, `trackers`) that the assembler resolves.
- `core/builder.ts` — `PartBuilder` DSL: primitives + per-material merge (one mesh per material per
  part → few draw calls). `core/materials.ts` — shared PBR materials (anodised aluminium, gold/silver
  MLI with a procedural crinkle normal map, solar cells with busbars + cover-glass clearcoat, PCBs,
  coated lenses, germanium, radiators, carbon fibre, COPV, ion grid…). `core/textures.ts` — canvas /
  data textures. `core/lighting.ts` — procedural PMREM studio environment + key/rim/fill rig.
- Layout: Earth 3U = frame 100×100×340.5 mm, modules along X (payload looking −X, computer, radio,
  attitude, battery/EPS). Lunar/Mars = deck stack along +Y (propulsion, power, attitude, computer,
  comms), payload on +X, wings ±Z, dishes on top / boom, thrusters at the lower corners.
- Materials are shared and never disposed by parts; geometries are disposed with `sc.dispose()` (cached
  part templates are kept, LRU 140 entries).

## Numbers (headless Chrome / SwiftShader, high detail)

| craft | triangles | meshes (≈ draw calls) | rebuild (cached) |
|---|---|---|---|
| Earth showcase (2 instruments, deployable wings) | ~41 k | ~145 | ~40 ms |
| Earth heavy (3 instruments, tracking wings, X-band dish) | ~52 k | ~157 | |
| Lunar showcase | ~79 k | ~190 | ~20 ms |
| Mars heaviest (3 instruments, fan arrays, 3 m dish, ext. tanks) | ~97 k | ~194 | |
| Low detail (orbit view) | 12–22 k | 105–122 | |

First build of a session also generates the procedural textures (~0.5–1 s on SwiftShader, much faster
on a GPU machine).
