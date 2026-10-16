import { Box3, Ray, Vector3 } from 'three'
import { BOUNDS, OBSTACLES } from '../world/layout'

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)

export function buildColliders(obstacles) {
  return obstacles.map((o) => ({
    minX: o.x - o.w / 2,
    maxX: o.x + o.w / 2,
    minZ: o.z - o.d / 2,
    maxZ: o.z + o.d / 2,
    h: o.h,
    box: new Box3(new Vector3(o.x - o.w / 2, 0, o.z - o.d / 2), new Vector3(o.x + o.w / 2, o.h, o.z + o.d / 2)),
  }))
}

export const COLLIDERS = buildColliders(OBSTACLES)

/** Push a circle (on the XZ plane) out of every collider and keep it in bounds. Mutates `pos`. */
export function resolveCircle(pos, r, colliders = COLLIDERS, bounds = BOUNDS) {
  for (let pass = 0; pass < 2; pass++) {
    for (const c of colliders) {
      const cx = clamp(pos.x, c.minX, c.maxX)
      const cz = clamp(pos.z, c.minZ, c.maxZ)
      const dx = pos.x - cx
      const dz = pos.z - cz
      const d2 = dx * dx + dz * dz
      if (d2 >= r * r) continue
      if (d2 > 1e-10) {
        const d = Math.sqrt(d2)
        pos.x += (dx / d) * (r - d)
        pos.z += (dz / d) * (r - d)
      } else {
        // Centre is inside the box: exit along the shallowest axis.
        const left = pos.x - c.minX
        const right = c.maxX - pos.x
        const back = pos.z - c.minZ
        const front = c.maxZ - pos.z
        const m = Math.min(left, right, back, front)
        if (m === left) pos.x = c.minX - r
        else if (m === right) pos.x = c.maxX + r
        else if (m === back) pos.z = c.minZ - r
        else pos.z = c.maxZ + r
      }
    }
  }
  pos.x = clamp(pos.x, -bounds + r, bounds - r)
  pos.z = clamp(pos.z, -bounds + r, bounds - r)
  return pos
}

export function circleBlocked(x, z, r, colliders = COLLIDERS, bounds = BOUNDS) {
  if (Math.abs(x) > bounds - r || Math.abs(z) > bounds - r) return true
  for (const c of colliders) {
    const dx = x - clamp(x, c.minX, c.maxX)
    const dz = z - clamp(z, c.minZ, c.maxZ)
    if (dx * dx + dz * dz < r * r) return true
  }
  return false
}

export function pointInColliders(p, colliders = COLLIDERS) {
  for (const c of colliders) {
    if (p.y < c.h && p.x > c.minX && p.x < c.maxX && p.z > c.minZ && p.z < c.maxZ) return true
  }
  return false
}

const hit = new Vector3()
/** Distance along the ray to the nearest collider or the ground, or null if nothing within maxDist. */
export function raycastWorld(ray, maxDist, { ground = true, colliders = COLLIDERS } = {}) {
  let best = maxDist
  for (const c of colliders) {
    if (ray.intersectBox(c.box, hit)) {
      const t = hit.distanceTo(ray.origin)
      if (t < best) best = t
    }
  }
  if (ground && ray.direction.y < -1e-4) {
    const t = -ray.origin.y / ray.direction.y
    if (t > 0 && t < best) best = t
  }
  return best < maxDist ? best : null
}

const losRay = new Ray()
const losDir = new Vector3()
export function hasLineOfSight(from, to, colliders = COLLIDERS) {
  losDir.subVectors(to, from)
  const len = losDir.length()
  if (len < 1e-6) return true
  losRay.set(from, losDir.divideScalar(len))
  return raycastWorld(losRay, len, { ground: false, colliders }) === null
}
