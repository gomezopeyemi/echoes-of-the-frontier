import { Vector3 } from 'three'
import { DROID } from './config'
import { DROID_HOME, SPAWN } from '../world/layout'

// Per-frame mutable state. This lives outside React on purpose: positions
// change 60 times a second and must never trigger re-renders. Anything the
// UI needs to *react* to (health, stage, phase) lives in the zustand store.

const makeRuntime = () => ({
  player: {
    position: new Vector3(SPAWN.x, 0, SPAWN.z),
    velocity: new Vector3(),
    invulnerable: false,
    dodgeReady: 1,
    moving: false,
  },
  droid: {
    position: new Vector3(DROID_HOME.x, DROID.restHeight, DROID_HOME.z),
    facing: 0,
    state: 'dormant',
    timer: 0,
    rangedCooldown: 1.5,
    strikeDir: new Vector3(),
    hitApplied: false,
    alerted: false,
    enraged: false,
  },
  camera: { yaw: 0, pitch: -0.12 },
  projectiles: Array.from({ length: 12 }, () => ({ active: false, pos: new Vector3(), vel: new Vector3(), life: 0 })),
  tracers: Array.from({ length: 8 }, () => ({ life: 0, from: new Vector3(), to: new Vector3() })),
  sparks: Array.from({ length: 12 }, () => ({ life: 0, pos: new Vector3(), color: '#ffffff', scale: 1 })),
})

export const runtime = makeRuntime()

export function resetRuntime() {
  Object.assign(runtime, makeRuntime())
}

function freeSlot(pool, isFree, age) {
  let slot = pool.find(isFree)
  if (!slot) slot = pool.reduce((a, b) => (age(a) < age(b) ? a : b))
  return slot
}

export function spawnTracer(from, to) {
  const t = freeSlot(runtime.tracers, (s) => s.life <= 0, (s) => s.life)
  t.from.copy(from)
  t.to.copy(to)
  t.life = 1
}

export function spawnSpark(pos, color = '#ffd28a', scale = 1) {
  const s = freeSlot(runtime.sparks, (s) => s.life <= 0, (s) => s.life)
  s.pos.copy(pos)
  s.color = color
  s.scale = scale
  s.life = 1
}

export function spawnProjectile(pos, vel, life = 3) {
  const p = freeSlot(runtime.projectiles, (s) => !s.active, (s) => s.life)
  p.pos.copy(pos)
  p.vel.copy(vel)
  p.life = life
  p.active = true
}
