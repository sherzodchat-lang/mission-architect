// Earth Observation CubeSat parts (3U). Units: metres. Board footprint ≈ 86 mm (inside the rails).
import { PartBuilder } from '../core/builder'
import {
  cable,
  cell18650,
  coilRect,
  cornerScrews,
  dish,
  dsub,
  harness,
  lensBarrel,
  patchAntenna,
  pcb,
  reactionWheel,
  screwRow,
  sma,
  standoffs,
  starTracker,
  torqueRod,
} from './common'
import type { PartCtx, PartFactory, PartResult } from './types'

const F = 0.086
const H = Math.PI / 2

const pbOf = (ctx: PartCtx, name: string) => new PartBuilder(ctx.detail, ctx.texScale, name)
const one = (pb: PartBuilder): PartResult => ({ main: pb.build(), extras: [] })

/** aluminium bracket plate the payload instruments bolt onto (back at z=0) */
function backPlate(pb: PartBuilder, w: number, h: number) {
  pb.rbox(w, h, 0.004, 0.0015, 'alu', [0, 0, 0.002])
  cornerScrews(pb, w, h, 0.004, 0.005, 0.0013)
}

// ------------------------------------------------------------------ instruments

/** Multispectral imager: gold-MLI wrapped optics bench with a big black lens and blue coated glass. */
const imager: PartFactory = (ctx) => {
  const pb = pbOf(ctx, 'imager')
  backPlate(pb, F, F)
  // housing frame + MLI wrap
  pb.box(F - 0.004, F - 0.004, 0.05, 'mliGold', [0, 0, 0.004 + 0.025])
  if (pb.hi) {
    for (const sy of [-1, 1]) pb.box(F - 0.01, 0.003, 0.0005, 'kapton', [0, sy * (F / 2 - 0.004), 0.02])
  }
  pb.rbox(F, F, 0.006, 0.002, 'alu', [0, 0, 0.057])
  cornerScrews(pb, F, F, 0.06, 0.006, 0.0014)
  // focal-plane electronics hint at the back side
  dsub(pb, [0.02, -0.026, 0], [Math.PI, 0, 0], 0.016)
  pb.at([0, 0, 0.06], undefined, () => lensBarrel(pb, { r: 0.025, len: 0.05, rings: 3 }))
  // filter wheel bump
  pb.cylZ(0.012, 0.012, 0.012, 'aluDark', [0.03, 0.03, 0.066])
  harness(pb, [[0.03, 0.03, 0.06], [0.04, 0.04, 0.03], [0.04, 0.035, 0.006]], 0.0012)
  return one(pb)
}

/** Thermal IR camera: black anodised body with cooling fins and a dark germanium lens. */
const thermal: PartFactory = (ctx) => {
  const pb = pbOf(ctx, 'thermal')
  backPlate(pb, F, F)
  pb.rbox(0.072, 0.072, 0.05, 0.004, 'aluDark', [0, 0, 0.029])
  // heat-sink fins on top
  for (let i = 0; i < (pb.hi ? 9 : 5); i++) {
    const n = pb.hi ? 9 : 5
    pb.box(0.072, 0.0015, 0.01, 'alu', [0, -0.03 + (i * 0.06) / (n - 1), 0.059])
  }
  pb.box(0.072, 0.064, 0.002, 'alu', [0, 0, 0.0545])
  // square lens hood
  pb.at([0, 0, 0.056], undefined, () => {
    lensBarrel(pb, { r: 0.02, len: 0.03, rings: 2, glass: 'germanium', body: 'aluDark' })
  })
  // shutter motor
  pb.cylZ(0.008, 0.008, 0.01, 'steel', [-0.03, 0.026, 0.06])
  pb.box(0.014, 0.012, 0.003, 'plasticWhite', [-0.024, -0.03, 0.056])
  sma(pb, [0.036, 0, 0.03], [0, H, 0], 0.7)
  dsub(pb, [0, -0.036, 0.03], [H, 0, 0], 0.016)
  return one(pb)
}

