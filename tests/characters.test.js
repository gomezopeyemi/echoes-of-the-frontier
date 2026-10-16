import { beforeEach, describe, expect, it } from 'vitest'
import { PLAYER } from '../src/game/config'
import { runtime } from '../src/game/runtime'
import { useGame } from '../src/game/store'
import { OperativeAnimator, createOperativeDriver } from '../src/characters/operative/operativeAnimator'
import { DroidAnimator, createDroidDriver } from '../src/characters/droid/droidAnimator'

const finitePose = (pose) =>
  Object.values(pose.joints).every((j) => j.every(Number.isFinite)) && pose.root.every(Number.isFinite)

const run = (anim, driver, seconds, step = 1 / 60) => {
  let pose
  for (let t = 0; t < seconds; t += step) pose = anim.update(step, driver)
  return pose
}

describe('operative animator', () => {
  it('stays finite through every action, including rapid state changes', () => {
    const a = new OperativeAnimator()
    const d = createOperativeDriver()
    const steps = [
      () => Object.assign(d, { speed: 2.5 }),
      () => Object.assign(d, { speed: 8.6 }),
      () => Object.assign(d, { speed: 4, moveAngle: Math.PI / 2, aiming: true }),
      () => Object.assign(d, { speed: 3, moveAngle: Math.PI, aimPitch: 0.5 }),
      () => Object.assign(d, { aiming: false, attackT: 0.2 }),
      () => Object.assign(d, { attackT: null, guarding: true }),
      () => Object.assign(d, { guarding: false, dashT: 0.1 }),
      () => Object.assign(d, { dashT: null, hitT: 0 }),
      () => Object.assign(d, { defeatT: 1.5, speed: 0 }),
    ]
    for (const s of steps) {
      s()
      expect(finitePose(run(a, d, 0.3))).toBe(true)
    }
  })

  it('ignites the blade only while attacking or guarding', () => {
    const a = new OperativeAnimator()
    const d = createOperativeDriver()
    run(a, d, 0.5)
    expect(a.bladeOn).toBe(0)
    for (let t = 0; t < 0.25; t += 1 / 60) {
      d.attackT = t
      a.update(1 / 60, d)
    }
    expect(a.bladeOn).toBeGreaterThan(0.9)
    d.attackT = null
    run(a, d, 1)
    expect(a.bladeOn).toBe(0)
  })

  it('defeat pose drops the body to its knees', () => {
    const a = new OperativeAnimator()
    const d = createOperativeDriver()
    d.defeatT = 0
    for (let t = 0; t < 2; t += 1 / 60) {
      d.defeatT = t
      a.update(1 / 60, d)
    }
    expect(a.current.root[1]).toBeLessThan(-0.35)
  })
})

describe('droid animator', () => {
  it('stays finite in every AI state and emits footsteps while walking', () => {
    const a = new DroidAnimator()
    const d = createDroidDriver()
    for (const state of ['dormant', 'booting', 'chase', 'windup', 'strike', 'recover', 'charging', 'stagger', 'destroyed']) {
      d.state = state
      for (let t = 0; t < 0.6; t += 1 / 60) {
        d.stateT = t
        expect(finitePose(a.update(1 / 60, d))).toBe(true)
      }
    }
    d.state = 'chase'
    d.speed = 4.4
    let steps = 0
    for (let t = 0; t < 2; t += 1 / 60) steps += a.update(1 / 60, d).joints && a.events.length
    expect(steps).toBeGreaterThan(3)
  })
})

describe('guard and hit reaction (store rules)', () => {
  beforeEach(() => {
    useGame.setState({ phase: 'playing', playerHealth: 100 })
    runtime.player.invulnerable = false
    runtime.player.guarding = false
    runtime.player.hitT = 99
  })

  it('guarding reduces blockable damage and skips the hit reaction', () => {
    runtime.player.guarding = true
    const r = useGame.getState().damagePlayer(20, { blockable: true })
    expect(r.blocked).toBe(true)
    expect(useGame.getState().playerHealth).toBeCloseTo(100 - 20 * PLAYER.guardDamageMultiplier)
    expect(runtime.player.hitT).toBe(99)
  })

  it('unguarded hits deal full damage and trigger the hit reaction', () => {
    useGame.getState().damagePlayer(20, { blockable: true })
    expect(useGame.getState().playerHealth).toBe(80)
    expect(runtime.player.hitT).toBe(0)
  })

  it('hazards are never blockable', () => {
    runtime.player.guarding = true
    useGame.getState().damagePlayer(10)
    expect(useGame.getState().playerHealth).toBe(90)
  })
})
