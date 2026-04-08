import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  ContactShadows,
  Float,
  OrbitControls,
  RoundedBox,
  Sparkles,
  useTexture,
} from '@react-three/drei'
import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import { sampleLighting, type LightingSample, type SceneConfig } from './time'

interface RoomSceneProps {
  config: SceneConfig
  onLampToggle: () => void
}

interface SceneContentsProps {
  config: SceneConfig
  onLampToggle: () => void
}

const wallHeight = 8.2
const windowBackdropSources = [
  '/assets/window/sunrise.png',
  '/assets/window/early-gold.png',
  '/assets/window/clear-day.png',
  '/assets/window/rainy-day.png',
  '/assets/window/sunset.png',
  '/assets/window/misty-evening.png',
  '/assets/window/rainy-night.png',
  '/assets/window/super-foggy.png',
]

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

function useSoundEffects() {
  const contextRef = useRef<AudioContext | null>(null)

  const getContext = () => {
    if (typeof window === 'undefined' || !window.AudioContext) {
      return null
    }

    if (!contextRef.current) {
      contextRef.current = new window.AudioContext()
    }

    return contextRef.current
  }

  const pulse = (
    frequency: number,
    duration: number,
    type: OscillatorType,
    gainValue: number,
  ) => {
    const context = getContext()
    if (!context) {
      return
    }

    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = type
    oscillator.frequency.value = frequency
    gain.gain.value = gainValue
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start()
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration)
    oscillator.stop(context.currentTime + duration)
  }

  return {
    lamp: () => pulse(640, 0.08, 'triangle', 0.024),
    roar: () => {
      pulse(96, 0.22, 'sawtooth', 0.032)
      window.setTimeout(() => pulse(84, 0.18, 'square', 0.02), 90)
    },
    wave: () => {
      pulse(520, 0.08, 'sine', 0.018)
      window.setTimeout(() => pulse(760, 0.08, 'sine', 0.014), 70)
    },
    rustle: () => {
      pulse(260, 0.1, 'triangle', 0.014)
      window.setTimeout(() => pulse(340, 0.1, 'triangle', 0.01), 40)
    },
  }
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
    const distance = THREE.MathUtils.lerp(13.2, 8.4, zoom)
    const targetPosition = new THREE.Vector3(
      pointer.x * strength,
      1.72 + pointer.y * strength * 0.4,
      distance + Math.abs(pointer.x) * strength * 0.18,
    )

    perspectiveCamera.position.lerp(targetPosition, 1 - Math.exp(-delta * 2.8))
    focus.lerp(
      new THREE.Vector3(pointer.x * strength * 0.38, 0.74 + pointer.y * 0.14, 0),
      1 - Math.exp(-delta * 2.8),
    )
    perspectiveCamera.lookAt(focus)
  })

  return null
}

function ShadowPlane({
  position,
  size,
  opacity = 0.14,
}: {
  position: [number, number, number]
  size: [number, number]
  opacity?: number
}) {
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={size} />
      <meshBasicMaterial color="#000000" transparent opacity={opacity} />
    </mesh>
  )
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

      <mesh position={[0, 6.04, 0.74]} receiveShadow castShadow>
        <boxGeometry args={[6.4, 0.2, 1.12]} />
        <meshStandardMaterial color={lighting.shelfTop} roughness={0.7} />
      </mesh>

      <mesh position={[0, 6.3, 0.52]} rotation={[-0.2, 0, 0]}>
        <planeGeometry args={[17, 6]} />
        <meshBasicMaterial color={lighting.accent} transparent opacity={0.15} />
      </mesh>
    </group>
  )
}