/** Atmospheric sensor: silver box with several small aperture ports and gold SMA connectors. */
const atmos: PartFactory = (ctx) => {
  const pb = pbOf(ctx, 'atmos')
  backPlate(pb, 0.07, 0.07)
  pb.rbox(0.068, 0.068, 0.036, 0.003, 'alu', [0, 0, 0.022])
  pb.box(0.07, 0.07, 0.003, 'aluDark', [0, 0, 0.0415])
  cornerScrews(pb, 0.07, 0.07, 0.043, 0.005, 0.0012)
  // three aperture tubes (UV / limb / nadir channels)
  const ports: [number, number, number][] = [[-0.018, 0.012, 0.007], [0.0, 0.012, 0.005], [0.018, 0.012, 0.005]]
  ports.forEach(([x, y, r], i) => {
    pb.cylZ(r * 1.3, r * 1.3, 0.012, 'aluDark', [x, y, 0.049])
    pb.cylZ(r, r, 0.0125, 'blackPaint', [x, y, 0.049], { open: true, inside: true })
    pb.disc(r, i === 0 ? 'glass' : 'sapphire', [x, y, 0.047])
  })
  // inlet grille
  for (let i = 0; i < 6; i++) pb.box(0.032, 0.0015, 0.0012, 'blackPaint', [0, -0.012 - i * 0.0035, 0.0435])
  sma(pb, [0.022, -0.022, 0.043], [0, 0, 0], 0.9)
  sma(pb, [0.012, -0.026, 0.043], [0, 0, 0], 0.9)
  sma(pb, [0.036, 0.01, 0.022], [0, H, 0], 0.9)
  pb.box(0.012, 0.008, 0.004, 'pcbGreen', [-0.022, -0.024, 0.045])
  return one(pb)
}

/** Compact spectrometer: slim body, rectangular entrance baffle with vanes, fibre loop. */
const spectro: PartFactory = (ctx) => {
  const pb = pbOf(ctx, 'spectro')
  backPlate(pb, F, 0.05)
  pb.rbox(0.08, 0.044, 0.05, 0.003, 'alu', [0, 0, 0.029])
  pb.box(0.03, 0.03, 0.02, 'aluDark', [0.028, 0.0, 0.064])
  // rectangular baffle with vanes
  const bw = 0.026
  const bh = 0.02
  const L = 0.028
  pb.at([0.028, 0, 0.074], undefined, () => {
    for (const s of [-1, 1]) {
      pb.box(bw, 0.0012, L, 'aluDark', [0, s * bh / 2, L / 2])
      pb.box(0.0012, bh, L, 'aluDark', [s * bw / 2, 0, L / 2])
    }
    if (pb.hi) for (let i = 1; i < 5; i++) {
      const z = (i / 5) * L
      for (const s of [-1, 1]) {
        pb.box(bw, 0.003, 0.0006, 'blackPaint', [0, s * (bh / 2 - 0.0015), z])
        pb.box(0.003, bh, 0.0006, 'blackPaint', [s * (bw / 2 - 0.0015), 0, z])
      }
    }
    pb.box(bw - 0.002, bh - 0.002, 0.001, 'blackPaint', [0, 0, 0.002])
    pb.box(0.012, 0.0016, 0.0005, 'mirror', [0, 0, 0.003])
  })
  // small round context lens
  pb.at([-0.022, 0.0, 0.054], undefined, () => lensBarrel(pb, { r: 0.008, len: 0.014, rings: 2, glass: 'glass' }))
  // grating housing
  pb.cylZ(0.012, 0.012, 0.01, 'aluGold', [-0.006, 0.0, 0.059])
  cable(pb, [[-0.03, -0.02, 0.054], [-0.04, -0.028, 0.04], [-0.035, -0.03, 0.01], [-0.02, -0.024, 0.005]], 0.0012, 'cableAmber')
  dsub(pb, [0.02, -0.022, 0.03], [H, 0, 0], 0.014)
  return one(pb)
}

// ------------------------------------------------------------------ computer

const obcBasic: PartFactory = (ctx) => {
  const pb = pbOf(ctx, 'obc_basic')
  standoffs(pb, F, F, 0, 0.012)
  pb.at([0, 0, 0.013], undefined, () => pcb(pb, F, F, { mask: 'green', seed: 3, chips: 5, header: true, leds: true }))
  // micro-SD + USB
  pb.box(0.012, 0.011, 0.0015, 'steel', [-0.03, -0.028, 0.015])
  pb.box(0.008, 0.006, 0.003, 'steel', [-0.04, 0.0, 0.0155])
  return one(pb)
}

