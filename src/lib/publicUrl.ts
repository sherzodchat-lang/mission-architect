/** Prefix a path under /public with Vite's BASE_URL (works for GitHub Pages sub-paths). */
export function publicUrl(path: string): string {
  const base = import.meta.env.BASE_URL || '/'
  const b = base.endsWith('/') ? base : base + '/'
  return b + path.replace(/^\/+/, '')
}
