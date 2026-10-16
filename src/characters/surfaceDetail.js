import { Color, DataTexture, LinearFilter, LinearMipmapLinearFilter, NoColorSpace, RepeatWrapping, RGBAFormat, Vector4 } from 'three'

// Surface detail for the procedural characters.
//
// Problem it solves: the characters are built from primitives whose UVs are
// unrelated to real-world size (a 2 cm strap and a 60 cm torso both span 0–1),
// so ordinary UV textures stretch, seam and change scale between parts.
//
// Instead each material samples one small tileable *data* texture in object
// space (triplanar), at a texel density given in tiles per metre:
//   R  micro height  -> bump (perturbs the normal; no tangents needed)
//   G  roughness breakup
//   B  low-frequency colour variation
//   A  chip mask, combined with the per-vertex `surfEdge` attribute that the
//      rounded-box geometry provides, so paint wear appears only on real edges
//
// Textures are linear data (NoColorSpace): they modulate shading, they are
// never displayed as colour. Cost: three texture fetches per fragment.

// ---------- tileable noise ----------

function seeded(seed) {
  let s = seed >>> 0
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296
}

/** Periodic value noise grid sampled with smooth interpolation (tiles seamlessly). */
function periodicNoise(cx, cy, seed) {
  const rnd = seeded(seed)
  const g = new Float32Array(cx * cy).map(() => rnd())
  return (u, v) => {
    const x = u * cx
    const y = v * cy
    const x0 = Math.floor(x)
    const y0 = Math.floor(y)
    const fx = x - x0
    const fy = y - y0
    const sx = fx * fx * (3 - 2 * fx)
    const sy = fy * fy * (3 - 2 * fy)
    const i = (a, b) => g[(((b % cy) + cy) % cy) * cx + (((a % cx) + cx) % cx)]
    const a = i(x0, y0) + (i(x0 + 1, y0) - i(x0, y0)) * sx
    const b = i(x0, y0 + 1) + (i(x0 + 1, y0 + 1) - i(x0, y0 + 1)) * sx
    return a + (b - a) * sy
  }
}

function fbm(cx, cy, octaves, seed) {
  const layers = Array.from({ length: octaves }, (_, o) => periodicNoise(cx << o, cy << o, seed + o * 101))
  return (u, v) => {
    let sum = 0
    let amp = 1
    let norm = 0
    for (const n of layers) {
      sum += n(u, v) * amp
      norm += amp
      amp *= 0.5
    }
    return sum / norm
  }
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
const contrast = (v, k) => clamp01((v - 0.5) * k + 0.5)

function toTexture(size, fill) {
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = fill(x / size, y / size)
      const o = (y * size + x) * 4
      for (let c = 0; c < 4; c++) data[o + c] = Math.round(clamp01(px[c]) * 255)
    }
  }
  const t = new DataTexture(data, size, size, RGBAFormat)
  t.wrapS = t.wrapT = RepeatWrapping
  t.magFilter = LinearFilter
  t.minFilter = LinearMipmapLinearFilter
  t.generateMipmaps = true
  t.anisotropy = 8
  t.colorSpace = NoColorSpace
  t.needsUpdate = true
  return t
}

/** Hard surfaces: fine orange-peel coating, soft handling smudges, colour drift, chip mask. */
function hardTexture() {
  const micro = fbm(48, 48, 2, 11)
  const smudge = fbm(5, 3, 4, 23) // slightly anisotropic: wiped, not blotchy
  const drift = fbm(3, 3, 3, 37)
  const chips = fbm(20, 20, 3, 53)
  const px = [0, 0, 0, 0]
  return toTexture(512, (u, v) => {
    px[0] = 0.5 + (micro(u, v) - 0.5) * 0.9
    px[1] = 0.5 + (smudge(u, v) - 0.5) * 1.3
    px[2] = 0.5 + (drift(u, v) - 0.5) * 1.2
    px[3] = contrast(chips(u, v), 2.2)
    return px
  })
}

/** Textiles: plain weave (16 threads per tile) with slubs, dye unevenness and fibre roughness. */
function fabricTexture() {
  const N = 16
  const slub = fbm(6, 24, 2, 71)
  const dye = fbm(3, 3, 3, 83)
  const fibre = fbm(32, 32, 2, 97)
  const px = [0, 0, 0, 0]
  return toTexture(256, (u, v) => {
    const tx = u * N
    const ty = v * N
    const warp = Math.sin(Math.PI * (tx - Math.floor(tx))) ** 0.7
    const weft = Math.sin(Math.PI * (ty - Math.floor(ty))) ** 0.7
    const over = (Math.floor(tx) + Math.floor(ty)) % 2 === 0
    const h = over ? 0.45 + 0.55 * warp * (0.6 + 0.4 * weft) : 0.45 * weft
    px[0] = clamp01(h + (slub(u, v) - 0.5) * 0.25)
    px[1] = 0.5 + (fibre(u, v) - 0.5) * 0.8
    px[2] = 0.5 + (dye(u, v) - 0.5) * 1.1 + (fibre(u, v) - 0.5) * 0.25
    px[3] = 0
    return px
  })
}

