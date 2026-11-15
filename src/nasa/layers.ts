/**
 * Real NASA imagery layers used for "science returns". Every identifier, tile matrix set, format and zoom range
 * below was verified against the services' WMTS GetCapabilities documents (Nov 2026) and by fetching tiles with an
 * Origin header (all return `Access-Control-Allow-Origin: *`, no API key):
 *
 *  - NASA GIBS, EPSG:3857 "best":   https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml
 *    REST template  {base}/{Layer}/default/{Time}/{TileMatrixSet}/{z}/{y}/{x}.{ext}  (256 px Web-Mercator tiles)
 *  - NASA Moon Trek, equirectangular: https://trek.nasa.gov/tiles/Moon/EQ/{Layer}/1.0.0/WMTSCapabilities.xml
 *  - NASA Mars Trek, equirectangular: https://trek.nasa.gov/tiles/Mars/EQ/{Layer}/1.0.0/WMTSCapabilities.xml
 *    REST template  .../{Layer}/1.0.0/default/default028mm/{z}/{y}/{x}.{ext}  (256 px tiles, level z = 2^(z+1) x 2^z)
 */
import type { MissionId } from '../data'

export type TileGrid = 'mercator' | 'geographic'

export interface ImageryLayer {
  /** WMTS layer identifier */
  id: string
  /** short human name, e.g. "MODIS Terra true colour" */
  name: string
  /** what the colours mean (one line, shown in the large view) */
  legend: string
  service: 'gibs' | 'moontrek' | 'marstrek'
  grid: TileGrid
  /** GIBS TileMatrixSet (mercator only) */
  matrixSet?: string
  ext: 'jpg' | 'png'
  minZoom: number
  maxZoom: number
  /** zoom that frames ~500 km on the ground (before orbit adjustments) */
  baseZoom: number
  /** daily / periodic product (GIBS) - the request carries a date */
  temporal: 'daily' | 'monthly' | 'periodic' | null
  /** latitude limits of the product (Diviner/THEMIS mosaics stop short of the poles) */
  latLimit?: number
  /** transparent overlay drawn over this base layer */
  base?: string
  /** layer to try when this one fails (e.g. VIIRS when MODIS has no tile) */
  fallback?: string
  /** mission + instrument names for the "Source:" credit */
  credit: string
  /** honest note when the layer stands in for the game's instrument */
  proxy?: string
}

const GIBS = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best'
const TREK = 'https://trek.nasa.gov/tiles'

