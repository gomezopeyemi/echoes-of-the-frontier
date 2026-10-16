import { CanvasTexture, Color, DoubleSide, MeshPhysicalMaterial, MeshStandardMaterial, SRGBColorSpace } from 'three'
import { detailTextures, withSurface } from './surfaceDetail'

// PBR material system for the two characters.
//
// Each material belongs to one physical class, and the classes are kept
// clearly apart in roughness, metalness and specular response:
//
//   textile       metalness 0, rough 0.8-0.95, sheen for fibre back-scatter, weave bump
//   coated armour metalness 0 (paint/ceramic is a dielectric), rough 0.38-0.58,
//                 optional thin clearcoat, edge chips revealing the substrate
//   bare metal    metalness 1, bright-ish base colour (real metals reflect
//                 50-95%), roughness varies with finish, polished worn edges
//   rubber        metalness 0, very dark, rough 0.8-0.9
//   glass         metalness 0, near-black, mirror clearcoat
//   emissive      only optics, sensors, energy weapons and status lights,
//                 with a deliberate brightness hierarchy
//
// Base colours are sRGB hex values (three converts to linear). The detail
// texture is linear data, see surfaceDetail.js. Numbers were tuned in the
// ?showcase viewer under both the studio and night presets.

function seeded(seed) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}

/** Weathered mantle cloth: sun-faded top, dust-darkened torn hem, coarse weave. */
function mantleTextures() {
  const W = 256
  const H = 512
  const rnd = seeded(77)
  const color = document.createElement('canvas')
  color.width = W
  color.height = H
  const g = color.getContext('2d')
  const grad = g.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, '#5f4b37')
  grad.addColorStop(0.55, '#4b3b2b')
  grad.addColorStop(1, '#2a2119')
  g.fillStyle = grad
  g.fillRect(0, 0, W, H)
  for (let i = 0; i < 2500; i++) {
    const v = rnd() > 0.5 ? 255 : 0
    g.fillStyle = `rgba(${v},${v},${v},${rnd() * 0.05})`
    g.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 2, 1 + rnd() * 6)
  }
  for (let i = 0; i < 25; i++) {
    const x = rnd() * W
    const y = H * 0.4 + rnd() * H * 0.6
    const r = 15 + rnd() * 40
    const rg = g.createRadialGradient(x, y, 0, x, y, r)
    rg.addColorStop(0, 'rgba(30,22,15,0.18)')
    rg.addColorStop(1, 'rgba(30,22,15,0)')
    g.fillStyle = rg
    g.fillRect(x - r, y - r, r * 2, r * 2)
  }

  // Alpha: torn, uneven hem plus a few wear holes.
  const alpha = document.createElement('canvas')
  alpha.width = W
  alpha.height = H
  const a = alpha.getContext('2d')
  a.fillStyle = '#000'
  a.fillRect(0, 0, W, H)
  a.fillStyle = '#fff'
  a.beginPath()
  a.moveTo(0, 0)
  a.lineTo(W, 0)
  let y = H * 0.86
  for (let x = W; x >= 0; x -= 6 + rnd() * 10) {
    // hem drops lower toward the left edge (asymmetric, as on the board)
    const base = H * (0.8 + 0.15 * (1 - x / W))
    y = base + (rnd() - 0.5) * 40 + (rnd() > 0.85 ? 30 : 0)
    a.lineTo(x, Math.min(H - 2, y))
  }
  a.lineTo(0, 0)
  a.fill()
  a.fillStyle = '#000'
  for (let i = 0; i < 6; i++) {
    a.beginPath()
    a.ellipse(rnd() * W, H * (0.55 + rnd() * 0.3), 2 + rnd() * 5, 3 + rnd() * 8, rnd(), 0, Math.PI * 2)
    a.fill()
  }
  const map = new CanvasTexture(color)
  map.colorSpace = SRGBColorSpace
  map.anisotropy = 4
  return { map, alphaMap: new CanvasTexture(alpha) }
}

// ---------- materials ----------

const lazy = (factory) => {
  let v
  return () => (v ??= factory())
}

const mantleTex = lazy(mantleTextures)

const phys = (p) => new MeshPhysicalMaterial(p)
const stdm = (p) => new MeshStandardMaterial(p)

