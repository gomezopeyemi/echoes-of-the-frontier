import { add, approach, blendFragment, clamp01, copyPose, createPose, dampPose, resetPose, sampleKeys, set } from '../pose'

// Procedural animation for the outpost security droid, driven by the AI state
// machine (src/game/droidAI.js). Same conventions as the operative:
// limbs +X swing forward, spine/chest/head -X bend forward, knees bend with -X.
//
// Motion language: heavy, deliberate, mechanical. Long strides with a pelvis
// roll, a slow head scan at rest, hard stops, and very readable telegraphs
// (arm drawn back before a melee swing, cannon raised and charging before a shot).

export const DROID_JOINTS = [
  'pelvis', 'spine', 'chest', 'neck', 'head',
  'shoulderL', 'elbowL', 'wristL', 'shoulderR', 'elbowR',
  'hipL', 'kneeL', 'ankleL', 'hipR', 'kneeR', 'ankleR',
]

/** AI → animation contract. stateT = seconds in the current AI state. */
export function createDroidDriver() {
  return {
    state: 'chase', // dormant | booting | chase | windup | strike | recover | charging | stagger | destroyed
    stateT: 0,
    speed: 0,
    lookYaw: 0, // target direction relative to facing (head tracking)
    aimPitch: 0,
    hitT: 99, // time since last damage taken
    fireT: 99, // time since last shot
    enraged: false,
  }
}

const DORMANT = {
  root: [0, -0.13, 0.04],
  hipL: [0.32, 0, -0.03], kneeL: [-0.6, 0, 0], ankleL: [0.28, 0, 0],
  hipR: [0.32, 0, 0.03], kneeR: [-0.6, 0, 0], ankleR: [0.28, 0, 0],
  spine: [-0.3, 0, 0], chest: [-0.25, 0, 0], neck: [-0.2, 0, 0], head: [-0.55, 0, 0],
  shoulderL: [0.3, 0, -0.04], elbowL: [0.25, 0, 0], wristL: [0.1, 0, 0],
  shoulderR: [0.3, 0, 0.04], elbowR: [0.3, 0, 0],
}

const STANCE = {
  root: [0, -0.04, 0],
  hipL: [0.12, 0, -0.06], kneeL: [-0.25, 0, 0], ankleL: [0.13, 0, 0],
  hipR: [0.08, 0, 0.06], kneeR: [-0.22, 0, 0], ankleR: [0.14, 0, 0],
  spine: [-0.1, 0, 0], chest: [-0.06, 0, 0], neck: [0.05, 0, 0], head: [0.08, 0, 0],
  shoulderL: [0.3, 0, -0.28], elbowL: [0.75, 0, 0], wristL: [0, 0, 0],
  shoulderR: [0.45, 0, 0.18], elbowR: [0.7, 0, 0],
}

// Detection response: optic snaps up first, then the frame unfolds into stance.
const BOOT = [
  { t: 0, pose: DORMANT },
  { t: 0.35, pose: { ...DORMANT, head: [0.15, 0.25, 0], neck: [0.1, 0, 0] } },
  { t: 0.7, pose: { ...DORMANT, head: [0.1, -0.2, 0], neck: [0.1, 0, 0], chest: [-0.15, 0, 0] } },
  { t: 1.6, pose: { ...STANCE, shoulderL: [0.0, 0, -0.45], shoulderR: [0.0, 0, 0.45], elbowL: [0.3, 0, 0], elbowR: [0.3, 0, 0], chest: [0.12, 0, 0] } },
  { t: 2.2, pose: STANCE },
]

const WINDUP = [
  { t: 0, pose: { shoulderL: [0.3, 0, -0.28], elbowL: [0.75, 0, 0], wristL: [0, 0, 0], chest: [-0.06, 0, 0], spine: [-0.1, 0, 0], root: [0, -0.04, 0] } },
  { t: 0.5, pose: { shoulderL: [1.25, 0, -1.35], elbowL: [0.45, 0, 0], wristL: [-0.2, 0, 0], chest: [0.08, 0.55, 0], spine: [0, 0.22, 0], root: [0, -0.09, 0.06] } },
]
const STRIKE = [
  { t: 0, pose: WINDUP[1].pose },
  { t: 0.22, pose: { shoulderL: [1.3, 0, 0.75], elbowL: [0.1, 0, 0], wristL: [0.2, 0, 0], chest: [-0.2, -0.65, 0], spine: [-0.15, -0.28, 0], root: [0, -0.12, -0.08] } },
]
const RECOVER = [
  { t: 0, pose: STRIKE[1].pose },
  { t: 0.6, pose: WINDUP[0].pose },
]

