# Planet textures — sources and credits

All imagery is from NASA / USGS and is in the public domain (US Government work). NASA asks for
credit; no endorsement is implied. No NASA logo is used. Machine-readable list:
`src/scene/sources.ts` (`PLANET_TEXTURE_SOURCES`).

| File | Source | Credit |
|---|---|---|
| `earth_day_4k.webp`, `earth_day_1k.webp` | Blue Marble: Next Generation, base map, July 2004 — https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-base/july/world.200407.3x5400x2700.jpg (page: https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/) | NASA Earth Observatory (Reto Stöckli, NASA GSFC) |
| `earth_clouds_2k.jpg` | The Blue Marble cloud layer — https://assets.science.nasa.gov/content/dam/science/esd/eo/content-feature/bluemarble/images/cloud_combined_2048.jpg (page: https://science.nasa.gov/earth/earth-observatory/the-blue-marble-true-color-global-imagery-at-1km-resolution/) | NASA GSFC; Reto Stöckli, Robert Simmon |
| `earth_lights_4k.jpg` | Earth at Night / Black Marble 2016, colour, 3 km — https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/144000/144898/BlackMarble_2016_3km.jpg (page: https://science.nasa.gov/earth/earth-observatory/earth-at-night/maps) | NASA Earth Observatory (Joshua Stevens), Suomi NPP VIIRS (Miguel Román, NASA GSFC) |
| `earth_data_2k.jpg` | GEBCO_08 elevation + bathymetry from Blue Marble NG — https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/topography/gebco_08_rev_elev_5400x2700.jpg and https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bathymetry/gebco_08_rev_bath_5400x2700.jpg (page: https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/topography-bathymetry-maps/) | NASA Earth Observatory; GEBCO |
| `moon_color_4k.webp`, `moon_color_1k.webp` | CGI Moon Kit, LROC colour mosaic — https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_4k.tif (page: https://svs.gsfc.nasa.gov/4720) | NASA SVS (Ernie Wright); LRO LROC team |
| `moon_data_2k.jpg` | CGI Moon Kit, LOLA elevation — https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/ldem_16_uint.tif | NASA SVS; LRO LOLA team |
| `mars_color_4k.webp`, `mars_color_1k.webp` | Mars Viking MDIM2.1 colorized global mosaic (USGS: https://astrogeology.usgs.gov/search/map/mars_viking_colorized_global_mosaic_232m), 1 km/px public-domain rendition https://commons.wikimedia.org/wiki/File:Mars_Viking_MDIM21_ClrMosaic_1km.jpg (3840 px thumbnail) | NASA / JPL / USGS Astrogeology |
| `mars_data_2k.jpg` | MGS MOLA MEGDR 16 px/deg topography — https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg016/megt90n000eb.img | NASA / GSFC MOLA Science Team, PDS Geosciences Node |

## Processing

Resampled to power-of-two equirectangular maps (longitude −180…180, north up). Colour maps: WebP
(sRGB). `*_data_2k.jpg` (linear, 4:4:4 JPEG): R/G = east/north surface slope derived from the
elevation grid (0.5 = flat), B = ocean mask (Earth) or normalised height (Moon, Mars).
`earth_lights_4k.jpg`: artificial light only (moonlit ground removed), greyscale.
