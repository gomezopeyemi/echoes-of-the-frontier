// Keyboard + mouse state, polled by entities inside useFrame.

const keys = new Set()
const pressed = new Set()
const mouse = { dx: 0, dy: 0, fire: false }

export const input = {
  isDown: (code) => keys.has(code),
  /** True once per physical key press. */
  consumePressed(code) {
    if (!pressed.has(code)) return false
    pressed.delete(code)
    return true
  },
  consumeMouse() {
    const out = { dx: mouse.dx, dy: mouse.dy }
    mouse.dx = 0
    mouse.dy = 0
    return out
  },
  get fire() {
    return mouse.fire
  },
  reset() {
    keys.clear()
    pressed.clear()
    mouse.dx = mouse.dy = 0
    mouse.fire = false
  },
}

const GAME_KEYS = new Set(['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])

export function attachInput() {
  const down = (e) => {
    if (GAME_KEYS.has(e.code)) e.preventDefault()
    if (!e.repeat) pressed.add(e.code)
    keys.add(e.code)
  }
  const up = (e) => keys.delete(e.code)
  // Chrome reports one bogus, huge movement right after pointer lock engages
  // (the cursor's jump to centre). Drop events briefly after a lock change
  // and any single event that is implausibly large.
  let ignoreUntil = 0
  const lockChange = () => (ignoreUntil = performance.now() + 100)
  const move = (e) => {
    const mx = e.movementX || 0
    const my = e.movementY || 0
    if (performance.now() < ignoreUntil || Math.abs(mx) > 300 || Math.abs(my) > 300) return
    mouse.dx += mx
    mouse.dy += my
  }
  const mdown = (e) => {
    if (e.button === 0) mouse.fire = true
    if (e.button === 2) pressed.add('Mouse2')
  }
  const noMenu = (e) => e.preventDefault()
  const mup = (e) => {
    if (e.button === 0) mouse.fire = false
  }
  const blur = () => input.reset()
  window.addEventListener('keydown', down)
  window.addEventListener('keyup', up)
  window.addEventListener('mousemove', move)
  window.addEventListener('mousedown', mdown)
  window.addEventListener('mouseup', mup)
  window.addEventListener('blur', blur)
  window.addEventListener('contextmenu', noMenu)
  document.addEventListener('pointerlockchange', lockChange)
  return () => {
    document.removeEventListener('pointerlockchange', lockChange)
    window.removeEventListener('keydown', down)
    window.removeEventListener('keyup', up)
    window.removeEventListener('mousemove', move)
    window.removeEventListener('mousedown', mdown)
    window.removeEventListener('mouseup', mup)
    window.removeEventListener('blur', blur)
    window.removeEventListener('contextmenu', noMenu)
  }
}

export function lockPointer() {
  try {
    const result = document.body.requestPointerLock?.()
    result?.catch?.(() => {})
  } catch {
    // Pointer lock unavailable (e.g. sandboxed iframe): mouse-look still works while the cursor moves.
  }
}

export function unlockPointer() {
  if (document.pointerLockElement) document.exitPointerLock?.()
}
