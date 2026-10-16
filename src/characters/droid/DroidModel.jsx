import { useLayoutEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, Color, MeshBasicMaterial } from 'three'
import { charMaterials, dynamicEmissive } from '../materials'
import { bladeGeometry, capsule, cyl, rbox, sphere, torus } from '../geometry'
import { applyPose } from '../pose'
import { bakeJoints } from '../bakeJoints'
import { DroidAnimator } from './droidAnimator'

// OUTPOST SECURITY DROID: prototype articulated model (procedural geometry).
//
// ~2.25 m humanoid combat frame: armoured shoulders and torso, exposed spine
// and hydraulic joints between plates, a single red optic, an integrated arm
// cannon on the right forearm and a melee emitter on the left forearm.
// Emissives are kept to the optic, two chest sensor slits, a dorsal strip, the
// cannon charge coils and small orange warning lights, and they all react to
// combat state so the player can read what the droid is about to do.

const BIND = {
  pelvis: [0, 1.17, 0],
  spine: [0, 0.14, 0],
  chest: [0, 0.26, 0],
  neck: [0, 0.36, -0.1],
  head: [0, 0.06, -0.03],
  shoulderL: [-0.38, 0.31, 0],
  elbowL: [0, -0.36, 0],
  wristL: [0, -0.33, 0],
  shoulderR: [0.38, 0.31, 0],
  elbowR: [0, -0.36, 0],
  hipL: [-0.16, -0.06, 0],
  kneeL: [0, -0.5, 0],
  ankleL: [0, -0.5, 0],
  hipR: [0.16, -0.06, 0],
  kneeR: [0, -0.5, 0],
  ankleR: [0, -0.5, 0],
}

function M({ g, m, p, r, s, cs, mref }) {
  return <mesh ref={mref} geometry={g} material={m} position={p} rotation={r} scale={s} castShadow={!!cs} receiveShadow={!!cs} />
}

function Shoulder({ side, mat, warn }) {
  const s = side === 'L' ? -1 : 1
  return (
    <>
      <M g={sphere(0.1, 14, 10)} m={mat.droidGunmetal} />
      <M g={rbox(0.29, 0.19, 0.36, 0.06)} m={mat.droidComposite} p={[s * 0.07, 0.09, 0]} r={[0, 0, -s * 0.3]} cs />
      <M g={rbox(0.23, 0.05, 0.3, 0.02)} m={mat.droidPlate} p={[s * 0.06, 0.19, 0]} r={[0, 0, -s * 0.3]} cs />
      <M g={rbox(0.2, 0.1, 0.05, 0.02)} m={mat.droidGunmetal} p={[s * 0.08, 0.05, -0.18]} r={[0, 0, -s * 0.3]} />
      <M g={rbox(0.03, 0.016, 0.03, 0.006)} m={warn} p={[s * 0.14, 0.12, -0.2]} r={[0, 0, -s * 0.3]} />
      <M g={capsule(0.07, 0.2)} m={mat.droidGunmetal} p={[0, -0.18, 0]} />
      <M g={rbox(0.15, 0.22, 0.16, 0.04)} m={mat.droidComposite} p={[s * 0.01, -0.17, 0]} cs />
      <M g={rbox(0.05, 0.16, 0.12, 0.02)} m={mat.droidPlate} p={[s * 0.08, -0.16, 0]} />
    </>
  )
}

