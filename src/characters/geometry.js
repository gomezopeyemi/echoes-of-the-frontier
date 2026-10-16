import { BufferGeometry, CapsuleGeometry, CylinderGeometry, Float32BufferAttribute, SphereGeometry, TorusGeometry } from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

// Cached primitive geometry. Characters reuse the same shapes many times
// (armour plates, joints), so each unique size is built exactly once.

const cache = new Map()
const memo = (key, make) => {
  let g = cache.get(key)
  if (!g) cache.set(key, (g = make()))
  return g
}

/** Rounded box: bevelled edges catch light the way machined/moulded parts do. */
export const rbox = (w, h, d, r = 0.015) => memo(`rb${w},${h},${d},${r}`, () => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2)))

export const capsule = (r, len, radial = 10) => memo(`cap${r},${len},${radial}`, () => new CapsuleGeometry(r, len, 4, radial))

export const cyl = (rt, rb, h, seg = 16, open = false) => memo(`cy${rt},${rb},${h},${seg},${open}`, () => new CylinderGeometry(rt, rb, h, seg, 1, open))

export const sphere = (r, w = 20, h = 14, phiStart = 0, phiLen = Math.PI * 2, thetaStart = 0, thetaLen = Math.PI) =>
  memo(`sp${r},${w},${h},${phiStart},${phiLen},${thetaStart},${thetaLen}`, () => new SphereGeometry(r, w, h, phiStart, phiLen, thetaStart, thetaLen))

export const torus = (r, tube, rs = 8, ts = 24, arc = Math.PI * 2) => memo(`to${r},${tube},${rs},${ts},${arc}`, () => new TorusGeometry(r, tube, rs, ts, arc))

/**
 * Tapered energy blade: diamond cross-section, flat sides, sharp tip.
 * Base at y = 0, tip at y = length.
 */
export const bladeGeometry = (length, width, thickness) =>
  memo(`blade${length},${width},${thickness}`, () => {
    const w = width / 2
    const t = thickness / 2
    const tipStart = length * 0.82
    const ring = (y, s) => [
      [0, y, -w * s],
      [t * s, y, 0],
      [0, y, w * s],
      [-t * s, y, 0],
    ]
    const r0 = ring(0, 0.8)
    const r1 = ring(tipStart, 1)
    const tip = [0, length, -w * 0.15]
    const pos = []
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4
      pos.push(...r0[i], ...r0[j], ...r1[j], ...r0[i], ...r1[j], ...r1[i])
      pos.push(...r1[i], ...r1[j], ...tip)
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(pos, 3))
    g.computeVertexNormals()
    return g
  })
