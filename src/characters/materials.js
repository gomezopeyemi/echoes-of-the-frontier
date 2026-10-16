import {
  CanvasTexture,
  Color,
  DoubleSide,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
} from 'three'

// PBR materials for the characters, derived from the design board palette:
//   operative: charcoal #1d1d1f, muted silver #cfcfcb, gunmetal #4a4c50,
//              weathered tan #7a6248, accents electric blue + burnt orange
//   droid:     dark gunmetal, black composite, worn steel, red optics,
//              small orange warning lights
//
// Surface variation comes from small procedural canvas textures (soft grime,
// roughness breakup, fabric weave). They are intentionally subtle: the goal is
// "used equipment", not noisy grunge.

// ---------- procedural textures ----------

function canvas(size) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  return [c, c.getContext('2d')]
}

function seeded(seed) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}

function finish(c, { srgb = false, repeat = 1 } = {}) {
  const t = new CanvasTexture(c)
  t.wrapS = t.wrapT = RepeatWrapping
  t.repeat.set(repeat, repeat)
  if (srgb) t.colorSpace = SRGBColorSpace
  t.anisotropy = 4
  return t
}

/** Soft, low-frequency grime: mostly white with faint darker blotches. Used as a colour multiplier. */
function grimeTexture(seed, strength = 0.08) {
  const [c, g] = canvas(256)
  const rnd = seeded(seed)
  g.fillStyle = '#fff'
  g.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 70; i++) {
    const x = rnd() * 256
    const y = rnd() * 256
    const r = 10 + rnd() * 45
    const grad = g.createRadialGradient(x, y, 0, x, y, r)
    const a = strength * (0.3 + rnd() * 0.7)
    grad.addColorStop(0, `rgba(70,60,50,${a})`)
    grad.addColorStop(1, 'rgba(70,60,50,0)')
    g.fillStyle = grad
    g.fillRect(x - r, y - r, r * 2, r * 2)
  }
  // fine speckle of chipped paint
  for (let i = 0; i < 400; i++) {
    g.fillStyle = `rgba(40,40,40,${rnd() * 0.1})`
    g.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 1.5, 1 + rnd() * 1.5)
  }
  return finish(c, { srgb: true })
}

/** Roughness breakup: green channel drives roughness (0.6–1.0 of the material's value). */
function roughnessTexture(seed) {
  const [c, g] = canvas(256)
  const rnd = seeded(seed)
  g.fillStyle = 'rgb(230,230,230)'
  g.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 120; i++) {
    const x = rnd() * 256
    const y = rnd() * 256
    const r = 6 + rnd() * 30
    const v = Math.round(195 + rnd() * 60)
    const grad = g.createRadialGradient(x, y, 0, x, y, r)
    grad.addColorStop(0, `rgba(${v},${v},${v},0.45)`)
    grad.addColorStop(1, `rgba(${v},${v},${v},0)`)
    g.fillStyle = grad
    g.fillRect(x - r, y - r, r * 2, r * 2)
  }
  // directional brushing / wipe marks
  for (let i = 0; i < 160; i++) {
    const v = Math.round(190 + rnd() * 60)
    g.strokeStyle = `rgba(${v},${v},${v},0.2)`
    g.lineWidth = 0.5 + rnd()
    const x = rnd() * 256
    const y = rnd() * 256
    g.beginPath()
    g.moveTo(x, y)
    g.lineTo(x + 20 + rnd() * 40, y + (rnd() - 0.5) * 4)
    g.stroke()
  }
  return finish(c)
}

