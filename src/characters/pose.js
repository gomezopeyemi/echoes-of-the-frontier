// Minimal pose system for articulated (rigid-segment) characters.
//
// A pose is { joints: { name: [rx, ry, rz] }, root: [x, y, z] } where root is
// the pelvis offset from its bind position. Animators build a *target* pose
// every frame from gameplay state (layered clips + overlays), then the rig
// eases toward it with critically-damped smoothing. This keeps transitions
// continuous and prevents single-frame pops when states change abruptly.

export function createPose(jointNames) {
  const joints = {}
  for (const n of jointNames) joints[n] = [0, 0, 0]
  return { joints, root: [0, 0, 0] }
}

export function resetPose(p) {
  for (const k in p.joints) {
    const j = p.joints[k]
    j[0] = j[1] = j[2] = 0
  }
  p.root[0] = p.root[1] = p.root[2] = 0
}

export function copyPose(dst, src) {
  for (const k in dst.joints) {
    const a = dst.joints[k]
    const b = src.joints[k]
    a[0] = b[0]
    a[1] = b[1]
    a[2] = b[2]
  }
  dst.root[0] = src.root[0]
  dst.root[1] = src.root[1]
  dst.root[2] = src.root[2]
}

/** Set a joint rotation. */
export function set(p, name, x = 0, y = 0, z = 0) {
  const j = p.joints[name]
  j[0] = x
  j[1] = y
  j[2] = z
}

/** Add to a joint rotation (for additive layers like breathing or flinches). */
export function add(p, name, x = 0, y = 0, z = 0, w = 1) {
  const j = p.joints[name]
  j[0] += x * w
  j[1] += y * w
  j[2] += z * w
}

/**
 * Blend a sparse pose fragment ({ name: [x,y,z] }, optional `root`) into `p` by weight w.
 * Joints absent from the fragment are untouched, so overlays affect only their body region.
 */
export function blendFragment(p, frag, w) {
  if (w <= 0) return
  for (const k in frag) {
    if (k === 'root') continue
    const j = p.joints[k]
    const f = frag[k]
    j[0] += (f[0] - j[0]) * w
    j[1] += (f[1] - j[1]) * w
    j[2] += (f[2] - j[2]) * w
  }
  if (frag.root) {
    p.root[0] += (frag.root[0] - p.root[0]) * w
    p.root[1] += (frag.root[1] - p.root[1]) * w
    p.root[2] += (frag.root[2] - p.root[2]) * w
  }
}

const smooth = (t) => t * t * (3 - 2 * t)

/**
 * Sample a keyframed clip at time t. keys = [{ t, pose: fragment }], sorted by t,
 * every fragment listing the same joints. Writes an interpolated fragment into `out`.
 */
export function sampleKeys(keys, t, out) {
  let i = 0
  while (i < keys.length - 2 && t > keys[i + 1].t) i++
  const a = keys[i]
  const b = keys[Math.min(i + 1, keys.length - 1)]
  const span = b.t - a.t
  const u = span > 0 ? smooth(Math.min(1, Math.max(0, (t - a.t) / span))) : 1
  for (const k in a.pose) {
    const fa = a.pose[k]
    const fb = b.pose[k]
    const o = (out[k] ??= [0, 0, 0])
    o[0] = fa[0] + (fb[0] - fa[0]) * u
    o[1] = fa[1] + (fb[1] - fa[1]) * u
    o[2] = fa[2] + (fb[2] - fa[2]) * u
  }
  return out
}

/** Ease `current` toward `target`. rate ~ 1/seconds; higher is snappier. */
export function dampPose(current, target, rate, dt) {
  const k = 1 - Math.exp(-rate * dt)
  for (const n in current.joints) {
    const c = current.joints[n]
    const t = target.joints[n]
    c[0] += (t[0] - c[0]) * k
    c[1] += (t[1] - c[1]) * k
    c[2] += (t[2] - c[2]) * k
  }
  for (let i = 0; i < 3; i++) current.root[i] += (target.root[i] - current.root[i]) * k
}

/** Write a pose onto joint Object3Ds. `bindRoot` is the pelvis bind position. */
export function applyPose(pose, jointRefs, pelvis, bindRoot) {
  for (const n in pose.joints) {
    const o = jointRefs[n]
    if (!o) continue
    const j = pose.joints[n]
    o.rotation.set(j[0], j[1], j[2])
  }
  if (pelvis) pelvis.position.set(bindRoot[0] + pose.root[0], bindRoot[1] + pose.root[1], bindRoot[2] + pose.root[2])
}

export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)

/** Move a scalar weight toward a target at a fixed rate per second. */
export const approach = (v, target, rate, dt) => (v < target ? Math.min(target, v + rate * dt) : Math.max(target, v - rate * dt))
