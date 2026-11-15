// NASA Image and Video Library (https://images.nasa.gov, API https://images-api.nasa.gov — keyless, CORS-enabled).
// Live in the browser: metadata from /search?nasa_id=…, a medium JPEG from /asset/<nasa_id>.
// Cached in memory and in localStorage (30 days); every failure resolves to null so callers show their offline fallback.
import { useEffect, useState } from 'react'

const API = 'https://images-api.nasa.gov'
const CACHE_KEY = 'ma_nasa_images_v1'
const TTL_MS = 30 * 24 * 3600 * 1000
const TIMEOUT_MS = 9000

export interface NasaImage {
  nasaId: string
  title: string
  /** As given by the API (secondary_creator / photographer / center), e.g. "NASA/JPL-Caltech". */
  credit: string
  date: string | null
  description: string
  /** Medium-size JPEG (https). */
  src: string
  /** Public page on images.nasa.gov. */
  pageUrl: string
}

type Entry = { at: number; img: NasaImage | null }
const memory = new Map<string, Entry>()
const inflight = new Map<string, Promise<NasaImage | null>>()

function readStore(): Record<string, Entry> {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, Entry>) : {}
  } catch {
    return {}
  }
}
function writeStore(key: string, e: Entry) {
  try {
    const all = readStore()
    all[key] = e
    localStorage.setItem(CACHE_KEY, JSON.stringify(all))
  } catch {
    /* private mode / quota: memory cache only */
  }
}
function cached(key: string): Entry | undefined {
  const m = memory.get(key)
  if (m) return m
  const s = readStore()[key]
  if (s && Date.now() - s.at < TTL_MS && s.img) {
    memory.set(key, s)
    return s
  }
  return undefined
}

async function getJson<T>(url: string): Promise<T> {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: ctl.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return (await res.json()) as T
  } finally {
    clearTimeout(t)
  }
}

interface SearchData {
  nasa_id: string
  title?: string
  description?: string
  date_created?: string
  center?: string
  secondary_creator?: string
  photographer?: string
  keywords?: string[]
  media_type?: string
}
interface SearchResult {
  collection: { items: { data: SearchData[] }[] }
}
interface AssetResult {
  collection: { items: { href: string }[] }
}

/** Insignia, logos and patches are never shown (the game uses no NASA logo). */
const BANNED = /\b(logo|insignia|emblem|patch|meatball|seal|worm)\b/i

function credit(d: SearchData): string {
  const c = (d.secondary_creator || d.photographer || '').trim()
  if (c) return c
  return d.center ? `NASA ${d.center}` : 'NASA'
}

function cleanTitle(d: SearchData): string {
  const t = (d.title ?? '').trim()
  return !t || t === d.nasa_id ? '' : t
}

async function assetUrl(nasaId: string): Promise<string | null> {
  const a = await getJson<AssetResult>(`${API}/asset/${encodeURIComponent(nasaId)}`)
  const hrefs = a.collection.items.map((i) => i.href)
  const pick =
    hrefs.find((h) => /~medium\.jpe?g$/i.test(h)) ??
    hrefs.find((h) => /~small\.jpe?g$/i.test(h)) ??
    hrefs.find((h) => /~orig\.jpe?g$/i.test(h)) ??
    hrefs.find((h) => /\.jpe?g$/i.test(h))
  return pick ? pick.replace(/^http:\/\//, 'https://').replace(/ /g, '%20') : null
}

function toImage(d: SearchData, src: string): NasaImage {
  return {
    nasaId: d.nasa_id,
    title: cleanTitle(d),
    credit: credit(d),
    date: d.date_created ? d.date_created.slice(0, 10) : null,
    description: (d.description ?? '').replace(/\s+/g, ' ').trim(),
    src,
    pageUrl: `https://images.nasa.gov/details/${encodeURIComponent(d.nasa_id)}`,
  }
}

async function byId(nasaId: string): Promise<NasaImage | null> {
  const [meta, src] = await Promise.all([
    getJson<SearchResult>(`${API}/search?${new URLSearchParams({ nasa_id: nasaId })}`),
    assetUrl(nasaId),
  ])
  const d = meta.collection.items[0]?.data[0]
  if (!d || !src) return null
  return toImage(d, src)
}

async function byQuery(q: string): Promise<NasaImage | null> {
  const res = await getJson<SearchResult>(`${API}/search?${new URLSearchParams({ q, media_type: 'image' })}`)
  const d = res.collection.items
    .map((i) => i.data[0])
    .find((x) => x && !BANNED.test(`${x.title ?? ''} ${(x.keywords ?? []).join(' ')}`))
  if (!d) return null
  const src = await assetUrl(d.nasa_id)
  return src ? toImage(d, src) : null
}

/**
 * A real NASA photo: the curated `nasaId` when given (guaranteed good), otherwise a live search for `query`.
 * Resolves to null offline or when nothing suitable exists.
 */
export function fetchNasaImage(opts: { nasaId?: string | null; query?: string | null }): Promise<NasaImage | null> {
  const key = opts.nasaId ? `id:${opts.nasaId}` : opts.query ? `q:${opts.query}` : ''
  if (!key) return Promise.resolve(null)
  const hit = cached(key)
  if (hit) return Promise.resolve(hit.img)
  const running = inflight.get(key)
  if (running) return running
  const p = (opts.nasaId ? byId(opts.nasaId) : byQuery(opts.query!))
    .catch(() => null)
    .then((img) => {
      const e = { at: Date.now(), img }
      memory.set(key, e)
      if (img) writeStore(key, e)
      inflight.delete(key)
      return img
    })
  inflight.set(key, p)
  return p
}

export type NasaImageState = { status: 'loading' | 'ready' | 'missing'; image: NasaImage | null }

/** React hook around fetchNasaImage. `missing` = offline / no picture: show the fallback. */
export function useNasaImage(nasaId: string | null | undefined, query?: string | null, enabled = true): NasaImageState {
  const key = nasaId ? `id:${nasaId}` : query ? `q:${query}` : ''
  const initial = key ? cached(key) : undefined
  const [state, setState] = useState<NasaImageState & { key: string }>(() => ({
    key,
    status: initial ? (initial.img ? 'ready' : 'missing') : key ? 'loading' : 'missing',
    image: initial?.img ?? null,
  }))
  useEffect(() => {
    if (!enabled || !key) return
    let alive = true
    fetchNasaImage({ nasaId, query }).then((img) => {
      if (alive) setState({ key, status: img ? 'ready' : 'missing', image: img })
    })
    return () => {
      alive = false
    }
  }, [key, nasaId, query, enabled])
  if (state.key !== key) {
    const c = key ? cached(key) : undefined
    return { status: c ? (c.img ? 'ready' : 'missing') : key && enabled ? 'loading' : 'missing', image: c?.img ?? null }
  }
  return { status: state.status, image: state.image }
}
