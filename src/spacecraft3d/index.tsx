// Light entry point for screens: no three.js in here. The heavy 3D modules are lazy chunks.
import { Suspense, lazy, type ReactNode } from 'react'
import type { HeroSpacecraftProps } from './HeroSpacecraft'
import type { SpacecraftViewProps } from './SpacecraftView'

export { ComponentThumb, prewarmThumbnails, type ComponentThumbProps } from './Thumbnail'
export { CATEGORY_LABEL, SLOT_CATEGORY, designKey, hasWebGL, showcaseDesign, slotOf } from './meta'
export type { SpacecraftViewApi, SpacecraftViewProps } from './SpacecraftView'
export type { HeroSpacecraftProps } from './HeroSpacecraft'

const View = lazy(() => import('./SpacecraftView'))
const Hero = lazy(() => import('./HeroSpacecraft'))

const Loading = () => (
  <div className="flex h-full w-full items-center justify-center" aria-busy="true">
    <span
      className="h-10 w-10 animate-spin rounded-full"
      style={{ border: '2px solid rgba(140,230,210,0.15)', borderTopColor: 'rgba(140,230,210,0.7)' }}
    />
  </div>
)

/** <SpacecraftView> with Suspense (lazy three.js chunk). `loading` replaces the default spinner. */
export function SpacecraftViewLazy(props: SpacecraftViewProps & { loading?: ReactNode }) {
  const { loading, ...rest } = props
  return (
    <Suspense fallback={loading ?? <Loading />}>
      <View {...rest} />
    </Suspense>
  )
}

/** <HeroSpacecraft> with Suspense (lazy three.js chunk). */
export function HeroSpacecraftLazy(props: HeroSpacecraftProps & { loading?: ReactNode }) {
  const { loading = null, ...rest } = props
  return (
    <Suspense fallback={loading}>
      <Hero {...rest} />
    </Suspense>
  )
}