function Leg({ side, J, mat }) {
  const s = side === 'L' ? -1 : 1
  return (
    <group ref={J(`hip${side}`)} position={BIND[`hip${side}`]}>
      <M g={sphere(0.09, 12, 10)} m={mat.droidGunmetal} />
      <M g={capsule(0.08, 0.3)} m={mat.droidGunmetal} p={[0, -0.25, 0]} />
      <M g={rbox(0.2, 0.32, 0.22, 0.05)} m={mat.droidComposite} p={[0, -0.23, -0.025]} cs />
      <M g={rbox(0.05, 0.22, 0.16, 0.02)} m={mat.droidPlate} p={[s * 0.11, -0.22, 0]} cs />
      <M g={cyl(0.02, 0.02, 0.32, 8)} m={mat.droidHydraulic} p={[-s * 0.07, -0.25, 0.1]} />
      <group ref={J(`knee${side}`)} position={BIND[`knee${side}`]}>
        <M g={cyl(0.075, 0.075, 0.18, 16)} m={mat.droidHydraulic} r={[0, 0, Math.PI / 2]} />
        <M g={rbox(0.14, 0.13, 0.08, 0.03)} m={mat.droidPlate} p={[0, 0.0, -0.1]} cs />
        <M g={rbox(0.13, 0.42, 0.14, 0.03)} m={mat.droidGunmetal} p={[0, -0.24, 0.02]} cs />
        <M g={rbox(0.16, 0.34, 0.07, 0.03)} m={mat.droidComposite} p={[0, -0.21, -0.075]} cs />
        <M g={cyl(0.026, 0.026, 0.34, 8)} m={mat.droidHydraulic} p={[0, -0.22, 0.1]} />
        <M g={cyl(0.04, 0.04, 0.12, 10)} m={mat.droidGunmetal} p={[0, -0.08, 0.1]} />
        <group ref={J(`ankle${side}`)} position={BIND[`ankle${side}`]}>
          <M g={cyl(0.06, 0.06, 0.16, 12)} m={mat.droidGunmetal} r={[0, 0, Math.PI / 2]} />
          <M g={rbox(0.2, 0.1, 0.33, 0.03)} m={mat.droidComposite} p={[0, -0.06, -0.06]} cs />
          <M g={rbox(0.21, 0.07, 0.1, 0.025)} m={mat.droidPlate} p={[0, -0.07, -0.215]} cs />
          <M g={rbox(0.13, 0.08, 0.1, 0.02)} m={mat.droidGunmetal} p={[0, -0.065, 0.12]} />
          <M g={rbox(0.205, 0.022, 0.42, 0.008)} m={mat.droidRubber} p={[0, -0.1, -0.06]} />
        </group>
      </group>
    </group>
  )
}