export const LAYERS: Record<string, ImageryLayer> = {
  /* ---------------- Earth - NASA GIBS ---------------- */
  MODIS_Terra_CorrectedReflectance_TrueColor: {
    id: 'MODIS_Terra_CorrectedReflectance_TrueColor',
    name: 'MODIS Terra true colour',
    legend: 'Natural colour, corrected reflectance (bands 1-4-3). White = clouds and snow.',
    service: 'gibs', grid: 'mercator', matrixSet: 'GoogleMapsCompatible_Level9', ext: 'jpg',
    minZoom: 0, maxZoom: 9, baseZoom: 6, temporal: 'daily',
    fallback: 'VIIRS_NOAA20_CorrectedReflectance_TrueColor',
    credit: 'NASA GIBS · Terra / MODIS',
  },
  VIIRS_NOAA20_CorrectedReflectance_TrueColor: {
    id: 'VIIRS_NOAA20_CorrectedReflectance_TrueColor',
    name: 'VIIRS NOAA-20 true colour',
    legend: 'Natural colour, corrected reflectance. White = clouds and snow.',
    service: 'gibs', grid: 'mercator', matrixSet: 'GoogleMapsCompatible_Level9', ext: 'jpg',
    minZoom: 0, maxZoom: 9, baseZoom: 6, temporal: 'daily',
    credit: 'NASA GIBS · NOAA-20 / VIIRS',
  },
  MODIS_Terra_L3_Land_Surface_Temp_Monthly_Day: {
    id: 'MODIS_Terra_L3_Land_Surface_Temp_Monthly_Day',
    name: 'MODIS land surface temperature (day, monthly)',
    legend: 'Daytime land temperature: blue = cold, yellow/red = hot. Oceans have no value.',
    service: 'gibs', grid: 'mercator', matrixSet: 'GoogleMapsCompatible_Level6', ext: 'png',
    minZoom: 0, maxZoom: 6, baseZoom: 5, temporal: 'monthly', base: 'BlueMarble_ShadedRelief_Bathymetry',
    credit: 'NASA GIBS · Terra / MODIS (MOD11C3)',
  },
  MODIS_Terra_Aerosol: {
    id: 'MODIS_Terra_Aerosol',
    name: 'MODIS aerosol optical depth',
    legend: 'Haze, smoke and dust in the air: yellow = light, dark red = thick. Gaps = clouds or no overpass.',
    service: 'gibs', grid: 'mercator', matrixSet: 'GoogleMapsCompatible_Level6', ext: 'png',
    minZoom: 0, maxZoom: 6, baseZoom: 5, temporal: 'daily', base: 'BlueMarble_ShadedRelief_Bathymetry',
    credit: 'NASA GIBS · Terra / MODIS (MOD04)',
  },
  MODIS_Terra_L3_NDVI_16Day: {
    id: 'MODIS_Terra_L3_NDVI_16Day',
    name: 'MODIS vegetation index (NDVI, 16-day)',
    legend: 'How green the land is: brown = bare, dark green = dense vegetation.',
    service: 'gibs', grid: 'mercator', matrixSet: 'GoogleMapsCompatible_Level9', ext: 'png',
    minZoom: 0, maxZoom: 9, baseZoom: 6, temporal: 'periodic', base: 'BlueMarble_ShadedRelief_Bathymetry',
    credit: 'NASA GIBS · Terra / MODIS (MOD13Q1)',
    proxy: 'A vegetation index is one of the products a spectrometer like yours delivers.',
  },
  BlueMarble_ShadedRelief_Bathymetry: {
    id: 'BlueMarble_ShadedRelief_Bathymetry',
    name: 'Blue Marble shaded relief',
    legend: '',
    service: 'gibs', grid: 'mercator', matrixSet: 'GoogleMapsCompatible_Level8', ext: 'jpg',
    minZoom: 0, maxZoom: 8, baseZoom: 5, temporal: null,
    credit: 'NASA Blue Marble',
  },

  /* ---------------- Moon - NASA Moon Trek ---------------- */
  LRO_WAC_Mosaic_Global_303ppd_v02: {
    id: 'LRO_WAC_Mosaic_Global_303ppd_v02',
    name: 'LROC Wide Angle Camera mosaic',
    legend: 'Grey-scale visible image of the surface (100 m per pixel).',
    service: 'moontrek', grid: 'geographic', ext: 'jpg',
    minZoom: 0, maxZoom: 8, baseZoom: 6, temporal: null,
    credit: 'NASA Moon Trek · LRO / LROC WAC',
  },
  LRO_LOLA_ClrShade_Global_128ppd_v04: {
    id: 'LRO_LOLA_ClrShade_Global_128ppd_v04',
    name: 'LOLA colour-shaded elevation',
    legend: 'Height from laser ranging: blue/purple = low basins, red/white = high terrain.',
    service: 'moontrek', grid: 'geographic', ext: 'png',
    minZoom: 0, maxZoom: 5, baseZoom: 5, temporal: null,
    credit: 'NASA Moon Trek · LRO / LOLA',
  },
  Clem_UVVIS_FeO_Clr_Global_152ppd: {
    id: 'Clem_UVVIS_FeO_Clr_Global_152ppd',
    name: 'Clementine iron oxide (FeO) abundance',
    legend: 'Iron-rich minerals: blue = low FeO (bright highlands), red = high FeO (dark mare basalt).',
    service: 'moontrek', grid: 'geographic', ext: 'png',
    minZoom: 0, maxZoom: 6, baseZoom: 5, temporal: null,
    credit: 'NASA Moon Trek · Clementine / UVVIS',
    proxy: 'Clementine mapped minerals with visible and near-infrared colours; it stands in for your infrared mapper.',
  },
  LP_NS_H_Clr_Global_2ppd: {
    id: 'LP_NS_H_Clr_Global_2ppd',
    name: 'Lunar Prospector hydrogen abundance',
    legend: 'Hydrogen from epithermal neutrons: warm colours = more hydrogen (likely water ice).',
    service: 'moontrek', grid: 'geographic', ext: 'png',
    minZoom: 0, maxZoom: 1, baseZoom: 1, temporal: null,
    credit: 'NASA Moon Trek · Lunar Prospector / Neutron Spectrometer',
  },

  /* ---------------- Mars - NASA Mars Trek ---------------- */
  Mars_Viking_MDIM21_ClrMosaic_global_232m: {
    id: 'Mars_Viking_MDIM21_ClrMosaic_global_232m',
    name: 'Viking colour mosaic (MDIM 2.1)',
    legend: 'Colour image of the surface, 232 m per pixel.',
    service: 'marstrek', grid: 'geographic', ext: 'jpg',
    minZoom: 0, maxZoom: 7, baseZoom: 6, temporal: null,
    credit: 'NASA Mars Trek · Viking Orbiter / VIS',
    proxy: 'A global colour mosaic from the Viking orbiters stands in for your context camera.',
  },
  TES_Dust: {
    id: 'TES_Dust',
    name: 'TES atmospheric dust',
    legend: 'Dust measured by an infrared spectrometer: warm colours = dustier.',
    service: 'marstrek', grid: 'geographic', ext: 'png',
    minZoom: 0, maxZoom: 1, baseZoom: 1, temporal: null,
    credit: 'NASA Mars Trek · Mars Global Surveyor / TES',
    proxy: 'Trace-gas maps are not published as map tiles; TES dust from a real orbital spectrometer is the closest.',
  },
  Mars_MGS_MOLA_ClrShade_merge_global_463m: {
    id: 'Mars_MGS_MOLA_ClrShade_merge_global_463m',
    name: 'MOLA colour-shaded elevation',
    legend: 'Height: blue = low plains (where buried ice is common), red/white = volcanoes and highlands.',
    service: 'marstrek', grid: 'geographic', ext: 'jpg',
    minZoom: 0, maxZoom: 7, baseZoom: 5, temporal: null,
    credit: 'NASA Mars Trek · Mars Global Surveyor / MOLA',
    proxy: 'Radar soundings are profiles, not map tiles; MOLA shows the terrain your radar would sound beneath.',
  },
  THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018: {
    id: 'THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018',
    name: 'THEMIS daytime infrared',
    legend: 'Daytime thermal infrared: bright = warm, dark = cold slopes and dust.',
    service: 'marstrek', grid: 'geographic', ext: 'png',
    minZoom: 0, maxZoom: 9, baseZoom: 5, temporal: null, latLimit: 64,
    credit: 'NASA Mars Trek · Mars Odyssey / THEMIS',
    proxy: 'Magnetic fields are invisible; this THEMIS infrared view shows the ancient crust whose magnetism you measure.',
  },
}

