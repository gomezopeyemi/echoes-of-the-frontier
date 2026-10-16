import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Ray, Sphere, Vector3 } from 'three'
import { CAMERA, DROID, HAZARD_DPS, PLAYER } from '../game/config'
import { raycastWorld, resolveCircle } from '../game/collision'
import { calculateDamage, Cooldown, inMeleeArc, raycastSpheres, turnTowards } from '../game/combat'
import { input } from '../game/input'
import { runtime, spawnSpark, spawnTracer } from '../game/runtime'
import { useGame } from '../game/store'
import { BEACON, HAZARD, LOG_SPOTS, TERMINAL } from '../world/layout'
import { OperativeModel } from '../characters/operative/OperativeModel'
import { createOperativeDriver } from '../characters/operative/operativeAnimator'
import { audio } from '../audio/audio'

const fwd = new Vector3()
const right = new Vector3()
const move = new Vector3()
const target = new Vector3()
const pivot = new Vector3()
const camDir = new Vector3()
const camPos = new Vector3()
const hitPoint = new Vector3()
const tmp = new Vector3()
const ray = new Ray()
const hitSphere = new Sphere()

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a))

function nearestInteractable(pos, stage, collected) {
  if (stage === 'deploy' && Math.hypot(pos.x - TERMINAL.x, pos.z - TERMINAL.z) < PLAYER.interactRange) return 'terminal'
  for (const log of LOG_SPOTS) {
    if (!collected.includes(log.id) && Math.hypot(pos.x - log.x, pos.z - log.z) < PLAYER.interactRange) return log.id
  }
  return null
}

