/** A NASA (or partner agency) data source actually used by the game. Every NASA-data feature registers its sources
 *  in its own file `src/data/nasa/sources/<feature>.ts` exporting `SOURCES: NasaSource[]`; the in-app
 *  "NASA data" page aggregates them all via import.meta.glob. */
export interface NasaSource {
  id: string
  /** e.g. "NASA GIBS (Global Imagery Browse Services)" */
  title: string
  /** provider: 'NASA' | 'NASA JPL' | 'NASA GSFC' | 'USGS' | 'CSA' | ... */
  provider: string
  url: string
  /** what the game uses it for, one plain-English sentence shown to players */
  usedFor: string
  /** 'live' = fetched in the browser at runtime; 'snapshot' = fetched at build time by a script in tools/ and shipped as JSON */
  access: 'live' | 'snapshot' | 'asset'
  /** where in the game the player sees it */
  where: string[]
  /** script that refreshes a snapshot, if any */
  refreshScript?: string
  license?: string
}