export function layerUrl(layer: ImageryLayer, z: number, x: number, y: number, date: string | null): string {
  if (layer.service === 'gibs') {
    const t = layer.temporal ? (date ?? 'default') : 'default'
    return `${GIBS}/${layer.id}/default/${t}/${layer.matrixSet}/${z}/${y}/${x}.${layer.ext}`
  }
  const body = layer.service === 'moontrek' ? 'Moon' : 'Mars'
  return `${TREK}/${body}/EQ/${layer.id}/1.0.0/default/default028mm/${z}/${y}/${x}.${layer.ext}`
}

/** Instrument id -> imagery layer, per mission (the design's payload decides what science you get). */
export const INSTRUMENT_LAYER: Record<MissionId, Record<string, string>> = {
  earth: {
    imager: 'MODIS_Terra_CorrectedReflectance_TrueColor',
    thermal: 'MODIS_Terra_L3_Land_Surface_Temp_Monthly_Day',
    atmos: 'MODIS_Terra_Aerosol',
    spectro: 'MODIS_Terra_L3_NDVI_16Day',
  },
  lunar: {
    cam: 'LRO_WAC_Mosaic_Global_303ppd_v02',
    altim: 'LRO_LOLA_ClrShade_Global_128ppd_v04',
    mapper: 'Clem_UVVIS_FeO_Clr_Global_152ppd',
    neutron: 'LP_NS_H_Clr_Global_2ppd',
  },
  mars: {
    cam: 'Mars_Viking_MDIM21_ClrMosaic_global_232m',
    tracegas: 'TES_Dust',
    radar: 'Mars_MGS_MOLA_ClrShade_merge_global_463m',
    fields: 'THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018',
  },
}

export function layerFor(missionId: MissionId, instrumentId: string): ImageryLayer | null {
  const id = INSTRUMENT_LAYER[missionId]?.[instrumentId]
  return id ? LAYERS[id] : null
}

/** Human "Source:" text, e.g. "NASA GIBS · Terra / MODIS". */
export function sourceCredit(layer: ImageryLayer): string {
  return layer.credit
}

export const SERVICE_URL: Record<ImageryLayer['service'], string> = {
  gibs: 'https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api',
  moontrek: 'https://trek.nasa.gov/moon/',
  marstrek: 'https://trek.nasa.gov/mars/',
}
