/** Pure tile maths for 256 px WMTS grids (Web-Mercator GIBS, equirectangular Moon/Mars Trek). */
import type { ImageryLayer } from './layers'

export const TILE = 256

export interface TileRef {
  z: number
  x: number
  y: number
  /** top-left of this tile relative to the crop origin, native pixels */
  dx: number
  dy: number
}

export interface FramePlan {
  z: number
  /** crop size in native pixels (drawn into the output frame; width may be squeezed for high latitudes) */
  cropW: number
  cropH: number
  tiles: TileRef[]
}

export function worldSize(layer: Pick<ImageryLayer, 'grid'>, z: number): { w: number; h: number } {
  return layer.grid === 'mercator'
    ? { w: TILE * 2 ** z, h: TILE * 2 ** z }
    : { w: TILE * 2 ** (z + 1), h: TILE * 2 ** z }
}

/** Lat/lon -> world pixel at zoom z. */
export function project(layer: Pick<ImageryLayer, 'grid'>, z: number, lat: number, lon: number): { x: number; y: number } {
  const { w, h } = worldSize(layer, z)
  const x = ((((lon + 180) % 360) + 360) % 360) / 360 * w
  if (layer.grid === 'mercator') {
    const φ = (Math.max(-85, Math.min(85, lat)) * Math.PI) / 180
    const y = ((1 - Math.log(Math.tan(φ) + 1 / Math.cos(φ)) / Math.PI) / 2) * h
    return { x, y }
  }
  return { x, y: ((90 - lat) / 180) * h }
}

/**
 * Tiles needed to show an outW x outH frame centred on lat/lon. Equirectangular grids are stretched east-west
 * by 1/cos(lat), so the crop is widened (and squeezed back when drawn) - at high latitude one zoom level lower
 * keeps the tile count small.
 */
export function planFrame(
  layer: Pick<ImageryLayer, 'grid' | 'minZoom' | 'maxZoom'>,
  lat: number,
  lon: number,
  zoom: number,
  outW: number,
  outH: number,
): FramePlan {
  let z = Math.max(layer.minZoom, Math.min(layer.maxZoom, Math.round(zoom)))
  let stretch = layer.grid === 'geographic' ? 1 / Math.max(0.2, Math.cos((lat * Math.PI) / 180)) : 1
  while (stretch > 2.2 && z > Math.max(1, layer.minZoom)) {
    z -= 1
    stretch /= 2
  }
  if (layer.grid === 'geographic') z = Math.max(z, Math.min(1, layer.maxZoom))
  const world = worldSize(layer, z)
  let cropW = Math.round(outW * Math.max(1, stretch))
  let cropH = outH
  if (cropH > world.h) {
    const k = world.h / cropH
    cropH = world.h
    cropW = Math.round(cropW * k)
  }
  cropW = Math.min(cropW, world.w)
  const c = project(layer, z, lat, lon)
  const x0 = c.x - cropW / 2
  const y0 = Math.max(0, Math.min(world.h - cropH, c.y - cropH / 2))
  const cols = world.w / TILE
  const rows = world.h / TILE
  const tiles: TileRef[] = []
  for (let ty = Math.floor(y0 / TILE); ty * TILE < y0 + cropH; ty++) {
    if (ty < 0 || ty >= rows) continue
    for (let tx = Math.floor(x0 / TILE); tx * TILE < x0 + cropW; tx++) {
      tiles.push({ z, x: ((tx % cols) + cols) % cols, y: ty, dx: tx * TILE - x0, dy: ty * TILE - y0 })
    }
  }
  return { z, cropW, cropH, tiles }
}
