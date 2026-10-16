import { describe, expect, it, vi } from 'vitest'
import { Ray, Vector3 } from 'three'
import { DROID } from '../src/game/config'
import { Sphere } from 'three'
import { buildColliders, hasLineOfSight, raycastWorld, resolveCircle } from '../src/game/collision'
import { applyDamage, calculateDamage, Cooldown, inMeleeArc, raycastSpheres, turnTowards } from '../src/game/combat'
import { applyDroidHit, updateDroid } from '../src/game/droidAI'

describe('combat', () => {
  it('applies falloff and crits', () => {
    expect(calculateDamage({ base: 10, distance: 5, rng: () => 1 }).amount).toBe(10)
    expect(calculateDamage({ base: 10, distance: 50, rng: () => 1 }).amount).toBe(5)
    const crit = calculateDamage({ base: 10, critChance: 0.5, critMultiplier: 2, rng: () => 0 })
    expect(crit).toEqual({ amount: 20, crit: true })
  })

  it('clamps health and reports defeat once', () => {
    expect(applyDamage(10, 25)).toEqual({ health: 0, defeated: true })
    expect(applyDamage(0, 5)).toEqual({ health: 0, defeated: false })
  })

  it('cooldown ticks to ready', () => {
    const c = new Cooldown(1)
    c.trigger()
    expect(c.ready()).toBe(false)
    c.tick(0.6)
    expect(c.progress).toBeCloseTo(0.6)
    c.tick(0.6)
    expect(c.ready()).toBe(true)
  })

  it('turns the short way around', () => {
    expect(turnTowards(3, -3, 10)).toBe(-3)
    expect(turnTowards(3, -3, 0.1)).toBeGreaterThan(3)
  })
})

describe('melee and hit volumes', () => {
  it('blade arc only hits in front and in range', () => {
    const o = new Vector3(0, 0, 0)
    expect(inMeleeArc(o, 0, new Vector3(0, 0, -2), 2.4, 0.45)).toBe(true) // facing -Z
    expect(inMeleeArc(o, 0, new Vector3(0, 0, 2), 2.4, 0.45)).toBe(false) // behind
    expect(inMeleeArc(o, 0, new Vector3(2, 0, -0.2), 2.4, 0.45)).toBe(false) // beside
    expect(inMeleeArc(o, 0, new Vector3(0, 0, -3), 2.4, 0.45)).toBe(false) // too far
    expect(inMeleeArc(o, Math.PI / 2, new Vector3(-2, 0, 0), 2.4, 0.45)).toBe(true) // turned left
  })

  it('ray hits the stacked hit spheres of a standing droid', () => {
    const ray = new Ray(new Vector3(0, 1.4, 10), new Vector3(0, 0, -1))
    const t = raycastSpheres(ray, new Vector3(0, 0, 0), DROID.hitSpheres, new Sphere(), new Vector3())
    expect(t).toBeCloseTo(10 - 0.5, 1)
    const over = new Ray(new Vector3(0, 3, 10), new Vector3(0, 0, -1))
    expect(raycastSpheres(over, new Vector3(), DROID.hitSpheres, new Sphere(), new Vector3())).toBeNull()
  })
})

describe('collision', () => {
  const box = buildColliders([{ x: 0, z: 0, w: 2, d: 2, h: 2 }])

  it('pushes a circle out of a box', () => {
    const p = new Vector3(1.2, 0, 0)
    resolveCircle(p, 0.5, box, 50)
    expect(p.x).toBeCloseTo(1.5)
  })

  it('handles a centre fully inside a box', () => {
    const p = new Vector3(0.9, 0, 0.1)
    resolveCircle(p, 0.5, box, 50)
    expect(p.x).toBeCloseTo(1.5)
  })

  it('raycasts against boxes and ground', () => {
    const ray = new Ray(new Vector3(-5, 1, 0), new Vector3(1, 0, 0))
    expect(raycastWorld(ray, 20, { colliders: box })).toBeCloseTo(4)
    const down = new Ray(new Vector3(10, 2, 0), new Vector3(0, -1, 0))
    expect(raycastWorld(down, 20, { colliders: box })).toBeCloseTo(2)
    expect(hasLineOfSight(new Vector3(-5, 1, 0), new Vector3(5, 1, 0), box)).toBe(false)
    expect(hasLineOfSight(new Vector3(-5, 3, 0), new Vector3(5, 3, 0), box)).toBe(true)
  })
})

