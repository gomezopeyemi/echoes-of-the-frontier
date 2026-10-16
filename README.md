# Echoes of the Frontier

A cinematic third-person sci-fi action RPG prototype built with React, Three.js and React Three Fiber.
This build contains **Mission 01: The Silent Outpost**: one world, one enemy encounter, one objective chain and one complete gameplay loop.

![In game](docs/screenshots/in-game.jpg)

```bash
npm install
npm run dev      # game:      http://localhost:5173
                 # showcase:  http://localhost:5173/?showcase
npm test         # unit tests: combat, collision, droid AI, animators, guard rules
npm run build
```

No extra asset installation is needed. All character geometry, materials and textures are generated in code.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrows | Move (camera-relative; strafing and backpedalling while aiming) |
| Shift | Sprint |
| Mouse | Look / aim (click Deploy to lock the pointer) |
| Left mouse | Energy pistol |
| Right mouse / F | Energy blade (diagonal slash, short lunge) |
| Q (hold) | Guard: blocks 70% of droid damage, slows movement |
| Space | Combat dash (invulnerable while dashing, 1.1 s cooldown) |
| E | Interact (terminal, data logs) |
| Esc / P | Pause |

## Mission flow

1. **Deploy** at the south landing pad; Command briefs you over comms.
2. **Investigate** the command module terminal (`E`). This trips a security override.
3. **Encounter**: SEC-DROID K7 powers up from standby. It also wakes if you get within 9 m or shoot it.
4. **Defeat** the droid. Every attack is telegraphed:
   - *Melee*: arm draws back, a red blade projects from the forearm, orange warning lights blink, then it lunges and sweeps. Dash through it or guard.
   - *Ranged* (6–20 m): the arm cannon rises, its coils charge up, then it fires a plasma bolt. Strafe, dash or guard.
   - Blade hits break its **poise** and stagger it, interrupting a wind-up or a charging shot.
   - Below 40% health it overheats and attacks 30% faster.
5. **Extract**: the beacon past the north wall lights up. Step onto the pad to win.
6. Lose all vitals and the mission fails. Redeploy restarts cleanly.

## Characters

Both characters follow the design board in [`docs/reference/character-design-board.webp`](docs/reference/character-design-board.webp).

![Showcase](docs/screenshots/showcase.jpg)

### Asset approach (read this first)

No licensed, rigged character models were available, and downloading unverified third-party models was out of scope. Both characters are therefore **prototype models built from procedural geometry**: bevelled primitives and conforming shell sections on a proper joint hierarchy, with PBR materials and a pose-based animation system driven by gameplay state. They are deliberately composed and proportioned, but they are **not** sculpted, textured, skinned production characters.

The joint names (`pelvis, spine, chest, neck, head, shoulderL/R, elbowL/R, wristL/R, hipL/R, kneeL/R, ankleL/R`) match a conventional humanoid rig. A skinned GLTF can later be driven by the same animators by mapping these names to its bones.

### Frontier Operative (player)

- ~1.80 m, athletic proportions. Enclosed helmet built from conforming panels: graphite crown, brow band, glossy black wrap-around visor with two restrained blue optics, muted-silver cheek guards and a faceplate.
- Charcoal undersuit with a graphite tactical vest. Muted-silver composite plates are placed asymmetrically: a larger left pauldron with a burnt-orange stripe, left thigh plate, chest plates, forearm guards, knee pads and shin guards.
- Weathered scarf wraps and a torn mantle. The mantle uses an alpha-tested torn hem with a sun-faded top and a dust-darkened hem. It is a CPU-deformed cloth sheet that trails with speed, clears the rear leg and hangs with gravity when the torso pitches.
- Survival pack with a blue status strip and a bedroll; belt with pouches.
- **Energy pistol** in the right hand. The gameplay muzzle is a socket on the barrel, so tracers leave the gun.
- **Energy blade** holstered on the left hip. It swaps to the left hand and ignites only while attacking or guarding.

### Outpost Security Droid (enemy)

- ~2.25 m humanoid combat frame, taller and broader than the player. Head sits low between massive armoured shoulders, with a tapered torso and an exposed mechanical spine.
- Visible separation between armour plates and moving parts: hydraulic knee and elbow actuators, calf and thigh pistons, neck pistons.
- Single red optic in a deep housing, two chest sensor slits, a dorsal strip and small orange warning lights.
- **Arm cannon** integrated into the right forearm, with charge coils and a muzzle socket the plasma bolts spawn from. **Melee emitter** on the left forearm projects a red blade, with a brief arc trail on the strike.
- Its emissives communicate state: dim in standby, flicker on detection, pulsing during telegraphs, the coils ramp while charging, the optic stutters during a stagger, and everything dies when it is destroyed.

### Materials

Defined in `src/characters/materials.js`:

- Physically based materials with distinct roughness and metalness: matte fabric (weave texture), leather, painted composite armour, worn gunmetal, glossy visor glass (clearcoat), hydraulics, rubber.
- Subtle procedural wear: soft grime as a colour multiplier, plus roughness breakup and wipe marks. Kept low-contrast on purpose.
- Reflections come from a small pre-filtered studio environment that is applied **only to character materials**, so the night-time level lighting is unchanged.
- A short-range, camera-side fill light (`CharacterFillLight`) keeps armour readable in the dark without lighting the level.
- Emissive use is limited to visor optics, sensors, energy weapons and status lights.

### Animation

