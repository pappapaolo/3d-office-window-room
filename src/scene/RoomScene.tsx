import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  ContactShadows,
  Float,
  OrbitControls,
  RoundedBox,
  Sparkles,
} from '@react-three/drei'
import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import { sampleLighting, type LightingSample, type SceneConfig } from './time'

interface RoomSceneProps {
  config: SceneConfig
}

const wallHeight = 8.2

function useIsTouchDevice() {
  const [isTouch, setIsTouch] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(pointer: coarse)')
    const update = () => setIsTouch(mediaQuery.matches)
    update()
    mediaQuery.addEventListener('change', update)
    return () => mediaQuery.removeEventListener('change', update)
  }, [])

  return isTouch
}

function createWindowTexture(lighting: LightingSample) {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 768
  const context = canvas.getContext('2d')

  if (!context) {
    return new THREE.CanvasTexture(canvas)
  }

  const gradient = context.createLinearGradient(0, 0, 0, canvas.height)
  gradient.addColorStop(0, lighting.skyTop)
  gradient.addColorStop(0.55, lighting.skyBottom)
  gradient.addColorStop(1, lighting.haze)
  context.fillStyle = gradient
  context.fillRect(0, 0, canvas.width, canvas.height)

  const bloom = context.createRadialGradient(
    canvas.width * 0.7,
    canvas.height * 0.28,
    40,
    canvas.width * 0.7,
    canvas.height * 0.28,
    260,
  )
  bloom.addColorStop(0, `${lighting.glow}ff`)
  bloom.addColorStop(1, `${lighting.glow}00`)
  context.fillStyle = bloom
  context.fillRect(0, 0, canvas.width, canvas.height)

  context.fillStyle = `${lighting.skylineFar}d9`
  const farBuildings = [
    [100, 362, 92, 162],
    [188, 338, 38, 186],
    [250, 350, 70, 174],
    [344, 304, 102, 220],
    [470, 252, 56, 272],
    [548, 316, 46, 208],
    [618, 296, 70, 228],
    [710, 324, 56, 200],
    [798, 342, 92, 182],
  ]

  farBuildings.forEach(([x, y, w, h]) => {
    context.fillRect(x, y, w, h)
  })

  context.fillStyle = `${lighting.skylineNear}ee`
  const nearBuildings = [
    [54, 470, 128, 170],
    [172, 520, 140, 120],
    [302, 450, 142, 190],
    [456, 500, 128, 140],
    [590, 464, 112, 176],
    [714, 486, 122, 154],
    [844, 450, 118, 190],
  ]

  nearBuildings.forEach(([x, y, w, h]) => {
    context.fillRect(x, y, w, h)
  })

  context.strokeStyle = 'rgba(255,255,255,0.22)'
  context.lineWidth = 1
  for (let x = 0; x < canvas.width; x += 24) {
    context.beginPath()
    context.moveTo(x, 0)
    context.lineTo(x, canvas.height)
    context.stroke()
  }

  for (let y = 0; y < canvas.height; y += 24) {
    context.beginPath()
    context.moveTo(0, y)
    context.lineTo(canvas.width, y)
    context.stroke()
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

function CameraRig({
  parallaxStrength,
  zoom,
  isTouch,
}: {
  parallaxStrength: number
  zoom: number
  isTouch: boolean
}) {
  const { camera, pointer } = useThree()
  const perspectiveCamera = camera as THREE.PerspectiveCamera
  const focus = useMemo(() => new THREE.Vector3(0, 0.65, 0), [])

  useFrame((_, delta) => {
    const strength = isTouch ? parallaxStrength * 0.22 : parallaxStrength * 0.5
    const distance = THREE.MathUtils.lerp(10.6, 7.4, zoom)
    const fov = THREE.MathUtils.lerp(40, 31, zoom)
    const targetPosition = new THREE.Vector3(
      pointer.x * strength,
      1.78 + pointer.y * strength * 0.45,
      distance + Math.abs(pointer.x) * strength * 0.18,
    )

    perspectiveCamera.position.lerp(targetPosition, 1 - Math.exp(-delta * 2.8))
    perspectiveCamera.fov = THREE.MathUtils.lerp(
      perspectiveCamera.fov,
      fov,
      1 - Math.exp(-delta * 4),
    )
    perspectiveCamera.updateProjectionMatrix()
    focus.lerp(
      new THREE.Vector3(pointer.x * strength * 0.45, 0.82 + pointer.y * 0.18, 0),
      1 - Math.exp(-delta * 2.8),
    )
    perspectiveCamera.lookAt(focus)
  })

  return null
}

function RoomShell({ lighting }: { lighting: LightingSample }) {
  return (
    <group>
      <mesh position={[0, wallHeight / 2 - 0.05, -1.52]} receiveShadow>
        <boxGeometry args={[15, wallHeight, 0.2]} />
        <meshStandardMaterial color={lighting.wallBottom} roughness={0.92} />
      </mesh>

      <mesh position={[0, 0.04, 0]} receiveShadow>
        <boxGeometry args={[15, 0.12, 7.8]} />
        <meshStandardMaterial color="#604232" roughness={1} />
      </mesh>

      <mesh position={[0, 0.58, 1.2]} receiveShadow castShadow>
        <boxGeometry args={[16, 0.25, 3.2]} />
        <meshStandardMaterial color={lighting.shelfTop} roughness={0.7} />
      </mesh>

      <mesh position={[0, -0.34, 0.95]} receiveShadow>
        <boxGeometry args={[16, 1.55, 3.8]} />
        <meshStandardMaterial color={lighting.shelfFront} roughness={0.88} />
      </mesh>

      <mesh position={[0, 6.3, 0.52]} rotation={[-0.2, 0, 0]}>
        <planeGeometry args={[17, 6]} />
        <meshBasicMaterial color={lighting.accent} transparent opacity={0.15} />
      </mesh>
    </group>
  )
}

function WindowAssembly({ lighting }: { lighting: LightingSample }) {
  const backdrop = useMemo(() => createWindowTexture(lighting), [lighting])

  useEffect(() => () => backdrop.dispose(), [backdrop])

  return (
    <group position={[0, 4.25, -1.2]}>
      <mesh position={[0, 0, -0.48]}>
        <planeGeometry args={[8.8, 5.55]} />
        <meshBasicMaterial map={backdrop} toneMapped={false} />
      </mesh>

      <mesh position={[0, 0, -0.2]}>
        <planeGeometry args={[8.82, 5.57]} />
        <meshPhysicalMaterial
          transmission={0.35}
          roughness={0.24}
          thickness={0.32}
          color={lighting.glow}
          transparent
          opacity={0.18}
        />
      </mesh>

      <mesh position={[0, 0, -0.16]}>
        <planeGeometry args={[8.82, 5.57]} />
        <meshBasicMaterial color={lighting.glow} transparent opacity={0.06} />
      </mesh>

      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[9.28, 5.98, 0.16]} />
        <meshStandardMaterial color={lighting.frame} roughness={0.58} />
      </mesh>

      <mesh position={[0, 0, 0.11]}>
        <boxGeometry args={[8.86, 5.58, 0.08]} />
        <meshStandardMaterial color="#2a1510" roughness={0.8} />
      </mesh>

      <mesh position={[0, 0, 0.16]}>
        <boxGeometry args={[8.56, 5.28, 0.08]} />
        <meshStandardMaterial color={lighting.frame} roughness={0.55} />
      </mesh>

      {[-2.86, 0, 2.86].map((x) => (
        <mesh key={x} position={[x, 0, 0.2]}>
          <boxGeometry args={[0.09, 5.28, 0.12]} />
          <meshStandardMaterial color={lighting.frame} roughness={0.5} />
        </mesh>
      ))}

      {[-1.76, 0, 1.76].map((y) => (
        <mesh key={y} position={[0, y, 0.2]}>
          <boxGeometry args={[8.56, 0.09, 0.12]} />
          <meshStandardMaterial color={lighting.frame} roughness={0.5} />
        </mesh>
      ))}
    </group>
  )
}

function Monitor({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false)
  const [screenIndex, setScreenIndex] = useState(0)
  const group = useRef<THREE.Group>(null)

  useFrame((state, delta) => {
    if (!group.current) {
      return
    }

    group.current.rotation.y = THREE.MathUtils.lerp(
      group.current.rotation.y,
      hovered ? -0.18 : -0.05,
      1 - Math.exp(-delta * 6),
    )
    group.current.position.y = 1.07 + Math.sin(state.clock.elapsedTime * 1.1) * 0.02
  })

  const screenColors = ['#29373f', '#4eb1ff', '#ffbf69']
  const emissive = ['#0f1218', '#2a8fe2', '#e58b1e']

  return (
    <group
      ref={group}
      position={[0.15, 1.06, 0.66]}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      onClick={() => {
        setScreenIndex((value) => (value + 1) % screenColors.length)
        onClick()
      }}
    >
      <RoundedBox args={[1.6, 1.25, 0.16]} radius={0.08} smoothness={4} castShadow>
        <meshStandardMaterial color="#ece3d0" roughness={0.45} />
      </RoundedBox>
      <mesh position={[0, 0.02, 0.09]}>
        <planeGeometry args={[1.2, 0.9]} />
        <meshStandardMaterial
          color={screenColors[screenIndex]}
          emissive={emissive[screenIndex]}
          emissiveIntensity={screenIndex === 0 ? 0.16 : 1.3}
          roughness={0.4}
        />
      </mesh>
      <mesh position={[0, -0.86, -0.02]} castShadow>
        <cylinderGeometry args={[0.1, 0.15, 0.48, 32]} />
        <meshStandardMaterial color="#d6ccb8" roughness={0.5} />
      </mesh>
      <mesh position={[0, -1.12, 0.04]} castShadow receiveShadow>
        <cylinderGeometry args={[0.46, 0.44, 0.08, 48]} />
        <meshStandardMaterial color="#ddd5c5" roughness={0.42} />
      </mesh>
    </group>
  )
}

function Lamp({
  lighting,
  lampOn,
  onClick,
}: {
  lighting: LightingSample
  lampOn: boolean
  onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const group = useRef<THREE.Group>(null)
  const glow = lampOn ? lighting.practicalIntensity : 0

  useFrame((state, delta) => {
    if (!group.current) {
      return
    }

    group.current.rotation.z = THREE.MathUtils.lerp(
      group.current.rotation.z,
      hovered ? 0.06 : 0.02,
      1 - Math.exp(-delta * 5),
    )
    group.current.position.y = 0.72 + Math.sin(state.clock.elapsedTime * 1.8) * 0.02
  })

  return (
    <group
      ref={group}
      position={[2.85, 0.72, 0.82]}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      onClick={onClick}
    >
      <mesh position={[0, -0.12, 0]} rotation={[0, 0, 0.2]} castShadow receiveShadow>
        <cylinderGeometry args={[0.36, 0.38, 0.08, 40]} />
        <meshStandardMaterial color="#2f6190" metalness={0.1} roughness={0.35} />
      </mesh>
      <mesh position={[0.12, 0.52, 0]} rotation={[0, 0, 0.42]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 1, 22]} />
        <meshStandardMaterial color="#bc412a" roughness={0.46} />
      </mesh>
      <mesh position={[0.44, 1.16, 0]} rotation={[0, 0, 0.92]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 0.76, 22]} />
        <meshStandardMaterial color="#bc412a" roughness={0.46} />
      </mesh>
      <mesh position={[0.74, 1.45, 0]} rotation={[0, 0, Math.PI / 2.5]} castShadow>
        <coneGeometry args={[0.28, 0.48, 32]} />
        <meshStandardMaterial
          color="#e0a61c"
          emissive={lighting.practical}
          emissiveIntensity={glow * 0.85}
          roughness={0.38}
        />
      </mesh>
      <pointLight
        position={[0.85, 1.45, 0.08]}
        color={lighting.practical}
        intensity={glow * 2.6}
        distance={6}
        decay={2}
      />
      <mesh position={[0.95, 1.42, 0.08]}>
        <sphereGeometry args={[0.09, 16, 16]} />
        <meshBasicMaterial color={lighting.practical} transparent opacity={0.95} />
      </mesh>
    </group>
  )
}