describe('droid AI', () => {
  const makeDroid = (x = 0, z = 0) => ({
    position: new Vector3(x, 0, z),
    facing: 0,
    state: 'dormant',
    stateT: 0,
    timer: 0,
    speed: 0,
    poise: 0,
    hitT: 99,
    fireT: 99,
    rangedCooldown: 0,
    strikeDir: new Vector3(),
    hitApplied: false,
    alerted: false,
    enraged: false,
  })
  const makeCtx = () => ({
    onActivate: vi.fn(),
    onWindup: vi.fn(),
    onCharge: vi.fn(),
    onStrike: vi.fn(),
    lineOfSight: () => true,
    meleeHit: vi.fn(),
    fire: vi.fn(),
  })
  // Open ground far from any level geometry.
  const origin = { x: -38, z: 30 }
  const run = (d, player, ctx, seconds) => {
    for (let t = 0; t < seconds; t += 1 / 60) updateDroid(d, player, 1 / 60, ctx)
  }

  it('stays dormant until the player is detected', () => {
    const d = makeDroid(origin.x, origin.z)
    const ctx = makeCtx()
    const player = { position: new Vector3(origin.x, 0, origin.z + 20) }
    run(d, player, ctx, 1)
    expect(d.state).toBe('dormant')
    player.position.z = origin.z + DROID.detectionRange - 1
    run(d, player, ctx, 0.05)
    expect(d.state).toBe('booting')
    expect(ctx.onActivate).toHaveBeenCalledOnce()
  })

  it('telegraphs then lands a melee strike at close range', () => {
    const d = makeDroid(origin.x, origin.z)
    d.alerted = true
    const ctx = makeCtx()
    const player = { position: new Vector3(origin.x, 0, origin.z + 2.2) }
    run(d, player, ctx, DROID.bootTime + 0.05)
    expect(d.state).toBe('windup')
    expect(ctx.meleeHit).not.toHaveBeenCalled()
    run(d, player, ctx, DROID.windup + DROID.strikeDuration)
    expect(ctx.onStrike).toHaveBeenCalled()
    expect(ctx.meleeHit).toHaveBeenCalledOnce()
  })

  it('charges and fires at mid range', () => {
    const d = makeDroid(origin.x, origin.z)
    d.alerted = true
    const ctx = makeCtx()
    const player = { position: new Vector3(origin.x, 0, origin.z + 12) }
    run(d, player, ctx, DROID.bootTime + 0.1)
    expect(d.state).toBe('charging')
    run(d, player, ctx, DROID.chargeTime + 0.05)
    expect(ctx.fire).toHaveBeenCalledOnce()
    expect(d.rangedCooldown).toBeGreaterThan(0)
  })

  it('staggers when poise breaks, interrupting a wind-up', () => {
    const d = makeDroid(origin.x, origin.z)
    d.state = 'windup'
    d.timer = 1
    expect(applyDroidHit(d, DROID.staggerPoise - 5)).toBe(false)
    expect(applyDroidHit(d, 10)).toBe(true)
    expect(d.state).toBe('stagger')
    const ctx = makeCtx()
    const player = { position: new Vector3(origin.x, 0, origin.z + 1.5) }
    run(d, player, ctx, DROID.staggerTime * 0.5)
    expect(d.state).toBe('stagger')
    expect(ctx.meleeHit).not.toHaveBeenCalled()
    run(d, player, ctx, DROID.staggerTime * 0.6)
    expect(d.state).not.toBe('stagger')
  })

  it('stays on the ground and reports walking speed while chasing', () => {
    const d = makeDroid(origin.x, origin.z)
    d.state = 'chase'
    const player = { position: new Vector3(origin.x, 0, origin.z + 5) }
    run(d, player, { ...makeCtx(), lineOfSight: () => false }, 0.2)
    expect(d.position.y).toBe(0)
    expect(d.speed).toBeCloseTo(DROID.chaseSpeed, 0)
  })

  it('does nothing once destroyed', () => {
    const d = makeDroid(origin.x, origin.z)
    d.state = 'destroyed'
    const ctx = makeCtx()
    run(d, { position: new Vector3(origin.x, 0, origin.z + 1) }, ctx, 1)
    expect(ctx.meleeHit).not.toHaveBeenCalled()
    expect(ctx.fire).not.toHaveBeenCalled()
  })
})
