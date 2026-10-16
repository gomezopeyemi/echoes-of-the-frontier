import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, DoubleSide } from 'three'
import { objectiveTarget } from '../game/mission'
import { runtime, spawnSpark } from '../game/runtime'
import { useGame } from '../game/store'
import { BEACON, HAZARD, LOG_SPOTS, TERMINAL } from './layout'
import { MAT, glow } from './materials'

function Terminal() {
  const screen = useMemo(() => glow(0.4, 2.2, 3), [])
  const stage = useGame((s) => s.stage)
  useFrame(({ clock }) => {
    const flicker = Math.random() > 0.97 ? 0.3 : 1
    const k = stage === 'deploy' ? (0.8 + 0.2 * Math.sin(clock.elapsedTime * 3)) * flicker : 0.35
    screen.color.setRGB(stage === 'deploy' ? 0.4 * k : 3 * k, 2.2 * k, 3 * k)
  })
  return (
    <group position={[TERMINAL.x, 0, TERMINAL.z]}>
      <mesh castShadow position={[0, 0.55, 0]} material={MAT.hullDark}>
        <boxGeometry args={[0.8, 1.1, 0.5]} />
      </mesh>
      <mesh castShadow position={[0, 1.25, 0.05]} rotation={[-0.5, 0, 0]} material={MAT.hull}>
        <boxGeometry args={[0.9, 0.6, 0.08]} />
      </mesh>
      <mesh position={[0, 1.27, 0.1]} rotation={[-0.5, 0, 0]} material={screen}>
        <planeGeometry args={[0.78, 0.48]} />
      </mesh>
      <pointLight position={[0, 1.4, 0.6]} color="#6fd6ff" intensity={6} distance={6} decay={2} />
    </group>
  )
}

function DataLog({ id, x, z }) {
  const ref = useRef()
  const collected = useGame((s) => s.collectedLogs.includes(id))
  useFrame(({ clock }) => {
    if (!ref.current) return
    ref.current.rotation.y = clock.elapsedTime * 1.2
    ref.current.position.y = 1 + Math.sin(clock.elapsedTime * 2 + x) * 0.1
  })
  if (collected) return null
  return (
    <group position={[x, 0, z]}>
      <mesh ref={ref} material={MAT.green}>
        <octahedronGeometry args={[0.18, 0]} />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} material={MAT.green}>
        <ringGeometry args={[0.45, 0.5, 32]} />
      </mesh>
      <pointLight position={[0, 1, 0]} color="#7dffb0" intensity={3} distance={4} decay={2} />
    </group>
  )
}

function Hazard() {
  const light = useRef()
  const arc = useRef()
  const timer = useRef(0)
  useFrame((_, dt) => {
    timer.current -= dt
    const on = Math.random() > 0.6
    light.current.intensity = on ? 14 + Math.random() * 20 : 2
    arc.current.visible = on
    arc.current.rotation.y = Math.random() * Math.PI
    if (timer.current <= 0) {
      timer.current = 0.3 + Math.random() * 0.8
      spawnSpark(
        { x: HAZARD.x + (Math.random() - 0.5) * HAZARD.w, y: 0.2, z: HAZARD.z + (Math.random() - 0.5) * HAZARD.d },
        '#9fd8ff',
        0.6
      )
    }
  })
  return (
    <group position={[HAZARD.x, 0, HAZARD.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} material={MAT.hazardStripe}>
        <planeGeometry args={[HAZARD.w, HAZARD.d]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} material={MAT.concrete}>
        <planeGeometry args={[HAZARD.w - 0.4, HAZARD.d - 0.4]} />
      </mesh>
      <mesh castShadow position={[-1.2, 0.3, 0]} rotation={[0, 0, Math.PI / 2 - 0.2]} material={MAT.hullDark}>
        <cylinderGeometry args={[0.25, 0.25, 2.4, 12]} />
      </mesh>
      <mesh castShadow position={[1.4, 0.25, 0.3]} rotation={[0.3, 0, Math.PI / 2 + 0.3]} material={MAT.hullDark}>
        <cylinderGeometry args={[0.25, 0.25, 1.8, 12]} />
      </mesh>
      <mesh ref={arc} position={[0.1, 0.45, 0.1]} material={MAT.cyan}>
        <boxGeometry args={[1.6, 0.03, 0.03]} />
      </mesh>
      <pointLight ref={light} position={[0, 0.8, 0]} color="#8fd0ff" distance={9} decay={2} />
    </group>
  )
}

function Beacon() {
  const beam = useRef()
  const light = useRef()
  const active = useGame((s) => s.stage === 'extract' || s.stage === 'complete')
  const beamMat = useMemo(
    () => glow(0.4, 3, 1.2, { transparent: true, opacity: 0.25, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, fog: false }),
    []
  )
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    beam.current.visible = active
    beamMat.opacity = 0.18 + 0.08 * Math.sin(t * 3)
    light.current.intensity = active ? 30 + 10 * Math.sin(t * 3) : 2
  })
  return (
    <group position={[BEACON.x, 0, BEACON.z]}>
      <mesh receiveShadow position={[0, 0.1, 0]} material={MAT.hullDark}>
        <cylinderGeometry args={[3, 3.2, 0.2, 40]} />
      </mesh>
      <mesh position={[0, 0.21, 0]} rotation={[-Math.PI / 2, 0, 0]} material={active ? MAT.green : MAT.red}>
        <ringGeometry args={[2.5, 2.6, 64]} />
      </mesh>
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2
        return (
          <mesh key={i} castShadow position={[Math.cos(a) * 2.4, 1.2, Math.sin(a) * 2.4]} material={MAT.hull}>
            <boxGeometry args={[0.25, 2.4, 0.25]} />
          </mesh>
        )
      })}
      <mesh ref={beam} position={[0, 40, 0]} material={beamMat}>
        <cylinderGeometry args={[0.9, 1.4, 80, 24, 1, true]} />
      </mesh>
      <pointLight ref={light} position={[0, 2, 0]} color="#6dffa6" distance={18} decay={2} />
    </group>
  )
}

/** Floating chevron above the current objective. */
function ObjectiveMarker() {
  const ref = useRef()
  useFrame(({ clock }) => {
    const { stage, phase } = useGame.getState()
    const target = objectiveTarget(stage, runtime.droid.position)
    ref.current.visible = !!target && phase === 'playing'
    if (!target) return
    const lift = stage === 'encounter' ? 2.75 : 3
    ref.current.position.set(target.x, lift + Math.sin(clock.elapsedTime * 2.5) * 0.15, target.z)
    ref.current.rotation.y = clock.elapsedTime * 1.5
    ref.current.material.color.setRGB(stage === 'encounter' ? 5 : 4, stage === 'encounter' ? 0.5 : 2.2, stage === 'encounter' ? 0.3 : 0.6)
  })
  return (
    <mesh ref={ref} rotation={[Math.PI, 0, 0]} material={useMemo(() => glow(4, 2.2, 0.6), [])}>
      <coneGeometry args={[0.22, 0.45, 4]} />
    </mesh>
  )
}

export function Interactables() {
  return (
    <>
      <Terminal />
      {LOG_SPOTS.map((l) => (
        <DataLog key={l.id} {...l} />
      ))}
      <Hazard />
      <Beacon />
      <ObjectiveMarker />
    </>
  )
}