const STAGGER = [
  { t: 0, pose: { chest: [0.45, 0.2, 0.1], spine: [0.22, 0, 0], head: [0.45, -0.3, 0], shoulderL: [-0.25, 0, -0.75], shoulderR: [-0.2, 0, 0.7], elbowL: [0.3, 0, 0], elbowR: [0.2, 0, 0], kneeL: [-0.5, 0, 0], kneeR: [-0.3, 0, 0], hipL: [0.35, 0, 0], hipR: [-0.1, 0, 0], root: [0, -0.1, 0.14] } },
  { t: 0.45, pose: { chest: [0.25, 0.1, -0.05], spine: [0.1, 0, 0], head: [0.1, 0.2, 0], shoulderL: [0.1, 0, -0.5], shoulderR: [0.1, 0, 0.45], elbowL: [0.5, 0, 0], elbowR: [0.5, 0, 0], kneeL: [-0.55, 0, 0], kneeR: [-0.45, 0, 0], hipL: [0.3, 0, 0], hipR: [0.2, 0, 0], root: [0, -0.12, 0.1] } },
  { t: 0.8, pose: { chest: STANCE.chest, spine: STANCE.spine, head: STANCE.head, shoulderL: STANCE.shoulderL, shoulderR: STANCE.shoulderR, elbowL: STANCE.elbowL, elbowR: STANCE.elbowR, kneeL: STANCE.kneeL, kneeR: STANCE.kneeR, hipL: STANCE.hipL, hipR: STANCE.hipR, root: STANCE.root } },
]

const DESTROYED = [
  { t: 0, pose: { ...STANCE, chest: [0.5, 0.3, 0.15], head: [0.5, 0.4, 0.2], root: [0, -0.06, 0.12], shoulderL: [-0.3, 0, -0.9], shoulderR: [-0.2, 0, 0.8] } },
  { t: 0.55, pose: { ...DORMANT, root: [0, -0.62, 0.08], hipL: [0.15, 0, -0.08], kneeL: [-1.6, 0, 0], ankleL: [0.7, 0, 0], hipR: [0.35, 0, 0.08], kneeR: [-1.5, 0, 0], ankleR: [0.65, 0, 0], chest: [-0.1, 0.2, 0.1], head: [0.2, 0.3, 0.2] } },
  { t: 1.4, pose: { ...DORMANT, root: [0, -0.66, 0.05], hipL: [0.25, 0, -0.08], kneeL: [-1.65, 0, 0], ankleL: [0.7, 0, 0], hipR: [0.4, 0, 0.1], kneeR: [-1.55, 0, 0], ankleR: [0.65, 0, 0], spine: [-0.55, 0.1, 0.12], chest: [-0.45, 0.1, 0.05], neck: [-0.3, 0, 0], head: [-0.75, 0.25, 0.3], shoulderL: [0.55, 0, 0.05], elbowL: [0.15, 0, 0], shoulderR: [0.75, 0, 0.1], elbowR: [0.1, 0, 0] } },
]

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)

export class DroidAnimator {
  constructor() {
    this.target = createPose(DROID_JOINTS)
    this.current = createPose(DROID_JOINTS)
    this.frags = { boot: {}, windup: {}, strike: {}, recover: {}, stagger: {}, destroyed: {} }
    this.time = 0
    this.phase = 0
    this.moveW = 0
    this.lastStepSign = 1
    this.events = []
  }

  settle(d) {
    this.update(1 / 60, d)
    copyPose(this.current, this.target)
  }