function emissive(hex, intensity) {
  return new MeshStandardMaterial({ color: '#060606', emissive: new Color(hex), emissiveIntensity: intensity, roughness: 0.35, metalness: 0 })
}

// Detail presets (scale in tiles per metre).
const FABRIC = (scale, bump, extra = {}) => ({ kind: 'fabric', scale, bump, rough: 0.18, color: 0.1, ...extra })
const HARD = (scale, bump, rough, color, wear) => ({ kind: 'hard', scale, bump, rough, color, wear })

function build() {
  const mantleMaps = mantleTex()
  const mantleBump = detailTextures().fabric.clone()
  mantleBump.repeat.set(9, 18)
  mantleBump.needsUpdate = true

  const m = {
    // ===== Frontier Operative =====
    // Tactical undersuit: matte synthetic weave with a faint cool sheen.
    undersuit: withSurface(phys({ color: '#2e2f31', roughness: 0.88, metalness: 0, sheen: 0.5, sheenRoughness: 0.65, sheenColor: '#58595b' }), FABRIC(14, 0.55)),
    // Webbing straps: coarser, slightly warmer nylon.
    webbing: withSurface(phys({ color: '#34322c', roughness: 0.84, metalness: 0, sheen: 0.4, sheenRoughness: 0.7, sheenColor: '#6b675a' }), FABRIC(30, 0.6)),
    // Pouches / glove palms: worn synthetic leather.
    leather: withSurface(stdm({ color: '#2f2924', roughness: 0.62, metalness: 0 }), HARD(9, 0.2, 0.3, 0.12)),
    // Light composite plates: matte-satin ceramic coating, chips reveal the darker substrate.
    armorLight: withSurface(
      phys({ color: '#a4a6a5', roughness: 0.46, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.45 }),
      HARD(5, 0.1, 0.22, 0.07, { amount: 1, color: '#55585b', roughness: 0.72, metalness: 0, threshold: 0.6 })
    ),
    // Charcoal hard armour: coated composite, controlled highlights, light scuffing on edges.
    armorGraphite: withSurface(
      phys({ color: '#363739', roughness: 0.44, metalness: 0, clearcoat: 0.2, clearcoatRoughness: 0.5 }),
      HARD(5, 0.1, 0.25, 0.07, { amount: 0.55, color: '#4b4e51', roughness: 0.58, metalness: 0, threshold: 0.66 })
    ),
    // Helmet shell: same coating family, a little glossier so the head reads first.
    helmet: withSurface(
      phys({ color: '#2e2f31', roughness: 0.34, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.22 }),
      HARD(6, 0.06, 0.25, 0.05, { amount: 0.5, color: '#62666c', roughness: 0.5, metalness: 0, threshold: 0.63 })
    ),
    // Exposed hardware (buckles, ear modules, toe caps, hilt, barrel): blasted steel with polished worn edges.
    gunmetal: withSurface(
      stdm({ color: '#8a8d92', roughness: 0.38, metalness: 1 }),
      HARD(8, 0.05, 0.35, 0.05, { amount: 0.6, color: '#b7babe', roughness: 0.2, metalness: 1, threshold: 0.56 })
    ),
    // Rubber seals and soles.
    rubber: withSurface(stdm({ color: '#19191a', roughness: 0.86, metalness: 0 }), HARD(14, 0.12, 0.12, 0.04)),
    // Visor: near-black tinted glass with a mirror clearcoat (reflections carry the shape).
    visorGlass: phys({ color: '#050608', roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, ior: 1.52, specularIntensity: 1 }),
    // Burnt-orange paint accents: same coating as the armour, chipping to substrate.
    accentOrange: withSurface(
      phys({ color: '#a8561d', roughness: 0.5, metalness: 0, clearcoat: 0.2, clearcoatRoughness: 0.5 }),
      HARD(6, 0.08, 0.2, 0.06, { amount: 1, color: '#3e4043', roughness: 0.7, metalness: 0, threshold: 0.6 })
    ),
    // Scarf: heavy, faded cotton.
    scarf: withSurface(phys({ color: '#56442f', roughness: 0.95, metalness: 0, sheen: 0.8, sheenRoughness: 0.8, sheenColor: '#8a7459' }), FABRIC(9, 0.9, { color: 0.16 })),
    // Mantle: UV-mapped (it deforms, so object-space detail would swim) with a woven bump.
    mantle: phys({
      map: mantleMaps.map,
      alphaMap: mantleMaps.alphaMap,
      alphaTest: 0.5,
      side: DoubleSide,
      roughness: 0.95,
      metalness: 0,
      sheen: 0.75,
      sheenRoughness: 0.8,
      sheenColor: '#7b6850',
      bumpMap: mantleBump,
      bumpScale: 1.2,
    }),
    // Blue emissive hierarchy: visor optics > pistol energy cell > pack status > hilt indicator.
    blueLight: emissive('#3d8cff', 2.4),
    energyCell: emissive('#3d8cff', 1.4),
    packStatus: emissive('#3d8cff', 0.8),
    blueLightDim: emissive('#3d8cff', 0.55),

    // ===== Security Droid =====
    // Dark powder-coated armour shells: satin, faint orange peel, chips expose steel.
    droidComposite: withSurface(
      phys({ color: '#29292b', roughness: 0.64, metalness: 0 }),
      HARD(5, 0.2, 0.15, 0.07, { amount: 0.8, color: '#7f8287', roughness: 0.34, metalness: 1, threshold: 0.66 })
    ),
    // Hull (torso, head dome, cannon housing): dark painted steel with a thin protective coat.
    droidHull: withSurface(
      phys({ color: '#3a3a3c', roughness: 0.46, metalness: 0, clearcoat: 0.18, clearcoatRoughness: 0.4 }),
      HARD(4, 0.12, 0.2, 0.06, { amount: 0.85, color: '#8c8f94', roughness: 0.3, metalness: 1, threshold: 0.62 })
    ),
    // Lighter grey painted plates.
    droidPlate: withSurface(
      phys({ color: '#5f6062', roughness: 0.56, metalness: 0 }),
      HARD(5, 0.18, 0.15, 0.06, { amount: 0.85, color: '#9a9da2', roughness: 0.3, metalness: 1, threshold: 0.64 })
    ),
    // Exposed structural metal (limb cores, frame, neck): parkerized steel, worn bright on edges.
    droidGunmetal: withSurface(
      stdm({ color: '#5e5f62', roughness: 0.45, metalness: 1 }),
      HARD(7, 0.06, 0.35, 0.05, { amount: 0.6, color: '#a2a5aa', roughness: 0.25, metalness: 1, threshold: 0.56 })
    ),
    // Actuator housings at knees/elbows/hips: machined metal, slightly finer finish.
    droidHydraulic: withSurface(stdm({ color: '#6d7075', roughness: 0.34, metalness: 1 }), HARD(9, 0.04, 0.3, 0.04)),
    // Piston rods: polished chrome.
    droidPiston: stdm({ color: '#c2c5c9', roughness: 0.14, metalness: 1 }),
    // Joint boots, bellows and soles.
    droidRubber: withSurface(stdm({ color: '#161617', roughness: 0.85, metalness: 0 }), HARD(12, 0.14, 0.12, 0.04)),
    // Heat-affected weapon metal: straw/bronze temper tint near the muzzle.
    droidHeatMetal: withSurface(stdm({ color: '#6f6052', roughness: 0.4, metalness: 1 }), HARD(9, 0.05, 0.3, 0.12)),
    // Optic cover: dark red-tinted glass, separate from the operative's visor.
    droidLens: phys({ color: '#140404', roughness: 0.03, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, ior: 1.52 }),
    orangeLight: emissive('#ff7a1a', 1.6),
  }
  // Glass reads by its reflections: give it a little more of the environment.
  m.visorGlass.userData.envBoost = 1.4
  m.droidLens.userData.envBoost = 1.4
  m.all = Object.values(m)
  return m
}

/** Shared character materials, created on first use (needs a DOM for the mantle canvas). */
export const charMaterials = lazy(build)

/** Per-instance emissive material whose intensity is animated at runtime. */
export function dynamicEmissive(hex, intensity = 1) {
  return emissive(hex, intensity)
}

/**
 * Give character materials reflections from a pre-filtered environment map.
 * Metals and glass need something to reflect or they read as flat black.
 */
export function applyCharacterEnvironment(envMap, intensity) {
  for (const mat of charMaterials().all) {
    mat.envMap = envMap
    mat.envMapIntensity = intensity * (mat.userData.envBoost ?? 1)
    mat.needsUpdate = true
  }
}
