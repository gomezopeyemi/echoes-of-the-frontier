import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferAttribute, BufferGeometry, CanvasTexture, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace, TextureLoader, Vector2 } from 'three'
import { runtime } from '../game/runtime'
import { MAT, PANEL } from './materials'
import { SPAWN } from './layout'

function makeGroundTexture() {
  const size = 512
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')
  g.fillStyle = '#6b625a'
  g.fillRect(0, 0, size, size)
  for (let i = 0; i < 9000; i++) {
    const v = 70 + Math.random() * 60
    g.fillStyle = `rgba(${v},${v * 0.92},${v * 0.85},${Math.random() * 0.35})`
    const r = Math.random() * 3
    g.fillRect(Math.random() * size, Math.random() * size, r, r)
  }
  for (let i = 0; i < 40; i++) {
    g.strokeStyle = `rgba(30,25,20,${0.1 + Math.random() * 0.2})`
    g.lineWidth = 1 + Math.random() * 2
    g.beginPath()
    let x = Math.random() * size
    let y = Math.random() * size
    g.moveTo(x, y)
    for (let k = 0; k < 6; k++) g.lineTo((x += (Math.random() - 0.5) * 60), (y += (Math.random() - 0.5) * 60))
    g.stroke()
  }
  const tex = new CanvasTexture(c)
  tex.wrapS = tex.wrapT = RepeatWrapping
  tex.repeat.set(18, 18)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

// Fine surface relief for the regolith: the ambientCG Rock020 normal map
// (CC0, public/assets/env/ASSETS.md) tiled every 3 m. three applies each
// map's own repeat, so the colour keeps its broad 14 m variation.
function groundRelief() {
  const t = new TextureLoader().load(`${import.meta.env.BASE_URL}assets/env/ambientcg-rock020/rock020_normal.jpg`)
  t.wrapS = t.wrapT = RepeatWrapping
  t.repeat.set(260 / 3, 260 / 3)
  t.anisotropy = 8
  return t
}

function Ground() {
  const mat = useMemo(
    () => new MeshStandardMaterial({ map: makeGroundTexture(), normalMap: groundRelief(), normalScale: new Vector2(0.7, 0.7), color: '#55504a', roughness: 0.97, metalness: 0.02 }),
    []
  )
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={mat}>
        <planeGeometry args={[260, 260]} />
      </mesh>
      {/* Compound slab and landing pad */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -4]} receiveShadow material={MAT.concrete}>
        <planeGeometry args={[52, 30]} />
      </mesh>
      <mesh position={[SPAWN.x, 0.06, SPAWN.z]} receiveShadow material={PANEL.deck()}>
        <cylinderGeometry args={[4.5, 4.8, 0.12, 48]} />
      </mesh>
      <mesh position={[SPAWN.x, 0.125, SPAWN.z]} rotation={[-Math.PI / 2, 0, 0]} material={MAT.cyan}>
        <ringGeometry args={[3.9, 4.0, 64]} />
      </mesh>
    </>
  )
}

function Sky() {
  const stars = useMemo(() => {
    const n = 1600
    const pos = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const u = Math.random() * Math.PI * 2
      const v = Math.random() * 0.9 + 0.08
      const r = 220
      pos[i * 3] = Math.cos(u) * Math.cos(v * Math.PI * 0.5) * r
      pos[i * 3 + 1] = Math.sin(v * Math.PI * 0.5) * r
      pos[i * 3 + 2] = Math.sin(u) * Math.cos(v * Math.PI * 0.5) * r
    }
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(pos, 3))
    return geo
  }, [])
  const mountains = useMemo(
    () =>
      Array.from({ length: 34 }, (_, i) => {
        const a = (i / 34) * Math.PI * 2 + Math.random() * 0.1
        const r = 110 + Math.random() * 30
        return { x: Math.cos(a) * r, z: Math.sin(a) * r, h: 18 + Math.random() * 30, w: 18 + Math.random() * 20 }
      }),
    []
  )
  const mountainMat = useMemo(() => new MeshStandardMaterial({ color: '#141518', roughness: 1, fog: false, flatShading: true }), [])
  return (
    <>
      <points geometry={stars}>
        <pointsMaterial size={1.4} sizeAttenuation={false} color="#c8d6ff" fog={false} transparent opacity={0.8} />
      </points>
      {/* Gas giant hanging over the ridge */}
      <mesh position={[-90, 70, -170]}>
        <sphereGeometry args={[34, 48, 32]} />
        <meshStandardMaterial color="#c79a6e" emissive="#3a2412" roughness={1} fog={false} />
      </mesh>
      <mesh position={[-90, 70, -170]} rotation={[1.2, 0.3, 0.2]}>
        <ringGeometry args={[42, 58, 96]} />
        <meshBasicMaterial color="#8c7a66" transparent opacity={0.35} side={2} fog={false} />
      </mesh>
      {mountains.map((m, i) => (
        <mesh key={i} position={[m.x, m.h / 2 - 2, m.z]} material={mountainMat}>
          <coneGeometry args={[m.w, m.h, 5]} />
        </mesh>
      ))}
    </>
  )
}

/** Drifting dust motes that follow the player for a sense of air and scale. */
function Dust() {
  const ref = useRef()
  const N = 500
  const SPAN = 30
  const geo = useMemo(() => {
    const pos = new Float32Array(N * 3)
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * SPAN
      pos[i * 3 + 1] = Math.random() * 8
      pos[i * 3 + 2] = (Math.random() - 0.5) * SPAN
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(pos, 3))
    return g
  }, [])
  useFrame((_, dt) => {
    const arr = geo.attributes.position.array
    const p = runtime.player.position
    for (let i = 0; i < N; i++) {
      const ix = i * 3
      arr[ix] += dt * 0.9
      arr[ix + 1] -= dt * 0.12
      arr[ix + 2] += dt * 0.35
      // Wrap around the player
      if (arr[ix] - p.x > SPAN / 2) arr[ix] -= SPAN
      if (arr[ix] - p.x < -SPAN / 2) arr[ix] += SPAN
      if (arr[ix + 2] - p.z > SPAN / 2) arr[ix + 2] -= SPAN
      if (arr[ix + 2] - p.z < -SPAN / 2) arr[ix + 2] += SPAN
      if (arr[ix + 1] < 0) arr[ix + 1] += 8
    }
    geo.attributes.position.needsUpdate = true
  })
  return (
    <points ref={ref} geometry={geo} frustumCulled={false}>
      <pointsMaterial size={0.05} color="#d9c7a8" transparent opacity={0.5} depthWrite={false} />
    </points>
  )
}

export function Environment() {
  return (
    <>
      <color attach="background" args={['#0b0e13']} />
      <fogExp2 attach="fog" args={['#0d1117', 0.021]} />
      <hemisphereLight args={['#5f7290', '#1c1612', 0.7]} />
      <ambientLight intensity={0.08} />
      <directionalLight
        position={[-30, 45, -25]}
        intensity={1.6}
        color="#a9bedb"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
        shadow-camera-near={1}
        shadow-camera-far={140}
        shadow-bias={-0.0004}
      />
      <Ground />
      <Sky />
      <Dust />
    </>
  )
}
