import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Vector3 } from 'three'
import { DROID } from '../game/config'
import { pointInColliders } from '../game/collision'
import { runtime, spawnSpark } from '../game/runtime'
import { useGame } from '../game/store'
import { glow } from '../world/materials'

const boltMat = glow(6, 1.6, 0.3)
const haloMat = glow(2, 0.4, 0.1, { transparent: true, opacity: 0.35, depthWrite: false })
const chest = new Vector3()

/** Enemy plasma bolts: a fixed pool of meshes driven by runtime.projectiles. */
export function Projectiles() {
  const refs = useRef([])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const game = useGame.getState()
    const playing = game.phase === 'playing'
    const player = runtime.player

    runtime.projectiles.forEach((pr, i) => {
      const mesh = refs.current[i]
      if (!mesh) return
      if (pr.active && playing) {
        pr.pos.addScaledVector(pr.vel, dt)
        pr.life -= dt
        chest.set(player.position.x, 1.1, player.position.z)
        if (pr.pos.distanceTo(chest) < 0.75 && !player.invulnerable) {
          game.damagePlayer(DROID.projectileDamage)
          spawnSpark(pr.pos, '#ff7a3c', 1.2)
          pr.active = false
        } else if (pr.life <= 0 || pr.pos.y < 0 || pointInColliders(pr.pos)) {
          spawnSpark(pr.pos, '#ff9a3c', 0.7)
          pr.active = false
        }
      }
      mesh.visible = pr.active
      if (pr.active) mesh.position.copy(pr.pos)
    })
  })

  return runtime.projectiles.map((_, i) => (
    <group key={i} ref={(el) => (refs.current[i] = el)} visible={false}>
      <mesh material={boltMat}>
        <sphereGeometry args={[0.16, 12, 10]} />
      </mesh>
      <mesh material={haloMat}>
        <sphereGeometry args={[0.38, 12, 10]} />
      </mesh>
    </group>
  ))
}
