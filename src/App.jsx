import { useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { CAMERA } from './game/config'
import { attachInput } from './game/input'
import { useGame } from './game/store'
import { SPAWN } from './world/layout'
import { Scene } from './Scene'
import { HUD } from './ui/HUD'
import { Screens } from './ui/Screens'

export default function App() {
  const runId = useGame((s) => s.runId)

  useEffect(() => attachInput(), [])

  // Leaving pointer lock (Esc) mid-mission pauses the game.
  useEffect(() => {
    let wasLocked = false
    const onChange = () => {
      const locked = !!document.pointerLockElement
      if (wasLocked && !locked) useGame.getState().pause()
      wasLocked = locked
    }
    const onKey = (e) => {
      if (e.code === 'KeyP' || (e.code === 'Escape' && !document.pointerLockElement)) {
        const g = useGame.getState()
        if (g.phase === 'playing') g.pause()
      }
    }
    document.addEventListener('pointerlockchange', onChange)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerlockchange', onChange)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  return (
    <div className="app">
      <Canvas
        shadows
        dpr={[1, 1.75]}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
        camera={{ fov: CAMERA.fov, near: 0.1, far: 500, position: [SPAWN.x, 3, SPAWN.z + 5] }}
      >
        <Scene key={runId} />
      </Canvas>
      <HUD />
      <Screens />
    </div>
  )
}
