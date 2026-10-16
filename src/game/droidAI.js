import { Vector3 } from 'three'
import { DROID, PLAYER } from './config'
import { circleBlocked, resolveCircle } from './collision'
import { turnTowards } from './combat'

// Finite-state machine for the security droid (a walking biped).
//
//   dormant ─(detect / shot / terminal)→ booting → chase
//   chase → windup → strike → recover → chase        (melee, telegraphed)
//   chase → charging → (fires plasma bolt) → chase    (ranged, telegraphed)
//   chase | windup | recover | charging → stagger     (poise broken by damage)
//   any   → destroyed                                 (health reaches 0)
//
// `ctx` supplies side effects so this module stays free of rendering/store code.
// The animator reads `state`, `stateT`, `speed`, `hitT` and `fireT`.

const desired = new Vector3()
const steer = new Vector3()
const before = new Vector3()
const PROBE_ANGLES = [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8]
const INTERRUPTIBLE = new Set(['chase', 'windup', 'recover', 'charging'])

function steerAround(pos, dir, radius, out) {
  for (const a of PROBE_ANGLES) {
    const c = Math.cos(a)
    const s = Math.sin(a)
    const x = dir.x * c - dir.z * s
    const z = dir.x * s + dir.z * c
    if (!circleBlocked(pos.x + x * 1.6, pos.z + z * 1.6, radius * 0.9)) return out.set(x, 0, z)
  }
  return out.copy(dir)
}

function enter(d, state, timer = 0) {
  d.state = state
  d.stateT = 0
  d.timer = timer
}

/** Register damage on the droid. Returns true if this hit broke its poise (stagger). */
export function applyDroidHit(d, amount) {
  if (d.state === 'destroyed') return false
  d.hitT = 0
  d.alerted = true
  d.poise += amount
  if (d.poise >= DROID.staggerPoise && INTERRUPTIBLE.has(d.state)) {
    d.poise = 0
    enter(d, 'stagger', DROID.staggerTime)
    return true
  }
  return false
}

export function destroyDroid(d) {
  enter(d, 'destroyed')
}

export function updateDroid(d, player, dt, ctx) {
  d.timer -= dt
  d.stateT += dt
  d.hitT += dt
  d.fireT += dt
  d.rangedCooldown = Math.max(0, d.rangedCooldown - dt)
  d.poise = Math.max(0, d.poise - DROID.poiseRegen * dt)
  before.copy(d.position)

  const dx = player.position.x - d.position.x
  const dz = player.position.z - d.position.z
  const dist = Math.hypot(dx, dz)
  const toPlayerAngle = Math.atan2(-dx, -dz)
  const pace = d.enraged ? DROID.enrageMultiplier : 1

  switch (d.state) {
    case 'dormant':
      if (d.alerted || dist < DROID.detectionRange) {
        enter(d, 'booting', DROID.bootTime)
        ctx.onActivate()
      }
      break

    case 'booting':
      // The optic locks on before the body turns.
      if (d.stateT > 0.6) d.facing = turnTowards(d.facing, toPlayerAngle, 2 * dt)
      if (d.timer <= 0) enter(d, 'chase')
      break

    case 'chase': {
      d.facing = turnTowards(d.facing, toPlayerAngle, 4 * dt)
      if (dist < DROID.meleeRange) {
        enter(d, 'windup', DROID.windup / pace)
        ctx.onWindup()
        break
      }
      if (dist > DROID.rangedMin && dist < DROID.rangedMax && d.rangedCooldown <= 0 && ctx.lineOfSight()) {
        enter(d, 'charging', DROID.chargeTime / pace)
        ctx.onCharge()
        break
      }
      if (dist > 1e-3) {
        desired.set(dx / dist, 0, dz / dist)
        steerAround(d.position, desired, DROID.radius, steer)
        d.position.addScaledVector(steer, DROID.chaseSpeed * pace * dt)
        resolveCircle(d.position, DROID.radius)
      }
      break
    }

    case 'windup':
      d.facing = turnTowards(d.facing, toPlayerAngle, 6 * dt)
      if (d.timer <= 0) {
        enter(d, 'strike', DROID.strikeDuration)
        d.hitApplied = false
        if (dist > 1e-3) d.strikeDir.set(dx / dist, 0, dz / dist)
        else d.strikeDir.set(-Math.sin(d.facing), 0, -Math.cos(d.facing))
        ctx.onStrike()
      }
      break

    case 'strike':
      d.position.addScaledVector(d.strikeDir, DROID.lungeSpeed * dt)
      resolveCircle(d.position, DROID.radius)
      if (!d.hitApplied && dist < DROID.radius + PLAYER.radius + 0.6) {
        d.hitApplied = true
        ctx.meleeHit(d.strikeDir)
      }
      if (d.timer <= 0) enter(d, 'recover', DROID.recover / pace)
      break

    case 'recover':
      if (d.timer <= 0) enter(d, 'chase')
      break

    case 'charging':
      d.facing = turnTowards(d.facing, toPlayerAngle, 5 * dt)
      if (d.timer <= 0) {
        ctx.fire()
        d.fireT = 0
        d.rangedCooldown = DROID.rangedCooldown / pace
        enter(d, 'chase')
      }
      break

    case 'stagger':
      if (d.timer <= 0) enter(d, 'chase')
      break

    case 'destroyed':
      d.speed = 0
      return
  }

  d.speed = dt > 0 ? Math.hypot(d.position.x - before.x, d.position.z - before.z) / dt : 0

  // Never let the droid overlap the player's body.
  if (d.state !== 'dormant' && dist < DROID.radius + PLAYER.radius && dist > 1e-3) {
    const push = DROID.radius + PLAYER.radius - dist
    player.position.x += (dx / dist) * push
    player.position.z += (dz / dist) * push
    resolveCircle(player.position, PLAYER.radius)
  }
}
