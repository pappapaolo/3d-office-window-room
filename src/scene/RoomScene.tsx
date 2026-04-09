import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  ContactShadows,
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
    const distance = THREE.MathUtils.lerp(14.8, 10.4, zoom)
    const targetPosition = new THREE.Vector3(
      pointer.x * strength * 0.78,
      1.92 + pointer.y * strength * 0.32,
      distance + Math.abs(pointer.x) * strength * 0.18,
    )

    perspectiveCamera.position.lerp(targetPosition, 1 - Math.exp(-delta * 2.8))
    focus.lerp(
      new THREE.Vector3(pointer.x * strength * 0.28, 1.02 + pointer.y * 0.18, -0.18),
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

      <mesh position={[0, 0.3, 1.2]} receiveShadow castShadow>
        <boxGeometry args={[16, 0.25, 3.2]} />
        <meshStandardMaterial color={lighting.shelfTop} roughness={0.7} />
      </mesh>

      <mesh position={[0, -0.78, 0.95]} receiveShadow>
        <boxGeometry args={[16, 0.95, 3.8]} />
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
    <group position={[0, 3.68, -1.2]}>
      <group ref={group} position={[0, 0, 0]}>
        <mesh position={[0, 0.08, -0.62]} scale={[1.18, 1.18, 1]}>
          <planeGeometry args={[10.4, 7.1]} />
          <meshBasicMaterial
            map={textures[baseIndex]}
            toneMapped={false}
            transparent
            opacity={1 - blend}
          />
        </mesh>

        <mesh position={[0.12, 0.1, -0.66]} scale={[1.2, 1.2, 1]}>
          <planeGeometry args={[10.4, 7.1]} />
          <meshBasicMaterial
            map={textures[nextIndex]}
            toneMapped={false}
            transparent
            opacity={blend}
          />
        </mesh>
      </group>

      <mesh position={[0, 0, -0.2]}>
        <planeGeometry args={[8.92, 5.88]} />
        <meshPhysicalMaterial
          transmission={0.22}
          roughness={0.12}
          thickness={0.32}
          color="#ffffff"
          transparent
          opacity={0.1}
        />
      </mesh>

      <mesh position={[0, 0.08, -0.08]}>
        <planeGeometry args={[8.92, 5.88]} />
        <meshBasicMaterial color={lighting.haze} transparent opacity={0.025} />
      </mesh>

      <mesh position={[0, 0, -0.16]}>
        <planeGeometry args={[8.92, 5.88]} />
        <meshBasicMaterial color={lighting.glow} transparent opacity={0.03} />
      </mesh>

      <mesh position={[0, 3.12, 0.12]}>
        <boxGeometry args={[9.62, 0.24, 0.18]} />
        <meshStandardMaterial color={lighting.frame} roughness={0.55} />
      </mesh>
      <mesh position={[0, -3.12, 0.12]}>
        <boxGeometry args={[9.62, 0.24, 0.18]} />
        <meshStandardMaterial color={lighting.frame} roughness={0.55} />
      </mesh>
      <mesh position={[-4.81, 0, 0.12]}>
        <boxGeometry args={[0.24, 6.34, 0.18]} />
        <meshStandardMaterial color={lighting.frame} roughness={0.55} />
      </mesh>
      <mesh position={[4.81, 0, 0.12]}>
        <boxGeometry args={[0.24, 6.34, 0.18]} />
        <meshStandardMaterial color={lighting.frame} roughness={0.55} />
      </mesh>

      {[-2.98, 0, 2.98].map((x) => (
        <mesh key={x} position={[x, 0, 0.18]}>
          <boxGeometry args={[0.1, 6.04, 0.12]} />
          <meshStandardMaterial color={lighting.frame} roughness={0.5} />
        </mesh>
      ))}

      {[-1.96, 0, 1.96].map((y) => (
        <mesh key={y} position={[0, y, 0.2]}>
          <boxGeometry args={[8.92, 0.1, 0.12]} />
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

function SingleBook() {
  return (
    <Book
      position={[2.05, 0.86, 0.72]}
      size={[0.28, 1.12, 0.48]}
      color="#6b4a36"
      tilt={-0.06}
      draggable
    />
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

function Typewriter() {
  return (
    <group position={[-2.65, 0.84, 0.74]} rotation={[0, 0.22, 0]} scale={[1.05, 1.05, 1.05]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.68, 0.42, 0.88]} />
        <meshStandardMaterial color="#2a2424" roughness={0.74} />
      </mesh>
      <mesh position={[0, 0.23, -0.16]} rotation={[-0.4, 0, 0]} castShadow>
        <boxGeometry args={[1.48, 0.16, 0.52]} />
        <meshStandardMaterial color="#31292a" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.38, -0.3]} castShadow>
        <cylinderGeometry args={[0.09, 0.09, 1.42, 28]} />
        <meshStandardMaterial color="#484445" metalness={0.18} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.58, -0.18]} rotation={[-0.18, 0, 0]} castShadow>
        <planeGeometry args={[1.08, 0.72]} />
        <meshStandardMaterial color="#f0e5d0" roughness={0.94} />
      </mesh>
      {Array.from({ length: 7 }).map((_, row) =>
        Array.from({ length: 6 }).map((__, column) => (
          <mesh
            key={`${row}-${column}`}
            position={[-0.58 + column * 0.23, 0.05, 0.08 + row * 0.08]}
            castShadow
          >
            <cylinderGeometry args={[0.038, 0.042, 0.08, 14]} />
            <meshStandardMaterial color="#d7ccb8" roughness={0.56} />
          </mesh>
        )),
      )}
      <ShadowPlane position={[0, -0.2, 0.02]} size={[2.2, 0.86]} opacity={0.16} />
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
      <Typewriter />
      <SingleBook />

      <mesh position={[0, 0.42, 0.74]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
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
      camera={{ position: [0, 2.35, 12.6], fov: 29 }}
      gl={{ antialias: true }}
    >
      <SceneContents config={config} onLampToggle={onLampToggle} />
    </Canvas>
  )
}