Animation is procedural and pose-based (`src/characters/pose.js`). Gameplay fills a small driver object each frame. The animator layers clips and overlays into a target pose and eases the rig toward it, so state changes never pop.

| Operative | Droid |
| --- | --- |
| Idle (breathing, weight shift) | Standby (powered-down slump, dim optic) |
| Walk / run (stride from distance travelled) | Detection response (optic snaps up, frame unfolds) |
| Directional movement: hips turn toward travel while the chest stays on aim; backpedal reverses the stride | Chase (heavy stride, pelvis roll, footfall audio) |
| Energy blade slash (wind-up → strike → recovery) | Melee wind-up → strike → recover |
| Pistol aim (follows camera pitch) + muzzle flash | Ranged: cannon raise + charge → fire recoil |
| Combat dash | Damage flinch (additive) |
| Guard | Stagger |
| Hit reaction (additive) | Destroyed (collapse to knees and slump) |
| Defeat (knees give out, slump) | Idle head scan / target tracking |

![Operative poses](docs/screenshots/operative-poses.jpg)
![Droid poses](docs/screenshots/droid-poses.jpg)

### Gameplay integration

- **Rules stay in gameplay code.** Blade damage, range, arc and timings, guard reduction and stagger poise live in `game/config.js`, `game/store.js` and `game/droidAI.js`. Animators only read state.
- **Attack timing matches the animation.** The player's blade clock lives in `Player.jsx`. The single hit check runs at `bladeHitTime` (the strike frame), once per swing. The animation samples the same clock.
- **Weapons are sockets on the models.** The pistol muzzle and droid cannon muzzle are read back into `runtime` every frame and used for tracers and bolt spawns.
- **Droid hit volume** is a stack of spheres matching the biped (legs, torso, shoulders, head) rather than one sphere.
- **Restart** remounts the scene and resets `runtime`, so both rigs, all clocks, poise and positions start fresh.

### Showcase

Open `/?showcase` (also linked from the title screen) for neutral studio lighting, an orbit camera, and buttons that run each character through its full animation set without gameplay.

### Performance

- Geometry is cached per unique shape and materials are shared.
- After mount, each joint's static pieces are baked into one mesh per material (`bakeJoints.js`). That takes the operative from 132 to 77 visible meshes and the droid from 136 to 65.
- Only larger parts cast shadows. Cloth deformation touches 165 vertices.
- A frame in the level is roughly 360 draw calls, including the shadow pass and post-processing.

### Remaining limitations

- **Prototype art.** Primitive-based forms cannot match the sculpted detail, silhouette nuance or hand-painted wear of the board. Real edge damage, decals and baked normal/AO maps need authored assets.
- **No skinning.** Limbs are rigid segments with joint caps; elbows and knees don't deform. The mantle is the only deforming mesh, and it is not a physics simulation (no collision against the body beyond leg clearance).
- **Procedural animation.** Poses are hand-authored keyframes and procedural cycles, not motion capture. Feet are not IK-planted, so slight sliding is possible on turns, and the kneeling poses can dip a few centimetres into the ground.
- **Not mirrored:** the energy blade is left-hand only; the plasma rifle from the board is not modelled because the game has no rifle mechanic yet.
- **Testing environment.** Verification ran in headless Chromium with software rendering (about 1 fps), so the feel at real frame rates still needs a hands-on playtest on a GPU.

### Replacing with production assets later

1. Export a rigged, licensed GLTF per character with the joint names above, or add a name map.
2. Load it with `useGLTF` (drei) or `GLTFLoader`, then replace the primitive JSX in `OperativeModel.jsx` / `DroidModel.jsx` with the loaded scene. Keep the `apiRef` contract (`update`, `muzzle`, `setFlash`).
3. Either keep the procedural animators by writing pose rotations onto the bones, or swap in an `AnimationMixer` and map driver state to clips. Gameplay code needs no changes.

## Architecture

```
src/
  game/                 # rules & state, no rendering
    config.js           # every tuning number (speeds, damage, ranges, cooldowns, poise, guard)
    store.js            # zustand: phase, mission stage, health, guard/hit rules, messages, stats
    runtime.js          # per-frame mutable state (positions, clocks, sockets, pools) outside React
    combat.js           # damage calc, cooldowns, melee arc test, multi-sphere raycast
    collision.js        # circle-vs-AABB resolution, raycasts, line of sight
    droidAI.js          # droid finite-state machine incl. stagger/poise (pure; side effects injected)
    mission.js          # objectives, briefing, transmissions, data log text
    input.js            # keyboard/mouse polling, pointer lock
  characters/           # character art + animation, no gameplay rules
    operative/          # OperativeModel.jsx (rig + meshes), operativeAnimator.js
    droid/              # DroidModel.jsx, droidAnimator.js
    materials.js        # PBR materials + procedural textures
    geometry.js         # cached primitive/blade geometry
    pose.js             # pose blending, keyframe sampling, damping
    bakeJoints.js       # per-joint static mesh merging
    CharacterEnvironment.jsx, CharacterFillLight.jsx
  entities/             # gameplay wrappers: Player, SecurityDroid, Projectiles, Effects
  world/                # level data (layout.js) + environment, structures, interactables
  showcase/             # ?showcase character viewer
  ui/                   # HUD and full-screen states (title, pause, victory, defeat)
  audio/audio.js        # procedural Web Audio SFX + ambience (no asset files)
```

In development, `window.__echoes` exposes `{ useGame, runtime }` and `window.__r3f` the R3F state for debugging.