const obcStd: PartFactory = (ctx) => {
  const pb = pbOf(ctx, 'obc_std')
  standoffs(pb, F, F, 0, 0.03)
  pb.at([0, 0, 0.008], undefined, () => pcb(pb, F, F, { mask: 'blue', seed: 7, chips: 7, header: true }))
  pb.at([0, 0, 0.026], undefined, () => pcb(pb, F, F, { mask: 'green', seed: 9, chips: 4, cpu: true, header: true, leds: true }))
  // heat spreader over the CPU
  pb.box(0.034, 0.034, 0.003, 'alu', [0.004, 0, 0.0325])
  if (pb.hi) for (let i = 0; i < 6; i++) pb.box(0.034, 0.0012, 0.004, 'alu', [0.004, -0.014 + i * 0.0056, 0.036])
  harness(pb, [[-0.04, 0.03, 0.01], [-0.046, 0.0, 0.018], [-0.04, -0.03, 0.026]], 0.001)
  return one(pb)
}

const obcRad: PartFactory = (ctx) => {
  const pb = pbOf(ctx, 'obc_rad')
  // alodined (gold) shielded enclosure
  pb.rbox(F, F, 0.032, 0.003, 'aluGold', [0, 0, 0.016])
  pb.box(F - 0.008, F - 0.008, 0.002, 'aluGold', [0, 0, 0.033])
  screwRow(pb, [-0.039, -0.039, 0.034], [0.039, -0.039, 0.034], 6)
  screwRow(pb, [-0.039, 0.039, 0.034], [0.039, 0.039, 0.034], 6)
  screwRow(pb, [-0.039, -0.03, 0.034], [-0.039, 0.03, 0.034], 4)
  screwRow(pb, [0.039, -0.03, 0.034], [0.039, 0.03, 0.034], 4)
  // tantalum spot shield over the processor
  pb.box(0.03, 0.03, 0.002, 'titanium', [0, 0, 0.035])
  // connectors on the front face
  dsub(pb, [-0.018, -F / 2, 0.016], [H, 0, 0], 0.018)
  dsub(pb, [0.018, -F / 2, 0.016], [H, 0, 0], 0.018)
  // ribbed side
  if (pb.hi) for (let i = 0; i < 5; i++) pb.box(0.0015, 0.07, 0.022, 'aluGold', [F / 2 + 0.00075, 0, 0.006 + i * 0.0001 + 0.01])
  pb.box(0.016, 0.004, 0.0005, 'plasticWhite', [0.028, 0.03, 0.0345])
  return one(pb)
}

// ------------------------------------------------------------------ radio

function transceiver(pb: PartBuilder, mask: 'green' | 'black' | 'blue', seed: number, can = true) {
  standoffs(pb, F, F, 0, 0.01)
  pb.at([0, 0, 0.011], undefined, () => pcb(pb, F, F, { mask, seed, chips: 4, header: true }))
  if (can) {
    pb.rbox(0.04, 0.03, 0.008, 0.0008, 'chipLid', [0.012, 0.006, 0.016])
    if (pb.hi) for (let i = 0; i < 8; i++) pb.cylZ(0.0012, 0.0012, 0.0002, 'blackPaint', [0.0, 0.0 + i * 0.003, 0.0201], { seg: 6 })
  }
  sma(pb, [0.036, -0.03, 0.012], [0, 0, 0])
}

const uhf: PartFactory = (ctx) => {
  const pb = pbOf(ctx, 'uhf')
  transceiver(pb, 'black', 21)
  cable(pb, [[0.036, -0.03, 0.022], [0.042, -0.036, 0.03], [0.04, -0.04, 0.045]], 0.0013, 'cable')
  // antenna deck with 4 tape antennas (turnstile)
  const deck = new PartBuilder(ctx.detail, ctx.texScale, 'uhf_antenna')
  deck.box(0.098, 0.098, 0.0016, 'pcbBlack', [0, 0, 0.0008])
  deck.box(0.05, 0.05, 0.004, 'aluDark', [0, 0, 0.0036])
  const L = ctx.preview ? 0.12 : 0.17
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2
    deck.at([0, 0, 0.003], [0, 0, a], () => {
      deck.box(0.012, 0.01, 0.003, 'aluDark', [0.044, 0.02, 0])
      // tape: slightly curved thin strip (cross-section arc)
      deck.cyl(0.02, 0.02, L, 'tape', [0.05 + L / 2, 0.02, 0.0 - 0.019], [0, 0, H], { open: true, thetaStart: -0.25, thetaLength: 0.5, seg: 4 })
      if (deck.hi) deck.box(0.004, 0.006, 0.002, 'cableRed', [0.04, 0.026, 0.002])
    })
  }
  deck.box(0.02, 0.012, 0.002, 'ceramic', [0, 0, 0.0065])
  return { main: pb.build(), extras: [{ object: deck.build(), mount: 'endDeck' }] }
}

