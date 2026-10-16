import { Color, MeshBasicMaterial, MeshStandardMaterial } from 'three'
import { withSurface } from '../characters/surfaceDetail'

// Shared environment materials.
//
// Painted and coated surfaces are dielectric (metalness 0): the level has no
// reflection environment for non-character materials, so metallic values made
// painted steel render as flat black. Surface variation comes from the shared
// object-space detail texture (see characters/surfaceDetail.js): fine bump,
// roughness breakup and colour drift, sized in tiles per metre.
//
// Ground, containers and rocks are intentionally untouched here: they are
// reserved for the approved Poly Haven assets (Aerial Ground Rock, Container
// Side, Rock 09).
//
// Emissive "glow" materials use HDR colours (>1) with tone mapping disabled so
// the bloom pass picks them up.

export const glow = (r, g, b, opts = {}) => new MeshBasicMaterial({ color: new Color(r, g, b), toneMapped: false, ...opts })

const HARD = (scale, bump, rough, color) => ({ kind: 'hard', scale, bump, rough, color })

export const MAT = {
  // Poured concrete: matte, broad colour drift, fine aggregate bump.
  concrete: withSurface(new MeshStandardMaterial({ color: '#4d4b47', roughness: 0.92, metalness: 0 }), HARD(2.5, 0.35, 0.18, 0.16)),
  // Painted steel cladding (habitat walls, tanks, beacon pylons): satin, weathered.
  hull: withSurface(new MeshStandardMaterial({ color: '#5a5e64', roughness: 0.58, metalness: 0 }), HARD(3, 0.12, 0.25, 0.12)),
  // Dark painted steel (roofs, frames, poles, pad, perimeter): slightly rougher.
  hullDark: withSurface(new MeshStandardMaterial({ color: '#2f3237', roughness: 0.64, metalness: 0 }), HARD(3, 0.12, 0.25, 0.1)),
  // Tan service panels.
  trim: withSurface(new MeshStandardMaterial({ color: '#7d6f55', roughness: 0.62, metalness: 0 }), HARD(4, 0.12, 0.2, 0.12)),
  // Olive composite supply crates.
  crate: withSurface(new MeshStandardMaterial({ color: '#56573c', roughness: 0.78, metalness: 0 }), HARD(5, 0.15, 0.2, 0.1)),
  // Placeholder rock visuals; replaced by Rock 09 once the asset is available.
  rock: new MeshStandardMaterial({ color: '#3b342e', roughness: 1, metalness: 0, flatShading: true }),
  // Painted hazard striping on walls, tanks and the conduit decal.
  hazardStripe: withSurface(new MeshStandardMaterial({ color: '#a8801c', roughness: 0.7, metalness: 0 }), HARD(5, 0.1, 0.2, 0.14)),

  amber: glow(4, 2.2, 0.6),
  cyan: glow(0.6, 2.8, 4),
  red: glow(5, 0.4, 0.3),
  green: glow(0.6, 4, 1.6),
  windowCyan: glow(0.35, 1.2, 1.6),
  // Restrained ice-blue status strip (wall tops, sealed doors).
  ice: glow(0.45, 1.25, 1.75),
}
