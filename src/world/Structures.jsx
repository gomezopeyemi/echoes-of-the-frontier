import { Suspense, useMemo, useRef } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import { Box3, BoxGeometry, CylinderGeometry, MeshStandardMaterial, Vector3 } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { BOUNDS, LIGHT_POLES, OBSTACLES } from './layout'
import { MAT, PANEL, glow } from './materials'
import { boxUV, cylinderUV } from './pbr'
import { getRockMaterial, makeRockGeometry } from './rocks'

// Level architecture. Each obstacle type is a small component drawn inside
// the collider that layout.js defines, so visuals can change without
// touching collision. Containers are licensed models (Godot TPS demo, CC-BY
// 3.0); habitats and tanks are primitives surfaced with licensed tiling PBR
// sets; boulders are generated meshes with ambientCG Rock020 (CC0).
// Sources and licences: public/assets/env/ASSETS.md.

function Hab({ x, z, w, d, h }) {
  const doorZ = d / 2 + 0.01
  const body = useMemo(() => boxUV(new BoxGeometry(w, h, d), w, h, d, PANEL.rivetTile), [w, h, d])
  const roof = useMemo(() => boxUV(new BoxGeometry(w + 0.4, 0.4, d + 0.4), w + 0.4, 0.4, d + 0.4, PANEL.gunMetalTile), [w, d])
  return (
    <group position={[x, 0, z]}>
      <mesh castShadow receiveShadow position={[0, h / 2, 0]} material={PANEL.rivet()} geometry={body} />
      <mesh castShadow position={[0, h + 0.2, 0]} material={PANEL.gunMetal()} geometry={roof} />
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

/** Original primitive container: loading fallback, and rollback if the model is removed. */
function ProceduralContainer({ x, z, w, d, h, color }) {
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

// Layout colour -> container model. The models carry their own painted
// livery; grey slots use the red-striped container because the grey texture
// set was authored for a different (open-ended) mesh.
const CONTAINER_MODELS = {
  '#7a3b22': 'container_brown.glb',
  '#2f5560': 'container_teal.glb',
  '#4c4f55': 'container_red.glb',
}
const containerUrl = (color) => `${import.meta.env.BASE_URL}assets/env/tps-demo/${CONTAINER_MODELS[color] ?? 'container_red.glb'}`

function ContainerModel({ x, z, w, d, color }) {
  const gltf = useLoader(GLTFLoader, containerUrl(color))
  const { object, scale, offset } = useMemo(() => {
    const object = gltf.scene.clone()
    object.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true
        o.receiveShadow = true
      }
    })
    // Fit the model to the collider: width exactly, height at the same scale,
    // length to the collider but never stretched more than 12% beyond that.
    const box = new Box3().setFromObject(object)
    const size = box.getSize(new Vector3())
    const centre = box.getCenter(new Vector3())
    const width = Math.min(w, d)
    const length = Math.max(w, d)
    const sw = width / size.x
    const sl = Math.min(length / size.z, sw * 1.12)
    return { object, scale: [sw, sw, sl], offset: [-centre.x, -box.min.y, -centre.z] }
  }, [gltf, w, d])
  // Models are authored long along Z; turn them to match the collider.
  return (
    <group position={[x, 0, z]} rotation={[0, w > d ? Math.PI / 2 : 0, 0]}>
      <group scale={scale}>
        <primitive object={object} position={offset} />
      </group>
    </group>
  )
}

function Container(props) {
  return (
    <Suspense fallback={<ProceduralContainer {...props} />}>
      <ContainerModel {...props} />
    </Suspense>
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
  const shell = useMemo(() => cylinderUV(new CylinderGeometry(r, r, h, 28), r, h, PANEL.gunMetalTile), [r, h])
  return (
    <group position={[x, 0, z]}>
      <mesh castShadow receiveShadow position={[0, h / 2, 0]} material={PANEL.tank()} geometry={shell} />
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
  // Seeded from the position so each boulder keeps its shape between runs.
  const geometry = useMemo(() => makeRockGeometry(Math.abs(Math.round(x * 31 + z * 17)) + 1), [x, z])
  return (
    <mesh castShadow receiveShadow position={[x, h * 0.4, z]} scale={[w / 1.8, h / 1.35, d / 1.8]} rotation={[0, x * 0.3, 0]} geometry={geometry} material={getRockMaterial()} />
  )
}

/** Non-colliding scenery boulders beyond the playable perimeter (cheaper: lower detail, no shadow casting). */
const SCENERY_ROCKS = [
  [-52, 6, 7, 4.5, 6],
  [-58, -22, 10, 6, 8],
  [-49, 38, 6, 3.5, 5],
  [55, -4, 9, 5, 7],
  [51, 30, 6, 4, 6],
  [60, -36, 11, 7, 9],
  [-20, -55, 8, 5, 6],
  [24, -58, 9, 6, 7],
  [-30, 56, 7, 4, 5],
  [18, 54, 8, 5, 6],
]

function SceneryRocks() {
  const geos = useMemo(() => SCENERY_ROCKS.map((_, i) => makeRockGeometry(900 + i * 37, 3)), [])
  return SCENERY_ROCKS.map(([x, z, w, h, d], i) => (
    <mesh key={i} receiveShadow position={[x, h * 0.35, z]} scale={[w / 1.8, h / 1.35, d / 1.8]} rotation={[0, i * 1.7, 0]} geometry={geos[i]} material={getRockMaterial()} />
  ))
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
      <SceneryRocks />
    </>
  )
}
