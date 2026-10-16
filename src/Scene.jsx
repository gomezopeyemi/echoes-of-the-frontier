import { Bloom, EffectComposer, Noise, ToneMapping, Vignette } from '@react-three/postprocessing'
import { BlendFunction, ToneMappingMode } from 'postprocessing'
import { Effects } from './entities/Effects'
import { Player } from './entities/Player'
import { Projectiles } from './entities/Projectiles'
import { SecurityDroid } from './entities/SecurityDroid'
import { Environment } from './world/Environment'
import { Interactables } from './world/Interactables'
import { Structures } from './world/Structures'

export function Scene() {
  return (
    <>
      <Environment />
      <Structures />
      <Interactables />
      <Player />
      <SecurityDroid />
      <Projectiles />
      <Effects />
      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur intensity={0.9} luminanceThreshold={1} luminanceSmoothing={0.2} />
        <Noise premultiply blendFunction={BlendFunction.ADD} opacity={0.35} />
        <Vignette offset={0.28} darkness={0.75} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    </>
  )
}
