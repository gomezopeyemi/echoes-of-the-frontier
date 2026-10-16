import { useEffect, useRef } from 'react'
import { DROID, PLAYER } from '../game/config'
import { LOGS, MISSION, objectiveTarget } from '../game/mission'
import { runtime } from '../game/runtime'
import { useGame } from '../game/store'

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

function Objective() {
  const stage = useGame((s) => s.stage)
  const dist = useRef()
  useRaf(() => {
    if (!dist.current) return
    const t = objectiveTarget(useGame.getState().stage, runtime.droid.position)
    const p = runtime.player.position
    dist.current.textContent = t ? `${Math.round(Math.hypot(t.x - p.x, t.z - p.z))} m` : ''
  })
  return (
    <div className="panel objective">
      <div className="eyebrow">
        {MISSION.code} · {MISSION.title}
      </div>
      <div className="objective-row" key={stage}>
        <span className="diamond" />
        <span className="objective-text">{MISSION.stages[stage].objective}</span>
        <span className="objective-dist" ref={dist} />
      </div>
    </div>
  )
}

function Vitals() {
  const hp = useGame((s) => s.playerHealth)
  const dodge = useRef()
  useRaf(() => {
    if (dodge.current) {
      const r = runtime.player.dodgeReady
      dodge.current.style.width = `${r * 100}%`
      dodge.current.parentElement.classList.toggle('ready', r >= 1)
    }
  })
  const pct = (hp / PLAYER.maxHealth) * 100
  return (
    <div className="panel vitals">
      <div className="vitals-label">
        <span>VITALS</span>
        <span className="mono">{Math.ceil(hp)}</span>
      </div>
      <div className={`bar health ${pct <= 30 ? 'critical' : ''}`}>
        <div className="bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="vitals-label small">
        <span>EVADE THRUSTER</span>
      </div>
      <div className="bar thruster">
        <div className="bar-fill" ref={dodge} />
      </div>
    </div>
  )
}

function EnemyBar() {
  const status = useGame((s) => s.droidStatus)
  const hp = useGame((s) => s.droidHealth)
  if (status !== 'hostile') return null
  return (
    <div className="enemy">
      <div className="enemy-label">
        <span>{DROID.name}</span>
        <span className="hostile">HOSTILE</span>
      </div>
      <div className="bar enemy-bar">
        <div className="bar-fill" style={{ width: `${(hp / DROID.maxHealth) * 100}%` }} />
      </div>
    </div>
  )
}

function Crosshair() {
  const hitMarker = useGame((s) => s.hitMarker)
  const crit = useGame((s) => s.lastHitCrit)
  return (
    <div className="crosshair">
      <span className="dot" />
      {hitMarker > 0 && <span key={hitMarker} className={`hitmarker ${crit ? 'crit' : ''}`} />}
    </div>
  )
}

function Messages() {
  const messages = useGame((s) => s.messages)
  return (
    <div className="messages">
      {messages.map((m) => (
        <div key={m.id} className="message">
          <span className="speaker">{m.speaker}</span>
          <span>{m.text}</span>
        </div>
      ))}
    </div>
  )
}

function Prompt() {
  const prompt = useGame((s) => s.prompt)
  if (!prompt) return null
  return (
    <div className="prompt">
      <kbd>E</kbd> {prompt === 'terminal' ? 'Access terminal' : 'Download data log'}
    </div>
  )
}

function LogPanel() {
  const openLog = useGame((s) => s.openLog)
  const count = useGame((s) => s.collectedLogs.length)
  if (!openLog) return null
  const log = LOGS[openLog]
  return (
    <div className="panel log">
      <div className="eyebrow">
        DATA LOG RECOVERED · {count}/{Object.keys(LOGS).length}
      </div>
      <h3>{log.title}</h3>
      <p>{log.body}</p>
    </div>
  )
}

function DamageFlash() {
  const hurt = useGame((s) => s.hurtCount)
  const hp = useGame((s) => s.playerHealth)
  return (
    <>
      {hurt > 0 && <div key={hurt} className="damage-flash" />}
      {hp <= 30 && <div className="critical-vignette" />}
    </>
  )
}

function ControlsHint() {
  return (
    <div className="controls-hint">
      <span><kbd>WASD</kbd> Move</span>
      <span><kbd>Shift</kbd> Sprint</span>
      <span><kbd>Mouse</kbd> Aim</span>
      <span><kbd>LMB</kbd> Fire</span>
      <span><kbd>Space</kbd> Evade</span>
      <span><kbd>E</kbd> Interact</span>
      <span><kbd>Esc</kbd> Pause</span>
    </div>
  )
}

export function HUD() {
  const phase = useGame((s) => s.phase)
  if (phase === 'title') return null
  return (
    <div className={`hud ${phase !== 'playing' ? 'dimmed' : ''}`}>
      <Objective />
      <EnemyBar />
      <Vitals />
      <Crosshair />
      <Messages />
      <Prompt />
      <LogPanel />
      <DamageFlash />
      <ControlsHint />
    </div>
  )
}
