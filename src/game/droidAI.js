import { Vector3 } from 'three'
import { DROID, PLAYER } from './config'
import { circleBlocked, resolveCircle } from './collision'
import { turnTowards } from './combat'

// Finite-state machine for the security droid.
//
//   dormant ─(detect / shot / terminal)→ booting → chase
//   chase → windup → strike → recover → chase        (melee, telegraphed)
//   chase → charging → (fires plasma bolt) → chase    (ranged, telegraphed)
//   any   → destroyed                                 (health reaches 0)
//
// `ctx` supplies side effects so this module stays free of rendering/store code.

const desired = new Vector3()
const steer = new Vector3()
const PROBE_ANGLES = [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8]

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

const damp = (current, target, rate, dt) => current + (target - current) * (1 - Math.exp(-rate * dt))

export function updateDroid(d, player, dt, ctx) {
  d.timer -= dt
  d.rangedCooldown = Math.max(0, d.rangedCooldown - dt)

  const dx = player.position.x - d.position.x
  const dz = player.position.z - d.position.z
  const dist = Math.hypot(dx, dz)
  const toPlayerAngle = Math.atan2(-dx, -dz)
  const pace = d.enraged ? DROID.enrageMultiplier : 1

  switch (d.state) {
    case 'dormant':
      if (d.alerted || dist < DROID.detectionRange) {
        d.state = 'booting'
        d.timer = DROID.bootTime
        ctx.onActivate()
      }
      break

    case 'booting':
      d.position.y = damp(d.position.y, DROID.hoverHeight, 2.5, dt)
      d.facing = turnTowards(d.facing, toPlayerAngle, 2 * dt)
      if (d.timer <= 0) d.state = 'chase'
      break

    case 'chase': {
      d.position.y = damp(d.position.y, DROID.hoverHeight, 4, dt)
      d.facing = turnTowards(d.facing, toPlayerAngle, 5 * dt)
      if (dist < DROID.meleeRange) {
        d.state = 'windup'
        d.timer = DROID.windup / pace
        ctx.onWindup()
        break
      }
      if (dist > DROID.rangedMin && dist < DROID.rangedMax && d.rangedCooldown <= 0 && ctx.lineOfSight()) {
        d.state = 'charging'
        d.timer = DROID.chargeTime / pace
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
      d.facing = turnTowards(d.facing, toPlayerAngle, 8 * dt)
      if (d.timer <= 0) {
        d.state = 'strike'
        d.timer = DROID.strikeDuration
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
      if (d.timer <= 0) {
        d.state = 'recover'
        d.timer = DROID.recover / pace
      }
      break

    case 'recover':
      if (d.timer <= 0) d.state = 'chase'
      break

    case 'charging':
      d.facing = turnTowards(d.facing, toPlayerAngle, 6 * dt)
      if (d.timer <= 0) {
        ctx.fire()
        d.rangedCooldown = DROID.rangedCooldown / pace
        d.state = 'chase'
      }
      break

    case 'destroyed':
      d.position.y = Math.max(DROID.restHeight - 0.15, d.position.y - 2.5 * dt)
      return
  }

  // Never let the droid overlap the player's body.
  if (d.state !== 'dormant' && dist < DROID.radius + PLAYER.radius && dist > 1e-3) {
    const push = DROID.radius + PLAYER.radius - dist
    player.position.x += (dx / dist) * push
    player.position.z += (dz / dist) * push
    resolveCircle(player.position, PLAYER.radius)
  }
}
