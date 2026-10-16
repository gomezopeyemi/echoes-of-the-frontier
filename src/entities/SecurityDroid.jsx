import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, Vector3 } from 'three'
import { DROID, PLAYER } from '../game/config'
import { hasLineOfSight, resolveCircle } from '../game/collision'
import { updateDroid } from '../game/droidAI'
import { runtime, spawnProjectile, spawnSpark } from '../game/runtime'
import { useGame } from '../game/store'
import { MAT, glow } from '../world/materials'
import { audio } from '../audio/audio'

const eyePos = new Vector3()
const aim = new Vector3()
const chest = new Vector3()

const EYE = {
  dormant: new Color(0.25, 0.02, 0.02),
  booting: new Color(3, 0.6, 0.1),
  chase: new Color(5, 0.35, 0.25),
  recover: new Color(2, 0.2, 0.15),
  windup: new Color(8, 2.5, 2),
  strike: new Color(9, 3, 3),
  charging: new Color(6, 2.2, 0.2),
  destroyed: new Color(0, 0, 0),
}

export function SecurityDroid() {
  const root = useRef()
  const body = useRef()
  const ring = useRef()
  const armL = useRef()
  const armR = useRef()
  const light = useRef()
  const eyeMat = useMemo(() => glow(0.25, 0.02, 0.02), [])
  const thrusterMat = useMemo(() => glow(0.6, 1.6, 3, { transparent: true, opacity: 0 }), [])
  const sparkTimer = useRef(0)

  const ctx = useMemo(
    () => ({
      onActivate: () => useGame.getState().activateEncounter(),
      onWindup: () => audio.windup(),
      onCharge: () => audio.charge(),
      onStrike: () => audio.strike(),
      lineOfSight: () => {
        const d = runtime.droid
        const p = runtime.player.position
        return hasLineOfSight(d.position, chest.set(p.x, 1.1, p.z))
      },
      meleeHit: (dir) => {
        const p = runtime.player
        if (p.invulnerable) {
          spawnSpark(chest.set(p.position.x, 1.1, p.position.z), '#7fd8ff', 0.7)
          return
        }
        useGame.getState().damagePlayer(DROID.meleeDamage)
        spawnSpark(chest.set(p.position.x, 1.1, p.position.z), '#ff5a3c', 1.4)
        p.position.addScaledVector(dir, DROID.knockback)
        resolveCircle(p.position, PLAYER.radius)
      },
      fire: () => {
        const d = runtime.droid
        const p = runtime.player.position
        eyePos.set(-Math.sin(d.facing), 0, -Math.cos(d.facing)).multiplyScalar(0.9).add(d.position)
        aim.set(p.x, 1.1, p.z).sub(eyePos).normalize().multiplyScalar(DROID.projectileSpeed)
        spawnProjectile(eyePos, aim)
        audio.enemyShot()
      },
    }),
    []
  )

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const t = state.clock.elapsedTime
    const d = runtime.droid
    if (useGame.getState().phase === 'playing') updateDroid(d, runtime.player, dt, ctx)

    const alive = d.state !== 'destroyed'
    const hovering = alive && d.state !== 'dormant'
    root.current.position.copy(d.position)
    root.current.position.y += hovering ? Math.sin(t * 2.2) * 0.08 : 0
    root.current.rotation.y = d.facing

    // Telegraphs: wind-up leans back and flares the eye; strike lunges forward.
    let lean = 0
    if (d.state === 'windup') lean = 0.35
    else if (d.state === 'strike') lean = -0.5
    else if (d.state === 'charging') lean = 0.1
    else if (!alive) lean = 0.7
    body.current.rotation.x += (lean - body.current.rotation.x) * (1 - Math.exp(-14 * dt))
    body.current.rotation.z = alive ? 0 : 0.35

    const spread = d.state === 'windup' ? 1.0 : d.state === 'strike' ? 0.1 : 0.5
    armL.current.rotation.z += (spread - armL.current.rotation.z) * (1 - Math.exp(-12 * dt))
    armR.current.rotation.z = -armL.current.rotation.z
    ring.current.rotation.z += dt * (d.state === 'charging' ? 14 : hovering ? 2 : 0.2)

    const c = EYE[d.state] ?? EYE.chase
    const pulse = d.state === 'windup' || d.state === 'charging' ? 0.6 + 0.4 * Math.sin(t * 30) : d.state === 'booting' ? (Math.sin(t * 18) > 0 ? 1 : 0.2) : 1
    eyeMat.color.copy(c).multiplyScalar(pulse)
    light.current.color.setRGB(Math.min(1, c.r), Math.min(1, c.g), Math.min(1, c.b))
    light.current.intensity = alive ? (d.state === 'dormant' ? 0.5 : 18 * pulse) : 0
    thrusterMat.opacity = hovering ? 0.6 + Math.random() * 0.3 : 0

    if (!alive) {
      sparkTimer.current -= dt
      if (sparkTimer.current <= 0 && d.timer > -4) {
        sparkTimer.current = 0.25 + Math.random() * 0.4
        spawnSpark(eyePos.copy(d.position).add(aim.set(Math.random() - 0.5, Math.random() * 0.6, Math.random() - 0.5)), '#ffb347', 0.9)
      }
      d.timer -= dt
    }
  })

  return (
    <group ref={root}>
      <group ref={body}>
        <mesh castShadow material={MAT.droidShell}>
          <sphereGeometry args={[0.8, 32, 24]} />
        </mesh>
        <mesh castShadow position={[0, 0, -0.1]} material={MAT.droidCore}>
          <cylinderGeometry args={[0.83, 0.83, 0.32, 32]} />
        </mesh>
        <mesh ref={ring} rotation={[Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} material={MAT.droidCore}>
          <torusGeometry args={[1.02, 0.07, 10, 40]} />
        </mesh>
        <mesh position={[0, 0.08, -0.74]} rotation={[Math.PI / 2, 0, 0]} material={MAT.droidCore}>
          <cylinderGeometry args={[0.3, 0.34, 0.2, 24]} />
        </mesh>
        <mesh position={[0, 0.08, -0.82]} material={eyeMat}>
          <sphereGeometry args={[0.17, 20, 16]} />
        </mesh>
        <pointLight ref={light} position={[0, 0.1, -1.3]} distance={10} decay={2} />
        <group ref={armL} position={[-0.8, -0.1, 0]}>
          <mesh castShadow position={[-0.35, -0.25, -0.2]} rotation={[0.3, 0, 0.3]} material={MAT.droidShell}>
            <boxGeometry args={[0.14, 0.9, 0.3]} />
          </mesh>
          <mesh position={[-0.48, -0.66, -0.32]} rotation={[0.3, 0, 0.3]} material={MAT.red}>
            <boxGeometry args={[0.04, 0.3, 0.04]} />
          </mesh>
        </group>
        <group ref={armR} position={[0.8, -0.1, 0]}>
          <mesh castShadow position={[0.35, -0.25, -0.2]} rotation={[0.3, 0, -0.3]} material={MAT.droidShell}>
            <boxGeometry args={[0.14, 0.9, 0.3]} />
          </mesh>
          <mesh position={[0.48, -0.66, -0.32]} rotation={[0.3, 0, -0.3]} material={MAT.red}>
            <boxGeometry args={[0.04, 0.3, 0.04]} />
          </mesh>
        </group>
        <mesh position={[0, -0.85, 0]} rotation={[Math.PI, 0, 0]} material={thrusterMat}>
          <coneGeometry args={[0.28, 0.6, 16, 1, true]} />
        </mesh>
      </group>
    </group>
  )
}
