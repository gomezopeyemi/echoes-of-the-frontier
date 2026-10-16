import { Color, MeshBasicMaterial, MeshStandardMaterial } from 'three'

// Shared materials. Emissive "glow" materials use HDR colours (>1) with tone
// mapping disabled so the bloom pass picks them up.

export const glow = (r, g, b, opts = {}) => new MeshBasicMaterial({ color: new Color(r, g, b), toneMapped: false, ...opts })

export const MAT = {
  ground: new MeshStandardMaterial({ color: '#2a2622', roughness: 0.95, metalness: 0.05 }),
  concrete: new MeshStandardMaterial({ color: '#4a4844', roughness: 0.9, metalness: 0.05 }),
  hull: new MeshStandardMaterial({ color: '#5d6168', roughness: 0.45, metalness: 0.7 }),
  hullDark: new MeshStandardMaterial({ color: '#2b2e33', roughness: 0.5, metalness: 0.75 }),
  trim: new MeshStandardMaterial({ color: '#8a7a5c', roughness: 0.6, metalness: 0.5 }),
  crate: new MeshStandardMaterial({ color: '#5a5a3c', roughness: 0.8, metalness: 0.2 }),
  rock: new MeshStandardMaterial({ color: '#3b342e', roughness: 1, metalness: 0, flatShading: true }),
  hazardStripe: new MeshStandardMaterial({ color: '#b58a1a', roughness: 0.7, metalness: 0.2 }),

  suit: new MeshStandardMaterial({ color: '#3a4048', roughness: 0.6, metalness: 0.4 }),
  armor: new MeshStandardMaterial({ color: '#c9cdd2', roughness: 0.35, metalness: 0.6 }),
  gun: new MeshStandardMaterial({ color: '#1d2024', roughness: 0.4, metalness: 0.9 }),

  droidShell: new MeshStandardMaterial({ color: '#d8d4cc', roughness: 0.3, metalness: 0.65 }),
  droidCore: new MeshStandardMaterial({ color: '#1a1b1e', roughness: 0.4, metalness: 0.9 }),

  amber: glow(4, 2.2, 0.6),
  cyan: glow(0.6, 2.8, 4),
  red: glow(5, 0.4, 0.3),
  green: glow(0.6, 4, 1.6),
  windowCyan: glow(0.35, 1.2, 1.6),
}
