// Lunar Orbiter and Mars Probe parts (deep-space bus). Units: metres.
import { PartBuilder, type V3 } from '../core/builder'
import {
  baffleTube,
  bellNozzle,
  boom,
  cable,
  cornerScrews,
  dish,
  dsub,
  harness,
  lensBarrel,
  reactionWheel,
  roundConnector,
  screwRow,
  smallThruster,
  starTracker,
  tank,
} from './common'
import type { PartCtx, PartFactory, PartResult } from './types'

const H = Math.PI / 2
const PI = Math.PI

const pbOf = (ctx: PartCtx, name: string) => new PartBuilder(ctx.detail, ctx.texScale, name)
const one = (pb: PartBuilder): PartResult => ({ main: pb.build(), extras: [] })

/** instrument mounting plate (back at z = 0) */
function mountPlate(pb: PartBuilder, w: number, h: number, t = 0.015) {
  pb.rbox(w, h, t, t * 0.3, 'alu', [0, 0, t / 2])
  if (pb.hi) {
    screwRow(pb, [-w / 2 + 0.02, -h / 2 + 0.02, t], [w / 2 - 0.02, -h / 2 + 0.02, t], 6, [0, 0, 0], 0.005)
    screwRow(pb, [-w / 2 + 0.02, h / 2 - 0.02, t], [w / 2 - 0.02, h / 2 - 0.02, t], 6, [0, 0, 0], 0.005)
  }
}

/** finned electronics chassis, base z=0 */
function chassis(pb: PartBuilder, w: number, d: number, h: number, body: 'aluDark' | 'aluGold' | 'aluBlue' | 'alu', p: V3 = [0, 0, 0], connectors = 3) {
  pb.at(p, undefined, () => {
    pb.rbox(w, d, h, Math.min(w, d, h) * 0.04, body, [0, 0, h / 2])
    // mounting flange
    pb.box(w + 0.03, d + 0.03, 0.006, body, [0, 0, 0.003])
    // ribs on top
    const n = pb.hi ? Math.max(3, Math.round(w / 0.03)) : 3
    for (let i = 0; i < n; i++) pb.box(0.004, d * 0.9, 0.012, body, [-w * 0.42 + (i * w * 0.84) / (n - 1), 0, h + 0.006])
    // connectors on the -Y face
    for (let i = 0; i < connectors; i++) {
      const x = -w * 0.35 + (connectors === 1 ? w * 0.35 : (i * w * 0.7) / (connectors - 1))
      if (i % 2) roundConnector(pb, [x, -d / 2, h * 0.5], [H, 0, 0], Math.min(0.014, h * 0.12))
      else dsub(pb, [x, -d / 2, h * 0.5], [H, 0, 0], Math.min(0.04, w * 0.18))
    }
    if (pb.hi) {
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) pb.cylZ(0.006, 0.006, 0.006, 'screw', [sx * (w / 2 + 0.008), sy * (d / 2 + 0.008), 0.009], { seg: 6 })
      pb.box(w * 0.3, 0.0008, h * 0.18, 'plasticWhite', [w * 0.2, -d / 2 - 0.0004, h * 0.82])
    }
  })
}

// ------------------------------------------------------------------ instruments

