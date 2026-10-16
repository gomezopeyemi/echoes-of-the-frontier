# Echoes of the Frontier

A cinematic third-person sci-fi action RPG prototype built with React, Three.js and React Three Fiber.
This build contains **Mission 01: The Silent Outpost**: one world, one enemy encounter, one objective chain and one complete gameplay loop.

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests for combat, collision and droid AI
npm run build
```

## Controls

| Input | Action |
| --- | --- |
| WASD / arrows | Move (camera-relative) |
| Shift | Sprint |
| Mouse | Look / aim (click Deploy to lock the pointer) |
| Left mouse | Fire pulse pistol |
| Space | Evade thruster (brief invulnerability, 1.1 s cooldown) |
| E | Interact (terminal, data logs) |
| Esc / P | Pause |

## Mission flow

1. **Deploy** at the south landing pad; Command briefs you over comms.
2. **Investigate** the command module terminal (`E`). This trips a security override.
3. **Encounter**: SEC-DROID K7 boots up. It also wakes if you get within 9 m or shoot it.
4. **Defeat** the droid. It telegraphs every attack:
   - *Melee*: the eye flares white and the droid leans back, then lunges. Evade through it.
   - *Ranged* (6–20 m): the ring spins up and the eye glows orange, then it fires a plasma bolt. Strafe or evade.
   - Below 40% health it overheats and attacks 30% faster.
5. **Extract**: the beacon past the north wall lights up. Step onto the pad to win.
6. Lose all vitals and the mission fails. Redeploy restarts cleanly.

Optional: three data logs scattered around the outpost tell what happened to the colony. An exposed power conduit east of the path is an environmental hazard.

## Architecture

```
src/
  game/                 # rules & state, no rendering
    config.js           # every tuning number (speeds, damage, ranges, cooldowns)
    store.js            # zustand: phase, mission stage, health, messages, stats
    runtime.js          # per-frame mutable state (positions, pools) kept outside React
    combat.js           # damage calc (falloff, crits), cooldowns, angle helpers
    collision.js        # circle-vs-AABB resolution, raycasts, line of sight
    droidAI.js          # droid finite-state machine (pure; side effects injected)
    mission.js          # objectives, briefing, transmissions, data log text
    input.js            # keyboard/mouse polling, pointer lock
  entities/             # things that act: Player, SecurityDroid, Projectiles, Effects
  world/                # level data (layout.js) + environment, structures, interactables
  ui/                   # HUD and full-screen states (title, pause, victory, defeat)
  audio/audio.js        # procedural Web Audio SFX + ambience (no asset files)
  Scene.jsx             # composes the 3D scene + post-processing
  App.jsx               # Canvas, HUD, screens, pause handling
```

Design notes:

- **Two kinds of state.** Anything the UI reacts to (health, stage, phase) lives in the zustand store. Anything that changes every frame (positions, timers, projectile pools) lives in `runtime.js`, so movement never causes React re-renders.
- **Level data is a single source.** `world/layout.js` drives both rendering and collision, so a moved crate can't end up with its collider somewhere else.
- **AI is testable.** `updateDroid` takes the droid, the player and a `ctx` of callbacks (damage, fire, sounds), so it runs in unit tests with no renderer.
- **Restart = remount.** Starting a mission resets `runtime`, resets the store and bumps `runId`, which is the `key` on `<Scene>`.
- **Placeholder art.** Every structure type is its own small component in `world/Structures.jsx`; swap one for a GLTF model without touching gameplay.

In development, `window.__echoes` exposes `{ useGame, runtime }` for debugging.

## Next steps toward the RPG

- Character attributes and equipment: extend `PLAYER` into a stats object, and feed it into `calculateDamage`.
- More enemy types: generalise `runtime.droid` into an enemy list. `droidAI.js` is already a self-contained brain.
- Inventory / dialogue: new store slices plus `ui/` panels; data-log text in `mission.js` shows the content pattern.
- Missions: make `mission.js` + `layout.js` per-mission modules and load by id.
