import { Color, IcosahedronGeometry, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace, TextureLoader, Vector3 } from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// Boulders: procedurally generated fractured-rock meshes surfaced with the
// ambientCG Rock020 PBR set (CC0, see public/assets/env/ASSETS.md).
//
// Shape: an icosphere displaced by fractal noise, then cut by a few random
// planes. The planar cuts give the broken faces and hard ridges of real
// boulders that pure noise does not.
//
// Texturing: generated meshes have no meaningful UVs, so the material samples
// colour, normal and AO/roughness triplanar in world space (texel density
// stays the same on every rock regardless of its scale). Normals use a
// whiteout blend of the three projected tangent-space normal maps.

function seeded(seed) {
  let s = seed >>> 0
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296
}

function valueNoise3(seed) {
  const rnd = seeded(seed)
  const perm = Array.from({ length: 256 }, (_, i) => i)
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[perm[i], perm[j]] = [perm[j], perm[i]]
  }
  const vals = Float32Array.from({ length: 256 }, () => rnd() * 2 - 1)
  const h = (x, y, z) => vals[perm[(perm[(perm[x & 255] + y) & 255] + z) & 255]]
  const s = (t) => t * t * (3 - 2 * t)
  return (x, y, z) => {
    const x0 = Math.floor(x)
    const y0 = Math.floor(y)
    const z0 = Math.floor(z)
    const fx = s(x - x0)
    const fy = s(y - y0)
    const fz = s(z - z0)
    const l = (a, b, t) => a + (b - a) * t
    return l(
      l(l(h(x0, y0, z0), h(x0 + 1, y0, z0), fx), l(h(x0, y0 + 1, z0), h(x0 + 1, y0 + 1, z0), fx), fy),
      l(l(h(x0, y0, z0 + 1), h(x0 + 1, y0, z0 + 1), fx), l(h(x0, y0 + 1, z0 + 1), h(x0 + 1, y0 + 1, z0 + 1), fx), fy),
      fz
    )
  }
}

/** Unit-radius boulder (roughly), flat-ish underside, deterministic per seed. */
export function makeRockGeometry(seed, detail = 4) {
  const rnd = seeded(seed * 7919 + 13)
  const noise = valueNoise3(seed)
  let g = new IcosahedronGeometry(1, detail)
  g.deleteAttribute('normal')
  g.deleteAttribute('uv')
  g = mergeVertices(g)

  const cuts = Array.from({ length: 5 + Math.floor(rnd() * 3) }, () => {
    const n = new Vector3(rnd() * 2 - 1, rnd() * 1.4 - 0.4, rnd() * 2 - 1).normalize()
    return { n, d: 0.62 + rnd() * 0.22 }
  })
  const pos = g.attributes.position
  const p = new Vector3()
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i)
    let r = 1
    let amp = 0.22
    let f = 1.6
    for (let o = 0; o < 4; o++) {
      r += noise(p.x * f + 11, p.y * f + 7, p.z * f + 3) * amp
      amp *= 0.5
      f *= 2.1
    }
    p.multiplyScalar(r)
    for (const c of cuts) {
      const k = p.dot(c.n) - c.d
      if (k > 0) p.addScaledVector(c.n, -k * 0.92)
    }
    // Settle into the ground: flatten the underside.
    if (p.y < -0.45) p.y = -0.45 + (p.y + 0.45) * 0.15
    pos.setXYZ(i, p.x, p.y, p.z)
  }
  g.computeVertexNormals()
  g.computeBoundingSphere()
  return g
}

const ROCK_GLSL = /* glsl */ `
uniform sampler2D tRockColor;
uniform sampler2D tRockNormal;
uniform sampler2D tRockOrm;
uniform float uRockScale;
uniform float uRockNormal;
varying vec3 vRockPos;
varying vec3 vRockNrm;

vec3 rockWeights(vec3 n) {
  vec3 w = pow(abs(n), vec3(6.0));
  return w / (w.x + w.y + w.z);
}
vec4 rockSample(sampler2D t, vec3 p, vec3 w) {
  return texture2D(t, p.zy) * w.x + texture2D(t, p.xz) * w.y + texture2D(t, p.xy) * w.z;
}
// Whiteout blend of three tangent-space normal maps into a world-space normal.
vec3 rockNormal(vec3 p, vec3 n, vec3 w) {
  vec3 tx = texture2D(tRockNormal, p.zy).xyz * 2.0 - 1.0;
  vec3 ty = texture2D(tRockNormal, p.xz).xyz * 2.0 - 1.0;
  vec3 tz = texture2D(tRockNormal, p.xy).xyz * 2.0 - 1.0;
  tx.xy *= uRockNormal; ty.xy *= uRockNormal; tz.xy *= uRockNormal;
  tx = vec3(tx.xy + n.zy, abs(tx.z) * n.x);
  ty = vec3(ty.xy + n.xz, abs(ty.z) * n.y);
  tz = vec3(tz.xy + n.xy, abs(tz.z) * n.z);
  return normalize(tx.zyx * w.x + ty.xzy * w.y + tz.xyz * w.z);
}
`

let rockMaterial = null

/** Shared boulder material (one shader program for every rock). */
export function getRockMaterial() {
  if (rockMaterial) return rockMaterial
  const base = `${import.meta.env.BASE_URL}assets/env/ambientcg-rock020/`
  const loader = new TextureLoader()
  const load = (f, srgb) => {
    const t = loader.load(base + f)
    t.wrapS = t.wrapT = RepeatWrapping
    t.anisotropy = 8
    if (srgb) t.colorSpace = SRGBColorSpace
    return t
  }
  const uniforms = {
    tRockColor: { value: load('rock020_color.jpg', true) },
    tRockNormal: { value: load('rock020_normal.jpg') },
    tRockOrm: { value: load('rock020_orm.jpg') },
    uRockScale: { value: 1 / 2.2 }, // one texture tile per 2.2 m
    uRockNormal: { value: 1.25 },
  }
  // Warm the cool grey scan toward the outpost's iron-rich dust.
  const m = new MeshStandardMaterial({ color: new Color('#b9a48f'), roughness: 1, metalness: 0 })
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRockPos;\nvarying vec3 vRockNrm;')
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        vRockPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vRockNrm = normalize(mat3(modelMatrix) * objectNormal);`
      )
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${ROCK_GLSL}`)
      .replace(
        '#include <map_fragment>',
        `vec3 rockN = normalize(vRockNrm);
        vec3 rockW = rockWeights(rockN);
        vec3 rockP = vRockPos * uRockScale;
        diffuseColor.rgb *= rockSample(tRockColor, rockP, rockW).rgb;
        vec4 rockOrm = rockSample(tRockOrm, rockP, rockW);`
      )
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = roughness * mix(0.75, 1.0, rockOrm.g);')
      .replace('#include <normal_fragment_maps>', 'normal = normalize((viewMatrix * vec4(rockNormal(rockP, rockN, rockW), 0.0)).xyz);')
      .replace('#include <aomap_fragment>', 'reflectedLight.indirectDiffuse *= rockOrm.r;\nreflectedLight.directDiffuse *= mix(1.0, rockOrm.r, 0.5);')
  }
  m.customProgramCacheKey = () => 'rock020-triplanar'
  return (rockMaterial = m)
}