/** Lunar: twin narrow-angle telescopes + wide-angle camera (LROC-like). Mars: single context camera. */
const camera: PartFactory = (ctx) => {
  const pb = pbOf(ctx, 'cam')
  if (ctx.missionId === 'lunar') {
    mountPlate(pb, 0.5, 0.42)
    for (const s of [-1, 1]) {
      pb.at([s * 0.125, 0.04, 0.015], undefined, () => {
        pb.box(0.17, 0.17, 0.09, 'aluDark', [0, 0, 0.045])
        pb.cylZ(0.1, 0.1, 0.42, 'whitePaint', [0, 0, 0.09 + 0.21], { seg: pb.seg(40) })
        pb.cylZ(0.104, 0.104, 0.02, 'alu', [0, 0, 0.1])
        pb.cylZ(0.104, 0.104, 0.02, 'alu', [0, 0, 0.5])
        baffleTube(pb, 0.098, 0.2, 0.51, 'mliBlack')
        // secondary mirror + spider
        pb.cylZ(0.035, 0.035, 0.02, 'aluDark', [0, 0, 0.55])
        pb.disc(0.034, 'mirror', [0, 0, 0.539], [PI, 0, 0])
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * PI * 2 + H
          pb.box(0.065, 0.003, 0.012, 'blackPaint', [Math.cos(a) * 0.065, Math.sin(a) * 0.065, 0.55], [0, 0, a])
        }
        pb.disc(0.096, 'mirror', [0, 0, 0.53 - 0.0], [0, 0, 0], pb.seg(40), 0.04)
        harness(pb, [[0.07, -0.06, 0.05], [0.09, -0.09, 0.02], [0.06, -0.12, -0.0]], 0.004)
      })
    }
    // wide-angle camera
    pb.at([0, -0.15, 0.015], undefined, () => {
      pb.rbox(0.11, 0.08, 0.07, 0.005, 'aluDark', [0, 0, 0.035])
      pb.at([0, 0, 0.07], undefined, () => lensBarrel(pb, { r: 0.022, len: 0.05, rings: 3 }))
    })
  } else {
    mountPlate(pb, 0.42, 0.34)
    pb.at([0, 0.03, 0.015], undefined, () => {
      pb.box(0.24, 0.22, 0.12, 'mliBlack', [0, 0, 0.06])
      pb.cylZ(0.125, 0.125, 0.3, 'mliBlack', [0, 0, 0.27])
      pb.cylZ(0.13, 0.13, 0.02, 'alu', [0, 0, 0.13])
      baffleTube(pb, 0.12, 0.16, 0.42, 'whitePaint', 3)
      pb.disc(0.115, 'glass', [0, 0, 0.44])
      // slanted sun-shade lip
      pb.cyl(0.124, 0.124, 0.08, 'whitePaint', [0, 0.0, 0.6], [H, 0, 0], { open: true, thetaStart: PI * 0.1, thetaLength: PI * 0.8 })
      pb.cyl(0.12, 0.12, 0.08, 'blackPaint', [0, 0.0, 0.6], [H, 0, 0], { open: true, inside: true, thetaStart: PI * 0.1, thetaLength: PI * 0.8 })
    })
    chassis(pb, 0.14, 0.1, 0.08, 'aluGold', [0, -0.12, 0.015], 2)
  }
  return one(pb)
}

/** Laser altimeter (LOLA-like): beryllium receiver telescope, laser beam expander, radiator. */
const altimeter: PartFactory = (ctx) => {
  const pb = pbOf(ctx, 'altim')
  mountPlate(pb, 0.34, 0.32)
  pb.box(0.3, 0.28, 0.13, 'mliGold', [0, 0, 0.08])
  pb.box(0.3, 0.004, 0.13, 'kapton', [0, 0.141, 0.08])
  // receiver telescope
  pb.at([0.04, 0.02, 0.145], undefined, () => {
    pb.cylZ(0.08, 0.08, 0.16, 'beryllium', [0, 0, 0.08])
    pb.cylZ(0.084, 0.084, 0.012, 'aluDark', [0, 0, 0.006])
    baffleTube(pb, 0.078, 0.07, 0.16, 'beryllium', 2)
    pb.disc(0.074, 'glass', [0, 0, 0.165])
  })
  // laser beam expander + diffractive optic (5 spots)
  pb.at([-0.09, -0.06, 0.145], undefined, () => {
    pb.cylZ(0.032, 0.032, 0.1, 'aluDark', [0, 0, 0.05])
    pb.cylZ(0.036, 0.036, 0.01, 'alu', [0, 0, 0.1])
    pb.disc(0.026, 'sapphire', [0, 0, 0.106])
    if (pb.hi) for (let i = 0; i < 5; i++) {
      const a = (i / 5) * PI * 2
      pb.disc(0.005, 'ledRed', [Math.cos(a) * 0.014, Math.sin(a) * 0.014, 0.1065])
    }
  })
  // laser box with radiator fins
  pb.box(0.1, 0.1, 0.05, 'aluDark', [-0.09, 0.07, 0.17])
  pb.box(0.004, 0.24, 0.14, 'whitePaint', [-0.152, 0, 0.08])
  if (pb.hi) for (let i = 0; i < 7; i++) pb.box(0.02, 0.003, 0.12, 'whitePaint', [-0.164, -0.1 + i * 0.033, 0.08])
  cable(pb, [[-0.04, 0.07, 0.17], [0.0, 0.08, 0.16], [0.04, 0.1, 0.15]], 0.004, 'cableAmber')
  return one(pb)
}

