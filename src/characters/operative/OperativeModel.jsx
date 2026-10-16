import { useLayoutEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, MeshBasicMaterial, PlaneGeometry } from 'three'
import { charMaterials, dynamicEmissive } from '../materials'
import { bladeGeometry, capsule, cyl, rbox, sphere, torus } from '../geometry'
import { applyPose } from '../pose'
import { bakeJoints } from '../bakeJoints'
import { OperativeAnimator } from './operativeAnimator'

// FRONTIER OPERATIVE — prototype articulated model (procedural geometry).
//
// Built from bevelled primitives on a 17-joint hierarchy so every piece of
// armour and equipment is parented to the bone it belongs to (no floating or
// detached parts). Proportions: ~1.80 m tall, athletic. Design notes from the
// board: enclosed helmet with glossy black visor and blue optics, weathered
// tan scarf + torn mantle, light composite plates over a charcoal undersuit,
// asymmetric shoulders/thighs, survival pack with a blue status strip,
// compact energy pistol (right hand) and energy blade (left hip / left hand).
//
// This is a stand-in for a sculpted, skinned GLTF character. The joint names
// match a conventional humanoid rig so a skinned model can later be driven by
// the same animator.

/** Helmet panels are sphere sections centred on the face direction (-Z). */
const F = Math.PI * 1.5

const BIND = {
  pelvis: [0, 0.96, 0],
  spine: [0, 0.1, 0],
  chest: [0, 0.2, 0],
  neck: [0, 0.25, 0.005],
  head: [0, 0.07, 0],
  shoulderL: [-0.2, 0.165, 0],
  elbowL: [0, -0.29, 0],
  wristL: [0, -0.26, 0],
  shoulderR: [0.2, 0.165, 0],
  elbowR: [0, -0.29, 0],
  wristR: [0, -0.26, 0],
  hipL: [-0.1, -0.06, 0],
  kneeL: [0, -0.43, 0],
  ankleL: [0, -0.42, 0],
  hipR: [0.1, -0.06, 0],
  kneeR: [0, -0.43, 0],
  ankleR: [0, -0.42, 0],
}

/** Mesh shorthand: g = geometry, m = material, p/r/s = position/rotation/scale, cs = casts shadow. */
function M({ g, m, p, r, s, cs, mref }) {
  return <mesh ref={mref} geometry={g} material={m} position={p} rotation={r} scale={s} castShadow={!!cs} receiveShadow={!!cs} />
}

function Arm({ side, J, mat, children }) {
  const s = side === 'L' ? -1 : 1
  const left = side === 'L'
  return (
    <group ref={J(`shoulder${side}`)} position={BIND[`shoulder${side}`]}>
      <M g={capsule(0.056, 0.17)} m={mat.undersuit} p={[0, -0.13, 0]} cs />
      {/* Pauldrons: heavier composite plate on the left, compact graphite cap on the right */}
      {left ? (
        <>
          <M g={sphere(0.1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2)} m={mat.armorLight} p={[-0.025, 0.015, 0]} r={[0, 0, 0.38]} s={[1.18, 0.85, 1.22]} cs />
          <M g={rbox(0.11, 0.07, 0.15, 0.02)} m={mat.armorGraphite} p={[-0.045, -0.055, 0]} r={[0, 0, 0.3]} cs />
          <M g={rbox(0.014, 0.026, 0.13, 0.005)} m={mat.accentOrange} p={[-0.117, -0.025, 0]} r={[0, 0, 0.42]} />
          <M g={rbox(0.065, 0.1, 0.095, 0.02)} m={mat.armorLight} p={[-0.05, -0.16, 0]} r={[0, 0, 0.06]} cs />
        </>
      ) : (
        <>
          <M g={sphere(0.09, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2)} m={mat.armorGraphite} p={[0.02, 0.01, 0]} r={[0, 0, -0.35]} s={[1.05, 0.75, 1.1]} cs />
          <M g={rbox(0.05, 0.06, 0.1, 0.015)} m={mat.armorLight} p={[0.075, -0.035, 0]} r={[0, 0, -0.3]} />
        </>
      )}
      <group ref={J(`elbow${side}`)} position={BIND[`elbow${side}`]}>
        <M g={sphere(0.047, 12, 10)} m={mat.gunmetal} />
        <M g={capsule(0.048, 0.16)} m={mat.undersuit} p={[0, -0.13, 0]} cs />
        <M g={rbox(left ? 0.085 : 0.09, 0.15, 0.095, 0.025)} m={mat.armorLight} p={[s * 0.004, -0.14, -0.006]} cs />
        <M g={rbox(0.088, 0.02, 0.098, 0.006)} m={mat.armorGraphite} p={[0, -0.215, -0.006]} />
        <group ref={J(`wrist${side}`)} position={BIND[`wrist${side}`]}>
          {/* Reinforced glove */}
          <M g={rbox(0.072, 0.085, 0.036, 0.013)} m={mat.armorGraphite} p={[0, -0.048, 0]} cs />
          <M g={rbox(0.07, 0.026, 0.02, 0.008)} m={mat.gunmetal} p={[0, -0.075, -0.022]} />
          <M g={rbox(0.068, 0.05, 0.032, 0.012)} m={mat.undersuit} p={[0, -0.105, -0.01]} r={[0.5, 0, 0]} />
          <M g={rbox(0.022, 0.052, 0.024, 0.009)} m={mat.armorGraphite} p={[-s * 0.042, -0.055, -0.02]} r={[0.3, 0, -s * 0.35]} />
          {children}
        </group>
      </group>
    </group>
  )
}

