import { create } from 'zustand'
import { DROID, PLAYER } from './config'
import { BRIEFING, TRANSMISSIONS } from './mission'
import { applyDroidHit, destroyDroid } from './droidAI'
import { resetRuntime, runtime } from './runtime'
import { input, unlockPointer } from './input'
import { audio } from '../audio/audio'

// Shared, React-observable game state: phase, mission progression, health,
// HUD messages and stats. High-frequency data lives in runtime.js instead.

let messageId = 0
let timers = []
const later = (fn, ms) => timers.push(setTimeout(fn, ms))
const clearTimers = () => {
  timers.forEach(clearTimeout)
  timers = []
}

const missionState = () => ({
  stage: 'deploy', // deploy | encounter | extract | complete
  playerHealth: PLAYER.maxHealth,
  droidHealth: DROID.maxHealth,
  droidStatus: 'dormant', // dormant | hostile | destroyed
  messages: [],
  prompt: null,
  openLog: null,
  collectedLogs: [],
  hurtCount: 0,
  lastHit: { amount: 0, blocked: false }, // most recent damage taken (HUD feedback)
  hitMarker: 0,
  lastHitCrit: false,
  warned: {},
  stats: { shotsFired: 0, shotsHit: 0, damageTaken: 0, startedAt: 0, endedAt: 0 },
})

export const useGame = create((set, get) => ({
  phase: 'title', // title | playing | paused | victory | defeat
  runId: 0,
  ...missionState(),

  startMission() {
    clearTimers()
    resetRuntime()
    input.reset()
    audio.init()
    set({ ...missionState(), phase: 'playing', runId: get().runId + 1 })
    set((s) => ({ stats: { ...s.stats, startedAt: performance.now() } }))
    for (const line of BRIEFING) later(() => get().stage === 'deploy' && get().say(line, 6500), line.at)
  },

  pause() {
    if (get().phase !== 'playing') return
    unlockPointer() // free the cursor so the pause menu is clickable (P pauses without the browser releasing it)
    set({ phase: 'paused' })
  },
  resume() {
    if (get().phase === 'paused') {
      input.reset()
      set({ phase: 'playing' })
    }
  },

  say({ speaker, text }, duration = 5500) {
    const id = ++messageId
    set((s) => ({ messages: [...s.messages.slice(-2), { id, speaker, text }] }))
    later(() => set((s) => ({ messages: s.messages.filter((m) => m.id !== id) })), duration)
  },

  /** Show a one-off warning only once per mission. */
  warnOnce(key) {
    if (get().warned[key]) return
    set((s) => ({ warned: { ...s.warned, [key]: true } }))
    get().say(TRANSMISSIONS[key])
  },

  setPrompt(prompt) {
    if (get().prompt !== prompt) set({ prompt })
  },

  accessTerminal() {
    if (get().stage !== 'deploy') return
    audio.interact()
    get().say(TRANSMISSIONS.terminal)
    runtime.droid.alerted = true
  },

  collectLog(id) {
    const s = get()
    if (s.collectedLogs.includes(id)) return
    audio.interact()
    set({ collectedLogs: [...s.collectedLogs, id], openLog: id })
    later(() => get().openLog === id && set({ openLog: null }), 9000)
  },
  closeLog() {
    set({ openLog: null })
  },

  activateEncounter() {
    if (get().droidStatus !== 'dormant') return
    audio.alarm()
    set({ droidStatus: 'hostile', stage: get().stage === 'deploy' ? 'encounter' : get().stage })
    later(() => get().droidStatus === 'hostile' && get().say(TRANSMISSIONS.activate), 1200)
  },

  registerShot(hit) {
    set((s) => ({ stats: { ...s.stats, shotsFired: s.stats.shotsFired + 1, shotsHit: s.stats.shotsHit + (hit ? 1 : 0) } }))
  },

  /** Returns { staggered } so callers can add feedback. */
  damageDroid(amount, crit = false) {
    const s = get()
    if (s.droidStatus === 'destroyed' || s.phase !== 'playing') return { staggered: false }
    const hp = Math.max(0, s.droidHealth - amount)
    const staggered = hp > 0 && applyDroidHit(runtime.droid, amount)
    if (staggered) audio.stagger()
    set({ droidHealth: hp, hitMarker: s.hitMarker + 1, lastHitCrit: crit })
    if (hp / DROID.maxHealth < DROID.enrageThreshold && !runtime.droid.enraged && hp > 0) {
      runtime.droid.enraged = true
      get().say(TRANSMISSIONS.enraged, 4000)
    }
    if (hp <= 0) {
      destroyDroid(runtime.droid)
      audio.explosion()
      set({ droidStatus: 'destroyed', stage: 'extract' })
      get().say(TRANSMISSIONS.destroyed, 7000)
    }
    return { staggered }
  },

  /**
   * Apply damage to the player. Droid attacks are `blockable`: holding guard
   * absorbs most of it and skips the hit reaction. Returns { applied, blocked }.
   */
  damagePlayer(amount, { blockable = false } = {}) {
    const s = get()
    const p = runtime.player
    if (s.phase !== 'playing' || p.invulnerable) return { applied: false, blocked: false }
    const blocked = blockable && p.guarding
    if (blocked) {
      amount *= PLAYER.guardDamageMultiplier
      audio.block()
    } else {
      p.hitT = 0
      audio.hurt()
    }
    const hp = Math.max(0, s.playerHealth - amount)
    set({
      playerHealth: hp,
      hurtCount: s.hurtCount + 1,
      lastHit: { amount: s.playerHealth - hp, blocked },
      stats: { ...s.stats, damageTaken: s.stats.damageTaken + (s.playerHealth - hp) },
    })
    if (hp > 0 && hp <= 30) get().warnOnce('lowHealth')
    if (hp <= 0) get().endMission('defeat')
    return { applied: true, blocked }
  },

  endMission(result) {
    const s = get()
    if (s.phase !== 'playing') return
    clearTimers()
    input.reset()
    unlockPointer()
    if (result === 'victory') audio.victory()
    else audio.defeat()
    set({
      phase: result,
      stage: result === 'victory' ? 'complete' : s.stage,
      prompt: null,
      stats: { ...s.stats, endedAt: performance.now() },
    })
  },
}))

if (import.meta.env.DEV && typeof window !== 'undefined') window.__echoes = { useGame, runtime }