/** Infrared mineral mapper: silver-MLI box, slit aperture, big white radiator, cryocooler. */
const mapper: PartFactory = (ctx) => {
  const pb = pbOf(ctx, 'mapper')
  mountPlate(pb, 0.4, 0.3)
  pb.box(0.36, 0.26, 0.2, 'mliSilver', [0, 0, 0.115])
  // slit aperture with stepped baffle
  pb.at([0.05, 0, 0.215], undefined, () => {
    for (let i = 0; i < 4; i++) {
      const t = i / 4
      const w = 0.16 - t * 0.05
      const h = 0.07 - t * 0.02
      pb.box(w, 0.006, 0.02, 'blackPaint', [0, h / 2, t * 0.06 + 0.01])
      pb.box(w, 0.006, 0.02, 'blackPaint', [0, -h / 2, t * 0.06 + 0.01])
      pb.box(0.006, h, 0.02, 'blackPaint', [w / 2, 0, t * 0.06 + 0.01])
      pb.box(0.006, h, 0.02, 'blackPaint', [-w / 2, 0, t * 0.06 + 0.01])
    }
    pb.box(0.1, 0.004, 0.002, 'mirror', [0, 0, 0.002])
  })
  // radiator (white, finned) on the +Y side
  pb.box(0.34, 0.006, 0.22, 'whitePaint', [0, 0.136, 0.12])
  if (pb.hi) for (let i = 0; i < 10; i++) pb.box(0.003, 0.03, 0.2, 'whitePaint', [-0.15 + i * 0.033, 0.152, 0.12])
  // cryocooler
  pb.cylX(0.04, 0.04, 0.16, 'steel', [-0.06, -0.1, 0.25])
  pb.cylX(0.05, 0.05, 0.03, 'aluDark', [-0.15, -0.1, 0.25])
  pb.cylX(0.025, 0.025, 0.05, 'aluGold', [0.04, -0.1, 0.25])
  harness(pb, [[-0.15, -0.1, 0.22], [-0.17, -0.12, 0.15], [-0.17, -0.12, 0.05]], 0.004)
  return one(pb)
}

/** Neutron spectrometer: collimated detector array (grid of cylindrical moderators). */
const neutron: PartFactory = (ctx) => {
  const pb = pbOf(ctx, 'neutron')
  mountPlate(pb, 0.3, 0.3)
  pb.rbox(0.27, 0.27, 0.16, 0.01, 'greyPaint', [0, 0, 0.095])
  for (let j = -1; j <= 1; j++)
    for (let i = -1; i <= 1; i++) {
      const x = i * 0.085
      const y = j * 0.085
      pb.cylZ(0.034, 0.034, 0.05, i === 0 && j === 0 ? 'plasticWhite' : 'whitePaint', [x, y, 0.19])
      pb.cylZ(0.02, 0.02, 0.051, 'blackPaint', [x, y, 0.19], { open: true, inside: true })
      pb.disc(0.02, i === 0 && j === 0 ? 'copper' : 'aluGold', [x, y, 0.17])
    }
  pb.box(0.12, 0.06, 0.06, 'aluGold', [0.05, -0.17, 0.05])
  dsub(pb, [0.05, -0.2, 0.05], [H, 0, 0], 0.04)
  return one(pb)
}

/** Trace-gas spectrometer suite (NOMAD-like): black box with a solar periscope + nadir ports. */
const tracegas: PartFactory = (ctx) => {
  const pb = pbOf(ctx, 'tracegas')
  mountPlate(pb, 0.52, 0.38)
  pb.box(0.48, 0.34, 0.26, 'mliBlack', [0, 0, 0.145])
  if (pb.hi) for (const y of [-0.17, 0.17]) pb.box(0.48, 0.004, 0.26, 'kapton', [0, y, 0.145])
  // solar occultation periscope (angled rectangular tube)
  pb.at([0.14, 0.08, 0.275], [-0.6, 0, 0], () => {
    pb.box(0.1, 0.1, 0.22, 'alu', [0, 0, 0.11])
    pb.box(0.08, 0.08, 0.005, 'blackPaint', [0, 0, 0.221])
    pb.disc(0.03, 'glass', [0, 0, 0.224])
  })
  // nadir ports
  ;[[-0.12, 0.06, 0.04], [-0.12, -0.08, 0.03], [0.04, -0.09, 0.025]].forEach(([x, y, r]) => {
    pb.cylZ(r * 1.3, r * 1.3, 0.04, 'aluDark', [x, y, 0.295])
    pb.cylZ(r, r, 0.041, 'blackPaint', [x, y, 0.295], { open: true, inside: true })
    pb.disc(r, 'germanium', [x, y, 0.28])
  })
  // sun shade
  pb.box(0.2, 0.004, 0.12, 'whitePaint', [-0.1, 0.17, 0.33])
  chassis(pb, 0.16, 0.1, 0.07, 'aluGold', [-0.12, -0.1, 0.275], 2)
  return one(pb)
}

/** Ground-penetrating radar: electronics box + long dipole antenna (MARSIS-like). */
const radar: PartFactory = (ctx) => {
  const pb = pbOf(ctx, 'radar')
  mountPlate(pb, 0.4, 0.3)
  pb.box(0.36, 0.26, 0.14, 'mliGold', [0, 0, 0.085])
  chassis(pb, 0.2, 0.14, 0.06, 'aluDark', [0, 0, 0.155], 3)
  const L = ctx.preview ? 0.55 : 2.6
  for (const s of [-1, 1]) {
    // deployment canister + dipole element
    pb.box(0.08, 0.1, 0.1, 'whitePaint', [s * 0.2, 0, 0.09])
    pb.cylX(0.03, 0.03, 0.04, 'alu', [s * 0.25, 0, 0.09])
    boom(pb, [s * 0.27, 0, 0.09], [s, 0, 0], L, 0.012, 'cableAmber')
  }
  // monopole
  boom(pb, [0, 0.13, 0.09], [0, 1, 0], ctx.preview ? 0.25 : 0.7, 0.008, 'cableAmber')
  return one(pb)
}

