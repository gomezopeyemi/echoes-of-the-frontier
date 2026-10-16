// Pure combat helpers: no rendering, no store access. Easy to test and to
// extend later with armour, resistances, status effects, etc.

export class Cooldown {
  constructor(duration) {
    this.duration = duration
    this.remaining = 0
  }
  ready() {
    return this.remaining <= 0
  }
  trigger(duration = this.duration) {
    this.remaining = duration
  }
  tick(dt) {
    this.remaining = Math.max(0, this.remaining - dt)
  }
  /** 0 = just triggered, 1 = ready */
  get progress() {
    return this.duration > 0 ? 1 - this.remaining / this.duration : 1
  }
}

/**
 * Damage with distance falloff and critical hits.
 * Falloff is linear from `falloffStart` to `falloffEnd`, never below `minFactor`.
 */
export function calculateDamage({
  base,
  distance = 0,
  critChance = 0,
  critMultiplier = 1.5,
  falloffStart = 18,
  falloffEnd = 50,
  minFactor = 0.5,
  rng = Math.random,
}) {
  let factor = 1
  if (distance > falloffStart) {
    const t = Math.min(1, (distance - falloffStart) / (falloffEnd - falloffStart))
    factor = 1 - t * (1 - minFactor)
  }
  const crit = rng() < critChance
  return { amount: Math.max(1, Math.round(base * factor * (crit ? critMultiplier : 1))), crit }
}

/** Apply damage to a health pool, returning the new value and whether it was lethal. */
export function applyDamage(health, amount) {
  const next = Math.max(0, health - amount)
  return { health: next, defeated: next <= 0 && health > 0 }
}

export function horizontalDistance(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z)
}

/** Rotate angle `a` toward `b` by at most `maxStep`, taking the short way round. */
export function turnTowards(a, b, maxStep) {
  let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI
  if (diff < -Math.PI) diff += Math.PI * 2
  if (Math.abs(diff) <= maxStep) return b
  return a + Math.sign(diff) * maxStep
}
