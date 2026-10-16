// Small custom stroke icons for the HUD (24×24, currentColor). Kept in one
// file so the set stays visually consistent: 1.5px strokes, square caps,
// mostly straight segments to match the angular panel language.

const Svg = ({ children, size = 24, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true" {...rest}>
    {children}
  </svg>
)

/** Energy blade / Energy Strike */
export const IconBlade = (p) => (
  <Svg {...p}>
    <path d="M19.5 3.5 9 14l1 1 10.5-10.5z" />
    <path d="M6.5 13.5l4 4" />
    <path d="M8.5 15.5 4 20" />
    <path d="M14 6.5l1.5-1.5" opacity="0.5" />
  </Svg>
)

/** Combat dash */
export const IconDash = (p) => (
  <Svg {...p}>
    <path d="M10 6l6 6-6 6" />
    <path d="M15 6l6 6-6 6" opacity="0.55" />
    <path d="M3 9h4M2 12h6M3 15h4" opacity="0.7" />
  </Svg>
)

/** Energy guard */
export const IconGuard = (p) => (
  <Svg {...p}>
    <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" />
    <path d="M12 7v10" opacity="0.6" />
  </Svg>
)

/** Kinetic pulse (not yet implemented) */
export const IconPulse = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="2.5" />
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
    <path d="M6.3 6.3l2 2M15.7 15.7l2 2M6.3 17.7l2-2M15.7 8.3l2-2" opacity="0.6" />
  </Svg>
)

/** Energy pistol / Plasma Shot */
export const IconPistol = (p) => (
  <Svg {...p}>
    <path d="M3 8h15l2 2v2H11l-1 2H7l-1 5H3l1-6-1-1z" />
    <path d="M13 10h4" opacity="0.6" />
  </Svg>
)

/** Operative helmet (player status) */
export const IconHelmet = (p) => (
  <Svg {...p}>
    <path d="M6 10a6 6 0 0 1 12 0v5l-2 3H8l-2-3z" />
    <path d="M7.5 11.5h9l-1 2.5h-7z" />
  </Svg>
)

/** Hostile machine (threat / target) */
export const IconTarget = (p) => (
  <Svg {...p}>
    <path d="M7 6h10l2 4v5l-3 3H8l-3-3v-5z" />
    <circle cx="12" cy="12" r="2.2" />
  </Svg>
)

/** Extraction beacon */
export const IconExtract = (p) => (
  <Svg {...p}>
    <path d="M12 3v12M8 7l4-4 4 4" />
    <path d="M5 17h14l-2 4H7z" />
  </Svg>
)

/** Lock (offline ability) */
export const IconLock = (p) => (
  <Svg {...p}>
    <rect x="6" y="11" width="12" height="9" />
    <path d="M9 11V8a3 3 0 0 1 6 0v3" />
  </Svg>
)