function Dino({
  lighting,
  onClick,
}: {
  lighting: LightingSample
  onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const [excited, setExcited] = useState(false)
  const group = useRef<THREE.Group>(null)

  useFrame((state, delta) => {
    if (!group.current) {
      return
    }

    const bounce = Math.sin(state.clock.elapsedTime * (excited ? 7 : 2.4)) * 0.03
    group.current.position.y = 0.72 + bounce
    group.current.rotation.y = THREE.MathUtils.lerp(
      group.current.rotation.y,
      hovered || excited ? 0.55 : 0.3,
      1 - Math.exp(-delta * 5),
    )
    group.current.rotation.x = THREE.MathUtils.lerp(
      group.current.rotation.x,
      excited ? -0.12 : 0,
      1 - Math.exp(-delta * 5),
    )
  })

  useEffect(() => {
    if (!excited) {
      return undefined
    }

    const timeout = window.setTimeout(() => setExcited(false), 900)
    return () => window.clearTimeout(timeout)
  }, [excited])

  return (
    <group
      ref={group}
      position={[-3.25, 0.72, 0.8]}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      onClick={() => {
        setExcited(true)
        onClick()
      }}
    >
      <mesh position={[-0.42, 0.1, 0.02]} rotation={[0.04, 0.08, 0.25]} castShadow>
        <capsuleGeometry args={[0.24, 1.18, 8, 16]} />
        <meshStandardMaterial color="#8a715e" roughness={0.95} />
      </mesh>
      <mesh position={[0.32, 0.48, 0.08]} rotation={[0, 0, -0.18]} castShadow>
        <capsuleGeometry args={[0.13, 0.66, 8, 14]} />
        <meshStandardMaterial color="#91806d" roughness={0.92} />
      </mesh>
      <mesh position={[0.74, 0.78, 0.08]} rotation={[0.1, 0, -0.25]} castShadow>
        <sphereGeometry args={[0.22, 20, 20]} />
        <meshStandardMaterial color="#8f7763" roughness={0.92} />
      </mesh>
      <mesh position={[0.92, 0.78, 0.16]} rotation={[0, 0, 0.2]} castShadow>
        <coneGeometry args={[0.09, 0.3, 16]} />
        <meshStandardMaterial color="#eee4cf" roughness={0.84} />
      </mesh>
      <mesh position={[0.18, 0.02, 0.22]} rotation={[0.1, 0, 0.16]} castShadow>
        <capsuleGeometry args={[0.06, 0.48, 6, 12]} />
        <meshStandardMaterial color="#655147" roughness={0.92} />
      </mesh>
      <mesh position={[0.54, 0.02, -0.02]} rotation={[0.08, 0, -0.18]} castShadow>
        <capsuleGeometry args={[0.06, 0.48, 6, 12]} />
        <meshStandardMaterial color="#655147" roughness={0.92} />
      </mesh>
      <mesh position={[-0.08, 0.1, -0.18]} rotation={[0.04, 0, -0.22]} castShadow>
        <capsuleGeometry args={[0.06, 0.52, 6, 12]} />
        <meshStandardMaterial color="#655147" roughness={0.92} />
      </mesh>
      <mesh position={[-0.62, 0.46, -0.02]} rotation={[0.18, 0.1, 1.18]} castShadow>
        <capsuleGeometry args={[0.1, 0.88, 8, 14]} />
        <meshStandardMaterial color="#7f6656" roughness={0.95} />
      </mesh>
      <mesh position={[0.82, 0.89, 0.28]}>
        <sphereGeometry args={[0.03, 12, 12]} />
        <meshBasicMaterial color={lighting.accent} />
      </mesh>
    </group>
  )
}

function Totem({ lighting }: { lighting: LightingSample }) {
  return (
    <Float speed={1.2} rotationIntensity={0.12} floatIntensity={0.2}>
      <group position={[4.65, 0.82, 0.92]} rotation={[0, -0.4, 0]}>
        <mesh castShadow>
          <capsuleGeometry args={[0.18, 0.42, 8, 14]} />
          <meshStandardMaterial color="#cb8355" roughness={0.68} />
        </mesh>
        <mesh position={[0, 0.33, 0]} castShadow>
          <sphereGeometry args={[0.22, 24, 24]} />
          <meshStandardMaterial color="#8bba6f" roughness={0.7} />
        </mesh>
        <mesh position={[-0.13, 0.53, 0]} castShadow>
          <sphereGeometry args={[0.1, 18, 18]} />
          <meshStandardMaterial color="#7dad5c" roughness={0.7} />
        </mesh>
        <mesh position={[0.13, 0.53, 0]} castShadow>
          <sphereGeometry args={[0.1, 18, 18]} />
          <meshStandardMaterial color="#7dad5c" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.34, 0.2]}>
          <sphereGeometry args={[0.045, 12, 12]} />
          <meshBasicMaterial color={lighting.glow} />
        </mesh>
      </group>
    </Float>
  )
}