function WindowAssembly({
  lighting,
  timeValue,
}: {
  lighting: LightingSample
  timeValue: number
}) {
  const textures = useTexture(windowBackdropSources)
  const { pointer } = useThree()
  const group = useRef<THREE.Group>(null)
  const imageCount = textures.length
  const scaled = ((timeValue % 1) + 1) % 1 * imageCount
  const baseIndex = Math.floor(scaled) % imageCount
  const nextIndex = (baseIndex + 1) % imageCount
  const blend = scaled - Math.floor(scaled)

  useMemo(() => {
    textures.forEach((texture) => {
      texture.colorSpace = THREE.SRGBColorSpace
      texture.minFilter = THREE.LinearFilter
      texture.magFilter = THREE.LinearFilter
    })
    return textures
  }, [textures])

  useFrame((_, delta) => {
    if (!group.current) {
      return
    }

    const targetX = pointer.x * 0.18
    const targetY = pointer.y * 0.1
    group.current.position.x = THREE.MathUtils.lerp(
      group.current.position.x,
      targetX,
      1 - Math.exp(-delta * 2.4),
    )
    group.current.position.y = THREE.MathUtils.lerp(
      group.current.position.y,
      targetY,
      1 - Math.exp(-delta * 2.4),
    )
  })

  return (
    <group position={[0, 4.25, -1.2]}>
      <group ref={group} position={[0, 0, 0]}>
        <mesh position={[0, 0, -0.68]} scale={[1.02, 1.02, 1]}>
          <planeGeometry args={[8.92, 6.66]} />
          <meshBasicMaterial
            map={textures[baseIndex]}
            toneMapped={false}
            transparent
            opacity={1 - blend}
          />
        </mesh>

        <mesh position={[0.08, 0.03, -0.72]} scale={[1.03, 1.03, 1]}>
          <planeGeometry args={[8.98, 6.7]} />
          <meshBasicMaterial
            map={textures[nextIndex]}
            toneMapped={false}
            transparent
            opacity={blend}
          />
        </mesh>
      </group>

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

      <mesh position={[0, 0.08, -0.08]}>
        <planeGeometry args={[8.82, 5.57]} />
        <meshBasicMaterial color={lighting.haze} transparent opacity={0.055} />
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

function Book({
  position,
  size,
  color,
  tilt,
  draggable = false,
}: {
  position: [number, number, number]
  size: [number, number, number]
  color: string
  tilt: number
  draggable?: boolean
}) {
  const [dragging, setDragging] = useState(false)
  const [x, setX] = useState(position[0])

  const endDrag = () => setDragging(false)

  return (
    <group
      position={[x, position[1], position[2]]}
      rotation={[0, 0, tilt]}
      onPointerDown={(event) => {
        if (!draggable) {
          return
        }
        event.stopPropagation()
        setDragging(true)
      }}
      onPointerMove={(event) => {
        if (!dragging) {
          return
        }
        event.stopPropagation()
        setX(THREE.MathUtils.clamp(event.point.x, -4.25, 4.25))
      }}
      onPointerUp={endDrag}
      onPointerOut={endDrag}
    >
      <mesh castShadow receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial color={color} roughness={0.66} />
      </mesh>
      <mesh position={[0, 0, size[2] / 2 + 0.002]}>
        <planeGeometry args={[size[0] * 0.82, size[1] * 0.72]} />
        <meshBasicMaterial color="#f5eadc" transparent opacity={0.55} />
      </mesh>
    </group>
  )
}

function BookshelfSet() {
  const lowerBooks = [
    [-4.2, 1.1, 0.8, 0.24, 1.18, 0.44, '#4f6682', -0.04],
    [-3.9, 1.07, 0.82, 0.18, 0.98, 0.42, '#d0915f', 0.06],
    [-3.62, 1.11, 0.82, 0.22, 1.1, 0.46, '#d5b46c', 0.02],
    [-3.3, 1.12, 0.83, 0.26, 1.3, 0.48, '#793d2e', -0.08],
    [-2.98, 1.04, 0.82, 0.16, 0.9, 0.4, '#a4b07a', 0.1],
    [-2.74, 1.08, 0.8, 0.22, 1.08, 0.44, '#6a4c93', 0.01],
    [2.02, 1.08, 0.79, 0.22, 1.06, 0.42, '#ba7043', -0.04],
    [2.3, 1.08, 0.8, 0.18, 1.18, 0.42, '#355070', 0.07],
    [2.55, 1.11, 0.82, 0.28, 1.3, 0.5, '#cb997e', 0.03],
    [2.91, 1.07, 0.81, 0.2, 0.96, 0.44, '#b5838d', -0.1],
  ] as const

  const upperBooks = [
    [-0.72, 6.12, 0.64, 0.2, 1.08, 0.38, '#d77a61', -0.08],
    [-0.44, 6.12, 0.64, 0.16, 0.9, 0.34, '#e9c46a', 0.06],
    [-0.2, 6.12, 0.65, 0.2, 1.2, 0.36, '#4d6c73', 0.03],
    [0.08, 6.12, 0.65, 0.16, 0.92, 0.34, '#7c5c93', -0.1],
    [0.32, 6.12, 0.65, 0.24, 1.14, 0.38, '#9c6644', 0.02],
    [0.65, 6.12, 0.66, 0.18, 0.98, 0.36, '#6b8f71', 0.08],
  ] as const

  return (
    <>
      {lowerBooks.map(([x, y, z, w, h, d, color, tilt], index) => (
        <Book
          key={`lower-${index}`}
          position={[x, y, z]}
          size={[w, h, d]}
          color={color}
          tilt={tilt}
          draggable={index < 2}
        />
      ))}
      {upperBooks.map(([x, y, z, w, h, d, color, tilt], index) => (
        <Book
          key={`upper-${index}`}
          position={[x, y, z]}
          size={[w, h, d]}
          color={color}
          tilt={tilt}
        />
      ))}
    </>
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
      position={[0.1, 1.06, 0.66]}
      scale={[1.08, 1.08, 1.08]}
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
      <ShadowPlane position={[0, -1.18, 0.02]} size={[1.22, 0.56]} opacity={0.16} />
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
      scale={[1.06, 1.06, 1.06]}
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
      <ShadowPlane
        position={[0.38, -0.12, 0.02]}
        size={[1.46, 0.7]}
        opacity={0.16 + glow * 0.08}
      />
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
  const head = useRef<THREE.Mesh>(null)

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
    if (head.current) {
      head.current.rotation.z = THREE.MathUtils.lerp(
        head.current.rotation.z,
        excited ? -0.28 : 0.08,
        1 - Math.exp(-delta * 9),
      )
    }
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
      scale={[1.12, 1.12, 1.12]}
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
      <mesh ref={head} position={[0.74, 0.78, 0.08]} rotation={[0.1, 0, 0.08]} castShadow>
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
      <ShadowPlane position={[0.18, -0.08, 0.02]} size={[2.2, 0.84]} opacity={0.14} />
    </group>
  )
}

function Totem({ lighting }: { lighting: LightingSample }) {
  return (
    <Float speed={1.2} rotationIntensity={0.12} floatIntensity={0.2}>
      <group position={[4.65, 0.82, 0.92]} rotation={[0, -0.4, 0]} scale={[1.08, 1.08, 1.08]}>
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
        <ShadowPlane position={[0, -0.14, 0.02]} size={[0.82, 0.42]} opacity={0.12} />
      </group>
    </Float>
  )
}

function CompanionBot({
  lighting,
  onClick,
}: {
  lighting: LightingSample
  onClick: () => void
}) {
  const [waving, setWaving] = useState(false)
  const arm = useRef<THREE.Mesh>(null)

  useEffect(() => {
    if (!waving) {
      return undefined
    }
    const timeout = window.setTimeout(() => setWaving(false), 1200)
    return () => window.clearTimeout(timeout)
  }, [waving])

  useFrame((state) => {
    if (!arm.current) {
      return
    }
    arm.current.rotation.z = waving
      ? Math.sin(state.clock.elapsedTime * 12) * 0.7
      : 0.18
  })

  return (
    <group
      position={[3.92, 0.84, 0.68]}
      scale={[1.08, 1.08, 1.08]}
      onClick={() => {
        setWaving(true)
        onClick()
      }}
    >
      <mesh castShadow>
        <capsuleGeometry args={[0.15, 0.38, 8, 14]} />
        <meshStandardMaterial color="#7b89cc" roughness={0.46} />
      </mesh>
      <mesh position={[0, 0.32, 0]} castShadow>
        <sphereGeometry args={[0.18, 22, 22]} />
        <meshStandardMaterial color="#f0ddc4" roughness={0.52} />
      </mesh>
      <mesh ref={arm} position={[0.24, 0.08, 0]} rotation={[0, 0, 0.18]} castShadow>
        <capsuleGeometry args={[0.035, 0.28, 6, 12]} />
        <meshStandardMaterial color="#f0ddc4" roughness={0.52} />
      </mesh>
      <mesh position={[-0.24, 0.04, 0]} rotation={[0, 0, -0.22]} castShadow>
        <capsuleGeometry args={[0.035, 0.28, 6, 12]} />
        <meshStandardMaterial color="#f0ddc4" roughness={0.52} />
      </mesh>
      <pointLight position={[0, 0.24, 0.18]} color={lighting.glow} intensity={0.12} distance={2} />
      <ShadowPlane position={[0, -0.18, 0.02]} size={[0.74, 0.38]} opacity={0.12} />
    </group>
  )
}

function Plant({ onClick }: { onClick: () => void }) {
  const [wiggling, setWiggling] = useState(false)
  const leaves = useRef<THREE.Group>(null)

  useEffect(() => {
    if (!wiggling) {
      return undefined
    }
    const timeout = window.setTimeout(() => setWiggling(false), 1100)
    return () => window.clearTimeout(timeout)
  }, [wiggling])

  useFrame((state) => {
    if (!leaves.current) {
      return
    }
    leaves.current.rotation.z = wiggling
      ? Math.sin(state.clock.elapsedTime * 11) * 0.18
      : Math.sin(state.clock.elapsedTime * 0.8) * 0.03
  })

  return (
    <group
      position={[-1.45, 0.92, 0.72]}
      scale={[1.08, 1.08, 1.08]}
      onClick={() => {
        setWiggling(true)
        onClick()
      }}
    >
      <mesh castShadow>
        <cylinderGeometry args={[0.18, 0.24, 0.32, 20]} />
        <meshStandardMaterial color="#936245" roughness={0.8} />
      </mesh>
      <group ref={leaves} position={[0, 0.26, 0]}>
        {[
          [0, 0.18, 0, 0],
          [0.12, 0.12, 0.2, 0.5],
          [-0.12, 0.14, -0.2, -0.5],
          [0.08, 0.28, 0.3, 0.2],
          [-0.08, 0.24, -0.3, -0.2],
        ].map(([x, y, z, rot], index) => (
          <mesh
            key={index}
            position={[x, y, z]}
            rotation={[0.1, rot, rot]}
            castShadow
          >
            <sphereGeometry args={[0.14, 18, 18]} />
            <meshStandardMaterial color="#6f9651" roughness={0.82} />
          </mesh>
        ))}
      </group>
      <ShadowPlane position={[0, -0.14, 0.02]} size={[0.8, 0.4]} opacity={0.12} />
    </group>
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

function SceneContents({ config, onLampToggle }: SceneContentsProps) {
  const lighting = useMemo(() => sampleLighting(config.timeValue), [config.timeValue])
  const isTouch = useIsTouchDevice()
  const [monitorPulse, setMonitorPulse] = useState(0)
  const sound = useSoundEffects()

  return (
    <>
      <CameraRig
        parallaxStrength={config.parallaxStrength}
        zoom={config.zoom}
        isTouch={isTouch}
      />
      <Lighting lighting={lighting} lampOn={config.lampOn} />

      <RoomShell lighting={lighting} />
      <WindowAssembly lighting={lighting} timeValue={config.timeValue} />

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
        lampOn={config.lampOn}
        onClick={() => {
          sound.lamp()
          onLampToggle()
        }}
      />
      <Dino
        lighting={lighting}
        onClick={() => {
          sound.roar()
          setMonitorPulse((value) => value + 0.4)
        }}
      />
      <Totem lighting={lighting} />
      <CompanionBot
        lighting={lighting}
        onClick={() => {
          sound.wave()
          setMonitorPulse((value) => value + 0.22)
        }}
      />
      <Plant
        onClick={() => {
          sound.rustle()
          setMonitorPulse((value) => value + 0.1)
        }}
      />
      <BookshelfSet />

      <mesh position={[0, 0.72, 0.74]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[11.5, 2.2]} />
        <meshStandardMaterial color={lighting.shelfTop} roughness={0.74} />
      </mesh>

      {config.effectsEnabled ? (
        <EffectComposer>
          <Bloom
            luminanceThreshold={0.72}
            luminanceSmoothing={0.4}
            intensity={config.lampOn ? 0.5 + monitorPulse * 0.02 : 0.2}
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

export function RoomScene({ config, onLampToggle }: RoomSceneProps) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ position: [0, 1.72, 11.4], fov: 38 }}
      gl={{ antialias: true }}
    >
      <SceneContents config={config} onLampToggle={onLampToggle} />
    </Canvas>
  )
}
