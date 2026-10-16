import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Bloom, EffectComposer, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CharacterEnvironment } from '../characters/CharacterEnvironment'
import { OperativeModel } from '../characters/operative/OperativeModel'
import { createOperativeDriver } from '../characters/operative/operativeAnimator'
import { DroidModel } from '../characters/droid/DroidModel'
import { createDroidDriver } from '../characters/droid/droidAnimator'

// Character showcase: neutral studio lighting, orbit camera, and buttons that
// drive each model through its animation set without any gameplay running.
// Open with ?showcase

const OPERATIVE_CLIPS = ['idle', 'walk', 'run', 'strafe', 'backpedal', 'aim + fire', 'blade', 'guard', 'dash', 'hit', 'defeat']
const DROID_CLIPS = ['standby', 'detect', 'idle', 'chase', 'melee', 'ranged', 'hit', 'stagger', 'destroyed']

function driveOperative(d, clip, t, api) {
  Object.assign(d, createOperativeDriver())
  const loop = (len) => t % len
  switch (clip) {
    case 'walk': d.speed = 2.6; break
    case 'run': d.speed = 8.6; break
    case 'strafe': d.speed = 4.5; d.moveAngle = -Math.PI / 2; d.aiming = true; break
    case 'backpedal': d.speed = 3.5; d.moveAngle = Math.PI; d.aiming = true; break
    case 'aim + fire': d.aiming = true; api?.setFlash(loop(0.4) < 0.05); break
    case 'blade': d.attackT = loop(1.1) < 0.5 ? loop(1.1) : null; break
    case 'guard': d.guarding = true; break
    case 'dash': d.dashT = loop(1.2) < 0.45 ? loop(1.2) : null; break
    case 'hit': d.hitT = loop(1.0); break
    case 'defeat': d.defeatT = loop(4); break
  }
  if (clip !== 'aim + fire') api?.setFlash(false)
}

function driveDroid(d, clip, t) {
  Object.assign(d, createDroidDriver())
  const loop = (len) => t % len
  switch (clip) {
    case 'standby': d.state = 'dormant'; break
    case 'detect': d.state = loop(4) < 2.2 ? 'booting' : 'chase'; d.stateT = loop(4); break
    case 'idle': d.state = 'chase'; break
    case 'chase': d.state = 'chase'; d.speed = 4.4; break
    case 'melee': {
      const c = loop(2)
      if (c < 0.65) { d.state = 'windup'; d.stateT = c }
      else if (c < 0.9) { d.state = 'strike'; d.stateT = c - 0.65 }
      else if (c < 1.6) { d.state = 'recover'; d.stateT = c - 0.9 }
      else { d.state = 'chase'; d.stateT = c - 1.6 }
      break
    }
    case 'ranged': {
      const c = loop(2.2)
      if (c < 0.9) { d.state = 'charging'; d.stateT = c } else { d.state = 'chase'; d.fireT = c - 0.9 }
      break
    }
    case 'hit': d.state = 'chase'; d.hitT = loop(0.9); break
    case 'stagger': d.state = loop(2) < 0.8 ? 'stagger' : 'chase'; d.stateT = loop(2); break
    case 'destroyed': d.state = 'destroyed'; d.stateT = loop(5); break
  }
}

function Orbit({ target }) {
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const ctl = useRef()
  useEffect(() => {
    const c = new OrbitControls(camera, gl.domElement)
    c.target.set(...target)
    c.enableDamping = true
    c.minDistance = 1.2
    c.maxDistance = 12
    c.update()
    ctl.current = c
    window.__showcaseCamera = (azimuth, elevation, distance, ty = target[1], tx = target[0]) => {
      c.target.set(tx, ty, target[2])
      camera.position.set(tx + Math.sin(azimuth) * Math.cos(elevation) * distance, ty + Math.sin(elevation) * distance, target[2] + Math.cos(azimuth) * Math.cos(elevation) * distance)
      c.update()
    }
    return () => c.dispose()
  }, [camera, gl, target])
  useFrame(() => ctl.current?.update())
  return null
}

