import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Vector3 } from 'three'
import { DROID, PLAYER } from '../game/config'
import { hasLineOfSight, resolveCircle } from '../game/collision'
import { updateDroid } from '../game/droidAI'
import { runtime, spawnProjectile, spawnSpark } from '../game/runtime'
import { useGame } from '../game/store'
import { DroidModel } from '../characters/droid/DroidModel'
import { createDroidDriver } from '../characters/droid/droidAnimator'
import { audio } from '../audio/audio'

const eye = new Vector3()
const aim = new Vector3()
const chest = new Vector3()
const spark = new Vector3()

const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a))

export function SecurityDroid() {
  const root = useRef()
  const model = useRef()
  const driver = useMemo(() => createDroidDriver(), [])
  const local = useRef({ sparkTimer: 0, settled: false }).current

  const ctx = useMemo(
    () => ({
      onActivate: () => {
        useGame.getState().activateEncounter()
        audio.servo()
      },
      onWindup: () => audio.windup(),
      onCharge: () => audio.charge(),
      onStrike: () => audio.strike(),
      lineOfSight: () => {
        const d = runtime.droid
        const p = runtime.player.position
        return hasLineOfSight(eye.set(d.position.x, DROID.eyeHeight, d.position.z), chest.set(p.x, 1.1, p.z))
      },
      meleeHit: (dir) => {
        const p = runtime.player
        chest.set(p.position.x, 1.1, p.position.z)
        if (p.invulnerable) {
          spawnSpark(chest, '#7fd8ff', 0.7)
          return
        }
        const { blocked } = useGame.getState().damagePlayer(DROID.meleeDamage, { blockable: true })
        spawnSpark(chest, blocked ? '#9cc8ff' : '#ff5a3c', blocked ? 1.2 : 1.4)
        p.position.addScaledVector(dir, DROID.knockback * (blocked ? 0.4 : 1))
        resolveCircle(p.position, PLAYER.radius)
      },
      fire: () => {
        const d = runtime.droid
        const p = runtime.player.position
        aim.set(p.x, 1.1, p.z).sub(d.muzzle).normalize().multiplyScalar(DROID.projectileSpeed)
        spawnProjectile(d.muzzle, aim)
        audio.enemyShot()
      },
    }),
    []
  )

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const d = runtime.droid
    const p = runtime.player.position
    if (useGame.getState().phase === 'playing') updateDroid(d, runtime.player, dt, ctx)

    root.current.position.copy(d.position)
    root.current.rotation.y = d.facing

    // AI state → animation driver.
    const dx = p.x - d.position.x
    const dz = p.z - d.position.z
    const dist = Math.hypot(dx, dz)
    driver.state = d.state
    driver.stateT = d.stateT
    driver.speed = d.state === 'chase' ? d.speed : 0
    driver.lookYaw = wrapAngle(Math.atan2(-dx, -dz) - d.facing)
    driver.aimPitch = Math.atan2(1.1 - DROID.eyeHeight, Math.max(dist, 0.5))
    driver.hitT = d.hitT
    driver.fireT = d.fireT
    driver.enraged = d.enraged

    const api = model.current
    if (!api) return
    const events = api.update(dt, driver, !local.settled)
    local.settled = true
    // Keep the gameplay muzzle on the cannon so bolts leave the barrel.
    api.muzzle.getWorldPosition(d.muzzle)
    if (events.includes('step')) audio.droidStep(Math.max(0, 1 - dist / 30))

    if (d.state === 'destroyed' && d.stateT < 4) {
      local.sparkTimer -= dt
      if (local.sparkTimer <= 0) {
        local.sparkTimer = 0.25 + Math.random() * 0.4
        spark.set(d.position.x + (Math.random() - 0.5) * 0.8, 0.6 + Math.random() * 1.0, d.position.z + (Math.random() - 0.5) * 0.8)
        spawnSpark(spark, '#ffb347', 0.9)
      }
    }
  })

  return (
    <group ref={root}>
      <DroidModel apiRef={model} />
    </group>
  )
}
