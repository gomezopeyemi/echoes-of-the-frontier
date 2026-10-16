// Level data for Mission 01. Everything here is plain data: the renderer
// draws it and the collision system reads it, so the two can never drift.
// North is -Z. The player deploys at the south landing pad.

export const BOUNDS = 44

export const SPAWN = { x: 0, z: 36 }
export const TERMINAL = { x: -3, z: 1.5 }
export const DROID_HOME = { x: 3, z: -9 }
export const BEACON = { x: 0, z: -36 }
export const HAZARD = { x: 7, z: 10, w: 5, d: 3.2 }

// Axis-aligned blockers. w = size on X, d = size on Z, h = height.
export const OBSTACLES = [
  // Habitat modules
  { type: 'hab', x: -10, z: -4, w: 10, d: 7, h: 5 },
  { type: 'hab', x: 12, z: -2, w: 8, d: 10, h: 4.5 },
  // North compound wall with two gaps leading to the extraction zone
  { type: 'wall', x: 0, z: -18, w: 12, d: 1, h: 4 },
  { type: 'wall', x: -20, z: -18, w: 12, d: 1, h: 4 },
  { type: 'wall', x: 20, z: -18, w: 12, d: 1, h: 4 },
  // Cargo containers
  { type: 'container', x: -20, z: 8, w: 2.6, d: 6.2, h: 2.6, color: '#7a3b22' },
  { type: 'container', x: -16, z: 22, w: 6.2, d: 2.6, h: 2.6, color: '#2f5560' },
  { type: 'container', x: 18, z: 16, w: 6.2, d: 2.6, h: 2.6, color: '#4c4f55' },
  { type: 'container', x: 22, z: -28, w: 2.6, d: 6.2, h: 2.6, color: '#7a3b22' },
  { type: 'container', x: -24, z: -30, w: 6.2, d: 2.6, h: 2.6, color: '#2f5560' },
  // Supply crates (low cover)
  { type: 'crate', x: 4, z: 18, w: 1.2, d: 1.2, h: 1.2 },
  { type: 'crate', x: 5.5, z: 18.5, w: 1.2, d: 1.2, h: 1.2 },
  { type: 'crate', x: -6, z: 12, w: 1.4, d: 1.4, h: 1.4 },
  { type: 'crate', x: -2.5, z: -12, w: 1.2, d: 1.2, h: 1.2 },
  { type: 'crate', x: 8, z: -12, w: 1.2, d: 1.2, h: 1.2 },
  { type: 'crate', x: -26, z: -6, w: 1.4, d: 1.4, h: 1.4 },
  { type: 'crate', x: 6, z: -28, w: 1.2, d: 1.2, h: 1.2 },
  // Fuel tanks
  { type: 'tank', x: 26, z: 4, w: 3, d: 3, h: 5 },
  { type: 'tank', x: 26, z: 9, w: 3, d: 3, h: 5 },
  // Comms relay tower
  { type: 'tower', x: 16, z: -12, w: 2, d: 2, h: 14 },
  // Generator
  { type: 'generator', x: -4, z: 22, w: 3, d: 2, h: 1.8 },
  // Boulders along the edges
  { type: 'rock', x: -34, z: 10, w: 6, d: 6, h: 4 },
  { type: 'rock', x: 34, z: -18, w: 7, d: 5, h: 5 },
  { type: 'rock', x: -32, z: -32, w: 6, d: 8, h: 5 },
  { type: 'rock', x: 33, z: 26, w: 8, d: 6, h: 4 },
  { type: 'rock', x: 12, z: -40, w: 6, d: 4, h: 3 },
]

export const LIGHT_POLES = [
  { x: 4, z: 32, color: '#7fd8ff' },
  { x: -8, z: 16, color: '#ffb35c' },
  { x: 2, z: 4, color: '#ffb35c' },
  { x: -4, z: -14, color: '#ff8a4c' },
  { x: 4, z: -30, color: '#7fffb0' },
]

export const LOG_SPOTS = [
  { id: 'log-1', x: -13, z: 22 },
  { id: 'log-2', x: 21, z: 11 },
  { id: 'log-3', x: -20, z: -24 },
]