  update(dt, d) {
    this.time += dt
    this.events.length = 0
    const t = this.target
    resetPose(t)
    const s = d.state
    const active = s !== 'dormant' && s !== 'booting' && s !== 'destroyed'

    // Base: combat stance with servo micro-motion and a slow scanning head.
    blendFragment(t, STANCE, 1)
    add(t, 'head', 0.03 * Math.sin(this.time * 1.3), 0.12 * Math.sin(this.time * 0.6), 0)
    add(t, 'chest', 0.012 * Math.sin(this.time * 2.1), 0, 0)

    // Heavy locomotion.
    const pace = d.enraged ? 1.15 : 1
    this.moveW = approach(this.moveW, active && s === 'chase' ? clamp01(d.speed / 1.5) : 0, 5, dt)
    const stepLen = 0.95
    this.phase += ((d.speed * dt) / stepLen) * Math.PI * (s === 'chase' ? 1 : 0)
    const mw = this.moveW
    if (mw > 0.01) {
      const p = this.phase
      const A = 0.42 * mw
      const K = 0.85 * mw
      const sl = Math.sin(p)
      add(t, 'hipL', A * sl)
      add(t, 'hipR', -A * sl)
      add(t, 'kneeL', -K * Math.max(0, Math.cos(p)))
      add(t, 'kneeR', -K * Math.max(0, -Math.cos(p)))
      add(t, 'ankleL', -0.25 * A * sl)
      add(t, 'ankleR', 0.25 * A * sl)
      t.root[1] -= 0.06 * mw * Math.abs(sl)
      add(t, 'pelvis', 0, 0.12 * A * sl, 0.07 * mw * Math.cos(p))
      add(t, 'chest', -0.08 * mw, -0.1 * A * sl, -0.05 * mw * Math.cos(p))
      add(t, 'spine', -0.06 * mw * pace)
      add(t, 'shoulderL', -0.35 * A * sl)
      add(t, 'shoulderR', 0.2 * A * sl)
      // Footfall events at each plant (sin crosses zero).
      const sign = Math.cos(p) >= 0 ? 1 : -1
      if (sign !== this.lastStepSign) this.events.push('step')
      this.lastStepSign = sign
    }

    // Head tracks the target while active.
    if (active) add(t, 'head', clamp(d.aimPitch * 0.5, -0.3, 0.3), clamp(d.lookYaw, -0.7, 0.7), 0)

    let rate = 12
    switch (s) {
      case 'dormant':
        blendFragment(t, DORMANT, 1)
        rate = 3
        break
      case 'booting':
        blendFragment(t, sampleKeys(BOOT, d.stateT, this.frags.boot), 1)
        rate = 9
        break
      case 'windup':
        blendFragment(t, sampleKeys(WINDUP, d.stateT, this.frags.windup), 1)
        add(t, 'head', 0, -0.4, 0) // keep the optic on target while the torso coils
        rate = 14
        break
      case 'strike':
        blendFragment(t, sampleKeys(STRIKE, d.stateT, this.frags.strike), 1)
        rate = 40
        break
      case 'recover':
        blendFragment(t, sampleKeys(RECOVER, d.stateT, this.frags.recover), 1)
        rate = 10
        break
      case 'charging': {
        const c = clamp01(d.stateT / 0.35)
        blendFragment(t, {
          shoulderR: [1.42 + clamp(d.aimPitch, -0.4, 0.4), 0, -0.1],
          elbowR: [0.06, 0, 0],
          shoulderL: [-0.1, 0, -0.45],
          elbowL: [0.4, 0, 0],
          chest: [-0.02, -0.22, 0],
          hipL: [0.32, 0, -0.08], kneeL: [-0.42, 0, 0], ankleL: [0.1, 0, 0],
          hipR: [-0.12, 0, 0.08], kneeR: [-0.28, 0, 0], ankleR: [0.3, 0, 0],
          root: [0, -0.08, 0],
        }, c)
        add(t, 'head', 0, 0.2, 0, c)
        rate = 10
        break
      }
      case 'stagger':
        blendFragment(t, sampleKeys(STAGGER, d.stateT, this.frags.stagger), 1)
        rate = 18
        break
      case 'destroyed':
        blendFragment(t, sampleKeys(DESTROYED, d.stateT, this.frags.destroyed), 1)
        rate = 8
        break
    }

    // Additive layers.
    if (d.fireT < 0.4 && active) {
      const a = (1 - d.fireT / 0.4) ** 2
      add(t, 'shoulderR', 0.3, 0, 0, a)
      add(t, 'elbowR', 0.25, 0, 0, a)
      add(t, 'chest', 0.12, 0.08, 0, a)
      t.root[2] += 0.05 * a
    }
    if (d.hitT < 0.3 && s !== 'destroyed') {
      const a = (1 - d.hitT / 0.3) ** 2
      add(t, 'chest', 0.14, 0.12 * Math.sin(this.time * 37), 0.05, a)
      add(t, 'head', 0.18, 0.15, 0, a)
      t.root[2] += 0.03 * a
    }

    dampPose(this.current, t, rate, dt)
    return this.current
  }
}
