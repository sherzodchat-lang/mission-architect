// Public-domain imagery used for the 3D planets (public/textures/planets). Three-free: safe to import
// from any screen (e.g. a "NASA data sources" page). Keep in sync with public/textures/planets/CREDITS.md.
export interface PlanetTextureSource {
  body: 'Earth' | 'Moon' | 'Mars'
  title: string
  url: string
  credit: string
  /** files in public/textures/planets derived from it */
  files: string[]
}

export const PLANET_TEXTURE_SOURCES: PlanetTextureSource[] = [
  {
    body: 'Earth',
    title: 'Blue Marble: Next Generation — base map, July 2004',
    url: 'https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/',
    credit: 'NASA Earth Observatory (Reto Stöckli, NASA GSFC)',
    files: ['earth_day_4k.webp', 'earth_day_1k.webp'],
  },
  {
    body: 'Earth',
    title: 'The Blue Marble — cloud layer (cloud_combined_2048)',
    url: 'https://science.nasa.gov/earth/earth-observatory/the-blue-marble-true-color-global-imagery-at-1km-resolution/',
    credit: 'NASA Goddard Space Flight Center; clouds by Reto Stöckli, enhancements by Robert Simmon',
    files: ['earth_clouds_2k.jpg'],
  },
  {
    body: 'Earth',
    title: 'Earth at Night (Black Marble) 2016, color global map 3 km',
    url: 'https://science.nasa.gov/earth/earth-observatory/earth-at-night/maps',
    credit: 'NASA Earth Observatory (Joshua Stevens), Suomi NPP VIIRS data (Miguel Román, NASA GSFC)',
    files: ['earth_lights_4k.jpg'],
  },
  {
    body: 'Earth',
    title: 'Blue Marble: Next Generation — topography & bathymetry maps (GEBCO_08)',
    url: 'https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/topography-bathymetry-maps/',
    credit: 'NASA Earth Observatory; GEBCO_08 grid',
    files: ['earth_data_2k.jpg'],
  },
  {
    body: 'Moon',
    title: 'CGI Moon Kit — LROC colour mosaic & LOLA elevation (ldem_16)',
    url: 'https://svs.gsfc.nasa.gov/4720',
    credit: 'NASA Scientific Visualization Studio (Ernie Wright); LRO LROC and LOLA teams',
    files: ['moon_color_4k.webp', 'moon_color_1k.webp', 'moon_data_2k.jpg'],
  },
  {
    body: 'Mars',
    title: 'Mars Viking MDIM2.1 Colorized Global Mosaic',
    url: 'https://astrogeology.usgs.gov/search/map/mars_viking_colorized_global_mosaic_232m',
    credit: 'NASA / JPL / USGS Astrogeology (Viking Orbiter); 1 km/px rendition via Wikimedia Commons (public domain)',
    files: ['mars_color_4k.webp', 'mars_color_1k.webp'],
  },
  {
    body: 'Mars',
    title: 'MGS MOLA Mission Experiment Gridded Data Record (MEGDR, 16 px/deg)',
    url: 'https://pds-geosciences.wustl.edu/missions/mgs/megdr.html',
    credit: 'NASA / GSFC MOLA Science Team, NASA PDS Geosciences Node',
    files: ['mars_data_2k.jpg'],
  },
]
