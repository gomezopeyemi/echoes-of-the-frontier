// Procedural sound effects via the Web Audio API. No asset files needed for
// the prototype; each cue can later be swapped for licensed recordings.

let ctx = null
let master = null
let noiseBuffer = null

function noiseBuf() {
  if (!noiseBuffer) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  }
  return noiseBuffer
}

function tone({ type = 'sine', f0, f1 = f0, dur, gain = 0.2, delay = 0 }) {
  if (!ctx) return
  const t = ctx.currentTime + delay
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = type
  o.frequency.setValueAtTime(f0, t)
  o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur)
  g.gain.setValueAtTime(gain, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(master)
  o.start(t)
  o.stop(t + dur + 0.05)
}

function noise({ dur, gain = 0.2, freq = 1200, filter = 'lowpass', delay = 0 }) {
  if (!ctx) return
  const t = ctx.currentTime + delay
  const src = ctx.createBufferSource()
  src.buffer = noiseBuf()
  const f = ctx.createBiquadFilter()
  f.type = filter
  f.frequency.value = freq
  const g = ctx.createGain()
  g.gain.setValueAtTime(gain, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(f).connect(g).connect(master)
  src.start(t, Math.random())
  src.stop(t + dur + 0.05)
}

function startAmbience() {
  // Low reactor drone
  const drone = ctx.createGain()
  drone.gain.value = 0.045
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 180
  for (const f of [48, 48.6, 72.3]) {
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.value = f
    o.connect(lp)
    o.start()
  }
  lp.connect(drone).connect(master)

  // Wind: looping noise through a slowly swept band-pass
  const src = ctx.createBufferSource()
  src.buffer = noiseBuf()
  src.loop = true
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 420
  bp.Q.value = 0.7
  const wind = ctx.createGain()
  wind.gain.value = 0.05
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 0.08
  const lfoGain = ctx.createGain()
  lfoGain.gain.value = 220
  lfo.connect(lfoGain).connect(bp.frequency)
  lfo.start()
  src.connect(bp).connect(wind).connect(master)
  src.start()
}

export const audio = {
  init() {
    if (ctx) {
      ctx.resume?.()
      return
    }
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = 0.55
    master.connect(ctx.destination)
    startAmbience()
  },
  shot() {
    tone({ type: 'square', f0: 1400, f1: 220, dur: 0.09, gain: 0.07 })
    noise({ dur: 0.06, gain: 0.08, freq: 4000, filter: 'highpass' })
  },
  hit(crit) {
    tone({ type: 'triangle', f0: crit ? 1800 : 1200, f1: 600, dur: 0.07, gain: 0.08 })
    noise({ dur: 0.08, gain: 0.07, freq: 2500, filter: 'bandpass' })
  },
  dodge() {
    noise({ dur: 0.25, gain: 0.12, freq: 900, filter: 'bandpass' })
  },
  hurt() {
    tone({ type: 'sawtooth', f0: 160, f1: 60, dur: 0.25, gain: 0.18 })
    noise({ dur: 0.2, gain: 0.15, freq: 600 })
  },
  alarm() {
    for (let i = 0; i < 3; i++) tone({ type: 'square', f0: 660, f1: 440, dur: 0.35, gain: 0.06, delay: i * 0.45 })
  },
  windup() {
    tone({ type: 'sawtooth', f0: 200, f1: 900, dur: 0.6, gain: 0.06 })
  },
  charge() {
    tone({ type: 'sine', f0: 300, f1: 1600, dur: 0.85, gain: 0.07 })
  },
  enemyShot() {
    tone({ type: 'sawtooth', f0: 520, f1: 90, dur: 0.3, gain: 0.08 })
  },
  strike() {
    noise({ dur: 0.18, gain: 0.18, freq: 500 })
  },
  explosion() {
    noise({ dur: 1.4, gain: 0.45, freq: 300 })
    tone({ type: 'sine', f0: 90, f1: 30, dur: 1.2, gain: 0.3 })
  },
  interact() {
    tone({ type: 'sine', f0: 880, f1: 1320, dur: 0.12, gain: 0.06 })
    tone({ type: 'sine', f0: 1320, f1: 1760, dur: 0.12, gain: 0.05, delay: 0.1 })
  },
  bladeIgnite() {
    tone({ type: 'sawtooth', f0: 90, f1: 260, dur: 0.18, gain: 0.05 })
    noise({ dur: 0.22, gain: 0.08, freq: 1800, filter: 'bandpass' })
  },
  bladeHit() {
    tone({ type: 'square', f0: 240, f1: 70, dur: 0.16, gain: 0.12 })
    noise({ dur: 0.14, gain: 0.16, freq: 3200, filter: 'bandpass' })
  },
  block() {
    tone({ type: 'triangle', f0: 1500, f1: 900, dur: 0.12, gain: 0.08 })
    noise({ dur: 0.1, gain: 0.1, freq: 5000, filter: 'highpass' })
  },
  stagger() {
    tone({ type: 'sawtooth', f0: 420, f1: 110, dur: 0.45, gain: 0.07 })
  },
  servo() {
    tone({ type: 'sawtooth', f0: 70, f1: 140, dur: 1.4, gain: 0.05 })
    tone({ type: 'square', f0: 210, f1: 380, dur: 0.9, gain: 0.02, delay: 0.5 })
  },
  /** Heavy droid footfall; `level` 0..1 from distance to the player. */
  droidStep(level = 1) {
    if (level <= 0.02) return
    tone({ type: 'sine', f0: 70, f1: 38, dur: 0.22, gain: 0.22 * level })
    noise({ dur: 0.08, gain: 0.06 * level, freq: 400 })
  },
  victory() {
    ;[523, 659, 784, 1046].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.6, gain: 0.08, delay: i * 0.15 }))
  },
  defeat() {
    tone({ type: 'sawtooth', f0: 220, f1: 40, dur: 1.6, gain: 0.15 })
  },
}
