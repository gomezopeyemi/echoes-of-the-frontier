import { add, approach, blendFragment, clamp01, copyPose, createPose, dampPose, resetPose, sampleKeys, set } from '../pose'

// Procedural animation for the Frontier Operative.
//
// The animator does not decide *what* happens: gameplay code fills in a
// driver object every frame (speed, move direction, attack clock, guard,
// dash clock, hit clock, defeat clock) and this module turns that state into
// a pose. Attack timing therefore always matches the real hit window.
//
// Rotation conventions (model faces -Z, character's right is +X):
//   limbs hanging down: +X rotation swings forward, knees bend with -X
//   spine/chest/head:   -X bends forward
//   arms: +Z moves the left arm inward (toward +X), -Z moves the right arm inward

export const OPERATIVE_JOINTS = [
  'pelvis', 'spine', 'chest', 'neck', 'head',
  'shoulderL', 'elbowL', 'wristL', 'shoulderR', 'elbowR', 'wristR',
  'hipL', 'kneeL', 'ankleL', 'hipR', 'kneeR', 'ankleR',
]

/** Gameplay → animation contract. All clocks are seconds since the action began, or null. */
export function createOperativeDriver() {
  return {
    speed: 0, // horizontal speed, m/s
    moveAngle: 0, // velocity direction relative to facing, radians (0 = forward)
    aiming: false, // pistol raised
    aimPitch: 0, // camera pitch, radians (+ = up)
    attackT: null, // energy blade swing clock
    attackDuration: 0.5,
    guarding: false,
    dashT: null,
    dashDuration: 0.3,
    hitT: 99, // time since last hit taken
    defeatT: null,
  }
}

const SLASH = [
  { t: 0, pose: { shoulderL: [0.45, 0, -0.25], elbowL: [0.7, 0, 0], wristL: [0, 0, 0], spine: [0, 0, 0], chest: [0, 0, 0], root: [0, 0, 0] } },
  // Wind-up: blade raised high over the left shoulder, torso coiled.
  { t: 0.13, pose: { shoulderL: [2.7, 0, -0.55], elbowL: [1.25, 0, 0], wristL: [-0.5, 0, 0], spine: [0.02, 0.15, 0], chest: [0.06, 0.45, 0], root: [0, -0.03, 0] } },
  // Strike: diagonal cut down and across the body, weight forward.
  { t: 0.25, pose: { shoulderL: [0.75, 0, 1.0], elbowL: [0.2, 0, 0], wristL: [-1.25, 0, 0], spine: [-0.12, -0.25, 0], chest: [-0.12, -0.5, 0], root: [0, -0.09, -0.05] } },
  // Recovery back toward ready.
  { t: 0.5, pose: { shoulderL: [0.55, 0, -0.1], elbowL: [0.8, 0, 0], wristL: [-0.5, 0, 0], spine: [-0.04, 0, 0], chest: [0, 0, 0], root: [0, -0.02, 0] } },
]

const SLASH_LEGS = { hipL: [0.4, 0, 0], kneeL: [-0.45, 0, 0], ankleL: [0.1, 0, 0], hipR: [-0.25, 0, 0], kneeR: [-0.2, 0, 0], ankleR: [0.3, 0, 0] }

const DEFEAT = [
  { t: 0, pose: { root: [0, -0.06, 0], hipL: [0.35, 0, 0], kneeL: [-0.6, 0, 0], ankleL: [0.2, 0, 0], hipR: [0.2, 0, 0], kneeR: [-0.5, 0, 0], ankleR: [0.2, 0, 0], spine: [-0.1, 0, 0], chest: [0.15, 0, 0], head: [0.25, 0, 0], shoulderL: [0.2, 0, -0.35], elbowL: [0.4, 0, 0], shoulderR: [0.2, 0, 0.35], elbowR: [0.4, 0, 0] } },
  // Knees give out.
  { t: 0.45, pose: { root: [0, -0.44, 0.06], hipL: [0.12, 0, -0.04], kneeL: [-1.55, 0, 0], ankleL: [0.65, 0, 0], hipR: [0.2, 0, 0.04], kneeR: [-1.5, 0, 0], ankleR: [0.6, 0, 0], spine: [-0.18, 0, 0], chest: [-0.15, 0, 0], head: [-0.25, 0, 0], shoulderL: [0.25, 0, -0.08], elbowL: [0.25, 0, 0], shoulderR: [0.25, 0, 0.08], elbowR: [0.25, 0, 0] } },
  // Slump forward.
  { t: 1.3, pose: { root: [0, -0.46, 0.04], hipL: [0.2, 0, -0.04], kneeL: [-1.6, 0, 0], ankleL: [0.65, 0, 0], hipR: [0.25, 0, 0.04], kneeR: [-1.55, 0, 0], ankleR: [0.6, 0, 0], spine: [-0.45, 0, 0.05], chest: [-0.35, 0, 0], head: [-0.6, 0, 0.1], shoulderL: [0.55, 0, 0.1], elbowL: [0.15, 0, 0], shoulderR: [0.45, 0, -0.05], elbowR: [0.2, 0, 0] } },
]

