import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MeshStandardMaterial } from 'three'
import { BOUNDS, LIGHT_POLES, OBSTACLES } from './layout'
import { MAT, glow } from './materials'

// Placeholder architecture built from primitives. Each type is a small
// component so it can be swapped for a licensed/modelled asset later.

function Hab({ x, z, w, d, h }) {
  const doorZ = d / 2 + 0.01
  return (
    <group position={[x, 0, z]}>
      <mesh castShadow receiveShadow position={[0, h / 2, 0]} material={MAT.hull}>
        <boxGeometry args={[w, h, d]} />
      </mesh>
      <mesh castShadow position={[0, h + 0.2, 0]} material={MAT.hullDark}>
        <boxGeometry args={[w + 0.4, 0.4, d + 0.4]} />
      </mesh>
      {/* Window band */}
      <mesh position={[0, h * 0.62, doorZ]} material={MAT.windowCyan}>
        <planeGeometry args={[w * 0.7, 0.35]} />
      </mesh>
      <mesh position={[0, h * 0.62, -doorZ]} rotation={[0, Math.PI, 0]} material={MAT.windowCyan}>
        <planeGeometry args={[w * 0.7, 0.35]} />
      </mesh>
      {/* Sealed door with warning light */}
      <mesh position={[w * 0.28, 1.2, doorZ]} material={MAT.hullDark}>
        <planeGeometry args={[1.5, 2.4]} />
      </mesh>
      <mesh position={[w * 0.28, 2.55, doorZ + 0.01]} material={MAT.ice}>
        <planeGeometry args={[1.5, 0.08]} />
      </mesh>
      {/* Roof vents */}
      <mesh castShadow position={[-w * 0.25, h + 0.75, 0]} material={MAT.hullDark}>
        <cylinderGeometry args={[0.5, 0.6, 0.8, 12]} />
      </mesh>
      <mesh castShadow position={[w * 0.2, h + 0.6, -d * 0.2]} material={MAT.trim}>
        <boxGeometry args={[1.4, 0.5, 1]} />
      </mesh>
    </group>
  )
}

function Wall({ x, z, w, d, h }) {
  return (
    <group position={[x, 0, z]}>
      <mesh castShadow receiveShadow position={[0, h / 2, 0]} material={MAT.concrete}>
        <boxGeometry args={[w, h, d]} />
      </mesh>
      <mesh position={[0, 0.6, d / 2 + 0.01]} material={MAT.hazardStripe}>
        <planeGeometry args={[w, 0.3]} />
      </mesh>
      <mesh position={[0, h - 0.3, d / 2 + 0.01]} material={MAT.ice}>
        <planeGeometry args={[w * 0.9, 0.05]} />
      </mesh>
    </group>
  )
}

function Container({ x, z, w, d, h, color }) {
  const mat = useMemo(() => new MeshStandardMaterial({ color, roughness: 0.65, metalness: 0.55 }), [color])
  const alongX = w > d
  const len = alongX ? w : d
  const ribs = 6
  return (
    <group position={[x, 0, z]}>
      <mesh castShadow receiveShadow position={[0, h / 2, 0]} material={mat}>
        <boxGeometry args={[w, h, d]} />
      </mesh>
      {Array.from({ length: ribs }, (_, i) => {
        const o = -len / 2 + (len / (ribs - 1)) * i
        return (
          <mesh key={i} position={alongX ? [o, h / 2, 0] : [0, h / 2, o]} material={mat}>
            <boxGeometry args={alongX ? [0.08, h * 0.96, d + 0.06] : [w + 0.06, h * 0.96, 0.08]} />
          </mesh>
        )
      })}
    </group>
  )
}

function Crate({ x, z, w, d, h }) {
  return (
    <group position={[x, 0, z]}>
      <mesh castShadow receiveShadow position={[0, h / 2, 0]} material={MAT.crate}>
        <boxGeometry args={[w, h, d]} />
      </mesh>
      <mesh position={[0, h * 0.7, d / 2 + 0.01]} material={MAT.green}>
        <planeGeometry args={[w * 0.4, 0.04]} />
      </mesh>
    </group>
  )
}

