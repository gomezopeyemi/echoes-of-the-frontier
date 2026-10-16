import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import { runtime } from '../game/runtime'

const toCam = new Vector3()

/**
 * Soft, short-range fill that rides between the camera and the operative
 * (the "cinematographer's bounce card"). It keeps armour and materials
 * readable at night without brightening the level: its range covers the
 * player and anything in melee distance, nothing beyond.
 */
export function CharacterFillLight({ intensity = 5, distance = 7 }) {
  const light = useRef()
  const camera = useThree((s) => s.camera)
  useFrame(() => {
    const p = runtime.player.position
    toCam.set(camera.position.x - p.x, 0, camera.position.z - p.z)
    if (toCam.lengthSq() < 1e-4) toCam.set(0, 0, 1)
    toCam.normalize()
    light.current.position.set(p.x + toCam.x * 2.2 - toCam.z * 1.2, 2.6, p.z + toCam.z * 2.2 + toCam.x * 1.2)
  })
  return <pointLight ref={light} color="#c9d6ea" intensity={intensity} distance={distance} decay={1.6} />
}
