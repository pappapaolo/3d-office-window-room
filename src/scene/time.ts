export type TimeMode = 'auto' | 'manual'
export type TimePreset = 'dawn' | 'day' | 'sunset' | 'night'

export interface SceneConfig {
  timeMode: TimeMode
  timeValue: number
  activePreset: TimePreset | null
  parallaxStrength: number
  zoom: number
  effectsEnabled: boolean
  lampOn: boolean
}

export interface LightingSample {
  skyTop: string
  skyBottom: string
  fog: string
  ambient: string
  sun: string
  sunPosition: [number, number, number]
  sunIntensity: number
  ambientIntensity: number
  practical: string
  practicalIntensity: number
  shelfTop: string
  shelfFront: string
  wallTop: string
  wallBottom: string
  frame: string
  wood: string
  accent: string
  glow: string
  skylineFar: string
  skylineNear: string
  haze: string
}

const presets: Record<TimePreset, LightingSample> = {
  dawn: {
    skyTop: '#6f88c7',
    skyBottom: '#f7b18e',
    fog: '#eed7c7',
    ambient: '#ffe4cc',
    sun: '#ffbc82',
    sunPosition: [-6.5, 5.2, 1.4],
    sunIntensity: 1.1,
    ambientIntensity: 0.9,
    practical: '#ffda97',
    practicalIntensity: 0.2,
    shelfTop: '#d7a266',
    shelfFront: '#b57a43',
    wallTop: '#7a4f39',
    wallBottom: '#65402f',
    frame: '#8c3b28',
    wood: '#7a4930',
    accent: '#f0c69a',
    glow: '#ffdba9',
    skylineFar: '#7f7fa0',
    skylineNear: '#5e6276',
    haze: '#f7d5c1',
  },
  day: {
    skyTop: '#9ad0ff',
    skyBottom: '#eff8ff',
    fog: '#d9e8ef',
    ambient: '#ffffff',
    sun: '#fff2d2',
    sunPosition: [1.8, 6.8, 3.8],
    sunIntensity: 1.45,
    ambientIntensity: 1.15,
    practical: '#ffe4aa',
    practicalIntensity: 0.08,
    shelfTop: '#deb27a',
    shelfFront: '#c48b54',
    wallTop: '#7d5136',
    wallBottom: '#66402e',
    frame: '#90331f',
    wood: '#825137',
    accent: '#ffefcb',
    glow: '#fff2db',
    skylineFar: '#8ca2bc',
    skylineNear: '#66788a',
    haze: '#eef6fb',
  },
  sunset: {
    skyTop: '#6d6ab3',
    skyBottom: '#f19e6d',
    fog: '#efd1c0',
    ambient: '#ffd8b8',
    sun: '#ff934f',
    sunPosition: [6.4, 3.4, 1.6],
    sunIntensity: 1.2,
    ambientIntensity: 0.7,
    practical: '#ffc36b',
    practicalIntensity: 0.4,
    shelfTop: '#d09b5f',
    shelfFront: '#b27645',
    wallTop: '#774734',
    wallBottom: '#59372b',
    frame: '#8f311d',
    wood: '#774731',
    accent: '#ffc694',
    glow: '#ffb47f',
    skylineFar: '#6d6c93',
    skylineNear: '#4f5162',
    haze: '#f0b89a',
  },
  night: {
    skyTop: '#101930',
    skyBottom: '#314467',
    fog: '#121826',
    ambient: '#96b0d9',
    sun: '#8fafe7',
    sunPosition: [3.8, 1.8, -3.2],
    sunIntensity: 0.18,
    ambientIntensity: 0.28,
    practical: '#ffbe5b',
    practicalIntensity: 1,
    shelfTop: '#ba8b5d',
    shelfFront: '#996339',
    wallTop: '#4d3129',
    wallBottom: '#3e261f',
    frame: '#6a2015',
    wood: '#5c392a',
    accent: '#9cbcff',
    glow: '#ffd36c',
    skylineFar: '#273551',
    skylineNear: '#111725',
    haze: '#1f2e49',
  },
}

const presetKeys: TimePreset[] = ['dawn', 'day', 'sunset', 'night']

