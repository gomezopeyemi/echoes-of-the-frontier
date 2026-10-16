import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { DoubleSide, Ray, Sphere, Vector3 } from 'three'
import { CAMERA, DROID, HAZARD_DPS, PLAYER } from '../game/config'
import { raycastWorld, resolveCircle } from '../game/collision'
import { calculateDamage, Cooldown, turnTowards } from '../game/combat'
import { input } from '../game/input'
import { runtime, spawnSpark, spawnTracer } from '../game/runtime'
import { useGame } from '../game/store'
import { BEACON, HAZARD, LOG_SPOTS, TERMINAL } from '../world/layout'
import { MAT, glow } from '../world/materials'
import { audio } from '../audio/audio'

const fwd = new Vector3()
const right = new Vector3()
const move = new Vector3()
const target = new Vector3()
const pivot = new Vector3()
const camDir = new Vector3()
const camPos = new Vector3()
const muzzlePos = new Vector3()
const hitPoint = new Vector3()
const ray = new Ray()
const droidSphere = new Sphere(new Vector3(), DROID.radius)
const flashMat = glow(3, 4, 5, { transparent: true, opacity: 0, side: DoubleSide, depthWrite: false })

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

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
  const legL = useRef()
  const legR = useRef()
  const muzzle = useRef()
  const flash = useRef()
  const camera = useThree((s) => s.camera)
  const s = useRef({
    fireCd: new Cooldown(PLAYER.fireCooldown),
    dodgeCd: new Cooldown(PLAYER.dodgeCooldown),
    dodgeTime: 0,
    dodgeDir: new Vector3(),
    facing: 0,
    aimTimer: 0,
    flashT: 0,
    hazardAcc: 0,
    stride: 0,
    camDist: CAMERA.distance,
  }).current

  function shoot(game) {
    camera.getWorldDirection(camDir)
    ray.set(camera.position, camDir)
    let t = raycastWorld(ray, PLAYER.weaponRange) ?? PLAYER.weaponRange
    let hitDroid = false
    const d = runtime.droid
    if (d.state !== 'destroyed') {
      droidSphere.center.copy(d.position)
      if (ray.intersectSphere(droidSphere, hitPoint)) {
        const td = hitPoint.distanceTo(ray.origin)
        if (td < t) {
          t = td
          hitDroid = true
        }
      }
    }
    ray.at(t, hitPoint)
    muzzle.current.getWorldPosition(muzzlePos)
    spawnTracer(muzzlePos, hitPoint)
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

    // --- Move / dodge ---
    let moving = false
    if (playing) {
      s.fireCd.tick(dt)
      s.dodgeCd.tick(dt)
      const f = (input.isDown('KeyW') || input.isDown('ArrowUp') ? 1 : 0) - (input.isDown('KeyS') || input.isDown('ArrowDown') ? 1 : 0)
      const r = (input.isDown('KeyD') || input.isDown('ArrowRight') ? 1 : 0) - (input.isDown('KeyA') || input.isDown('ArrowLeft') ? 1 : 0)
      move.set(0, 0, 0).addScaledVector(fwd, f).addScaledVector(right, r)
      moving = move.lengthSq() > 0
      if (moving) move.normalize()

      if (input.consumePressed('Space') && s.dodgeCd.ready()) {
        s.dodgeDir.copy(moving ? move : fwd)
        s.dodgeTime = PLAYER.dodgeDuration
        s.dodgeCd.trigger()
        audio.dodge()
      }

      if (s.dodgeTime > 0) {
        s.dodgeTime -= dt
        p.invulnerable = true
        p.velocity.copy(s.dodgeDir).multiplyScalar(PLAYER.dodgeSpeed)
      } else {
        p.invulnerable = false
        const sprint = input.isDown('ShiftLeft') || input.isDown('ShiftRight')
        target.copy(move).multiplyScalar(sprint && f > 0 && !input.fire ? PLAYER.sprintSpeed : PLAYER.walkSpeed)
        p.velocity.lerp(target, 1 - Math.exp(-PLAYER.acceleration * dt))
      }
      p.position.addScaledVector(p.velocity, dt)
      resolveCircle(p.position, PLAYER.radius)
      p.dodgeReady = s.dodgeCd.progress
      p.moving = moving
    }

    // --- Facing: toward aim while shooting, otherwise toward movement ---
    s.aimTimer = Math.max(0, s.aimTimer - dt)
    if (playing && input.fire) s.aimTimer = 0.7
    const speed = Math.hypot(p.velocity.x, p.velocity.z)
    if (s.aimTimer > 0) s.facing = turnTowards(s.facing, cam.yaw, 18 * dt)
    else if (speed > 0.5) s.facing = turnTowards(s.facing, Math.atan2(-p.velocity.x, -p.velocity.z), 10 * dt)
    else if (game.phase === 'title') s.facing = 0

    // --- Model pose ---
    root.current.position.copy(p.position)
    model.current.rotation.y = s.facing
    s.stride += speed * dt * 1.6
    const swing = Math.sin(s.stride) * Math.min(1, speed / 5) * 0.6
    legL.current.rotation.x = swing
    legR.current.rotation.x = -swing
    const dodging = s.dodgeTime > 0
    model.current.position.y = dodging ? -0.35 : Math.abs(Math.sin(s.stride)) * 0.05 * Math.min(1, speed / 5)
    model.current.rotation.x = dodging ? -0.5 : game.phase === 'defeat' ? -1.4 : -Math.min(speed / 40, 0.15)
    if (game.phase === 'defeat') model.current.position.y = 0.2

    // --- Fire ---
    if (playing && input.fire && s.fireCd.ready() && !dodging) {
      model.current.updateMatrixWorld(true)
      shoot(game)
      s.fireCd.trigger()
    }
    s.flashT = Math.max(0, s.flashT - dt)
    flashMat.opacity = s.flashT > 0 ? 1 : 0
    flash.current.rotation.z = Math.random() * Math.PI

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
          spawnSpark(pivot.set(p.position.x, 0.4, p.position.z), '#9fd8ff', 0.8)
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
      <group ref={model}>
        <group ref={legL} position={[-0.15, 0.9, 0]}>
          <mesh castShadow position={[0, -0.45, 0]} material={MAT.suit}>
            <boxGeometry args={[0.2, 0.9, 0.24]} />
          </mesh>
        </group>
        <group ref={legR} position={[0.15, 0.9, 0]}>
          <mesh castShadow position={[0, -0.45, 0]} material={MAT.suit}>
            <boxGeometry args={[0.2, 0.9, 0.24]} />
          </mesh>
        </group>
        <mesh castShadow position={[0, 1.22, 0]} material={MAT.armor}>
          <boxGeometry args={[0.58, 0.66, 0.34]} />
        </mesh>
        <mesh position={[0, 1.3, -0.176]} material={MAT.cyan}>
          <boxGeometry args={[0.22, 0.04, 0.01]} />
        </mesh>
        <mesh castShadow position={[0, 1.24, 0.26]} material={MAT.hullDark}>
          <boxGeometry args={[0.46, 0.52, 0.18]} />
        </mesh>
        <mesh position={[0.12, 1.4, 0.36]} material={MAT.amber}>
          <boxGeometry args={[0.05, 0.12, 0.01]} />
        </mesh>
        <mesh castShadow position={[0, 1.74, 0]} material={MAT.armor}>
          <sphereGeometry args={[0.2, 18, 14]} />
        </mesh>
        <mesh position={[0, 1.75, -0.14]} material={MAT.cyan}>
          <boxGeometry args={[0.27, 0.07, 0.1]} />
        </mesh>
        <mesh castShadow position={[-0.38, 1.18, 0]} rotation={[0.2, 0, 0.1]} material={MAT.suit}>
          <boxGeometry args={[0.16, 0.6, 0.18]} />
        </mesh>
        <mesh castShadow position={[0.34, 1.28, -0.2]} rotation={[-1.25, 0, 0]} material={MAT.suit}>
          <boxGeometry args={[0.16, 0.55, 0.18]} />
        </mesh>
        <group position={[0.3, 1.3, -0.5]}>
          <mesh castShadow material={MAT.gun}>
            <boxGeometry args={[0.1, 0.15, 0.6]} />
          </mesh>
          <mesh position={[0, 0.05, -0.05]} material={MAT.cyan}>
            <boxGeometry args={[0.02, 0.02, 0.3]} />
          </mesh>
          <group ref={muzzle} position={[0, 0, -0.33]}>
            <mesh ref={flash} material={flashMat}>
              <planeGeometry args={[0.35, 0.35]} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  )
}