/** Tight fabric weave for the undersuit and webbing. */
function weaveTexture(seed) {
  const [c, g] = canvas(128)
  const rnd = seeded(seed)
  g.fillStyle = '#fff'
  g.fillRect(0, 0, 128, 128)
  for (let i = 0; i < 128; i += 2) {
    g.fillStyle = `rgba(0,0,0,${0.06 + rnd() * 0.04})`
    g.fillRect(0, i, 128, 1)
    g.fillRect(i, 0, 1, 128)
  }
  return finish(c, { srgb: true, repeat: 4 })
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

const tex = {
  grimeA: lazy(() => grimeTexture(11)),
  grimeB: lazy(() => grimeTexture(23, 0.12)),
  roughA: lazy(() => roughnessTexture(5)),
  roughB: lazy(() => roughnessTexture(9)),
  weave: lazy(() => weaveTexture(3)),
  mantle: lazy(mantleTextures),
}

function std(params, maps = {}) {
  return new MeshStandardMaterial({ ...params, ...maps })
}

function emissive(hex, intensity) {
  return new MeshStandardMaterial({ color: '#050505', emissive: new Color(hex), emissiveIntensity: intensity, roughness: 0.4 })
}

function build() {
  const m = {
    // --- Frontier Operative ---
    undersuit: std({ color: '#1e1f22', roughness: 0.88, metalness: 0 }, { map: tex.weave() }),
    webbing: std({ color: '#26231f', roughness: 0.82, metalness: 0 }, { map: tex.weave() }),
    leather: std({ color: '#2b2520', roughness: 0.7, metalness: 0 }, { map: tex.grimeA() }),
    armorLight: std({ color: '#a3a5a4', roughness: 0.44, metalness: 0.3 }, { map: tex.grimeA(), roughnessMap: tex.roughA() }),
    armorGraphite: std({ color: '#2d2f33', roughness: 0.5, metalness: 0.35 }, { map: tex.grimeB(), roughnessMap: tex.roughA() }),
    gunmetal: std({ color: '#4c4f54', roughness: 0.36, metalness: 0.85 }, { roughnessMap: tex.roughB() }),
    helmet: std({ color: '#26282c', roughness: 0.38, metalness: 0.5 }, { roughnessMap: tex.roughA() }),
    visorGlass: new MeshPhysicalMaterial({ color: '#07080b', roughness: 0.06, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05 }),
    accentOrange: std({ color: '#c8661f', roughness: 0.55, metalness: 0.1 }, { map: tex.grimeA() }),
    scarf: std({ color: '#55432f', roughness: 0.97, metalness: 0 }, { map: tex.weave() }),
    mantle: (() => {
      const { map, alphaMap } = tex.mantle()
      return new MeshStandardMaterial({ map, alphaMap, alphaTest: 0.5, side: DoubleSide, roughness: 0.97, metalness: 0 })
    })(),
    blueLight: emissive('#3d8cff', 2.2),
    blueLightDim: emissive('#3d8cff', 0.9),

    // --- Security Droid ---
    droidGunmetal: std({ color: '#3a3c40', roughness: 0.38, metalness: 0.85 }, { map: tex.grimeB(), roughnessMap: tex.roughB() }),
    droidComposite: std({ color: '#18191b', roughness: 0.55, metalness: 0.25 }, { map: tex.grimeA(), roughnessMap: tex.roughA() }),
    droidPlate: std({ color: '#5d6065', roughness: 0.46, metalness: 0.7 }, { map: tex.grimeA() }),
    droidHydraulic: std({ color: '#6f7277', roughness: 0.32, metalness: 1 }),
    droidRubber: std({ color: '#121212', roughness: 0.9, metalness: 0 }),
    orangeLight: emissive('#ff7a1a', 1.6),
  }
  m.all = Object.values(m)
  return m
}

/** Shared character materials, created on first use (needs a DOM for canvas textures). */
export const charMaterials = lazy(build)

/** Per-instance emissive material whose intensity is animated at runtime. */
export function dynamicEmissive(hex, intensity = 1) {
  return emissive(hex, intensity)
}

/**
 * Give character materials reflections from a pre-filtered environment map.
 * Metals and the visor need something to reflect or they read as flat black.
 * Applied only to characters so the level's lighting is unchanged.
 */
export function applyCharacterEnvironment(envMap, intensity) {
  for (const mat of charMaterials().all) {
    mat.envMap = envMap
    mat.envMapIntensity = intensity
    mat.needsUpdate = true
  }
}