const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a))
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)

export class OperativeAnimator {
  constructor() {
    this.target = createPose(OPERATIVE_JOINTS)
    this.current = createPose(OPERATIVE_JOINTS)
    this.slashFrag = {}
    this.defeatFrag = {}
    this.time = 0
    this.phase = 0
    this.moveW = 0
    this.runW = 0
    this.aimW = 0
    this.guardW = 0
    this.lowerYaw = 0
    this.bladeOn = 0
    this.cape = { swing: 0.1, sway: 0 }
  }

  /** Snap to the current target (used on spawn so there is no blend from the bind pose). */
  settle(driver) {
    this.update(1 / 60, driver)
    copyPose(this.current, this.target)
  }

  update(dt, d) {
    this.time += dt
    const t = this.target
    resetPose(t)

    // ---------- locomotion ----------
    const speed = d.defeatT !== null ? 0 : d.speed
    this.moveW = approach(this.moveW, clamp01(speed / 1.6), 6, dt)
    this.runW = approach(this.runW, clamp01((speed - 5.6) / 2.4), 4, dt)
    const backwards = Math.abs(d.moveAngle) > 1.9
    const legYaw = clamp(backwards ? wrapAngle(d.moveAngle - Math.PI) : d.moveAngle, -1.05, 1.05)
    this.lowerYaw += ((this.moveW > 0.2 && d.dashT === null ? legYaw : 0) - this.lowerYaw) * (1 - Math.exp(-10 * dt))
    const stepLen = 0.72 + 0.35 * this.runW
    this.phase += ((speed * dt) / stepLen) * Math.PI * (backwards ? -1 : 1)

    const mw = this.moveW
    const rw = this.runW
    const A = (0.4 + 0.42 * rw) * mw
    const K = (0.75 + 0.8 * rw) * mw
    const p = this.phase
    const legL = Math.sin(p)
    const legR = -legL
    const kneeL = -(0.06 + K * Math.max(0, Math.cos(p)))
    const kneeR = -(0.06 + K * Math.max(0, -Math.cos(p)))
    const breathe = Math.sin(this.time * 1.7)

    // Idle stance: relaxed, weight slightly on the right leg, pistol at low ready.
    set(t, 'hipL', -0.03 + A * legL, 0, -0.04)
    set(t, 'hipR', 0.02 + A * legR, 0, 0.03)
    set(t, 'kneeL', kneeL - 0.04)
    set(t, 'kneeR', kneeR)
    set(t, 'ankleL', -(A * legL + kneeL) * 0.55)
    set(t, 'ankleR', -(A * legR + kneeR) * 0.55)
    t.root[1] = -0.012 * (1 - mw) - (0.03 + 0.03 * rw) * mw * Math.abs(Math.sin(p))
    set(t, 'pelvis', 0, this.lowerYaw + 0.1 * A * legL, 0.03 * mw * Math.cos(p) + 0.02 * (1 - mw))
    set(t, 'spine', -0.04 * mw - 0.2 * rw + 0.012 * breathe, -this.lowerYaw * 0.55, 0)
    set(t, 'chest', 0.015 * breathe, -this.lowerYaw * 0.45 - 0.08 * A * legL, -0.02 * (1 - mw))
    set(t, 'neck', 0, 0, 0)
    set(t, 'head', 0.02 + 0.1 * rw, 0, 0)
    const armSwing = 0.75 * A
    set(t, 'shoulderL', 0.05 + armSwing * legR, 0, -0.13 - 0.05 * rw)
    set(t, 'shoulderR', 0.08 + armSwing * legL, 0, 0.12 + 0.05 * rw)
    set(t, 'elbowL', 0.2 + 1.0 * rw + 0.1 * mw)
    set(t, 'elbowR', 0.35 + 0.9 * rw)
    set(t, 'wristL', 0, 0, 0)
    set(t, 'wristR', 0.1, 0, 0)

    // ---------- upper-body overlays ----------
    const pitch = clamp(d.aimPitch, -0.8, 0.6)
    this.aimW = approach(this.aimW, d.aiming && d.dashT === null && d.defeatT === null ? 1 : 0, 9, dt)
    this.guardW = approach(this.guardW, d.guarding && d.defeatT === null ? 1 : 0, 7, dt)

    if (this.aimW > 0) {
      blendFragment(t, {
        shoulderR: [1.52 + pitch, 0, -0.12],
        elbowR: [0.06, 0, 0],
        wristR: [0.02, 0, 0],
        shoulderL: [1.15 + pitch, 0, 0.62],
        elbowL: [0.55, 0, 0],
        wristL: [0.2, 0, 0],
      }, this.aimW)
      add(t, 'chest', pitch * 0.3, 0.12, 0, this.aimW)
      add(t, 'head', pitch * 0.35, -0.1, 0, this.aimW)
    }

    if (this.guardW > 0) {
      blendFragment(t, {
        shoulderL: [1.05, 0, 0.35],
        elbowL: [1.55, 0, 0],
        wristL: [0.2, 0, 0.9],
        shoulderR: [0.45, 0, 0.05],
        elbowR: [1.0, 0, 0],
        spine: [-0.1, 0.1, 0],
        head: [-0.05, 0, 0],
        hipL: [0.3 + A * legL * 0.5, 0, -0.06],
        kneeL: [-0.55, 0, 0],
        ankleL: [0.25, 0, 0],
        hipR: [0.05 + A * legR * 0.5, 0, 0.06],
        kneeR: [-0.45, 0, 0],
        ankleR: [0.35, 0, 0],
        root: [0, -0.07, 0],
      }, this.guardW)
    }

    const attacking = d.attackT !== null && d.attackT <= d.attackDuration
    if (attacking) {
      const w = d.attackT > d.attackDuration - 0.1 ? (d.attackDuration - d.attackT) / 0.1 : 1
      blendFragment(t, sampleKeys(SLASH, d.attackT, this.slashFrag), w)
      blendFragment(t, SLASH_LEGS, w * 0.7 * (1 - mw * 0.5))
    }

    const bladeWanted = attacking || d.guarding
    this.bladeOn = approach(this.bladeOn, bladeWanted && d.defeatT === null ? 1 : 0, bladeWanted ? 9 : 4, dt)

    // ---------- full-body actions ----------
    if (d.dashT !== null && d.dashT <= d.dashDuration + 0.1) {
      const w = clamp01(Math.sin((Math.PI * clamp01(d.dashT / (d.dashDuration + 0.1)))) * 1.6)
      blendFragment(t, {
        root: [0, -0.2, 0],
        spine: [-0.5, 0, 0],
        chest: [-0.15, 0, 0],
        head: [0.35, 0, 0],
        hipL: [0.95, 0, -0.05],
        kneeL: [-1.25, 0, 0],
        ankleL: [0.2, 0, 0],
        hipR: [-0.35, 0, 0.05],
        kneeR: [-0.9, 0, 0],
        ankleR: [0.5, 0, 0],
        shoulderL: [-0.5, 0, -0.35],
        elbowL: [0.6, 0, 0],
        shoulderR: [-0.4, 0, 0.35],
        elbowR: [0.7, 0, 0],
      }, w)
    }

    if (d.hitT < 0.45) {
      const a = (1 - d.hitT / 0.45) ** 2
      add(t, 'spine', 0.28, 0, 0.06, a)
      add(t, 'chest', 0.22, 0.1, 0, a)
      add(t, 'head', 0.35, 0, 0.1, a)
      add(t, 'shoulderL', -0.25, 0, -0.2, a)
      add(t, 'shoulderR', -0.25, 0, 0.2, a)
      t.root[2] += 0.05 * a
    }

    if (d.defeatT !== null) {
      const w = clamp01(d.defeatT / 0.2)
      blendFragment(t, sampleKeys(DEFEAT, d.defeatT, this.defeatFrag), w)
      this.aimW = 0
    }

    const rate = attacking ? 30 : d.dashT !== null && d.dashT < d.dashDuration ? 24 : d.defeatT !== null ? 9 : 16
    dampPose(this.current, t, rate, dt)

    // ---------- secondary motion for the mantle ----------
    const legBack = Math.max(0, -this.current.joints.hipL[0], -this.current.joints.hipR[0])
    // Trails behind with speed and is pushed back by the rear leg so it never clips through the legs.
    // Gravity: when the torso pitches forward the cloth should still hang down, so counter most of the lean.
    const lean = this.current.joints.spine[0] + this.current.joints.chest[0]
    const swingTarget = Math.max(-0.65, Math.min(0.42, 0.04 + 0.07 * mw + 0.1 * rw + legBack * 0.25 + (d.dashT !== null ? 0.15 : 0) + lean * 0.7))
    this.cape.swing += (swingTarget - this.cape.swing) * (1 - Math.exp(-5 * dt))
    this.cape.sway += (-this.lowerYaw * 0.12 + Math.sin(this.time * 0.9) * 0.015 - this.cape.sway) * (1 - Math.exp(-4 * dt))
    return this.current
  }
}