function Character({ kind, clip, x, rotationY = 0, scrub = null }) {
  const api = useRef()
  const driver = useMemo(() => (kind === 'operative' ? createOperativeDriver() : createDroidDriver()), [kind])
  const t0 = useRef(0)
  useEffect(() => {
    t0.current = 0
  }, [clip])
  useFrame((_, dt) => {
    t0.current = scrub ?? t0.current + Math.min(dt, 0.05)
    if (!api.current) return
    if (kind === 'operative') driveOperative(driver, clip, t0.current, api.current)
    else driveDroid(driver, clip, t0.current)
    api.current.update(Math.min(dt, 0.05), driver)
  })
  return (
    <group position={[x, 0, 0]} rotation={[0, rotationY, 0]}>
      {kind === 'operative' ? <OperativeModel apiRef={api} /> : <DroidModel apiRef={api} />}
    </group>
  )
}

function Stage() {
  return (
    <>
      <color attach="background" args={["#4a4d52"]} />
      <hemisphereLight args={['#c9d2de', '#2a2622', 0.5]} />
      <directionalLight position={[3, 5, 3]} intensity={2.2} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-4} shadow-camera-right={4} shadow-camera-top={4} shadow-camera-bottom={-4} shadow-bias={-0.0003} />
      <directionalLight position={[-4, 2.5, 1]} intensity={0.6} color="#dfe8ff" />
      <directionalLight position={[0, 3, -5]} intensity={1.4} color="#bcd0ff" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[6, 64]} />
        <meshStandardMaterial color="#3a3b3e" roughness={0.9} />
      </mesh>
    </>
  )
}

export default function Showcase() {
  const [view, setView] = useState('both')
  const [opClip, setOpClip] = useState('idle')
  const [droidClip, setDroidClip] = useState('idle')
  const [facing, setFacing] = useState(0)
  const [scrub, setScrub] = useState(null) // freeze clips at a time (seconds) for inspection

  useEffect(() => {
    window.__showcase = { setView, setOpClip, setDroidClip, setFacing, setScrub }
  }, [])

  const target = view === 'operative' ? [0, 1.0, 0] : view === 'droid' ? [0, 1.3, 0] : [0, 1.2, 0]

  return (
    <div className="app showcase">
      <Canvas shadows dpr={[1, 1.75]} gl={{ antialias: false }} camera={{ fov: 35, near: 0.05, far: 100, position: [0, 1.5, 6.5] }}>
        <Stage />
        <CharacterEnvironment intensity={0.6} asSceneEnvironment />
        {view !== 'droid' && <Character kind="operative" clip={opClip} x={view === 'both' ? -0.9 : 0} rotationY={facing} scrub={scrub} />}
        {view !== 'operative' && <Character kind="droid" clip={droidClip} x={view === 'both' ? 0.9 : 0} rotationY={facing} scrub={scrub} />}
        <Orbit key={view} target={target} />
        <EffectComposer multisampling={4}>
          <Bloom mipmapBlur intensity={0.6} luminanceThreshold={1} luminanceSmoothing={0.2} />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
      </Canvas>
      <div className="showcase-panel">
        <div className="eyebrow">Character showcase · prototype models</div>
        <div className="showcase-row">
          {['both', 'operative', 'droid'].map((v) => (
            <button key={v} className={`chip ${view === v ? 'on' : ''}`} onClick={() => setView(v)}>
              {v}
            </button>
          ))}
          <button className="chip" onClick={() => setFacing((f) => f + Math.PI / 2)}>
            rotate 90°
          </button>
        </div>
        {view !== 'droid' && (
          <>
            <div className="eyebrow">Frontier Operative</div>
            <div className="showcase-row">
              {OPERATIVE_CLIPS.map((c) => (
                <button key={c} className={`chip ${opClip === c ? 'on' : ''}`} onClick={() => setOpClip(c)}>
                  {c}
                </button>
              ))}
            </div>
          </>
        )}
        {view !== 'operative' && (
          <>
            <div className="eyebrow">Security Droid</div>
            <div className="showcase-row">
              {DROID_CLIPS.map((c) => (
                <button key={c} className={`chip ${droidClip === c ? 'on' : ''}`} onClick={() => setDroidClip(c)}>
                  {c}
                </button>
              ))}
            </div>
          </>
        )}
        <a className="showcase-back" href="./">
          ← Back to game
        </a>
      </div>
    </div>
  )
}