export function Player() {
  const root = useRef()
  const model = useRef()
  const camera = useThree((s) => s.camera)
  const driver = useMemo(() => createOperativeDriver(), [])
  const s = useRef({
    fireCd: new Cooldown(PLAYER.fireCooldown),
    dodgeCd: new Cooldown(PLAYER.dodgeCooldown),
    bladeCd: new Cooldown(PLAYER.bladeCooldown),
    dodgeTime: 0,
    dashT: null,
    dodgeDir: new Vector3(),
    attackT: null,
    attackHitDone: false,
    facing: 0,
    aimTimer: 0,
    flashT: 0,
    hazardAcc: 0,
    camDist: CAMERA.distance,
    settled: false,
  }).current

  function shoot(game) {
    camera.getWorldDirection(camDir)
    ray.set(camera.position, camDir)
    let t = raycastWorld(ray, PLAYER.weaponRange) ?? PLAYER.weaponRange
    let hitDroid = false
    const d = runtime.droid
    if (d.state !== 'destroyed') {
      const td = raycastSpheres(ray, d.position, DROID.hitSpheres, hitSphere, hitPoint)
      if (td !== null && td < t) {
        t = td
        hitDroid = true
      }
    }
    ray.at(t, hitPoint)
    spawnTracer(runtime.player.muzzle, hitPoint)
    s.flashT = 0.06
    audio.shot()
    if (hitDroid) {
      const dmg = calculateDamage({
        base: PLAYER.weaponDamage,
        distance: runtime.player.position.distanceTo(hitPoint),
        critChance: PLAYER.critChance,
        critMultiplier: PLAYER.critMultiplier,
      })
      game.damageDroid(dmg.amount, dmg.crit)
      spawnSpark(hitPoint, dmg.crit ? '#fff1a8' : '#ffb347', dmg.crit ? 1.7 : 1)
      audio.hit(dmg.crit)
    } else if (t < PLAYER.weaponRange) {
      spawnSpark(hitPoint, '#8fd3ff', 0.5)
    }
    game.registerShot(hitDroid)
  }

  /** Single hit check per swing, at the strike frame of the animation. */
  function bladeHit(game) {
    const d = runtime.droid
    const p = runtime.player.position
    if (d.state === 'destroyed') return
    if (!inMeleeArc(p, s.facing, d.position, PLAYER.bladeRange + DROID.radius * 0.5, PLAYER.bladeArcCos)) return
    const dmg = calculateDamage({ base: PLAYER.bladeDamage, critChance: PLAYER.critChance, critMultiplier: 1.5 })
    game.damageDroid(dmg.amount, dmg.crit)
    tmp.set(d.position.x, 1.4, d.position.z).lerp(pivot.set(p.x, 1.4, p.z), 0.35)
    spawnSpark(tmp, '#9cc8ff', dmg.crit ? 0.8 : 0.6)
    audio.bladeHit()
  }

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const game = useGame.getState()
    const p = runtime.player
    const cam = runtime.camera
    const playing = game.phase === 'playing'

    // --- Look ---
    const { dx, dy } = input.consumeMouse()
    if (playing) {
      cam.yaw -= dx * CAMERA.sensitivity
      cam.pitch = clamp(cam.pitch - dy * CAMERA.sensitivity, CAMERA.minPitch, CAMERA.maxPitch)
    } else if (game.phase === 'title') {
      cam.yaw += dt * 0.06 // slow cinematic orbit behind the title screen
    }
    fwd.set(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw))
    right.set(Math.cos(cam.yaw), 0, -Math.sin(cam.yaw))

    // --- Actions & movement ---
    const attacking = s.attackT !== null
    const dodging = s.dodgeTime > 0
    p.hitT += dt
    if (playing) {
      s.fireCd.tick(dt)
      s.dodgeCd.tick(dt)
      s.bladeCd.tick(dt)
      const f = (input.isDown('KeyW') || input.isDown('ArrowUp') ? 1 : 0) - (input.isDown('KeyS') || input.isDown('ArrowDown') ? 1 : 0)
      const r = (input.isDown('KeyD') || input.isDown('ArrowRight') ? 1 : 0) - (input.isDown('KeyA') || input.isDown('ArrowLeft') ? 1 : 0)
      move.set(0, 0, 0).addScaledVector(fwd, f).addScaledVector(right, r)
      const moving = move.lengthSq() > 0
      if (moving) move.normalize()

      p.guarding = input.isDown('KeyQ') && !dodging && !attacking

      const bladePressed = input.consumePressed('Mouse2') || input.consumePressed('KeyF')
      if (bladePressed && !attacking && !dodging && !p.guarding && s.bladeCd.ready()) {
        s.attackT = 0
        s.attackHitDone = false
        s.bladeCd.trigger()
        s.aimTimer = 0.7
        audio.bladeIgnite()
      }

      if (input.consumePressed('Space') && s.dodgeCd.ready() && !attacking) {
        s.dodgeDir.copy(moving ? move : fwd)
        s.dodgeTime = PLAYER.dodgeDuration
        s.dashT = 0
        s.dodgeCd.trigger()
        p.guarding = false
        audio.dodge()
      }

      if (s.dodgeTime > 0) {
        s.dodgeTime -= dt
        p.invulnerable = true
        p.velocity.copy(s.dodgeDir).multiplyScalar(PLAYER.dodgeSpeed)
      } else {
        p.invulnerable = false
        const sprint = (input.isDown('ShiftLeft') || input.isDown('ShiftRight')) && f > 0 && !input.fire && !p.guarding && !attacking
        let speed = sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed
        if (p.guarding) speed *= PLAYER.guardSpeedMultiplier
        if (attacking) speed *= 0.4
        target.copy(move).multiplyScalar(speed)
        // Short lunge into the swing.
        if (attacking && s.attackT > 0.08 && s.attackT < 0.24) target.addScaledVector(fwd, PLAYER.bladeLunge)
        p.velocity.lerp(target, 1 - Math.exp(-PLAYER.acceleration * dt))
      }
      p.position.addScaledVector(p.velocity, dt)
      resolveCircle(p.position, PLAYER.radius)
      p.dodgeReady = s.dodgeCd.progress
      p.moving = moving
    } else {
      p.velocity.multiplyScalar(Math.exp(-10 * dt))
      p.guarding = false
    }
    if (game.phase === 'defeat') p.defeatT += dt

    // --- Facing: aim direction while shooting/attacking/guarding, dash direction while dashing, else movement ---
    s.aimTimer = Math.max(0, s.aimTimer - dt)
    if (playing && input.fire) s.aimTimer = 0.7
    const speed = Math.hypot(p.velocity.x, p.velocity.z)
    if (s.dodgeTime > 0) s.facing = turnTowards(s.facing, Math.atan2(-s.dodgeDir.x, -s.dodgeDir.z), 25 * dt)
    else if (s.aimTimer > 0 || p.guarding || s.attackT !== null) s.facing = turnTowards(s.facing, cam.yaw, 18 * dt)
    else if (speed > 0.5) s.facing = turnTowards(s.facing, Math.atan2(-p.velocity.x, -p.velocity.z), 10 * dt)
    else if (game.phase === 'title') s.facing = 0

    // --- Blade timeline (gameplay clock that the animation follows) ---
    if (s.attackT !== null) {
      s.attackT += dt
      if (!s.attackHitDone && s.attackT >= PLAYER.bladeHitTime && playing) {
        s.attackHitDone = true
        bladeHit(game)
      }
      if (s.attackT > PLAYER.bladeDuration) s.attackT = null
    }
    if (s.dashT !== null) {
      s.dashT += dt
      if (s.dashT > PLAYER.dodgeDuration + 0.15) s.dashT = null
    }

    // --- Character model ---
    root.current.position.copy(p.position)
    root.current.rotation.y = s.facing
    driver.speed = speed
    driver.moveAngle = speed > 0.3 ? wrapAngle(Math.atan2(-p.velocity.x, -p.velocity.z) - s.facing) : 0
    driver.aiming = playing && s.aimTimer > 0 && s.attackT === null && !p.guarding
    driver.aimPitch = cam.pitch
    driver.attackT = p.attackT = s.attackT
    p.dashT = s.dashT
    driver.attackDuration = PLAYER.bladeDuration
    driver.guarding = playing && p.guarding
    driver.dashT = s.dashT
    driver.dashDuration = PLAYER.dodgeDuration
    driver.hitT = p.hitT
    driver.defeatT = game.phase === 'defeat' ? p.defeatT : null
    const api = model.current
    if (api) {
      api.update(dt, driver, !s.settled)
      s.settled = true
      root.current.updateMatrixWorld(true)
      api.muzzle.getWorldPosition(p.muzzle)
    }

    // --- Fire (after the pose update so the muzzle is where the gun is this frame) ---
    if (playing && input.fire && s.fireCd.ready() && !dodging && s.attackT === null && !p.guarding && api) {
      shoot(game)
      s.fireCd.trigger()
    }
    s.flashT = Math.max(0, s.flashT - dt)
    api?.setFlash(s.flashT > 0)

    // --- Interaction, hazard, extraction ---
    if (playing) {
      const near = nearestInteractable(p.position, game.stage, game.collectedLogs)
      game.setPrompt(near)
      if (near && input.consumePressed('KeyE')) {
        if (near === 'terminal') game.accessTerminal()
        else game.collectLog(near)
      }
      input.consumePressed('KeyE')

      const inHazard = Math.abs(p.position.x - HAZARD.x) < HAZARD.w / 2 && Math.abs(p.position.z - HAZARD.z) < HAZARD.d / 2
      if (inHazard) {
        game.warnOnce('hazard')
        s.hazardAcc += dt
        if (s.hazardAcc >= 0.25) {
          s.hazardAcc -= 0.25
          game.damagePlayer(HAZARD_DPS * 0.25)
          spawnSpark(tmp.set(p.position.x, 0.4, p.position.z), '#9fd8ff', 0.8)
        }
      } else s.hazardAcc = 0

      if (game.stage === 'extract' && Math.hypot(p.position.x - BEACON.x, p.position.z - BEACON.z) < 2.6) {
        game.endMission('victory')
      }
    }

    // --- Third-person camera with collision ---
    camDir.set(-Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), -Math.cos(cam.yaw) * Math.cos(cam.pitch))
    pivot.copy(p.position).addScaledVector(right, CAMERA.shoulder)
    pivot.y += CAMERA.height
    ray.set(pivot, camPos.copy(camDir).negate())
    const blocked = raycastWorld(ray, CAMERA.distance + 0.3)
    const wanted = blocked !== null ? Math.max(0.6, blocked - 0.3) : CAMERA.distance
    // Pull in instantly when blocked, ease back out when clear.
    s.camDist = wanted < s.camDist ? wanted : s.camDist + (wanted - s.camDist) * (1 - Math.exp(-4 * dt))
    camPos.copy(pivot).addScaledVector(camDir, -s.camDist)
    camPos.y = Math.max(0.3, camPos.y)
    camera.position.copy(camPos)
    camera.lookAt(camPos.add(camDir))
  })

  return (
    <group ref={root}>
      <OperativeModel apiRef={model} />
    </group>
  )
}