function Leg({ side, J, mat }) {
  const s = side === 'L' ? -1 : 1
  const left = side === 'L'
  return (
    <group ref={J(`hip${side}`)} position={BIND[`hip${side}`]}>
      <M g={capsule(0.084, 0.26)} m={mat.undersuit} p={[0, -0.205, 0]} s={[1, 1, 1.08]} cs />
      {left ? (
        <M g={rbox(0.05, 0.17, 0.13, 0.02)} m={mat.armorLight} p={[-0.07, -0.17, -0.005]} r={[0, 0, -0.07]} cs />
      ) : (
        <>
          <M g={rbox(0.05, 0.13, 0.1, 0.015)} m={mat.leather} p={[0.082, -0.2, 0.005]} cs />
          <M g={rbox(0.165, 0.022, 0.16, 0.008)} m={mat.webbing} p={[0, -0.13, 0]} />
        </>
      )}
      <group ref={J(`knee${side}`)} position={BIND[`knee${side}`]}>
        <M g={rbox(0.1, 0.11, 0.06, 0.025)} m={mat.armorLight} p={[0, 0.005, -0.068]} cs />
        <M g={capsule(0.062, 0.26)} m={mat.undersuit} p={[0, -0.19, 0]} cs />
        <M g={rbox(0.085, 0.19, 0.035, 0.014)} m={mat.armorLight} p={[0, -0.17, -0.064]} cs />
        <M g={rbox(0.118, 0.19, 0.135, 0.035)} m={mat.armorGraphite} p={[0, -0.32, 0.002]} cs />
        <M g={rbox(0.122, 0.022, 0.14, 0.008)} m={mat.webbing} p={[0, -0.24, 0.002]} />
        <group ref={J(`ankle${side}`)} position={BIND[`ankle${side}`]}>
          <M g={rbox(0.112, 0.08, 0.25, 0.03)} m={mat.armorGraphite} p={[0, -0.005, -0.05]} cs />
          <M g={rbox(0.118, 0.026, 0.262, 0.01)} m={mat.droidRubber} p={[0, -0.042, -0.05]} />
          <M g={rbox(0.1, 0.045, 0.06, 0.018)} m={mat.gunmetal} p={[0, 0.0, -0.155]} />
          <M g={rbox(0.03, 0.05, 0.06, 0.01)} m={mat.armorLight} p={[s * 0.055, 0.01, 0.05]} />
        </group>
      </group>
    </group>
  )
}