const sband: PartFactory = (ctx) => {
  const pb = pbOf(ctx, 'sband')
  transceiver(pb, 'green', 33)
  pb.at([0, 0, 0.026], undefined, () => pcb(pb, F, F, { mask: 'green', seed: 34, chips: 3, header: true }))
  standoffs(pb, F, F, 0.012, 0.014)
  const ant = new PartBuilder(ctx.detail, ctx.texScale, 'sband_patch')
  patchAntenna(ant, 0.07, [0, 0, 0.0015], [0, 0, 0], 'pcbBlack')
  sma(ant, [0.028, 0.028, 0.003], [0, 0, 0], 0.7)
  return { main: pb.build(), extras: [{ object: ant.build(), mount: 'sideFace' }] }
}

const xband: PartFactory = (ctx) => {
  const pb = pbOf(ctx, 'xband')
  // transmitter in a finned box
  pb.rbox(F, F, 0.02, 0.002, 'aluDark', [0, 0, 0.01])
  for (let i = 0; i < (pb.hi ? 11 : 6); i++) {
    const n = pb.hi ? 11 : 6
    pb.box(0.07, 0.0016, 0.012, 'alu', [-0.004, -0.036 + (i * 0.072) / (n - 1), 0.026])
  }
  sma(pb, [0.034, 0.03, 0.02], [0, 0, 0])
  dsub(pb, [0, -F / 2, 0.01], [H, 0, 0], 0.016)
  // deployable high-gain dish on a short mast
  const ant = new PartBuilder(ctx.detail, ctx.texScale, 'xband_dish')
  ant.box(0.06, 0.06, 0.003, 'alu', [0, 0, 0.0015])
  ant.cylZ(0.006, 0.008, 0.03, 'alu', [0, 0, 0.018])
  ant.cylZ(0.012, 0.012, 0.008, 'aluDark', [0, 0, 0.034])
  ant.at([0, 0, 0.038], undefined, () => dish(ant, { D: 0.13, fd: 0.32, struts: 3 }))
  cable(ant, [[0.02, 0.02, 0.003], [0.012, 0.01, 0.02], [0.005, 0.006, 0.034]], 0.0012, 'cableWhite')
  return { main: pb.build(), extras: [{ object: ant.build(), mount: 'endDeck' }] }
}

// ------------------------------------------------------------------ attitude

const magnets: PartFactory = (ctx) => {
  const pb = pbOf(ctx, 'mag')
  pb.rbox(F, F, 0.003, 0.002, 'alu', [0, 0, 0.0015])
  // two permanent bar magnets
  for (const y of [-0.012, 0.012]) {
    pb.cylX(0.004, 0.004, 0.05, 'magnet', [0, y, 0.008])
    pb.box(0.006, 0.012, 0.004, 'aluDark', [-0.02, y, 0.005])
    pb.box(0.006, 0.012, 0.004, 'aluDark', [0.02, y, 0.005])
  }
  // hysteresis damping rods (soft magnetic) along X and Y
  for (const y of [-0.033, 0.033]) pb.cylX(0.0012, 0.0012, 0.075, 'ferrite', [0, y, 0.006], { seg: 8 })
  for (const x of [-0.033, 0.033]) pb.cyl(0.0012, 0.0012, 0.075, 'ferrite', [x, 0, 0.006], [0, 0, 0], { seg: 8 })
  return one(pb)
}

const torquers: PartFactory = (ctx) => {
  const pb = pbOf(ctx, 'torq')
  standoffs(pb, F, F, 0, 0.004)
  pb.at([0, 0, 0.005], undefined, () => pcb(pb, F, F, { mask: 'black', seed: 41, chips: 3 }))
  // two air-core coils (X/Y) laid flat + a Z torque rod
  coilRect(pb, 0.075, 0.075, 0.006, 0.004, [0, 0, 0.009])
  coilRect(pb, 0.06, 0.03, 0.005, 0.004, [0, 0.0, 0.025], [H, 0, 0])
  torqueRod(pb, 0.07, 0.005, [0, -0.026, 0.016])
  // coarse sun sensors (tiny glass dies)
  for (const x of [-0.03, 0.03]) {
    pb.box(0.01, 0.01, 0.002, 'ceramic', [x, 0.03, 0.008])
    pb.box(0.006, 0.006, 0.0005, 'glass', [x, 0.03, 0.0093])
  }
  return one(pb)
}

