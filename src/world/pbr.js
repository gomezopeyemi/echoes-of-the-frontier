import { MeshStandardMaterial, RepeatWrapping, SRGBColorSpace, TextureLoader } from 'three'

// Tiling PBR materials built from the licensed texture sets in
// public/assets/env (see public/assets/env/ASSETS.md for sources and licences).
//
// Maps follow the glTF/ORM packing: R = ambient occlusion, G = roughness,
// B = metalness. Normal maps are OpenGL (+Y) convention.
//
// Geometry using these materials must carry UVs in "tiles" (world metres
// divided by the texture's real-world size): see boxUV / cylinderUV below.

const BASE = `${import.meta.env.BASE_URL}assets/env/`
const loader = new TextureLoader()
const cache = new Map()

function tex(path, { color = false, repeat = 1 } = {}) {
  const key = `${path}|${repeat}`
  if (cache.has(key)) return cache.get(key)
  const t = loader.load(BASE + path)
  t.wrapS = t.wrapT = RepeatWrapping
  t.anisotropy = 8
  t.repeat.set(repeat, repeat)
  if (color) t.colorSpace = SRGBColorSpace
  cache.set(key, t)
  return t
}

/**
 * MeshStandardMaterial from an albedo / normal / ORM set.
 * `color` multiplies the albedo, so a neutral grey set can be tinted to the
 * art direction without repainting the texture.
 */
export function pbrMaterial({ albedo, normal, orm, color = '#ffffff', metalness = 1, roughness = 1, normalScale = 1, aoIntensity = 1, repeat = 1, envMapIntensity = 1 }) {
  const ormTex = orm && tex(orm, { repeat })
  const m = new MeshStandardMaterial({
    color,
    map: albedo ? tex(albedo, { color: true, repeat }) : null,
    normalMap: normal ? tex(normal, { repeat }) : null,
    roughnessMap: ormTex,
    metalnessMap: ormTex,
    aoMap: ormTex,
    aoMapIntensity: aoIntensity,
    metalness,
    roughness,
    envMapIntensity,
  })
  m.normalScale.set(normalScale, normalScale)
  return m
}

/**
 * Rescale a BoxGeometry's per-face 0..1 UVs to world size / tile size, so a
 * tiling texture keeps the same texel density on every face and every box.
 */
export function boxUV(geometry, w, h, d, tile) {
  const uv = geometry.attributes.uv
  // BoxGeometry face order: +x, -x, +y, -y, +z, -z (4 vertices each).
  const faces = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ]
  for (let f = 0; f < 6; f++) {
    const [su, sv] = faces[f]
    for (let i = f * 4; i < f * 4 + 4; i++) uv.setXY(i, (uv.getX(i) * su) / tile, (uv.getY(i) * sv) / tile)
  }
  uv.needsUpdate = true
  return geometry
}

/** Same for a CylinderGeometry side (u around the circumference, v up the height). */
export function cylinderUV(geometry, radius, height, tile) {
  const uv = geometry.attributes.uv
  const su = (2 * Math.PI * radius) / tile
  const sv = height / tile
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv)
  uv.needsUpdate = true
  return geometry
}