function EnergyPistol({ mat, muzzleRef, flashRef, flashMat }) {
  // Barrel runs along the hand's -Y axis, grip along +Z (see animator conventions).
  return (
    <group position={[0, -0.06, -0.005]}>
      <M g={rbox(0.03, 0.042, 0.1, 0.01)} m={mat.armorGraphite} p={[0, 0.0, 0.025]} r={[-0.22, 0, 0]} />
      <M g={rbox(0.036, 0.2, 0.046, 0.01)} m={mat.armorLight} p={[0, -0.055, -0.045]} />
      <M g={rbox(0.032, 0.13, 0.024, 0.008)} m={mat.armorGraphite} p={[0, -0.06, -0.012]} />
      <M g={rbox(0.006, 0.085, 0.012, 0.003)} m={mat.blueLight} p={[0.019, -0.06, -0.045]} />
      <M g={rbox(0.006, 0.085, 0.012, 0.003)} m={mat.blueLight} p={[-0.019, -0.06, -0.045]} />
      <M g={cyl(0.011, 0.013, 0.035, 10)} m={mat.gunmetal} p={[0, -0.17, -0.045]} />
      <group ref={muzzleRef} position={[0, -0.195, -0.045]}>
        <M mref={flashRef} g={sphere(0.05, 8, 6)} m={flashMat} s={[1, 1.8, 1]} />
      </group>
    </group>
  )
}

function BladeHilt({ mat }) {
  // Hilt along Z; the blade (when ignited) extends toward -Z.
  return (
    <group rotation={[Math.PI / 2, 0, 0]}>
      <M g={cyl(0.017, 0.017, 0.16, 12)} m={mat.gunmetal} />
      <M g={cyl(0.02, 0.02, 0.08, 12)} m={mat.leather} p={[0, 0.01, 0]} />
      <M g={cyl(0.025, 0.02, 0.03, 12)} m={mat.armorLight} p={[0, -0.085, 0]} />
      <M g={cyl(0.02, 0.015, 0.02, 12)} m={mat.armorGraphite} p={[0, 0.085, 0]} />
      <M g={rbox(0.008, 0.025, 0.012, 0.003)} m={mat.blueLightDim} p={[0.02, -0.06, 0]} />
    </group>
  )
}

function useMantle() {
  const geo = useMemo(() => new PlaneGeometry(1, 1, 10, 14), [])
  // Deform the cloth on the CPU: ~165 vertices, cheap, and fully controlled.
  const deform = (swing, sway, time) => {
    const pos = geo.attributes.position
    const cols = 11
    for (let i = 0; i < pos.count; i++) {
      const u = (i % cols) / (cols - 1)
      const v = Math.floor(i / cols) / 14
      const cu = (u - 0.5) * 2
      const len = 1.08 * v
      let x = (u - 0.5) * (0.47 + 0.22 * v)
      let z = 0.125 + 0.07 * v - 0.11 * (1 - v) ** 5 * cu * cu + 0.014 * Math.sin(u * Math.PI * 7 + v * 2) * v
      let y = 0.25 - len
      // Swing about the shoulder line; the angle grows down the length so the cloth curves
      // instead of pivoting like a board, plus a gentle flutter toward the hem.
      const a = swing * (0.35 + 0.65 * v) + 0.035 * Math.sin(time * 2.3 + u * 5 + v * 3) * v
      z += Math.sin(a) * len
      y += (1 - Math.cos(a)) * len
      x += sway * v * v
      pos.setXYZ(i, x, y, z)
    }
    pos.needsUpdate = true
    geo.computeVertexNormals()
    geo.computeBoundingSphere()
  }
  return { geo, deform }
}

