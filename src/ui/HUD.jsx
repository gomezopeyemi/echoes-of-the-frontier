import { useEffect, useRef, useState } from 'react'
import { DROID, PLAYER } from '../game/config'
import { LOGS, MISSION, objectiveTarget } from '../game/mission'
import { runtime } from '../game/runtime'
import { useGame } from '../game/store'
import { BEACON } from '../world/layout'
import { IconBlade, IconDash, IconExtract, IconGuard, IconHelmet, IconLock, IconPistol, IconPulse, IconTarget } from './hudIcons'
import './hud.css'

// In-game HUD. Everything shown here reads an existing source of truth:
//   useGame (zustand)  - health, mission stage, droid status, prompts, hits, messages
//   runtime            - per-frame values (cooldowns, ability gates, droid AI state,
//                        poise, positions), published by the entities themselves
// Per-frame values are written straight to the DOM from a rAF loop so the HUD
// never re-renders React (and never touches the Canvas) 60 times a second.

const CRITICAL_HP = 30 // same threshold the store uses for the "vitals critical" warning
const STAGES = ['deploy', 'encounter', 'extract']

/** Run a callback every animation frame (for values that live in runtime, not the store). */
function useRaf(fn) {
  const ref = useRef(fn)
  ref.current = fn
  useEffect(() => {
    let id
    const loop = () => {
      ref.current()
      id = requestAnimationFrame(loop)
    }
    id = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(id)
  }, [])
}

const distTo = (t) => {
  const p = runtime.player.position
  return Math.hypot(t.x - p.x, t.z - p.z)
}

function Panel({ className = '', children, ...rest }) {
  return (
    <section className={`hud-panel ${className}`} {...rest}>
      <i className="hud-corner tl" />
      <i className="hud-corner br" />
      {children}
    </section>
  )
}

// ---------------------------------------------------------------- top left

function MissionPanel() {
  const stage = useGame((s) => s.stage)
  const dist = useRef()
  useRaf(() => {
    if (!dist.current) return
    const t = objectiveTarget(useGame.getState().stage, runtime.droid.position)
    dist.current.textContent = t ? `${Math.round(distTo(t))} m` : ''
  })
  const index = stage === 'complete' ? STAGES.length : STAGES.indexOf(stage)
  return (
    <Panel className="hud-mission" aria-label="Mission">
      <div className="hud-label">
        <span className="hud-label-mark" />
        Frontier Operations
        <span className="hud-label-meta">Esc · pause</span>
      </div>
      <div className="hud-mission-id">{MISSION.code}</div>
      <div className="hud-mission-title">{MISSION.title}</div>
      <div className="hud-objective" key={stage}>
        <span className={`hud-obj-marker ${stage === 'complete' ? 'done' : ''}`} />
        <span className="hud-obj-text">{MISSION.stages[stage].objective}</span>
        <span className="hud-obj-dist" ref={dist} />
      </div>
      <div className="hud-obj-steps">
        {STAGES.map((st, i) => (
          <span key={st} className={i < index ? 'done' : i === index ? 'active' : ''} />
        ))}
        <em>
          Obj {Math.min(index + 1, STAGES.length)}/{STAGES.length}
        </em>
      </div>
    </Panel>
  )
}

// ---------------------------------------------------------------- top right

function CombatPanel() {
  const status = useGame((s) => s.droidStatus)
  const root = useRef()
  const meter = useRef()
  const state = useRef()
  const range = useRef()
  useRaf(() => {
    if (!root.current) return
    const p = runtime.player
    const a = p.abilities
    const blade = p.weapon === 'blade'
    if (root.current.dataset.weapon !== p.weapon) root.current.dataset.weapon = p.weapon
    const cur = blade ? a.strike : a.shot
    meter.current.style.transform = `scaleX(${cur.progress})`
    let label
    if (blade) label = a.guard.active ? 'Guarding' : a.strike.active ? 'Striking' : 'Ready'
    else label = cur.progress < 1 ? 'Cycling' : cur.available ? 'Ready' : 'Standby'
    if (state.current.textContent !== label) state.current.textContent = label
    if (range.current) range.current.textContent = `${Math.round(distTo(runtime.droid.position))} m`
  })
  return (
    <Panel className="hud-combat" aria-label="Combat status">
      <div ref={root} className="hud-weapon" data-weapon="pistol">
        <div className="hud-label">Active weapon</div>
        <div className="hud-weapon-row pistol">
          <IconPistol size={26} />
          <div>
            <div className="hud-weapon-name">Energy pistol</div>
            <div className="hud-weapon-sub">Sidearm · LMB</div>
          </div>
        </div>
        <div className="hud-weapon-row blade">
          <IconBlade size={26} />
          <div>
            <div className="hud-weapon-name">Energy blade</div>
            <div className="hud-weapon-sub">Melee · RMB / F · Q guard</div>
          </div>
        </div>
        <div className="hud-weapon-meter">
          <i ref={meter} />
        </div>
        <div className="hud-weapon-state" ref={state} />
      </div>
      <div className={`hud-threat ${status}`}>
        <IconTarget size={14} />
        {status === 'dormant' && <span>No contact</span>}
        {status === 'hostile' && (
          <>
            <span>Hostile contact</span>
            <b ref={range} />
          </>
        )}
        {status === 'destroyed' && <span>Threat neutralized</span>}
      </div>
    </Panel>
  )
}