export const PRESET_LABELS: Record<TimePreset, string> = {
  dawn: 'Dawn',
  day: 'Day',
  sunset: 'Sunset',
  night: 'Night',
}

export const PRESET_VALUES: Record<TimePreset, number> = {
  dawn: 0.12,
  day: 0.34,
  sunset: 0.68,
  night: 0.9,
}

function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '')
  const value =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => `${char}${char}`)
          .join('')
      : normalized

  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  }
}

function mixColor(from: string, to: string, t: number) {
  const a = hexToRgb(from)
  const b = hexToRgb(to)
  const mix = (start: number, end: number) =>
    Math.round(start + (end - start) * t)
      .toString(16)
      .padStart(2, '0')

  return `#${mix(a.r, b.r)}${mix(a.g, b.g)}${mix(a.b, b.b)}`
}

function mixVector(
  from: [number, number, number],
  to: [number, number, number],
  t: number,
): [number, number, number] {
  return [
    from[0] + (to[0] - from[0]) * t,
    from[1] + (to[1] - from[1]) * t,
    from[2] + (to[2] - from[2]) * t,
  ]
}

function mixNumber(from: number, to: number, t: number) {
  return from + (to - from) * t
}

function getSegment(value: number) {
  const normalized = ((value % 1) + 1) % 1
  const scaled = normalized * presetKeys.length
  const index = Math.floor(scaled) % presetKeys.length
  const nextIndex = (index + 1) % presetKeys.length
  return {
    from: presets[presetKeys[index]],
    to: presets[presetKeys[nextIndex]],
    t: scaled - index,
  }
}

export function sampleLighting(value: number): LightingSample {
  const segment = getSegment(value)
  return {
    skyTop: mixColor(segment.from.skyTop, segment.to.skyTop, segment.t),
    skyBottom: mixColor(segment.from.skyBottom, segment.to.skyBottom, segment.t),
    fog: mixColor(segment.from.fog, segment.to.fog, segment.t),
    ambient: mixColor(segment.from.ambient, segment.to.ambient, segment.t),
    sun: mixColor(segment.from.sun, segment.to.sun, segment.t),
    sunPosition: mixVector(
      segment.from.sunPosition,
      segment.to.sunPosition,
      segment.t,
    ),
    sunIntensity: mixNumber(
      segment.from.sunIntensity,
      segment.to.sunIntensity,
      segment.t,
    ),
    ambientIntensity: mixNumber(
      segment.from.ambientIntensity,
      segment.to.ambientIntensity,
      segment.t,
    ),
    practical: mixColor(segment.from.practical, segment.to.practical, segment.t),
    practicalIntensity: mixNumber(
      segment.from.practicalIntensity,
      segment.to.practicalIntensity,
      segment.t,
    ),
    shelfTop: mixColor(segment.from.shelfTop, segment.to.shelfTop, segment.t),
    shelfFront: mixColor(
      segment.from.shelfFront,
      segment.to.shelfFront,
      segment.t,
    ),
    wallTop: mixColor(segment.from.wallTop, segment.to.wallTop, segment.t),
    wallBottom: mixColor(
      segment.from.wallBottom,
      segment.to.wallBottom,
      segment.t,
    ),
    frame: mixColor(segment.from.frame, segment.to.frame, segment.t),
    wood: mixColor(segment.from.wood, segment.to.wood, segment.t),
    accent: mixColor(segment.from.accent, segment.to.accent, segment.t),
    glow: mixColor(segment.from.glow, segment.to.glow, segment.t),
    skylineFar: mixColor(
      segment.from.skylineFar,
      segment.to.skylineFar,
      segment.t,
    ),
    skylineNear: mixColor(
      segment.from.skylineNear,
      segment.to.skylineNear,
      segment.t,
    ),
    haze: mixColor(segment.from.haze, segment.to.haze, segment.t),
  }
}

export function getTimeValueFromDate(date: Date) {
  const hours = date.getHours()
  const minutes = date.getMinutes()
  return (hours * 60 + minutes) / (24 * 60)
}

export function getPresetFromValue(value: number): TimePreset {
  if (value < 0.23) {
    return 'dawn'
  }

  if (value < 0.56) {
    return 'day'
  }

  if (value < 0.8) {
    return 'sunset'
  }

  return 'night'
}