export function OperativeModel({ apiRef, shadows = true }) {
  const mat = charMaterials()
  const joints = useRef({})
  const J = (name) => (o) => {
    if (o) joints.current[name] = o
  }
  const muzzle = useRef()
  const flash = useRef()
  const holstered = useRef()
  const drawn = useRef()
  const blade = useRef()
  const mantle = useMantle()
  const flashMat = useMemo(() => new MeshBasicMaterial({ color: '#9fd4ff', transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false }), [])
  const bladeCore = useMemo(() => dynamicEmissive('#4d9bff', 3), [])
  const bladeGlow = useMemo(() => new MeshBasicMaterial({ color: '#2f7bff', transparent: true, opacity: 0.18, blending: AdditiveBlending, depthWrite: false }), [])
  const animator = useMemo(() => new OperativeAnimator(), [])

  useLayoutEffect(() => {
    const api = {
      animator,
      muzzle: muzzle.current,
      setFlash(on) {
        flash.current.visible = on
        if (on) flash.current.rotation.y = Math.random() * Math.PI
      },
      /** Advance animation from a driver (see createOperativeDriver). */
      update(dt, driver, settle = false) {
        if (settle) animator.settle(driver)
        const pose = settle ? animator.current : animator.update(dt, driver)
        applyPose(pose, joints.current, joints.current.pelvis, BIND.pelvis)
        const on = animator.bladeOn
        drawn.current.visible = on > 0.01
        holstered.current.visible = !drawn.current.visible
        blade.current.visible = on > 0.02
        blade.current.scale.set(1, on, 1)
        bladeCore.emissiveIntensity = 2.6 + Math.sin(animator.time * 40) * 0.15
        mantle.deform(animator.cape.swing, animator.cape.sway, animator.time)
      },
    }
    api.setFlash(false)
    if (apiRef) apiRef.current = api
    // Set every joint to its bind position once; animation only changes rotations (+ pelvis offset).
    for (const [name, p] of Object.entries(BIND)) joints.current[name]?.position.set(...p)
    mantle.deform(0.06, 0, 0)
    return bakeJoints(Object.values(joints.current))
  }, [animator, apiRef, bladeCore, mantle])

  const cs = shadows

  return (
    <group>
      <group ref={J('pelvis')} position={BIND.pelvis}>
        {/* Hips, belt and utility attachments */}
        <M g={rbox(0.32, 0.17, 0.21, 0.05)} m={mat.undersuit} p={[0, -0.02, 0]} cs={cs} />
        <M g={rbox(0.335, 0.055, 0.23, 0.02)} m={mat.webbing} p={[0, 0.05, 0]} />
        <M g={rbox(0.06, 0.042, 0.02, 0.008)} m={mat.gunmetal} p={[0, 0.05, -0.117]} />
        <M g={rbox(0.07, 0.085, 0.05, 0.014)} m={mat.leather} p={[0.11, 0.02, -0.1]} cs={cs} />
        <M g={rbox(0.05, 0.085, 0.07, 0.014)} m={mat.leather} p={[0.17, 0.02, 0.03]} />
        <M g={rbox(0.08, 0.075, 0.05, 0.014)} m={mat.leather} p={[-0.07, 0.02, 0.115]} />
        <M g={rbox(0.1, 0.12, 0.03, 0.012)} m={mat.armorLight} p={[-0.16, -0.05, -0.055]} r={[0.05, 0.75, 0.08]} cs={cs} />
        {/* Holstered energy blade on the left hip */}
        <group ref={holstered} position={[-0.185, -0.03, 0.04]} rotation={[-1.35, 0, 0.12]}>
          <BladeHilt mat={mat} />
        </group>

        <group ref={J('spine')} position={BIND.spine}>
          <M g={rbox(0.27, 0.2, 0.18, 0.06)} m={mat.undersuit} p={[0, 0.07, 0]} cs={cs} />
          <M g={rbox(0.23, 0.05, 0.03, 0.012)} m={mat.armorGraphite} p={[0, 0.03, -0.09]} />
          <M g={rbox(0.21, 0.045, 0.03, 0.012)} m={mat.armorGraphite} p={[0, 0.09, -0.095]} />

          <group ref={J('chest')} position={BIND.chest}>
            {/* Torso: graphite tactical vest over the undersuit */}
            <M g={rbox(0.37, 0.31, 0.235, 0.06)} m={mat.armorGraphite} p={[0, 0.08, 0]} cs={cs} />
            <M g={rbox(0.15, 0.12, 0.028, 0.014)} m={mat.armorLight} p={[-0.088, 0.135, -0.119]} r={[-0.1, 0.2, 0.04]} cs={cs} />
            <M g={rbox(0.1, 0.05, 0.026, 0.012)} m={mat.armorLight} p={[-0.13, 0.205, -0.098]} r={[-0.4, 0.45, 0.2]} />
            <M g={rbox(0.1, 0.085, 0.03, 0.012)} m={mat.armorLight} p={[0.095, 0.125, -0.117]} r={[-0.12, -0.18, 0]} />
            <M g={rbox(0.06, 0.012, 0.006, 0.003)} m={mat.accentOrange} p={[-0.095, 0.165, -0.135]} r={[-0.12, 0.18, 0]} />
            <M g={rbox(0.03, 0.012, 0.006, 0.003)} m={mat.accentOrange} p={[0.1, 0.1, -0.133]} r={[-0.12, -0.18, 0]} />
            <M g={rbox(0.05, 0.3, 0.02, 0.008)} m={mat.webbing} p={[-0.1, 0.06, -0.125]} />
            <M g={rbox(0.05, 0.3, 0.02, 0.008)} m={mat.webbing} p={[0.1, 0.06, -0.125]} />
            <M g={rbox(0.07, 0.06, 0.035, 0.012)} m={mat.leather} p={[0.1, -0.035, -0.13]} />
            <M g={rbox(0.07, 0.06, 0.035, 0.012)} m={mat.leather} p={[-0.02, -0.035, -0.13]} />

            {/* Scarf: loose wraps at the neck, a fold hanging over the chest, bunched hood at the back */}
            <M g={torus(0.1, 0.034, 10, 24)} m={mat.scarf} p={[0, 0.245, -0.005]} r={[Math.PI / 2 + 0.12, 0, 0.05]} s={[1.08, 1.0, 1]} cs={cs} />
            <M g={torus(0.097, 0.03, 10, 24)} m={mat.scarf} p={[0, 0.215, 0.0]} r={[Math.PI / 2 - 0.1, 0, -0.08]} s={[1.18, 1.05, 1]} cs={cs} />
            <M g={sphere(0.1, 14, 10)} m={mat.scarf} p={[0.02, 0.165, -0.11]} s={[0.95, 0.95, 0.32]} r={[0.25, 0, 0.18]} cs={cs} />
            <M g={sphere(0.11, 14, 10)} m={mat.scarf} p={[0, 0.255, 0.085]} s={[1.05, 0.55, 0.6]} r={[-0.2, 0, 0]} cs={cs} />
            <M g={sphere(0.1, 14, 10)} m={mat.scarf} p={[-0.12, 0.205, 0.025]} s={[0.6, 0.35, 0.95]} r={[0, 0, 0.45]} />
            <M g={sphere(0.095, 14, 10)} m={mat.scarf} p={[0.12, 0.205, 0.025]} s={[0.55, 0.33, 0.9]} r={[0, 0, -0.45]} />

            {/* Torn mantle hanging from the shoulders (CPU-deformed cloth) */}
            <mesh geometry={mantle.geo} material={mat.mantle} castShadow={cs} userData={{ noBake: true }} />

            {/* Survival pack */}
            <group position={[0, 0.06, 0.2]} userData={{ bake: true }}>
              <M g={rbox(0.27, 0.33, 0.12, 0.035)} m={mat.armorGraphite} cs={cs} />
              <M g={rbox(0.2, 0.25, 0.012, 0.006)} m={mat.gunmetal} p={[0, -0.005, 0.061]} />
              <M g={rbox(0.022, 0.16, 0.008, 0.004)} m={mat.blueLight} p={[0, -0.01, 0.069]} />
              <M g={cyl(0.05, 0.05, 0.25, 14)} m={mat.scarf} p={[0, 0.19, -0.005]} r={[0, 0, Math.PI / 2]} cs={cs} />
              <M g={rbox(0.05, 0.17, 0.09, 0.018)} m={mat.leather} p={[0.16, -0.04, -0.005]} />
              <M g={rbox(0.05, 0.17, 0.09, 0.018)} m={mat.leather} p={[-0.16, -0.04, -0.005]} />
              <M g={rbox(0.06, 0.05, 0.03, 0.01)} m={mat.armorLight} p={[0.1, -0.14, 0.055]} />
            </group>

            <group ref={J('neck')} position={BIND.neck}>
              <M g={capsule(0.05, 0.06)} m={mat.undersuit} p={[0, 0.02, 0]} />
              <group ref={J('head')} position={BIND.head}>
                {/* Enclosed helmet built from conforming shell panels (all share the shell's centre and scale):
                    crown, brow band, wrap-around visor, silver cheek guards, faceplate */}
                <group position={[0, 0.095, 0.012]} scale={[0.93, 1.02, 1.12]} userData={{ bake: true }}>
                  <M g={sphere(0.125, 28, 20)} m={mat.helmet} cs={cs} />
                  <M g={sphere(0.1285, 28, 4, F - 1.25, 2.5, 0.82, 0.3)} m={mat.armorGraphite} />
                  <M g={sphere(0.127, 28, 10, F - 0.95, 1.9, 1.1, 0.55)} m={mat.visorGlass} />
                  <M g={sphere(0.1295, 10, 10, F - 1.55, 0.62, 1.12, 1.0)} m={mat.armorLight} />
                  <M g={sphere(0.1295, 10, 10, F + 0.93, 0.62, 1.12, 1.0)} m={mat.armorLight} />
                  <M g={sphere(0.1285, 20, 8, F - 1.0, 2.0, 1.64, 0.7)} m={mat.armorGraphite} />
                </group>
                <M g={rbox(0.032, 0.009, 0.008, 0.004)} m={mat.blueLight} p={[-0.033, 0.103, -0.134]} r={[0, 0.3, -0.1]} />
                <M g={rbox(0.032, 0.009, 0.008, 0.004)} m={mat.blueLight} p={[0.033, 0.103, -0.134]} r={[0, -0.3, 0.1]} />
                <M g={rbox(0.045, 0.018, 0.02, 0.006)} m={mat.gunmetal} p={[0, 0.0, -0.125]} r={[0.6, 0, 0]} />
                <M g={rbox(0.16, 0.05, 0.04, 0.015)} m={mat.armorGraphite} p={[0, 0.0, 0.105]} r={[-0.45, 0, 0]} />
                <M g={cyl(0.03, 0.03, 0.022, 14)} m={mat.gunmetal} p={[-0.12, 0.09, 0.012]} r={[0, 0, Math.PI / 2]} />
                <M g={cyl(0.03, 0.03, 0.022, 14)} m={mat.gunmetal} p={[0.12, 0.09, 0.012]} r={[0, 0, Math.PI / 2]} />
                <M g={rbox(0.008, 0.04, 0.026, 0.003)} m={mat.accentOrange} p={[0.127, 0.115, -0.035]} r={[0, -0.45, 0]} />
                <M g={rbox(0.022, 0.014, 0.16, 0.006)} m={mat.armorGraphite} p={[0, 0.224, 0.025]} />
              </group>
            </group>

            <Arm side="L" J={J} mat={mat}>
              <group ref={drawn} position={[0, -0.06, -0.005]}>
                <BladeHilt mat={mat} />
                <group ref={blade} position={[0, 0, -0.09]} rotation={[-Math.PI / 2, 0, 0]}>
                  <mesh geometry={bladeGeometry(0.72, 0.045, 0.012)} material={bladeCore} />
                  <mesh geometry={bladeGeometry(0.72, 0.045, 0.012)} material={bladeGlow} scale={[2.2, 1.04, 1.6]} />
                </group>
              </group>
            </Arm>
            <Arm side="R" J={J} mat={mat}>
              <EnergyPistol mat={mat} muzzleRef={muzzle} flashRef={flash} flashMat={flashMat} />
            </Arm>
          </group>
        </group>

        <Leg side="L" J={J} mat={mat} />
        <Leg side="R" J={J} mat={mat} />
      </group>
    </group>
  )
}
