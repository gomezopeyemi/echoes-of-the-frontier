import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CylinderGeometry } from 'three'
import { runtime } from '../game/runtime'
import { glow } from '../world/materials'

const tracerGeo = new CylinderGeometry(0.02, 0.02, 1, 6).rotateX(Math.PI / 2)

/** Weapon tracers and impact sparks, rendered from pooled runtime data. */
export function Effects() {
  const tracerRefs = useRef([])
  const sparkRefs = useRef([])
  const tracerMats = useMemo(() => runtime.tracers.map(() => glow(1.2, 4, 6, { transparent: true, depthWrite: false })), [])
  const sparkMats = useMemo(() => runtime.sparks.map(() => glow(4, 3, 1, { transparent: true, depthWrite: false })), [])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    runtime.tracers.forEach((t, i) => {
      const m = tracerRefs.current[i]
      if (!m) return
      t.life = Math.max(0, t.life - dt * 12)
      m.visible = t.life > 0
      if (!m.visible) return
      m.position.lerpVectors(t.from, t.to, 0.5)
      m.lookAt(t.to)
      m.scale.set(1, 1, t.from.distanceTo(t.to))
      tracerMats[i].opacity = t.life
    })
    runtime.sparks.forEach((s, i) => {
      const m = sparkRefs.current[i]
      if (!m) return
      s.life = Math.max(0, s.life - dt * 4)
      m.visible = s.life > 0
      if (!m.visible) return
      m.position.copy(s.pos)
      m.scale.setScalar(s.scale * (0.15 + (1 - s.life) * 0.5))
      sparkMats[i].color.set(s.color).multiplyScalar(5)
      sparkMats[i].opacity = s.life
    })
  })

  return (
    <>
      {runtime.tracers.map((_, i) => (
        <mesh key={`t${i}`} ref={(el) => (tracerRefs.current[i] = el)} geometry={tracerGeo} material={tracerMats[i]} visible={false} />
      ))}
      {runtime.sparks.map((_, i) => (
        <mesh key={`s${i}`} ref={(el) => (sparkRefs.current[i] = el)} material={sparkMats[i]} visible={false}>
          <icosahedronGeometry args={[1, 0]} />
        </mesh>
      ))}
    </>
  )
}