/** Magnetometer boom + particle analyser (top-hat electrostatic analyser). */
const fields: PartFactory = (ctx) => {
  const pb = pbOf(ctx, 'fields')
  mountPlate(pb, 0.28, 0.24)
  // particle package
  pb.box(0.18, 0.16, 0.12, 'mliGold', [-0.03, 0, 0.075])
  pb.cylZ(0.055, 0.06, 0.06, 'aluDark', [-0.03, 0, 0.165])
  pb.sphere(0.05, 'aluGold', [-0.03, 0, 0.195], [H, 0, 0], { thetaLength: H })
  pb.torus(0.056, 0.006, 'blackPaint', [-0.03, 0, 0.198])
  // Langmuir probe stub
  pb.rod([0.04, 0.06, 0.12], [0.12, 0.14, 0.26], 0.004, 'cfrp')
  pb.sphere(0.018, 'titanium', [0.12, 0.14, 0.26])
  // magnetometer boom with two fluxgate sensors
  const L = ctx.preview ? 0.5 : 2.2
  pb.box(0.06, 0.06, 0.06, 'aluDark', [0.1, 0, 0.05])
  const end = boom(pb, [0.13, 0, 0.05], [1, 0, 0], L, 0.012, 'cfrp')
  pb.box(0.07, 0.07, 0.07, 'mliBlack', [end[0] + 0.03, end[1], end[2]])
  pb.box(0.05, 0.05, 0.05, 'mliBlack', [0.13 + L * 0.6, 0, 0.05])
  if (pb.hi) cable(pb, [[0.13, 0.015, 0.06], [0.13 + L * 0.3, 0.016, 0.062], [0.13 + L * 0.6, 0.015, 0.06], [end[0], 0.015, 0.06]], 0.003, 'cableWhite')
  return one(pb)
}

// ------------------------------------------------------------------ computer

const computer = (variant: 'std' | 'rad' | 'mem' | 'auto'): PartFactory => (ctx) => {
  const pb = pbOf(ctx, 'obc_' + variant)
  const k = ctx.missionId === 'mars' ? 1.15 : 1
  if (variant === 'std') {
    chassis(pb, 0.26 * k, 0.2 * k, 0.11 * k, 'aluDark', [0, 0, 0], 4)
  } else if (variant === 'rad') {
    chassis(pb, 0.28 * k, 0.22 * k, 0.13 * k, 'aluGold', [0, 0, 0], 4)
  } else if (variant === 'mem') {
    chassis(pb, 0.26 * k, 0.2 * k, 0.13 * k, 'aluGold', [-0.15 * k, 0, 0], 4)
    chassis(pb, 0.22 * k, 0.18 * k, 0.1 * k, 'aluBlue', [0.17 * k, 0, 0], 2)
    harness(pb, [[-0.05 * k, -0.11 * k, 0.07 * k], [0.02 * k, -0.15 * k, 0.04 * k], [0.12 * k, -0.1 * k, 0.05 * k]], 0.005)
  } else {
    // redundant A/B computers + cross-strap unit
    chassis(pb, 0.22 * k, 0.2 * k, 0.12 * k, 'aluGold', [-0.18 * k, 0, 0], 3)
    chassis(pb, 0.22 * k, 0.2 * k, 0.12 * k, 'aluGold', [0.18 * k, 0, 0], 3)
    chassis(pb, 0.1 * k, 0.16 * k, 0.08 * k, 'aluBlue', [0, 0.02, 0], 1)
    harness(pb, [[-0.1 * k, -0.11 * k, 0.08 * k], [0, -0.16 * k, 0.05 * k], [0.1 * k, -0.11 * k, 0.08 * k]], 0.005, ['cable', 'cableWhite', 'cableRed'])
    pb.box(0.06, 0.004, 0.02, 'led', [-0.18 * k, -0.1 * k - 0.002, 0.1 * k])
    pb.box(0.06, 0.004, 0.02, 'led', [0.18 * k, -0.1 * k - 0.002, 0.1 * k])
  }
  return one(pb)
}

// ------------------------------------------------------------------ comms