function Tank({ x, z, w, h }) {
  const r = w / 2
  return (
    <group position={[x, 0, z]}>
      <mesh castShadow receiveShadow position={[0, h / 2, 0]} material={MAT.hull}>
        <cylinderGeometry args={[r, r, h, 28]} />
      </mesh>
      <mesh castShadow position={[0, h, 0]} material={MAT.hull}>
        <sphereGeometry args={[r, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      {[0.3, 0.7].map((t) => (
        <mesh key={t} position={[0, h * t, 0]} material={MAT.hazardStripe}>
          <cylinderGeometry args={[r + 0.03, r + 0.03, 0.18, 28]} />
        </mesh>
      ))}
    </group>
  )
}

function Tower({ x, z, w, h }) {
  const beacon = useRef()
  useFrame(({ clock }) => {
    beacon.current.visible = Math.sin(clock.elapsedTime * 3) > 0.6
  })
  return (
    <group position={[x, 0, z]}>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} castShadow position={[(sx * w) / 2.4, h / 2, (sz * w) / 2.4]} material={MAT.hullDark}>
            <boxGeometry args={[0.18, h, 0.18]} />
          </mesh>
        ))
      )}
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} position={[0, 1.5 + i * 2.2, 0]} material={MAT.hullDark}>
          <boxGeometry args={[w, 0.12, w]} />
        </mesh>
      ))}
      <mesh castShadow position={[0.6, h - 1.2, 0]} rotation={[0, 0, -0.9]} material={MAT.hull}>
        <cylinderGeometry args={[1.4, 0.2, 0.6, 24, 1, true]} />
      </mesh>
      <mesh ref={beacon} position={[0, h + 0.2, 0]} material={MAT.red}>
        <sphereGeometry args={[0.18, 12, 10]} />
      </mesh>
    </group>
  )
}

function Generator({ x, z, w, d, h }) {
  return (
    <group position={[x, 0, z]}>
      <mesh castShadow receiveShadow position={[0, h / 2, 0]} material={MAT.hullDark}>
        <boxGeometry args={[w, h, d]} />
      </mesh>
      {[-0.8, 0, 0.8].map((o) => (
        <mesh key={o} castShadow position={[o, h + 0.3, 0]} material={MAT.hull}>
          <cylinderGeometry args={[0.25, 0.25, 0.6, 12]} />
        </mesh>
      ))}
      <mesh position={[0, h * 0.5, d / 2 + 0.01]} material={MAT.amber}>
        <planeGeometry args={[w * 0.6, 0.1]} />
      </mesh>
    </group>
  )
}

function Rock({ x, z, w, d, h }) {
  return (
    <mesh castShadow receiveShadow position={[x, h * 0.35, z]} scale={[w / 2, h / 1.6, d / 2]} rotation={[0.2, x * 0.3, 0.1]} material={MAT.rock}>
      <dodecahedronGeometry args={[1, 0]} />
    </mesh>
  )
}

const RENDERERS = { hab: Hab, wall: Wall, container: Container, crate: Crate, tank: Tank, tower: Tower, generator: Generator, rock: Rock }

function LightPole({ x, z, color }) {
  const lamp = useMemo(() => {
    const m = glow(1, 1, 1)
    m.color.set(color).multiplyScalar(4)
    return m
  }, [color])
  return (
    <group position={[x, 0, z]}>
      <mesh castShadow position={[0, 2.5, 0]} material={MAT.hullDark}>
        <cylinderGeometry args={[0.08, 0.12, 5, 8]} />
      </mesh>
      <mesh position={[0, 5.05, 0]} material={lamp}>
        <boxGeometry args={[0.5, 0.12, 0.5]} />
      </mesh>
      <pointLight position={[0, 4.6, 0]} color={color} intensity={45} distance={20} decay={2} />
    </group>
  )
}

/** Low barrier marking the playable perimeter (collision is handled by BOUNDS). */
function Perimeter() {
  const L = BOUNDS * 2
  const sides = [
    [0, -BOUNDS, L, 0.4],
    [0, BOUNDS, L, 0.4],
    [-BOUNDS, 0, 0.4, L],
    [BOUNDS, 0, 0.4, L],
  ]
  return sides.map(([x, z, w, d], i) => (
    <group key={i}>
      <mesh castShadow receiveShadow position={[x, 0.5, z]} material={MAT.hullDark}>
        <boxGeometry args={[w, 1, d]} />
      </mesh>
      <mesh position={[x, 1.02, z]} material={MAT.red}>
        <boxGeometry args={[w === 0.4 ? 0.05 : w, 0.03, d === 0.4 ? 0.05 : d]} />
      </mesh>
    </group>
  ))
}

export function Structures() {
  return (
    <>
      {OBSTACLES.map((o, i) => {
        const C = RENDERERS[o.type]
        return <C key={i} {...o} />
      })}
      {LIGHT_POLES.map((l, i) => (
        <LightPole key={i} {...l} />
      ))}
      <Perimeter />
    </>
  )
}
