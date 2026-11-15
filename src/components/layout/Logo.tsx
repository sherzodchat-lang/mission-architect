import { cx } from '../cx'

export interface LogoProps {
  /**
   * 'mark' = orbit mark only (rail top), 'wordmark' = "Mission Architect" text only (top bar),
   * 'full' = both. Legacy 'stacked' / 'inline' render as 'full'.
   */
  variant?: 'mark' | 'wordmark' | 'full' | 'stacked' | 'inline'
  /** mark size in px (default 44) */
  size?: number
  className?: string
}

/** Thin-line planet with a tilted orbit ring. Original artwork - not a NASA mark. */
export function LogoMark({ size = 44, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <mask id="ma-logo-cut" maskUnits="userSpaceOnUse" x="0" y="0" width="48" height="48">
          <rect width="48" height="48" fill="#fff" />
          <circle cx="24" cy="24" r="12.4" fill="#000" />
        </mask>
      </defs>
      {/* planet */}
      <circle cx="24" cy="24" r="10.5" />
      <g transform="rotate(-24 24 24)">
        {/* back half of the ring, hidden behind the planet */}
        <path d="M3 24a21 7.2 0 0 1 42 0" mask="url(#ma-logo-cut)" />
        {/* front half */}
        <path d="M3 24a21 7.2 0 0 0 42 0" />
      </g>
      <circle cx="39.5" cy="10.5" r="1.7" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function Logo({ variant = 'full', size = 44, className }: LogoProps) {
  const showMark = variant !== 'wordmark'
  const showWord = variant !== 'mark'
  return (
    <div className={cx('flex shrink-0 items-center gap-3 text-text', className)}>
      {showMark && <LogoMark size={size} />}
      {showWord && (
        <span className="text-[22px] leading-none font-medium tracking-[-0.01em] whitespace-nowrap">Mission Architect</span>
      )}
    </div>
  )
}