function transponder(pb: PartBuilder, twtas: number, k = 1) {
  chassis(pb, 0.2 * k, 0.15 * k, 0.08 * k, 'aluDark', [-0.12 * k, 0, 0], 2)
  for (let i = 0; i < twtas; i++) {
    const x = 0.08 * k + i * 0.12 * k
    pb.box(0.09 * k, 0.24 * k, 0.07 * k, 'alu', [x, 0, 0.035 * k])
    if (pb.hi) for (let f = 0; f < 6; f++) pb.box(0.09 * k, 0.004, 0.02 * k, 'alu', [x, -0.1 * k + f * 0.04 * k, 0.08 * k])
    pb.cyl(0.012 * k, 0.012 * k, 0.08 * k, 'aluGold', [x, 0.15 * k, 0.035 * k])
  }
  pb.at([0, 0, 0], undefined, () => cable(pb, [[-0.02 * k, 0.0, 0.05 * k], [0.03 * k, 0.04 * k, 0.07 * k], [0.08 * k, 0.1 * k, 0.05 * k]], 0.006 * k, 'cableWhite'))
}

/** quadrifilar-helix low-gain antenna in a white radome (boresight +Z) */
function lga(pb: PartBuilder, s = 1) {
  pb.cylZ(0.05 * s, 0.05 * s, 0.01 * s, 'alu', [0, 0, 0.005 * s])
  pb.cylZ(0.035 * s, 0.035 * s, 0.14 * s, 'plasticWhite', [0, 0, 0.08 * s])
  pb.sphere(0.035 * s, 'plasticWhite', [0, 0, 0.15 * s], [H, 0, 0], { thetaLength: H })
  pb.cylZ(0.037 * s, 0.037 * s, 0.01 * s, 'goldPin', [0, 0, 0.015 * s])
}

const radioDeep = (id: string): PartFactory => (ctx) => {
  const pb = pbOf(ctx, id)
  const mars = ctx.missionId === 'mars'
  const k = mars ? 1.2 : 1
  const ex = new PartBuilder(ctx.detail, ctx.texScale, id + '_antenna')
  let mount: 'lga' | 'mast' | 'boom' | 'top' = 'top'
  switch (id) {
    case 'sband':
      transponder(pb, 0, k)
      lga(ex, 1.3)
      mount = 'lga'
      break
    case 'xband': {
      transponder(pb, 1, k)
      // medium-gain flat patch array on a short gimballed mast
      ex.cylZ(0.04, 0.05, 0.25, 'alu', [0, 0, 0.125])
      ex.box(0.08, 0.08, 0.06, 'aluDark', [0, 0, 0.27])
      ex.at([0, 0, 0.32], [0.35, 0, 0], () => {
        ex.box(0.42, 0.42, 0.02, 'whitePaint', [0, 0, 0])
        for (let j = 0; j < 4; j++)
          for (let i = 0; i < 4; i++) ex.box(0.07, 0.07, 0.004, 'goldPin', [-0.15 + i * 0.1, -0.15 + j * 0.1, 0.012])
        ex.box(0.1, 0.1, 0.03, 'aluDark', [0, 0, -0.025])
      })
      mount = 'mast'
      break
    }
    case 'kaband': {
      transponder(pb, 2, k)
      // high-gain dish on a 2-axis gimbal boom
      ex.box(0.12, 0.12, 0.06, 'aluDark', [0, 0, 0.03])
      const end = boom(ex, [0, 0, 0.06], [0, 0, 1], ctx.preview ? 0.3 : 0.75, 0.025, 'cfrp')
      ex.cylX(0.05, 0.05, 0.1, 'aluDark', [end[0], end[1], end[2] + 0.04])
      ex.cylZ(0.05, 0.05, 0.08, 'alu', [end[0], end[1], end[2] + 0.12])
      ex.at([end[0], end[1], end[2] + 0.16], [0.5, 0, 0], () => dish(ex, { D: 1.0, fd: 0.35, cassegrain: true }))
      mount = 'boom'
      break
    }
    case 'x1':
      transponder(pb, 1, k)
      ex.cylZ(0.08, 0.1, 0.15, 'alu', [0, 0, 0.075])
      ex.at([0, 0, 0.15], undefined, () => dish(ex, { D: 1.0, fd: 0.4, struts: 3 }))
      break
    case 'x2':
      transponder(pb, 1, k)
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * PI * 2 + PI / 4
        ex.rod([Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0], [Math.cos(a) * 0.12, Math.sin(a) * 0.12, 0.25], 0.015, 'cfrp')
      }
      ex.cylZ(0.14, 0.14, 0.04, 'alu', [0, 0, 0.26])
      ex.at([0, 0, 0.28], undefined, () => dish(ex, { D: 2.0, fd: 0.36, cassegrain: true }))
      break
    case 'ka3':
      transponder(pb, 2, k)
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * PI * 2
        ex.rod([Math.cos(a) * 0.45, Math.sin(a) * 0.45, 0], [Math.cos(a) * 0.2, Math.sin(a) * 0.2, 0.35], 0.02, 'cfrp')
      }
      ex.cylZ(0.22, 0.22, 0.05, 'alu', [0, 0, 0.37])
      ex.at([0, 0, 0.4], undefined, () => {
        dish(ex, { D: 3.0, fd: 0.33, cassegrain: true, struts: 4, surface: 'tape' })
        // deployable petal seams
        if (ex.hi) for (let i = 0; i < 12; i++) {
          const a = (i / 12) * PI * 2
          const pts: V3[] = []
          for (let k = 1; k <= 6; k++) {
            const r = (k / 6) * 1.48
            pts.push([Math.cos(a) * r, Math.sin(a) * r, (r * r) / (4 * 0.99) + 0.006])
          }
          ex.tube(pts, 0.008, 'whitePaint', { radial: 4, seg: 8 })
        }
      })
      break
  }
  return { main: pb.build(), extras: [{ object: ex.build(), mount }] }
}