function Lighting({
  lighting,
  lampOn,
}: {
  lighting: LightingSample
  lampOn: boolean
}) {
  return (
    <>
      <color attach="background" args={[lighting.fog]} />
      <fog attach="fog" args={[lighting.fog, 9, 18]} />
      <ambientLight color={lighting.ambient} intensity={lighting.ambientIntensity} />
      <directionalLight
        castShadow
        position={lighting.sunPosition}
        color={lighting.sun}
        intensity={lighting.sunIntensity}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={1}
        shadow-camera-far={20}
        shadow-camera-top={7}
        shadow-camera-right={8}
        shadow-camera-bottom={-4}
        shadow-camera-left={-8}
      />
      <pointLight
        position={[0.2, 2.5, 1.8]}
        color={lighting.accent}
        intensity={lampOn ? 0.18 : 0.08}
        distance={10}
      />
    </>
  )
}

function SceneContents({ config }: RoomSceneProps) {
  const lighting = useMemo(() => sampleLighting(config.timeValue), [config.timeValue])
  const isTouch = useIsTouchDevice()
  const [lampOn, setLampOn] = useState(true)
  const [monitorPulse, setMonitorPulse] = useState(0)

  return (
    <>
      <CameraRig
        parallaxStrength={config.parallaxStrength}
        zoom={config.zoom}
        isTouch={isTouch}
      />
      <Lighting lighting={lighting} lampOn={lampOn} />

      <RoomShell lighting={lighting} />
      <WindowAssembly lighting={lighting} />

      <Sparkles
        count={36}
        size={3.4}
        scale={[7.2, 2.4, 1.5]}
        position={[0.1, 4.1, 0.16]}
        color={lighting.glow}
        opacity={0.32}
        speed={0.18}
      />

      <ContactShadows
        position={[0, 0.065, 0]}
        opacity={0.42}
        scale={13}
        blur={2.5}
        far={4}
        resolution={1024}
        color="#000000"
      />

      <Monitor onClick={() => setMonitorPulse((value) => value + 1)} />
      <Lamp
        lighting={lighting}
        lampOn={lampOn}
        onClick={() => setLampOn((value) => !value)}
      />
      <Dino
        lighting={lighting}
        onClick={() => setMonitorPulse((value) => value + 0.4)}
      />
      <Totem lighting={lighting} />

      <mesh position={[0, 0.72, 0.74]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[11.5, 2.2]} />
        <meshStandardMaterial color={lighting.shelfTop} roughness={0.74} />
      </mesh>

      {config.effectsEnabled ? (
        <EffectComposer>
          <Bloom
            luminanceThreshold={0.72}
            luminanceSmoothing={0.4}
            intensity={lampOn ? 0.5 + monitorPulse * 0.02 : 0.2}
            mipmapBlur
          />
          <Noise opacity={0.03} />
          <Vignette offset={0.16} darkness={0.42} eskil={false} />
        </EffectComposer>
      ) : null}

      <OrbitControls
        enabled={false}
        enablePan={false}
        enableZoom={false}
        enableRotate={false}
      />
    </>
  )
}

export function RoomScene({ config }: RoomSceneProps) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ position: [0, 1.78, 9.4], fov: 36 }}
      gl={{ antialias: true }}
    >
      <SceneContents config={config} />
    </Canvas>
  )
}