export function DroidModel({ apiRef }) {
  const mat = charMaterials()
  const joints = useRef({})
  const J = (name) => (o) => {
    if (o) joints.current[name] = o
  }
  const muzzle = useRef()
  const chargeGlow = useRef()
  const melee = useRef()
  const arc = useRef()
  const eyeLight = useRef()
  const animator = useMemo(() => new DroidAnimator(), [])
  // Per-instance emissives so intensities can follow combat state.
  const fx = useMemo(
    () => ({
      optic: dynamicEmissive('#ff2414', 3),
      sensor: dynamicEmissive('#ff2414', 1.2),
      coil: dynamicEmissive('#ff3a1a', 0.3),
      warn: dynamicEmissive('#ff7a1a', 1.4),
      bladeCore: dynamicEmissive('#ff2a14', 3),
      bladeGlow: new MeshBasicMaterial({ color: '#ff2a14', transparent: true, opacity: 0.18, blending: AdditiveBlending, depthWrite: false }),
      arc: new MeshBasicMaterial({ color: new Color(3, 0.35, 0.2), transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
      charge: new MeshBasicMaterial({ color: new Color(4, 0.6, 0.25), transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
    }),
    []
  )

  useLayoutEffect(() => {
    const api = {
      animator,
      muzzle: muzzle.current,
      update(dt, d, settle = false) {
        if (settle) animator.settle(d)
        const pose = settle ? animator.current : animator.update(dt, d)
        applyPose(pose, joints.current, joints.current.pelvis, BIND.pelvis)
        const time = animator.time
        const s = d.state

        // Optic: dim in standby, flickers awake on detection, flares on telegraphs, dies on destruction.
        let eye = 3
        if (s === 'dormant') eye = 0.12 + 0.05 * Math.sin(time * 1.5)
        else if (s === 'booting') eye = d.stateT < 0.35 ? (Math.sin(time * 45) > 0 ? 3 : 0.2) : 3.2
        else if (s === 'windup') eye = 4 + 2.5 * Math.sin(time * 28)
        else if (s === 'strike') eye = 7
        else if (s === 'charging') eye = 4
        else if (s === 'stagger') eye = Math.sin(time * 50) > 0 ? 2.5 : 0.4
        else if (s === 'destroyed') eye = d.stateT < 1 && Math.sin(time * 33) > 0.3 ? 1.5 * (1 - d.stateT) : 0
        fx.optic.emissiveIntensity = eye
        fx.sensor.emissiveIntensity = s === 'destroyed' ? 0 : s === 'dormant' ? 0.1 : 1.2
        eyeLight.current.intensity = Math.min(eye, 5) * 0.35

        // Orange warning lights blink while an attack is being telegraphed.
        const telegraph = s === 'windup' || s === 'charging'
        fx.warn.emissiveIntensity = s === 'destroyed' || s === 'dormant' ? 0.05 : telegraph ? (Math.sin(time * 22) > 0 ? 2.5 : 0.2) : d.enraged ? 1.8 : 1.1

        // Cannon charge: coils and muzzle glow ramp up over the charge time; flash on fire.
        const charge = s === 'charging' ? Math.min(1, d.stateT / 0.85) : 0
        const shot = d.fireT < 0.12 ? 1 - d.fireT / 0.12 : 0
        fx.coil.emissiveIntensity = s === 'destroyed' ? 0 : 0.25 + charge * 4 + shot * 5
        fx.charge.opacity = Math.max(charge * 0.85, shot)
        chargeGlow.current.scale.setScalar(0.4 + charge * 0.8 + shot * 1.2)

        // Melee emitter: blade extends on wind-up, fades during recovery; arc trail on the strike.
        let bladeLen = 0
        if (s === 'windup') bladeLen = Math.min(1, d.stateT / 0.2)
        else if (s === 'strike') bladeLen = 1
        else if (s === 'recover') bladeLen = Math.max(0, 1 - d.stateT / 0.3)
        melee.current.visible = bladeLen > 0.01
        melee.current.scale.set(1, bladeLen, 1)
        fx.arc.opacity = s === 'strike' ? 0.55 * (1 - d.stateT / 0.3) : s === 'recover' && d.stateT < 0.12 ? 0.3 * (1 - d.stateT / 0.12) : 0
        arc.current.visible = fx.arc.opacity > 0.01
        return animator.events
      },
    }
    if (apiRef) apiRef.current = api
    for (const [name, p] of Object.entries(BIND)) joints.current[name]?.position.set(...p)
    return bakeJoints(Object.values(joints.current))
  }, [animator, apiRef, fx])

  return (
    <group>
      <group ref={J('pelvis')} position={BIND.pelvis}>
        <M g={rbox(0.36, 0.18, 0.27, 0.04)} m={mat.droidGunmetal} cs />
        <M g={cyl(0.075, 0.075, 0.44, 14)} m={mat.droidHydraulic} p={[0, -0.04, 0]} r={[0, 0, Math.PI / 2]} />
        <M g={rbox(0.26, 0.16, 0.045, 0.02)} m={mat.droidComposite} p={[0, -0.08, -0.15]} r={[0.15, 0, 0]} cs />
        <M g={rbox(0.045, 0.18, 0.2, 0.02)} m={mat.droidPlate} p={[-0.235, -0.07, 0]} r={[0, 0, 0.12]} cs />
        <M g={rbox(0.045, 0.18, 0.2, 0.02)} m={mat.droidPlate} p={[0.235, -0.07, 0]} r={[0, 0, -0.12]} cs />
        <M g={rbox(0.22, 0.12, 0.04, 0.02)} m={mat.droidComposite} p={[0, -0.06, 0.15]} r={[-0.12, 0, 0]} />

        <group ref={J('spine')} position={BIND.spine}>
          {/* Exposed mechanical spine between pelvis and torso */}
          <M g={cyl(0.075, 0.075, 0.2, 14)} m={mat.droidHydraulic} p={[0, 0.07, 0.05]} />
          <M g={rbox(0.29, 0.07, 0.2, 0.025)} m={mat.droidComposite} p={[0, 0.03, -0.02]} cs />
          <M g={rbox(0.31, 0.07, 0.21, 0.025)} m={mat.droidComposite} p={[0, 0.115, -0.02]} cs />
          <M g={cyl(0.018, 0.018, 0.22, 8)} m={mat.droidHydraulic} p={[-0.13, 0.08, 0.04]} />
          <M g={cyl(0.018, 0.018, 0.22, 8)} m={mat.droidHydraulic} p={[0.13, 0.08, 0.04]} />

          <group ref={J('chest')} position={BIND.chest}>
            {/* Reinforced torso: broad upper chest tapering into the ribcage */}
            <M g={rbox(0.6, 0.27, 0.4, 0.07)} m={mat.droidGunmetal} p={[0, 0.25, 0]} cs />
            <M g={rbox(0.46, 0.2, 0.33, 0.06)} m={mat.droidGunmetal} p={[0, 0.06, 0.01]} cs />
            <M g={rbox(0.26, 0.22, 0.05, 0.03)} m={mat.droidComposite} p={[-0.14, 0.25, -0.2]} r={[-0.12, 0.2, 0.06]} cs />
            <M g={rbox(0.26, 0.22, 0.05, 0.03)} m={mat.droidComposite} p={[0.14, 0.25, -0.2]} r={[-0.12, -0.2, -0.06]} cs />
            <M g={rbox(0.36, 0.06, 0.04, 0.015)} m={mat.droidComposite} p={[0, 0.09, -0.17]} />
            <M g={rbox(0.32, 0.05, 0.04, 0.015)} m={mat.droidComposite} p={[0, 0.02, -0.165]} />
            <M g={rbox(0.065, 0.012, 0.008, 0.003)} m={fx.sensor} p={[-0.14, 0.17, -0.23]} r={[0, 0.2, 0]} />
            <M g={rbox(0.065, 0.012, 0.008, 0.003)} m={fx.sensor} p={[0.14, 0.17, -0.23]} r={[0, -0.2, 0]} />
            <M g={rbox(0.38, 0.07, 0.3, 0.03)} m={mat.droidPlate} p={[0, 0.4, 0.02]} cs />
            <M g={rbox(0.5, 0.3, 0.06, 0.03)} m={mat.droidComposite} p={[0, 0.22, 0.21]} cs />
            <M g={rbox(0.02, 0.24, 0.008, 0.004)} m={fx.sensor} p={[0, 0.2, 0.243]} />
            {[-0.13, 0.13].map((x) => (
              <M key={x} g={rbox(0.1, 0.2, 0.02, 0.008)} m={mat.droidGunmetal} p={[x, 0.2, 0.245]} />
            ))}
            <group ref={J('neck')} position={BIND.neck}>
              <M g={cyl(0.05, 0.065, 0.12, 12)} m={mat.droidGunmetal} p={[0, 0.02, 0]} />
              <M g={cyl(0.016, 0.016, 0.14, 8)} m={mat.droidHydraulic} p={[-0.06, 0.02, 0.03]} r={[0, 0, 0.2]} />
              <M g={cyl(0.016, 0.016, 0.14, 8)} m={mat.droidHydraulic} p={[0.06, 0.02, 0.03]} r={[0, 0, -0.2]} />
              <group ref={J('head')} position={BIND.head}>
                {/* Armoured sensor head: rounded dome, central red optic in a deep housing */}
                <M g={sphere(0.13, 22, 16)} m={mat.droidGunmetal} p={[0, 0.08, 0]} s={[1, 0.86, 1.06]} cs />
                <M g={rbox(0.24, 0.04, 0.2, 0.02)} m={mat.droidPlate} p={[0, 0.158, -0.015]} r={[0.2, 0, 0]} cs />
                <M g={rbox(0.05, 0.12, 0.16, 0.02)} m={mat.droidComposite} p={[-0.12, 0.07, -0.03]} r={[0, 0.25, 0]} cs />
                <M g={rbox(0.05, 0.12, 0.16, 0.02)} m={mat.droidComposite} p={[0.12, 0.07, -0.03]} r={[0, -0.25, 0]} cs />
                <M g={rbox(0.15, 0.05, 0.06, 0.02)} m={mat.droidComposite} p={[0, 0.0, -0.11]} r={[0.35, 0, 0]} />
                <M g={cyl(0.07, 0.078, 0.06, 24)} m={mat.droidComposite} p={[0, 0.08, -0.13]} r={[Math.PI / 2, 0, 0]} />
                <M g={cyl(0.052, 0.052, 0.02, 24)} m={fx.optic} p={[0, 0.08, -0.152]} r={[Math.PI / 2, 0, 0]} />
                <M g={sphere(0.056, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2)} m={mat.visorGlass} p={[0, 0.08, -0.156]} r={[-Math.PI / 2, 0, 0]} s={[1, 0.35, 1]} />
                <M g={rbox(0.018, 0.018, 0.018, 0.005)} m={fx.warn} p={[-0.142, 0.11, -0.07]} />
                <pointLight ref={eyeLight} position={[0, 0.08, -0.9]} color="#ff2a1a" distance={6} decay={2} />
              </group>
            </group>

            {/* Left arm: armoured forearm, claw, melee emitter */}
            <group ref={J('shoulderL')} position={BIND.shoulderL}>
              <Shoulder side="L" mat={mat} warn={fx.warn} />
              <group ref={J('elbowL')} position={BIND.elbowL}>
                <M g={cyl(0.068, 0.068, 0.15, 14)} m={mat.droidHydraulic} r={[0, 0, Math.PI / 2]} />
                <M g={rbox(0.15, 0.28, 0.16, 0.04)} m={mat.droidGunmetal} p={[0, -0.16, 0]} cs />
                <M g={rbox(0.165, 0.21, 0.05, 0.02)} m={mat.droidPlate} p={[0, -0.15, -0.085]} cs />
                <M g={rbox(0.012, 0.15, 0.01, 0.004)} m={fx.sensor} p={[-0.05, -0.15, -0.112]} />
                <M g={rbox(0.05, 0.22, 0.05, 0.015)} m={mat.droidComposite} p={[-0.095, -0.17, 0]} />
                <group ref={J('wristL')} position={BIND.wristL}>
                  <M g={rbox(0.12, 0.1, 0.1, 0.025)} m={mat.droidGunmetal} p={[0, -0.05, 0]} cs />
                  {[-0.035, 0, 0.035].map((x) => (
                    <M key={x} g={rbox(0.028, 0.12, 0.032, 0.01)} m={mat.droidComposite} p={[x, -0.15, -0.02]} r={[0.35, 0, 0]} />
                  ))}
                  <M g={rbox(0.028, 0.09, 0.032, 0.01)} m={mat.droidComposite} p={[0.065, -0.1, -0.03]} r={[0.3, 0, 0.4]} />
                  {/* Energy blade projected from the forearm emitter, along the arm */}
                  <group ref={melee} position={[-0.095, 0.1, 0]} rotation={[Math.PI, 0, 0]}>
                    <mesh geometry={bladeGeometry(0.85, 0.07, 0.016)} material={fx.bladeCore} />
                    <mesh geometry={bladeGeometry(0.85, 0.07, 0.016)} material={fx.bladeGlow} scale={[2, 1.03, 1.5]} />
                  </group>
                </group>
              </group>
            </group>

            {/* Right arm: integrated arm cannon */}
            <group ref={J('shoulderR')} position={BIND.shoulderR}>
              <Shoulder side="R" mat={mat} warn={fx.warn} />
              <group ref={J('elbowR')} position={BIND.elbowR}>
                <M g={cyl(0.068, 0.068, 0.15, 14)} m={mat.droidHydraulic} r={[0, 0, Math.PI / 2]} />
                <M g={cyl(0.11, 0.12, 0.42, 18)} m={mat.droidGunmetal} p={[0, -0.2, 0]} cs />
                <M g={rbox(0.17, 0.34, 0.11, 0.03)} m={mat.droidComposite} p={[0, -0.18, -0.06]} cs />
                <M g={rbox(0.06, 0.26, 0.03, 0.01)} m={mat.droidPlate} p={[0, -0.2, -0.122]} />
                <M g={rbox(0.022, 0.016, 0.022, 0.005)} m={fx.warn} p={[0.09, -0.07, -0.08]} />
                <M g={cyl(0.052, 0.058, 0.24, 14)} m={mat.droidGunmetal} p={[0, -0.5, 0]} />
                {[-0.42, -0.48, -0.54].map((y) => (
                  <M key={y} g={torus(0.07, 0.012, 6, 20)} m={fx.coil} p={[0, y, 0]} r={[Math.PI / 2, 0, 0]} />
                ))}
                <M g={cyl(0.066, 0.066, 0.045, 16)} m={mat.droidPlate} p={[0, -0.62, 0]} />
                <M g={cyl(0.034, 0.034, 0.05, 12)} m={mat.droidRubber} p={[0, -0.64, 0]} />
                <group ref={muzzle} position={[0, -0.67, 0]}>
                  <mesh ref={chargeGlow} material={fx.charge}>
                    <sphereGeometry args={[0.09, 12, 10]} />
                  </mesh>
                </group>
              </group>
            </group>

            {/* Melee strike arc: brief trail sweeping across the front */}
            <group position={[0, 0.12, 0]} rotation={[0.35, 0, 0]}>
              <mesh ref={arc} rotation={[-Math.PI / 2, 0, 0.47]} material={fx.arc}>
                <torusGeometry args={[0.85, 0.028, 6, 40, 2.2]} />
              </mesh>
            </group>
          </group>
        </group>

        <Leg side="L" J={J} mat={mat} />
        <Leg side="R" J={J} mat={mat} />
      </group>
    </group>
  )
}
