import { Bloom, EffectComposer, Noise, ToneMapping, Vignette } from '@react-three/postprocessing'
import { BlendFunction, ToneMappingMode } from 'postprocessing'
import { CharacterEnvironment } from './characters/CharacterEnvironment'
import { CharacterFillLight } from './characters/CharacterFillLight'
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
      {/* Night reflections: full strength on the characters, dimmed for the level's PBR props. */}
      <CharacterEnvironment preset="night" intensity={1.1} levelIntensity={0.9} />
      <CharacterFillLight />
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
