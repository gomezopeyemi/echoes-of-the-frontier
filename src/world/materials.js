import { Color, MeshBasicMaterial, MeshStandardMaterial } from 'three'
import { withSurface } from '../characters/surfaceDetail'
import { pbrMaterial } from './pbr'

// Shared environment materials.
//
// Painted and coated surfaces here are dielectric (metalness 0). The level's
// reflection environment is deliberately dim (Scene.jsx), so only the PBR
// sets below use metalness. Surface variation comes from the shared
// object-space detail texture (see characters/surfaceDetail.js): fine bump,
// roughness breakup and colour drift, sized in tiles per metre.
//
// Containers (glTF models) and boulders (rocks.js) carry their own materials.
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

// Licensed tiling PBR sets from the Godot TPS demo (CC-BY 3.0, see
// public/assets/env/ASSETS.md). Created on first use so texture loading only
// starts when the level mounts. Tile sizes are the real-world metres one
// texture repeat covers; geometry UVs are scaled to match (boxUV/cylinderUV).
const once = (make) => {
  let m = null
  return () => (m ??= make())
}
const TPS = (name) => ({ albedo: `tps-demo/${name}_albedo.jpg`, normal: `tps-demo/${name}_normal.jpg`, orm: `tps-demo/${name}_orm.jpg` })

export const PANEL = {
  rivetTile: 2.5,
  gunMetalTile: 2,
  // Riveted cladding for habitat walls. The scan is neutral grey; the tint
  // lifts it to the previous hull value with a slight cool cast.
  rivet: once(() => pbrMaterial({ ...TPS('tile_rivet_panels'), color: new Color(1.25, 1.3, 1.38), metalness: 0.5 })),
  // Painted gun-metal for roofs (Godot material uses metallic 0.5 x map).
  gunMetal: once(() => pbrMaterial({ ...TPS('tile_painted_gun_metal'), color: new Color(0.9, 0.92, 0.95), metalness: 0.5 })),
  // Fuel tanks: the same panel set as a painted (mostly dielectric) finish, so
  // the large curved shells keep the old hull value instead of going black.
  tank: once(() => pbrMaterial({ ...TPS('tile_painted_gun_metal'), color: new Color(2.0, 2.05, 2.15), metalness: 0.15 })),
  // Anti-slip deck plate for the landing pad.
  deck: once(() => pbrMaterial({ ...TPS('tile_anti_slip'), color: new Color(0.55, 0.57, 0.6), metalness: 0.5, repeat: 6 })),
}