const wheels: PartFactory = (ctx) => {
  const pb = pbOf(ctx, 'wheel')
  pb.rbox(F, F, 0.004, 0.002, 'alu', [0, 0, 0.002])
  cornerScrews(pb, F, F, 0.004, 0.005)
  // three orthogonal reaction wheels (as in the mockup)
  reactionWheel(pb, 0.017, 0.018, [-0.02, -0.018, 0.004], [0, 0, 0])
  reactionWheel(pb, 0.017, 0.018, [0.02, -0.018, 0.004], [0, 0, 0])
  reactionWheel(pb, 0.017, 0.018, [0.0, 0.022, 0.004], [0, 0, 0])
  pb.box(0.05, 0.012, 0.012, 'pcbBlack', [0, 0.0, 0.03])
  harness(pb, [[-0.02, -0.002, 0.012], [0, 0.004, 0.024], [0.02, -0.002, 0.012]], 0.0009)
  // star tracker looks out through the −Z face
  const st = new PartBuilder(ctx.detail, ctx.texScale, 'star_tracker')
  starTracker(st, 0.03)
  return { main: pb.build(), extras: [{ object: st.build(), mount: 'sideFace' }] }
}

// ------------------------------------------------------------------ battery / EPS

function batteryPack(ctx: PartCtx, name: string, layers: number, perLayer: number, wrap: 'cellBlue' | 'cellGreen' | 'cellPurple') {
  const pb = pbOf(ctx, name)
  standoffs(pb, F, F, 0, 0.012 + layers * 0.019)
  pb.at([0, 0, 0.004], undefined, () => pcb(pb, F, F, { mask: 'black', seed: 51, chips: 2 }))
  for (let l = 0; l < layers; l++) {
    const z = 0.0145 + l * 0.0195
    for (let i = 0; i < perLayer; i++) {
      const y = (i - (perLayer - 1) / 2) * 0.0188
      pb.at([0, y, z], [0, H, 0], () => cell18650(pb, [0, 0, 0], wrap))
    }
    // cell holder rails
    pb.box(0.006, perLayer * 0.0188 + 0.004, 0.012, 'plasticBlack', [-0.036, 0, z])
    pb.box(0.006, perLayer * 0.0188 + 0.004, 0.012, 'plasticBlack', [0.036, 0, z])
    // nickel tabs
    if (pb.hi) for (let i = 0; i < perLayer; i++) {
      const y = (i - (perLayer - 1) / 2) * 0.0188
      pb.box(0.0004, 0.012, 0.012, 'steel', [0.0395, y, z])
      pb.box(0.0004, 0.012, 0.012, 'steel', [-0.0395, y, z])
    }
  }
  // EPS board on top
  const top = 0.012 + layers * 0.0195 + 0.006
  pb.at([0, 0, top], undefined, () => pcb(pb, F, F, { mask: 'blue', seed: 52 + layers, chips: 6, header: true, leds: true }))
  harness(pb, [[0.04, 0.03, 0.014], [0.044, 0.035, top * 0.6], [0.038, 0.03, top - 0.002]], 0.0011, ['cableRed', 'cable', 'cableRed'])
  return one(pb)
}

const batS: PartFactory = (ctx) => batteryPack(ctx, 'bat_s', 1, 2, 'cellBlue')
const batM: PartFactory = (ctx) => batteryPack(ctx, 'bat_m', 1, 4, 'cellGreen')
const batL: PartFactory = (ctx) => batteryPack(ctx, 'bat_l', 2, 4, 'cellPurple')

export const EARTH_PARTS: Record<string, PartFactory> = {
  imager,
  thermal,
  atmos,
  spectro,
  obc_basic: obcBasic,
  obc_std: obcStd,
  obc_rad: obcRad,
  uhf,
  sband,
  xband,
  mag: magnets,
  torq: torquers,
  wheel: wheels,
  bat_s: batS,
  bat_m: batM,
  bat_l: batL,
}

/** natural slot heights (+Z extent) used for layout sanity */
export const EARTH_F = F
