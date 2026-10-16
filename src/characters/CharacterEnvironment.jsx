import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { PMREMGenerator } from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { applyCharacterEnvironment } from './materials'

/**
 * Builds a small pre-filtered studio environment once and assigns it to the
 * character materials only. `asSceneEnvironment` additionally lights the whole
 * scene with it (used by the neutral showcase, not by the night-time level).
 */
export function CharacterEnvironment({ intensity = 0.35, asSceneEnvironment = false }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    const pmrem = new PMREMGenerator(gl)
    const room = new RoomEnvironment()
    const env = pmrem.fromScene(room, 0.04).texture
    applyCharacterEnvironment(env, intensity)
    if (asSceneEnvironment) {
      scene.environment = env
      scene.environmentIntensity = intensity
    }
    return () => {
      if (asSceneEnvironment) scene.environment = null
      env.dispose()
      pmrem.dispose()
      room.traverse((o) => o.geometry?.dispose?.())
    }
  }, [gl, scene, intensity, asSceneEnvironment])
  return null
}
