import type { NasaSource } from './types'
export type { NasaSource } from './types'

const modules = import.meta.glob<{ SOURCES: NasaSource[] }>('./sources/*.ts', { eager: true })

/** All NASA data sources registered by features (see types.ts). */
export const NASA_SOURCES: NasaSource[] = Object.values(modules).flatMap((m) => m.SOURCES ?? [])