// ------------------------------------------------------------------ attitude

function wheelPyramid(pb: PartBuilder, n: number, r: number, k = 1) {
  pb.rbox(0.5 * k, 0.5 * k, 0.012, 0.004, 'alu', [0, 0, 0.006])
  const tilt = 0.6
  for (let i = 0; i < n; i++) {
    const a = (i / n) * PI * 2 + PI / 4
    const x = Math.cos(a) * 0.15 * k
    const y = Math.sin(a) * 0.15 * k
    pb.at([x, y, 0.012], [-Math.sin(a) * tilt, Math.cos(a) * tilt, 0], () => {
      pb.box(r * 2.2, r * 2.2, 0.01, 'aluDark', [0, 0, 0.005])
      reactionWheel(pb, r, r * 0.8, [0, 0, 0.01], [0, 0, 0], 'alu')
    })
  }
}

const attitudeDeep = (id: 'thr' | 'wheel' | 'wheel_red'): PartFactory => (ctx) => {
  const pb = pbOf(ctx, id)
  const k = ctx.missionId === 'mars' ? 1.2 : 1
  const extras: PartResult['extras'] = []
  if (id === 'thr') {
    chassis(pb, 0.18 * k, 0.12 * k, 0.07 * k, 'aluDark', [0, 0, 0], 2)
    // latch valves + filter on a plate
    pb.box(0.3 * k, 0.16 * k, 0.006, 'alu', [0, 0.18 * k, 0.003])
    for (let i = 0; i < 3; i++) pb.cylZ(0.02, 0.02, 0.06, 'steel', [(-0.08 + i * 0.08) * k, 0.18 * k, 0.036])
    cable(pb, [[-0.12 * k, 0.18 * k, 0.02], [0, 0.22 * k, 0.03], [0.12 * k, 0.18 * k, 0.02]], 0.004, 'steel')
    // rocker thruster cluster (4 nozzles) – copied to the four lower corners
    const c = new PartBuilder(ctx.detail, ctx.texScale, 'thruster_cluster')
    c.box(0.08, 0.08, 0.03, 'alu', [0, 0, 0.015])
    c.cylZ(0.015, 0.015, 0.04, 'goldPin', [0, 0, 0.05])
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * PI * 2
      c.aim([Math.cos(a) * 0.035, Math.sin(a) * 0.035, 0.03], [-Math.cos(a) * 0.8, -Math.sin(a) * 0.8, -0.6], () => smallThruster(c, 0.05))
    }
    // coarse sun sensor
    c.box(0.03, 0.03, 0.01, 'aluDark', [0.0, 0.06, 0.005])
    c.box(0.018, 0.018, 0.002, 'glass', [0.0, 0.06, 0.011])
    extras.push({ object: c.build(), mount: 'corners' })
  } else {
    const red = id === 'wheel_red'
    wheelPyramid(pb, red ? 5 : 4, 0.07 * k, k)
    chassis(pb, 0.12 * k, 0.1 * k, 0.06 * k, 'aluDark', [0, 0, 0.012], 1)
    const t = new PartBuilder(ctx.detail, ctx.texScale, 'star_trackers')
    const n = red ? 2 : 1
    for (let i = 0; i < n; i++) {
      t.at([(i - (n - 1) / 2) * 0.16, 0, 0], [0, (i - (n - 1) / 2) * 0.5, 0], () => {
        t.box(0.13, 0.13, 0.02, 'alu', [0, 0, 0.01])
        starTracker(t, 0.09, [0, 0, 0.02])
      })
    }
    extras.push({ object: t.build(), mount: 'trackers' })
  }
  return { main: pb.build(), extras }
}

// ------------------------------------------------------------------ battery

