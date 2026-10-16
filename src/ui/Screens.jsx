import { lockPointer } from '../game/input'
import { LOGS, MISSION } from '../game/mission'
import { useGame } from '../game/store'

function deploy() {
  lockPointer()
  useGame.getState().startMission()
}

function resume() {
  lockPointer()
  useGame.getState().resume()
}

function Title() {
  return (
    <div className="screen title-screen">
      <div className="title-block">
        <div className="eyebrow">A frontier operative's record</div>
        <h1>
          Echoes <span>of the</span> Frontier
        </h1>
        <div className="divider" />
        <div className="briefing">
          <div className="eyebrow">
            {MISSION.code} · {MISSION.title}
          </div>
          <p>
            Outpost-9 went silent nineteen days ago. You are being inserted alone to find out why. Recover what you can, survive whatever
            is still running down there, and reach extraction.
          </p>
          <div className="mono dim">{MISSION.location}</div>
        </div>
        <button className="btn primary" onClick={deploy}>
          Deploy
        </button>
        <div className="keys">
          <span><kbd>WASD</kbd> move</span>
          <span><kbd>Shift</kbd> sprint</span>
          <span><kbd>Mouse</kbd> look / aim</span>
          <span><kbd>LMB</kbd> fire</span>
          <span><kbd>Space</kbd> evade (invulnerable)</span>
          <span><kbd>E</kbd> interact</span>
        </div>
      </div>
    </div>
  )
}

function Paused() {
  return (
    <div className="screen overlay">
      <div className="card">
        <div className="eyebrow">Mission paused</div>
        <h2>Holding position</h2>
        <div className="actions">
          <button className="btn primary" onClick={resume}>
            Resume
          </button>
          <button className="btn" onClick={deploy}>
            Restart mission
          </button>
        </div>
      </div>
    </div>
  )
}

function Stats() {
  const stats = useGame((s) => s.stats)
  const logs = useGame((s) => s.collectedLogs.length)
  const seconds = Math.max(0, (stats.endedAt - stats.startedAt) / 1000)
  const acc = stats.shotsFired ? Math.round((stats.shotsHit / stats.shotsFired) * 100) : 0
  return (
    <dl className="stats">
      <div>
        <dt>Mission time</dt>
        <dd>
          {Math.floor(seconds / 60)}:{String(Math.floor(seconds % 60)).padStart(2, '0')}
        </dd>
      </div>
      <div>
        <dt>Accuracy</dt>
        <dd>{acc}%</dd>
      </div>
      <div>
        <dt>Damage taken</dt>
        <dd>{Math.round(stats.damageTaken)}</dd>
      </div>
      <div>
        <dt>Data logs</dt>
        <dd>
          {logs}/{Object.keys(LOGS).length}
        </dd>
      </div>
    </dl>
  )
}

function Victory() {
  return (
    <div className="screen overlay victory">
      <div className="card">
        <div className="eyebrow">{MISSION.code} complete</div>
        <h2>Extraction confirmed</h2>
        <p>The dropship lifts off through the dust. Whatever the colony found in that ridge is still out there, and it is still transmitting.</p>
        <Stats />
        <div className="actions">
          <button className="btn primary" onClick={deploy}>
            Replay mission
          </button>
        </div>
      </div>
    </div>
  )
}

function Defeat() {
  return (
    <div className="screen overlay defeat">
      <div className="card">
        <div className="eyebrow">Operative down</div>
        <h2>Signal lost</h2>
        <p>Vital signs flatlined at Outpost-9. Command is preparing another insertion.</p>
        <Stats />
        <div className="actions">
          <button className="btn primary" onClick={deploy}>
            Redeploy
          </button>
        </div>
      </div>
    </div>
  )
}

export function Screens() {
  const phase = useGame((s) => s.phase)
  if (phase === 'title') return <Title />
  if (phase === 'paused') return <Paused />
  if (phase === 'victory') return <Victory />
  if (phase === 'defeat') return <Defeat />
  return null
}
