import type { ReactNode, SVGProps } from 'react'

/** Thin line icons (24x24 grid, currentColor, 1.5px stroke by default) matching the mockups' rail. Add new ones to ICONS. */
const ICONS = {
  warning: (
    <>
      <path d="M12 3.5 2.8 19.5h18.4L12 3.5Z" />
      <path d="M12 10v4.6" />
      <path d="M12 17.3v.1" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 4.5 6v5.6c0 4.4 3.1 7.9 7.5 9.4 4.4-1.5 7.5-5 7.5-9.4V6L12 3Z" />
      <path d="m8.8 12.2 2.3 2.3 4.1-4.5" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  cross: <path d="m6 6 12 12M18 6 6 18" />,
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2.2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
  star: <path d="m12 3.2 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8L12 3.2Z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  soundOn: (
    <>
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4v-5Z" />
      <path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" />
    </>
  ),
  soundOff: (
    <>
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4v-5Z" />
      <path d="m16 9.5 5 5m0-5-5 5" />
    </>
  ),
  undo: (
    <>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
    </>
  ),
  redo: (
    <>
      <path d="m15 14 5-5-5-5" />
      <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
    </>
  ),
  reset: (
    <>
      <path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5" />
      <path d="M4.5 4.5v4h4" />
    </>
  ),
  rocket: (
    <>
      <path d="M12 2.8c3.4 2.2 5 5.6 4.6 10.2l-2 2.4H9.4l-2-2.4C7 8.4 8.6 5 12 2.800Z" />
      <circle cx="12" cy="9.5" r="1.7" />
      <path d="m7.4 12.5-3 3.8 3.2-.4M16.6 12.500l3 3.8-3.2-.4M10 18.5 12 22l2-3.5" />
    </>
  ),
  satellite: (
    <>
      <path d="m10.2 10.2 3.6 3.6M9 12.4l2.6 2.6M12.4 9l2.6 2.6" />
      <rect x="10.4" y="10.4" width="3.2" height="3.2" rx=".6" transform="rotate(45 12 12)" />
      <path d="m3.4 7.6 4.2-4.2 3 3-4.2 4.2-3-3ZM13.4 17.6l4.2-4.2 3 3-4.2 4.2-3-3Z" />
      <path d="M16.2 7.8a2.4 2.4 0 0 0-2-2M18.4 7.4a4.8 4.8 0 0 0-3.8-3.8" />
    </>
  ),
  antenna: (
    <>
      <path d="M12 12.500v8M8.5 20.500h7" />
      <circle cx="12" cy="10" r="1.8" />
      <path d="M7.8 5.800a6 6 0 0 0 0 8.400M16.2 5.800a6 6 0 0 1 0 8.400M5 3.200a10 10 0 0 0 0 13.600M19 3.200a10 10 0 0 1 0 13.6" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.500M12 7.800v.1" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.500a2.6 2.6 0 1 1 3.6 2.400c-.7.4-1.1.9-1.1 1.800M12 16.800v.1" />
    </>
  ),
  bolt: <path d="M13 2.8 5.5 13.500H11L10 21.200l8.5-11.200H13l0-7.200Z" />,
  mass: (
    <>
      <path d="M7.5 9.500h9l2.5 10.500H5l2.5-10.500Z" />
      <circle cx="12" cy="6.3" r="2.3" />
    </>
  ),
  database: (
    <>
      <ellipse cx="12" cy="6" rx="7" ry="2.8" />
      <path d="M5 6v6c0 1.5 3.1 2.8 7 2.800s7-1.3 7-2.800V6M5 12v6c0 1.5 3.1 2.8 7 2.800s7-1.3 7-2.800v-6" />
    </>
  ),
  coins: (
    <>
      <ellipse cx="9.5" cy="7" rx="6" ry="2.6" />
      <path d="M3.5 7v5c0 1.4 2.7 2.6 6 2.600s6-1.2 6-2.600V7M3.5 12v4c0 1.4 2.7 2.6 6 2.6 1.2 0 2.3-.2 3.2-.5" />
      <path d="M15.5 10.500c2.7.2 5 1.2 5 2.500v5c0 1.4-2.7 2.6-6 2.6" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  arrowLeft: <path d="M20 12H4.500M10.5 5.5 4 12l6.5 6.5" />,
  arrowRight: <path d="M4 12h15.500M13.5 5.5 20 12l-6.5 6.5" />,
  chevronDown: <path d="m6 9.5 6 6 6-6" />,
  play: <path d="M7 4.500v15l12.5-7.500L7 4.500Z" />,
  pause: <path d="M8 5v14M16 5v14" />,
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 5 5" />
    </>
  ),
  heart: (
    <path d="M12 20.500s-8-4.8-8-10.700A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8 2.800C20 15.7 12 20.5 12 20.500Z" />
  ),
  flask: (
    <>
      <path d="M9.5 3.500h5M10.5 3.500v6L5 19a1.5 1.5 0 0 0 1.3 2.200h11.400A1.5 1.5 0 0 0 19 19l-5.5-9.500v-6" />
      <path d="M7.5 15h9" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.500a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8.5" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 5.200a3.5 3.5 0 0 1 0 6.600M18 14.200c2 .8 3.5 2.7 3.5 5.3" />
    </>
  ),
  book: (
    <>
      <path d="M12 6.500C10 5 7 4.5 3.5 5v13.500c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.500V5C17 4.5 14 5 12 6.500Z" />
      <path d="M12 6.500V20" />
    </>
  ),
  home: <path d="M3.5 11 12 3.5 20.5 11M5.5 9.500V20.500h13V9.500M10 20.500v-6h4v6" />,
  download: <path d="M12 3.500v12M6.5 10.5 12 16l5.5-5.500M4.5 20.500h15" />,
  save: (
    <>
      <path d="M4.5 4.500h12L19.5 7.500v12H4.500v-15Z" />
      <path d="M8 4.500v5h7v-5M8 19.500v-6h8v6" />
    </>
  ),
  external: <path d="M14 4.500h5.500V10M19.5 4.5 11 13M17.5 14v5.500h-13v-13H10" />,
  thermometer: (
    <>
      <path d="M10 14.500V5a2 2 0 0 1 4 0v9.500a4 4 0 1 1-4 0Z" />
      <path d="M12 9v7" />
    </>
  ),
  link: (
    <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.400l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.400l1-1" />
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.500v2.500M12 19v2.500M2.5 12H5M19 12h2.500M5.3 5.300l1.8 1.800M16.9 16.900l1.8 1.800M5.3 18.700l1.8-1.800M16.9 7.100l1.8-1.8" />
    </>
  ),
  pulse: <path d="M3 12h4l2.5-6 4 12L16 12h5" />,
  flag: <path d="M5.5 21V4M5.5 4.500h12l-2.5 4 2.5 4h-12" />,
  camera: (
    <>
      <path d="M3.5 8h3.500l1.5-2.500h7L17 8h3.500v11.500h-17V8Z" />
      <circle cx="12" cy="13.5" r="3.5" />
    </>
  ),
  orbit: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(-25 12 12)" />
    </>
  ),
  cube: (
    <>
      <path d="M12 2.8 20 7.2v9.6l-8 4.4-8-4.4V7.2l8-4.4Z" />
      <path d="M4 7.2 12 11.6l8-4.4M12 11.6v9.6" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.8" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.4" />
    </>
  ),
  document: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2.4" />
      <path d="M8.5 8h7M8.5 12h7M8.5 16h4.5" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" />
    </>
  ),
  arrowUpRight: <path d="M7 17 17 7M8.5 7H17v8.5" />,
  chevronRight: <path d="m9.5 6 6 6-6 6" />,
  chevronLeft: <path d="m14.5 6-6 6 6 6" />,
  chevronUp: <path d="m6 14.5 6-6 6 6" />,
  layers: (
    <>
      <path d="m12 3.5 8.5 4.3L12 12 3.5 7.8 12 3.5Z" />
      <path d="m3.5 12 8.5 4.3 8.5-4.3M3.5 16.2 12 20.5l8.5-4.3" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.8" />
      <path d="M3.2 12h17.6M12 3.2c2.4 2.4 3.6 5.3 3.6 8.8s-1.2 6.4-3.6 8.8c-2.4-2.4-3.6-5.3-3.6-8.8S9.6 5.6 12 3.2Z" />
    </>
  ),
  copy: (
    <>
      <rect x="8.5" y="8.5" width="12" height="12" rx="2.2" />
      <path d="M15.5 5.5V5a1.5 1.5 0 0 0-1.5-1.5H5A1.5 1.5 0 0 0 3.5 5v9A1.5 1.5 0 0 0 5 15.5h.5" />
    </>
  ),
  zoomIn: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 5 5M10.5 7.8v5.4M7.8 10.5h5.4" />
    </>
  ),
  zoomOut: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 5 5M7.8 10.5h5.4" />
    </>
  ),
  rotate: (
    <>
      <path d="M19.5 12a7.5 7.5 0 0 1-13 5.1M4.5 12a7.5 7.5 0 0 1 13-5.1" />
      <path d="M17.8 3.6v3.6h-3.6M6.2 20.4v-3.6h3.6" />
    </>
  ),
  expand: <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.8" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  radiation: (
    <>
      <circle cx="12" cy="12" r="8.8" />
      <circle cx="12" cy="12" r="1.6" />
      <path d="M12 10.4 9.3 5.7A7 7 0 0 1 14.7 5.7L12 10.4ZM13.4 12.8l5.4.1a7 7 0 0 1-2.7 4.7l-2.7-4.8ZM10.6 12.8l-2.7 4.8a7 7 0 0 1-2.7-4.7l5.4-.1Z" />
    </>
  ),
} satisfies Record<string, ReactNode>

export type IconName = keyof typeof ICONS
export const ICON_NAMES = Object.keys(ICONS) as IconName[]

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName
  /** px size (default 20) */
  size?: number
  /** fill the shape instead of stroking it (star, play, bolt, ...) */
  filled?: boolean
  /** stroke width, default 1.5 (thin line language of the mockups) */
  strokeWidth?: number
}

export function Icon({ name, size = 20, filled = false, strokeWidth = 1.5, className, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...rest}
    >
      {ICONS[name]}
    </svg>
  )
}
