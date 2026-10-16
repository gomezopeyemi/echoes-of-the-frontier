import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { BackSide, Color, DoubleSide, Mesh, MeshBasicMaterial, PlaneGeometry, PMREMGenerator, Scene, SphereGeometry } from 'three'
import { applyCharacterEnvironment } from './materials'

// Procedural reflection environments, pre-filtered with PMREM.
//
// three's RoomEnvironment is a box room full of small bright cubes, which
// shows up on glossy armour as random white rectangles. These scenes contain
// only what a photographer would use (large soft panels and strips) and they
// line up with the direct lights in the viewer, so reflections and shading
// agree. Panel colours are HDR (> 1) so highlights keep energy after filtering.

const PRESETS = {
  studio: {
    walls: '#2a2b2e',
    floor: '#3a3b3e',
    panels: [
      // [width, height, position, colour intensity (rgb)]
      [5, 3.5, [-5, 5.5, 5], [7, 6.8, 6.4]], // key softbox (front-left, high), matches the key light
      [2, 5, [6, 2.5, 3.5], [1.7, 1.7, 1.75]], // fill strip (front-right)
      [1, 6, [-4.5, 3, -6], [4.8, 4.9, 5.1]], // rim strip (back-left)
      [1, 6, [5, 3, -6], [3.8, 3.9, 4.1]], // rim strip (back-right)
      [7, 7, [0, 10, 0], [0.9, 0.9, 0.95]], // overhead bounce
    ],
  },
  night: {
    walls: '#07080b',
    floor: '#120f0d',
    panels: [
      [10, 4, [-8, 9, -8], [1.0, 1.2, 1.5]], // moonlit sky glow
      [1.2, 2.5, [7, 3, 3], [3.2, 1.8, 0.7]], // distant sodium lamp
      [1.2, 2.5, [-6, 3, 7], [0.6, 1.4, 1.8]], // cool pad light
      [14, 14, [0, 14, 0], [0.12, 0.13, 0.16]], // night sky
    ],
  },
}

function buildScene(preset) {
  const p = PRESETS[preset]
  const scene = new Scene()
  const dispose = []
  const room = new Mesh(new SphereGeometry(20, 32, 16), new MeshBasicMaterial({ color: p.walls, side: BackSide }))
  const floor = new Mesh(new PlaneGeometry(40, 40), new MeshBasicMaterial({ color: p.floor }))
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -0.01
  scene.add(room, floor)
  dispose.push(room, floor)
  for (const [w, h, pos, rgb] of p.panels) {
    const panel = new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ color: new Color(...rgb), side: DoubleSide }))
    panel.position.set(...pos)
    panel.lookAt(0, 1, 0)
    scene.add(panel)
    dispose.push(panel)
  }
  return {
    scene,
    dispose: () =>
      dispose.forEach((m) => {
        m.geometry.dispose()
        m.material.dispose()
      }),
  }
}

/**
 * Builds a pre-filtered environment once and assigns it to the character
 * materials. `asSceneEnvironment` additionally lights the whole scene with it
 * at the same intensity (the neutral showcase). `levelIntensity` instead
 * lights the rest of the scene with it at its own, lower strength (the night
 * level: reflections for the PBR props without lifting the darkness).
 */
export function CharacterEnvironment({ preset = 'studio', intensity = 1, asSceneEnvironment = false, levelIntensity = 0 }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    const pmrem = new PMREMGenerator(gl)
    const src = buildScene(preset)
    const env = pmrem.fromScene(src.scene, 0.02).texture
    src.dispose()
    applyCharacterEnvironment(env, intensity)
    const sceneWide = asSceneEnvironment || levelIntensity > 0
    if (sceneWide) {
      scene.environment = env
      scene.environmentIntensity = asSceneEnvironment ? intensity : levelIntensity
    }
    return () => {
      if (sceneWide) scene.environment = null
      env.dispose()
      pmrem.dispose()
    }
  }, [gl, scene, preset, intensity, asSceneEnvironment, levelIntensity])
  return null
}