let textures = null
export function detailTextures() {
  return (textures ??= { hard: hardTexture(), fabric: fabricTexture() })
}

// ---------- shader patch ----------

const VERT_DECL = /* glsl */ `
attribute float surfEdge;
varying vec3 vSurfPos;
varying vec3 vSurfNormal;
varying float vSurfEdge;
`

const FRAG_DECL = /* glsl */ `
uniform sampler2D tSurf;
uniform vec4 uSurf;      // x: tiles per metre, y: bump strength, z: roughness variation, w: colour variation
uniform vec4 uWear;      // x: amount, y: worn roughness, z: worn metalness, w: threshold
uniform vec3 uWearColor;
varying vec3 vSurfPos;
varying vec3 vSurfNormal;
varying float vSurfEdge;

vec4 surfTriplanar(vec3 p, vec3 n) {
  vec3 w = pow(abs(normalize(n)), vec3(4.0));
  w /= (w.x + w.y + w.z);
  return texture2D(tSurf, p.zy) * w.x + texture2D(tSurf, p.xz) * w.y + texture2D(tSurf, p.xy) * w.z;
}

// Same construction as three's perturbNormalArb (Mikkelsen bump), fed with a screen-space height gradient.
vec3 surfPerturb(vec3 surfPos, vec3 surfNorm, vec2 dHdxy, float faceDir) {
  vec3 sx = normalize(dFdx(surfPos));
  vec3 sy = normalize(dFdy(surfPos));
  vec3 r1 = cross(sy, surfNorm);
  vec3 r2 = cross(surfNorm, sx);
  float det = dot(sx, r1) * faceDir;
  vec3 grad = sign(det) * (dHdxy.x * r1 + dHdxy.y * r2);
  return normalize(abs(det) * surfNorm - grad);
}
`

/**
 * Patch a MeshStandard/MeshPhysical material with object-space surface detail.
 * opts: { kind: 'hard' | 'fabric', scale, bump, rough, color, wear?: { amount, color, roughness, metalness, threshold } }
 */
export function withSurface(material, opts) {
  const tex = detailTextures()[opts.kind]
  const wear = opts.wear ?? { amount: 0, color: '#000000', roughness: 0.5, metalness: 0, threshold: 1 }
  const uniforms = {
    tSurf: { value: tex },
    uSurf: { value: new Vector4(opts.scale, opts.bump, opts.rough, opts.color) },
    uWear: { value: new Vector4(wear.amount, wear.roughness, wear.metalness, wear.threshold) },
    uWearColor: { value: new Color(wear.color) },
  }
  material.userData.surface = uniforms
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_DECL}`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSurfPos = position;\nvSurfNormal = objectNormal;\nvSurfEdge = surfEdge;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_DECL}`)
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        vec4 surf = surfTriplanar(vSurfPos * uSurf.x, vSurfNormal);
        diffuseColor.rgb *= 1.0 + (surf.b - 0.5) * 2.0 * uSurf.w;
        // Squared edge factor keeps wear on the outer lip of a bevel, not the whole band.
        float surfWear = uWear.x * smoothstep(uWear.w, uWear.w + 0.06, vSurfEdge * vSurfEdge * 0.85 + (surf.a - 0.5) * 0.7);
        diffuseColor.rgb = mix(diffuseColor.rgb, uWearColor, surfWear);`
      )
      .replace(
        '#include <metalnessmap_fragment>',
        `#include <metalnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor * (1.0 + (surf.g - 0.5) * 2.0 * uSurf.z), 0.03, 1.0);
        roughnessFactor = mix(roughnessFactor, uWear.y, surfWear);
        metalnessFactor = mix(metalnessFactor, uWear.z, surfWear);`
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        if (uSurf.y > 0.0) {
          vec2 dH = vec2(dFdx(surf.r), dFdy(surf.r)) * uSurf.y;
          normal = surfPerturb(-vViewPosition, normal, dH, faceDirection);
        }`
      )
  }
  // All patched materials share one program; uniforms stay per-material.
  material.customProgramCacheKey = () => 'char-surface'
  return material
}

/** Rounded-box edge factor (0 on flat faces, 1 on bevels/corners) from the face-local normal. */
export function edgeFactor(nx, ny, nz) {
  const m = Math.max(Math.abs(nx), Math.abs(ny), Math.abs(nz))
  return clamp01((1 - m) / 0.25)
}

