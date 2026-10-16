// Central tuning values. Keep gameplay numbers here so balancing never
// requires digging through rendering code.

export const PLAYER = {
  radius: 0.45,
  maxHealth: 100,
  walkSpeed: 5.2,
  sprintSpeed: 8.6,
  acceleration: 12,
  dodgeSpeed: 15,
  dodgeDuration: 0.3,
  dodgeCooldown: 1.1,
  fireCooldown: 0.2,
  weaponDamage: 9,
  critChance: 0.15,
  critMultiplier: 1.8,
  weaponRange: 60,
  interactRange: 2.6,
}

export const DROID = {
  name: 'SEC-DROID K7',
  radius: 1.0,
  maxHealth: 240,
  restHeight: 0.6,
  hoverHeight: 1.4,
  detectionRange: 9,
  bootTime: 2.2,
  chaseSpeed: 4.4,
  meleeRange: 2.6,
  meleeDamage: 22,
  windup: 0.65,
  lungeSpeed: 11,
  strikeDuration: 0.25,
  recover: 0.7,
  knockback: 1.4,
  rangedMin: 6,
  rangedMax: 20,
  rangedCooldown: 3.2,
  chargeTime: 0.9,
  projectileSpeed: 16,
  projectileDamage: 14,
  enrageThreshold: 0.4,
  enrageMultiplier: 1.3,
}

export const HAZARD_DPS = 16

export const CAMERA = {
  fov: 60,
  distance: 4.6,
  height: 1.7,
  shoulder: 0.85,
  sensitivity: 0.0022,
  minPitch: -0.9,
  maxPitch: 0.6,
}
