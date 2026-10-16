import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Bloom, EffectComposer, N8AO, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { CanvasTexture, SRGBColorSpace } from 'three'
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
    c.minDistance = 0.5
    c.maxDistance = 12
    c.maxPolarAngle = Math.PI * 0.53 // never orbit under the floor
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

// Lighting presets. One coherent rig per preset: direct lights carry shape and
// shadows, the matching PMREM environment (CharacterEnvironment) carries
// reflections and soft ambient. No hemisphere/ambient light competing with it.
const LIGHTING = {
  studio: {
    env: 'studio',
    envIntensity: 0.75,
    background: ['#6c6f74', '#3c3e42'],
    floor: '#4b4c4f',
    key: { position: [-3.2, 5, 3.6], intensity: 2.6, color: '#fff3e6' },
    fill: { position: [4, 1.8, 3.2], intensity: 0.55, color: '#eceff3' },
    rims: [
      { position: [-3, 3, -4.5], intensity: 1.7, color: '#eef1f8' },
      { position: [3.5, 2.6, -4.5], intensity: 1.3, color: '#f2f4f8' },
    ],
  },
  night: {
    env: 'night',
    envIntensity: 1.0,
    background: ['#151820', '#07080a'],
    floor: '#1c1d1f',
    key: { position: [-4, 6, -3], intensity: 0.7, color: '#a9bedb' }, // moonlight, as in the level
    fill: { position: [3, 1.5, 3], intensity: 0.12, color: '#c9d6ea' },
    rims: [{ position: [3, 3, -4], intensity: 0.7, color: '#9fb4d0' }],
    point: { position: [2.4, 3.2, 2.2], intensity: 14, distance: 10, color: '#ffb35c' }, // sodium pole lamp
  },
}

function gradientTexture([top, bottom]) {
  const c = document.createElement('canvas')
  c.width = 4
  c.height = 256
  const g = c.getContext('2d')
  const grad = g.createLinearGradient(0, 0, 0, 256)
  grad.addColorStop(0, top)
  grad.addColorStop(1, bottom)
  g.fillStyle = grad
  g.fillRect(0, 0, 4, 256)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

function Stage({ lighting }) {
  const L = LIGHTING[lighting]
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    const bg = gradientTexture(L.background)
    scene.background = bg
    return () => {
      scene.background = null
      bg.dispose()
    }
  }, [scene, L])
  return (
    <>
      <directionalLight
        position={L.key.position}
        intensity={L.key.intensity}
        color={L.key.color}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={3.2}
        shadow-camera-bottom={-1}
        shadow-camera-near={0.5}
        shadow-camera-far={20}
        shadow-bias={-0.0002}
        shadow-normalBias={0.02}
        shadow-radius={4}
      />
      <directionalLight position={L.fill.position} intensity={L.fill.intensity} color={L.fill.color} />
      {L.rims.map((r, i) => (
        <directionalLight key={i} position={r.position} intensity={r.intensity} color={r.color} />
      ))}
      {L.point && <pointLight position={L.point.position} intensity={L.point.intensity} distance={L.point.distance} decay={2} color={L.point.color} />}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[7, 64]} />
        <meshStandardMaterial color={L.floor} roughness={0.92} metalness={0} />
      </mesh>
      <CharacterEnvironment key={lighting} preset={L.env} intensity={L.envIntensity} asSceneEnvironment />
    </>
  )
}

// Camera presets: [azimuth, elevation, distance, target height] per subject.
const CAMERAS = {
  front: { operative: [Math.PI, 0.06, 2.9, 1.0], droid: [Math.PI, 0.06, 3.9, 1.2], both: [Math.PI, 0.08, 5.4, 1.15] },
  '¾': { operative: [2.45, 0.12, 2.9, 1.0], droid: [2.45, 0.12, 3.9, 1.2], both: [2.6, 0.12, 5.4, 1.15] },
  side: { operative: [Math.PI / 2, 0.06, 2.9, 1.0], droid: [Math.PI / 2, 0.06, 3.9, 1.2], both: [Math.PI / 2, 0.08, 5.4, 1.15] },
  rear: { operative: [0.3, 0.1, 2.9, 1.0], droid: [0.3, 0.1, 3.9, 1.2], both: [0.3, 0.12, 5.4, 1.15] },
  close: { operative: [2.6, 0.08, 1.25, 1.42], droid: [2.6, 0.08, 1.7, 1.75], both: [2.6, 0.1, 3.0, 1.5] },
}

export default function Showcase() {
  const [view, setView] = useState('both')
  const [opClip, setOpClip] = useState('idle')
  const [droidClip, setDroidClip] = useState('idle')
  const [facing, setFacing] = useState(0)
  const [scrub, setScrub] = useState(null) // freeze clips at a time (seconds) for inspection
  const [lighting, setLighting] = useState('studio')
  const [ao, setAo] = useState(true)
  const [bloom, setBloom] = useState(true)

  useEffect(() => {
    window.__showcase = { setView, setOpClip, setDroidClip, setFacing, setScrub, setLighting, setAo, setBloom }
  }, [])

  const frame = (name) => {
    const [az, el, dist, ty] = CAMERAS[name][view]
    window.__showcaseCamera?.(az, el, dist, ty, 0)
  }

  const target = view === 'operative' ? [0, 1.0, 0] : view === 'droid' ? [0, 1.3, 0] : [0, 1.2, 0]

  return (
    <div className="app showcase">
      <Canvas shadows="percentage" dpr={[1, 1.75]} gl={{ antialias: false }} camera={{ fov: 35, near: 0.03, far: 100, position: [0, 1.5, 6.5] }}>
        <Stage lighting={lighting} />
        {view !== 'droid' && <Character kind="operative" clip={opClip} x={view === 'both' ? -0.9 : 0} rotationY={facing} scrub={scrub} />}
        {view !== 'operative' && <Character kind="droid" clip={droidClip} x={view === 'both' ? 0.9 : 0} rotationY={facing} scrub={scrub} />}
        <Orbit key={view} target={target} />
        {/* PBR Neutral tone mapping keeps base colours faithful for material review; AO and bloom are optional. */}
        <EffectComposer multisampling={4} enableNormalPass={false}>
          {ao ? <N8AO halfRes quality="medium" aoRadius={0.3} distanceFalloff={0.5} intensity={2.0} /> : <></>}
          {bloom ? <Bloom mipmapBlur intensity={0.35} luminanceThreshold={1.1} luminanceSmoothing={0.2} /> : <></>}
          <ToneMapping mode={ToneMappingMode.NEUTRAL} />
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
        <div className="showcase-row">
          {Object.keys(CAMERAS).map((c) => (
            <button key={c} className="chip" onClick={() => frame(c)}>
              {c}
            </button>
          ))}
        </div>
        <div className="showcase-row">
          {Object.keys(LIGHTING).map((l) => (
            <button key={l} className={`chip ${lighting === l ? 'on' : ''}`} onClick={() => setLighting(l)}>
              {l} light
            </button>
          ))}
          <button className={`chip ${ao ? 'on' : ''}`} onClick={() => setAo((v) => !v)}>
            AO
          </button>
          <button className={`chip ${bloom ? 'on' : ''}`} onClick={() => setBloom((v) => !v)}>
            bloom
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