const batteryDeep = (size: 's' | 'm' | 'l'): PartFactory => (ctx) => {
  const pb = pbOf(ctx, 'bat_' + size)
  const k = ctx.missionId === 'mars' ? 1.25 : 1
  const [nx, ny, mods] = { s: [5, 4, 1], m: [7, 5, 1], l: [7, 5, 2] }[size] as [number, number, number]
  const r = 0.012 * k
  const pitch = r * 2.15
  const w = nx * pitch + 0.02
  const d = ny * pitch + 0.02
  const h = 0.075 * k
  for (let m = 0; m < mods; m++) {
    const ox = mods === 1 ? 0 : (m - 0.5) * (w + 0.04)
    pb.at([ox, 0, 0], undefined, () => {
      // aluminium tray walls
      pb.box(w + 0.03, d + 0.03, 0.008, 'alu', [0, 0, 0.004])
      for (const s of [-1, 1]) {
        pb.box(w, 0.006, h, 'aluDark', [0, s * (d / 2), h / 2 + 0.008])
        pb.box(0.006, d, h, 'aluDark', [s * (w / 2), 0, h / 2 + 0.008])
      }
      // cells (tops visible)
      for (let j = 0; j < ny; j++)
        for (let i = 0; i < nx; i++) {
          const x = -w / 2 + 0.01 + pitch / 2 + i * pitch
          const y = -d / 2 + 0.01 + pitch / 2 + j * pitch
          pb.cylZ(r, r, h * 0.92, 'cellBlue', [x, y, 0.008 + h * 0.46], { seg: pb.seg(16) })
          pb.cylZ(r * 0.92, r * 0.92, 0.002, 'steel', [x, y, 0.008 + h * 0.93], { seg: pb.seg(16) })
        }
      // copper busbars across rows
      for (let j = 0; j < ny; j++) {
        const y = -d / 2 + 0.01 + pitch / 2 + j * pitch
        pb.box(w - 0.02, r * 0.6, 0.0015, 'copper', [0, y, 0.008 + h * 0.94])
      }
      roundConnector(pb, [w / 2 - 0.02, -d / 2, h * 0.6], [H, 0, 0], 0.012)
      pb.box(w * 0.4, 0.004, h * 0.4, 'pcbGreen', [-w * 0.15, -d / 2 - 0.004, h * 0.55])
    })
  }
  // power conditioning (EPS) box
  chassis(pb, 0.16 * k, 0.12 * k, 0.07 * k, 'aluDark', [0, (d / 2 + 0.11 * k), 0], 2)
  harness(pb, [[w / 2 - 0.02, -d / 2 - 0.02, h * 0.6], [w / 2 + 0.02, 0, h * 0.7], [0.05, d / 2 + 0.06 * k, 0.05 * k]], 0.005, ['cableRed', 'cable', 'cableRed'])
  return one(pb)
}

// ------------------------------------------------------------------ propulsion