// ---------------------------------------------------------------- target (top centre)

const DROID_STATE = {
  dormant: ['Standby', ''],
  booting: ['Acquiring target', 'warn'],
  chase: ['Pursuit', ''],
  windup: ['Melee wind-up', 'warn'],
  strike: ['Striking', 'warn'],
  recover: ['Recovering', 'open'],
  charging: ['Cannon charging', 'warn'],
  stagger: ['Staggered', 'open'],
  destroyed: ['Neutralized', ''],
}

function TargetPanel() {
  const status = useGame((s) => s.droidStatus)
  const hp = useGame((s) => s.droidHealth)
  const [linger, setLinger] = useState(false)
  const root = useRef()
  const stateLabel = useRef()
  const poise = useRef()
  const overheat = useRef()

  useEffect(() => {
    if (status !== 'destroyed') return
    setLinger(true)
    const t = setTimeout(() => setLinger(false), 3000)
    return () => clearTimeout(t)
  }, [status])

  useRaf(() => {
    if (!root.current) return
    const d = runtime.droid
    const [label, tone] = DROID_STATE[d.state] ?? ['', '']
    if (stateLabel.current.textContent !== label) stateLabel.current.textContent = label
    if (root.current.dataset.tone !== tone) root.current.dataset.tone = tone
    poise.current.style.transform = `scaleX(${Math.min(1, d.poise / DROID.staggerPoise)})`
    overheat.current.hidden = !d.enraged || d.state === 'destroyed'
  })

  // Only while actually engaged (the encounter is live), plus a short confirmation after the kill.
  if (status !== 'hostile' && !(status === 'destroyed' && linger)) return null
  const pct = (hp / DROID.maxHealth) * 100
  return (
    <div ref={root} className={`hud-target ${status}`} aria-label="Target">
      <div className="hud-target-head">
        <span className="hud-target-name">{DROID.name}</span>
        <span className="hud-target-state" ref={stateLabel} />
        <span className="hud-target-flag" ref={overheat} hidden>
          Overheated
        </span>
      </div>
      <div className="hud-bar hud-target-bar">
        <i className="trail" style={{ width: `${pct}%` }} />
        <i className="fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="hud-target-poise">
        <span>Balance</span>
        <div>
          <i ref={poise} />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- bottom left

function PlayerStatus() {
  const hp = useGame((s) => s.playerHealth)
  const hurt = useGame((s) => s.hurtCount)
  const lastHit = useGame((s) => s.lastHit)
  const flag = useRef()
  useRaf(() => {
    if (!flag.current) return
    const a = runtime.player.abilities
    const text = a.dash.active ? 'Evading · invulnerable' : a.guard.active ? 'Guard up · −70% damage' : ''
    if (flag.current.textContent !== text) flag.current.textContent = text
  })
  const pct = Math.max(0, (hp / PLAYER.maxHealth) * 100)
  const critical = hp > 0 && hp <= CRITICAL_HP
  return (
    <Panel className={`hud-player ${critical ? 'critical' : ''}`} aria-label="Operative status">
      <div className="hud-portrait">
        <IconHelmet size={30} />
      </div>
      <div className="hud-player-body">
        <div className="hud-player-head">
          <span className="hud-label">Vitals</span>
          <span className="hud-hp">
            <b>{Math.ceil(hp)}</b> / {PLAYER.maxHealth}
          </span>
        </div>
        <div className="hud-bar hud-hpbar">
          <i className="trail" style={{ width: `${pct}%` }} />
          <i className="fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="hud-player-foot">
          {critical ? <span className="hud-critical-tag">Vitals critical</span> : <span className="hud-status-flag" ref={flag} />}
          {hurt > 0 && lastHit.amount > 0 && (
            <span key={hurt} className={`hud-dmg ${lastHit.blocked ? 'blocked' : ''}`}>
              {lastHit.blocked ? 'Blocked ' : ''}−{Math.round(lastHit.amount)}
            </span>
          )}
        </div>
      </div>
    </Panel>
  )
}

// ---------------------------------------------------------------- bottom centre

// Slots follow the design board's order. Bindings are the game's real controls.
const SLOTS = [
  { id: 'strike', name: 'Energy Strike', hint: 'Energy blade slash', keys: 'RMB / F', Icon: IconBlade },
  { id: 'dash', name: 'Combat Dash', hint: 'Invulnerable dash', keys: 'Space', Icon: IconDash },
  { id: 'guard', name: 'Energy Guard', hint: 'Hold to block 70% of droid damage', keys: 'Hold Q', Icon: IconGuard },
  { id: 'pulse', name: 'Kinetic Pulse', hint: 'Not yet available', keys: '—', Icon: IconPulse, offline: true },
  { id: 'shot', name: 'Plasma Shot', hint: 'Energy pistol', keys: 'LMB', Icon: IconPistol },
]

function slotState(a) {
  if (a.active) return 'active'
  if (a.progress < 0.999) return 'cooling' // tolerate float residue in the cooldown clock
  return a.available ? 'ready' : 'blocked'
}

function AbilityBar() {
  const refs = useRef({})
  useRaf(() => {
    const abilities = runtime.player.abilities
    for (const slot of SLOTS) {
      const el = refs.current[slot.id]
      const a = abilities[slot.id]
      if (!el || !a) continue
      const st = slotState(a)
      if (el.dataset.state !== st) el.dataset.state = st
      if (st === 'cooling') el.style.setProperty('--cd', a.progress.toFixed(3))
    }
  })
  return (
    <div className="hud-abilities" aria-label="Abilities">
      {SLOTS.map(({ id, name, hint, keys, Icon, offline }) => (
        <div
          key={id}
          ref={(el) => (refs.current[id] = el)}
          className="hud-slot"
          data-state={offline ? 'offline' : 'blocked'}
          title={`${name}: ${hint}`}
        >
          <div className="hud-slot-frame">
            <Icon size={22} />
            {offline && (
              <span className="hud-slot-lock">
                <IconLock size={11} />
              </span>
            )}
            <i className="hud-slot-cd" />
          </div>
          <span className="hud-slot-key">{keys}</span>
          <span className="hud-slot-name">{offline ? 'Offline' : name}</span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------- bottom right

const PROMPTS = {
  terminal: ['Access terminal', 'Command module'],
  log: ['Download data log', 'Colony records'],
}

function InteractionPrompt() {
  const prompt = useGame((s) => s.prompt)
  const extract = useRef()
  useRaf(() => {
    if (!extract.current) return
    const g = useGame.getState()
    // Extraction is automatic on the pad; guide the player only once they are close to it.
    const show = g.phase === 'playing' && g.stage === 'extract' && !g.prompt && distTo(BEACON) < 9
    if (extract.current.hidden === show) extract.current.hidden = !show
  })
  const [action, detail] = prompt ? PROMPTS[prompt === 'terminal' ? 'terminal' : 'log'] : []
  return (
    <div className="hud-prompts">
      {prompt && (
        <div className="hud-prompt" key={prompt}>
          <kbd className="hud-key">E</kbd>
          <div>
            <b>{action}</b>
            <span>{detail}</span>
          </div>
        </div>
      )}
      <div className="hud-prompt extract" ref={extract} hidden>
        <span className="hud-key icon">
          <IconExtract size={14} />
        </span>
        <div>
          <b>Extract</b>
          <span>Step onto the beacon pad</span>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- centre / feedback

function Crosshair() {
  const hitMarker = useGame((s) => s.hitMarker)
  const crit = useGame((s) => s.lastHitCrit)
  return (
    <div className="hud-crosshair">
      <i className="t" />
      <i className="r" />
      <i className="b" />
      <i className="l" />
      <span className="dot" />
      {hitMarker > 0 && <span key={hitMarker} className={`hud-hit ${crit ? 'crit' : ''}`} />}
    </div>
  )
}

function Comms() {
  const messages = useGame((s) => s.messages)
  return (
    <div className="hud-comms">
      {messages.map((m) => (
        <div key={m.id} className="hud-comm">
          <span className="hud-comm-from">{m.speaker}</span>
          <span>{m.text}</span>
        </div>
      ))}
    </div>
  )
}

function LogPanel() {
  const openLog = useGame((s) => s.openLog)
  const count = useGame((s) => s.collectedLogs.length)
  if (!openLog) return null
  const log = LOGS[openLog]
  return (
    <Panel className="hud-log">
      <div className="hud-label">
        <span className="hud-label-mark" />
        Data log recovered · {count}/{Object.keys(LOGS).length}
      </div>
      <h3>{log.title}</h3>
      <p>{log.body}</p>
    </Panel>
  )
}

function DamageFeedback() {
  const hurt = useGame((s) => s.hurtCount)
  const lastHit = useGame((s) => s.lastHit)
  const hp = useGame((s) => s.playerHealth)
  return (
    <>
      {hurt > 0 && <div key={hurt} className={`hud-damage-edge ${lastHit.blocked ? 'blocked' : ''}`} />}
      {hp > 0 && hp <= CRITICAL_HP && <div className="hud-critical-edge" />}
    </>
  )
}

export function HUD() {
  const phase = useGame((s) => s.phase)
  if (phase === 'title') return null
  return (
    <div className={`hud ${phase !== 'playing' ? 'dimmed' : ''}`}>
      <DamageFeedback />
      <MissionPanel />
      <TargetPanel />
      <CombatPanel />
      <LogPanel />
      <Crosshair />
      <Comms />
      <PlayerStatus />
      <AbilityBar />
      <InteractionPrompt />
    </div>
  )
}