/** Propulsion module: tanks above z=0, thrust axis −Z, engines below. hp = available module height. */
const propulsion = (id: string): PartFactory => (ctx) => {
  const pb = pbOf(ctx, id)
  const mars = ctx.missionId === 'mars'
  const hp = mars ? 0.66 : 0.42
  const fourThrusters = (s: number, rr: number) => {
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * PI * 2 + PI / 4
      smallThruster(pb, s, [Math.cos(a) * rr, Math.sin(a) * rr, 0.0], [0, 0, 0])
      cable(pb, [[Math.cos(a) * rr, Math.sin(a) * rr, s], [Math.cos(a) * rr * 0.7, Math.sin(a) * rr * 0.7, s * 2], [0, 0, hp * 0.3]], 0.004, 'steel')
    }
  }
  const deck = (w: number) => {
    pb.rbox(w, w, 0.02, 0.006, 'alu', [0, 0, 0.01])
    if (pb.hi) cornerScrews(pb, w, w, 0.02, 0.03, 0.006)
  }
  switch (id) {
    case 'mono_s': {
      deck(0.6)
      tank(pb, 0.17, 0, [0, 0, 0.02 + 0.19])
      fourThrusters(0.07, 0.22)
      break
    }
    case 'mono_l': {
      const r = mars ? 0.26 : 0.17
      deck(mars ? 1.0 : 0.7)
      for (const s of [-1, 1]) tank(pb, r, mars ? 0.06 : 0.0, [s * r * 1.15, 0, 0.02 + hp * 0.5], 'titanium')
      fourThrusters(mars ? 0.1 : 0.08, mars ? 0.36 : 0.26)
      pb.rod([-r * 1.15, 0, hp * 0.5 + r], [r * 1.15, 0, hp * 0.5 + r], 0.006, 'steel')
      break
    }
    case 'biprop':
    case 'biprop_xl': {
      const xl = id === 'biprop_xl'
      const r = mars ? 0.25 : 0.165
      const cylL = mars ? (xl ? 0.06 : 0.1) : 0.04
      deck(mars ? 1.1 : 0.75)
      const tanks: [number, number][] = xl
        ? [[-1, -1], [1, -1], [-1, 1], [1, 1]]
        : [[-1, 0], [1, 0]]
      const sp = xl ? r * 1.12 : r * 1.25
      tanks.forEach(([sx, sy], i) => tank(pb, r, cylL, [sx * sp, sy * sp, 0.02 + hp * 0.52], i % 2 ? 'titanium' : 'aluGold'))
      // pressurant COPV(s)
      const copvs = xl ? 2 : 1
      for (let i = 0; i < copvs; i++) pb.sphere(r * 0.5, 'copv', [(i - (copvs - 1) / 2) * r * 1.3, xl ? 0 : r * 1.25, 0.02 + hp * (xl ? 0.92 : 0.5)])
      // main engine with gimbal-less mount, valves, heat shield
      const ex = mars ? (xl ? 0.24 : 0.2) : 0.13
      pb.cylZ(ex * 0.45, ex * 0.6, 0.06, 'steel', [0, 0, -0.01])
      pb.cylZ(ex * 0.32, ex * 0.32, 0.06, 'aluGold', [0, 0, 0.04])
      for (let i = 0; i < 2; i++) pb.cylZ(0.02, 0.02, 0.05, 'steel', [(i ? 1 : -1) * ex * 0.4, 0, 0.06])
      bellNozzle(pb, ex * 0.18, ex, ex * 2.4, [0, 0, -0.04])
      pb.disc(ex * 1.4, 'mliGold', [0, 0, 0.0005], [PI, 0, 0], pb.seg(36), ex * 0.6)
      fourThrusters(mars ? 0.1 : 0.07, mars ? 0.45 : 0.3)
      harness(pb, [[0, 0, 0.06], [sp * 0.5, 0, hp * 0.3], [sp, 0, hp * 0.4]], 0.006, ['steel', 'steel', 'aluGold'])
      break
    }
    case 'sep': {
      deck(1.0)
      // xenon COPV + PPU
      pb.sphere(0.3, 'copv', [0, 0.1, 0.02 + hp * 0.5])
      pb.cylZ(0.04, 0.04, 0.08, 'steel', [0, 0.1, 0.02 + hp * 0.5 + 0.32])
      chassis(pb, 0.3, 0.2, 0.12, 'aluDark', [0.0, -0.32, 0.02], 3)
      // gridded ion thruster on a gimbal ring (thrust −Z)
      pb.at([0, 0, -0.02], undefined, () => {
        pb.torus(0.25, 0.015, 'alu', [0, 0, 0], [0, 0, 0], { seg: pb.seg(48) })
        pb.cylZ(0.21, 0.23, 0.22, 'alu', [0, 0, -0.11], { seg: pb.seg(48) })
        pb.cylZ(0.215, 0.215, 0.02, 'aluDark', [0, 0, -0.225], { seg: pb.seg(48) })
        const g = pb
        g.disc(0.19, 'ionGrid', [0, 0, -0.236], [PI, 0, 0], pb.seg(48))
        g.torus(0.2, 0.012, 'aluDark', [0, 0, -0.235], [0, 0, 0], { seg: pb.seg(48) })
        // neutraliser cathode
        g.rod([0.2, 0, -0.18], [0.27, 0, -0.26], 0.012, 'steel')
        g.cylZ(0.018, 0.018, 0.04, 'aluGold', [0.27, 0, -0.27])
        // gimbal actuators
        for (const s of [-1, 1]) g.rod([s * 0.28, 0, 0.04], [s * 0.22, 0, -0.08], 0.012, 'steel')
      })
      fourThrusters(0.08, 0.42)
      break
    }
  }
  return one(pb)
}

export const DEEP_PARTS: Record<string, PartFactory> = {
  cam: camera,
  altim: altimeter,
  mapper,
  neutron,
  tracegas,
  radar,
  fields,
  obc_std: computer('std'),
  obc_rad: computer('rad'),
  obc_mem: computer('mem'),
  obc_auto: computer('auto'),
  sband: radioDeep('sband'),
  xband: radioDeep('xband'),
  kaband: radioDeep('kaband'),
  x1: radioDeep('x1'),
  x2: radioDeep('x2'),
  ka3: radioDeep('ka3'),
  thr: attitudeDeep('thr'),
  wheel: attitudeDeep('wheel'),
  wheel_red: attitudeDeep('wheel_red'),
  bat_s: batteryDeep('s'),
  bat_m: batteryDeep('m'),
  bat_l: batteryDeep('l'),
  mono_s: propulsion('mono_s'),
  mono_l: propulsion('mono_l'),
  biprop: propulsion('biprop'),
  biprop_xl: propulsion('biprop_xl'),
  sep: propulsion('sep'),
}
