import { useEffect, useState } from 'react'
import './App.css'
import { RoomScene } from './scene/RoomScene'
import {
  PRESET_LABELS,
  PRESET_VALUES,
  getPresetFromValue,
  getTimeValueFromDate,
  sampleLighting,
  type TimeMode,
  type TimePreset,
} from './scene/time'

const presetOrder: TimePreset[] = ['dawn', 'day', 'sunset', 'night']

function App() {
  const [timeMode, setTimeMode] = useState<TimeMode>('auto')
  const [timeValue, setTimeValue] = useState(() => getTimeValueFromDate(new Date()))
  const [activePreset, setActivePreset] = useState<TimePreset | null>(() =>
    getPresetFromValue(getTimeValueFromDate(new Date())),
  )
  const [lampOn, setLampOn] = useState(true)
  const [parallaxStrength, setParallaxStrength] = useState(0.72)
  const [zoom, setZoom] = useState(0.26)
  const [effectsEnabled, setEffectsEnabled] = useState(true)
  const [showDebug, setShowDebug] = useState(false)
  const lighting = sampleLighting(timeValue)
  const lampOverlay = lampOn ? lighting.practicalIntensity * 0.16 : 0

  useEffect(() => {
    if (timeMode !== 'auto') {
      return undefined
    }

    const syncToClock = () => {
      const nextValue = getTimeValueFromDate(new Date())
      setTimeValue(nextValue)
      setActivePreset(getPresetFromValue(nextValue))
    }

    syncToClock()

    const interval = window.setInterval(syncToClock, 60_000)
    return () => window.clearInterval(interval)
  }, [timeMode])

  const applyPreset = (preset: TimePreset) => {
    setTimeMode('manual')
    setTimeValue(PRESET_VALUES[preset])
    setActivePreset(preset)
  }

  const handleSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = Number(event.target.value)
    setTimeMode('manual')
    setTimeValue(nextValue)
    setActivePreset(getPresetFromValue(nextValue))
  }

  const handleTimeModeToggle = () => {
    if (timeMode === 'auto') {
      setTimeMode('manual')
      return
    }

    const nextValue = getTimeValueFromDate(new Date())
    setTimeMode('auto')
    setTimeValue(nextValue)
    setActivePreset(getPresetFromValue(nextValue))
  }

  return (
    <main className="app-shell">
      <div className="scene-frame">
        <div
          className="scene-lamp-wash"
          style={{ opacity: lampOverlay }}
          aria-hidden="true"
        />
        <div className="scene-canvas">
          <RoomScene
            config={{
              timeMode,
              timeValue,
              activePreset,
              parallaxStrength,
              zoom,
              effectsEnabled,
              lampOn,
            }}
            onLampToggle={() => setLampOn((value) => !value)}
          />
        </div>
        <section className="control-panel">
          <div className="panel-copy">
            <p className="eyebrow">Window Room Lab</p>
            <h1>Interactive light-study starter for a live 3D room.</h1>
            <p className="lede">
              The room, props, and window light all respond to time of day. Swap
              the outside art later, keep the camera rig and lighting system now.
            </p>
          </div>

          <div className="panel-group">
            <div className="panel-heading">
              <span>Time of day</span>
              <button
                className={`mode-toggle ${timeMode === 'auto' ? 'is-auto' : ''}`}
                type="button"
                onClick={handleTimeModeToggle}
              >
                {timeMode === 'auto' ? 'Auto synced' : 'Manual override'}
              </button>
            </div>

            <div className="preset-row">
              {presetOrder.map((preset) => (
                <button
                  key={preset}
                  className={`preset-chip ${
                    activePreset === preset ? 'is-active' : ''
                  }`}
                  type="button"
                  onClick={() => applyPreset(preset)}
                >
                  {PRESET_LABELS[preset]}
                </button>
              ))}
            </div>

            <label className="slider-field">
              <span>
                Timeline
                <strong>{Math.round(timeValue * 100)}%</strong>
              </span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.001"
                value={timeValue}
                onChange={handleSliderChange}
              />
            </label>

            <label className="slider-field">
              <span>
                Zoom
                <strong>{zoom.toFixed(2)}</strong>
              </span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
              />
            </label>
          </div>

          <div className="panel-group">
            <div className="panel-heading">
              <span>Scene tuning</span>
              <button
                className="quiet-toggle"
                type="button"
                onClick={() => setShowDebug((value) => !value)}
              >
                {showDebug ? 'Hide debug' : 'Show debug'}
              </button>
            </div>

            {showDebug ? (
              <div className="debug-grid">
                <label className="slider-field">
                  <span>
                    Parallax
                    <strong>{parallaxStrength.toFixed(2)}</strong>
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="1.4"
                    step="0.01"
                    value={parallaxStrength}
                    onChange={(event) =>
                      setParallaxStrength(Number(event.target.value))
                    }
                  />
                </label>

                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={effectsEnabled}
                    onChange={(event) => setEffectsEnabled(event.target.checked)}
                  />
                  <span>Post effects and bloom</span>
                </label>
              </div>
            ) : null}
          </div>

          <div className="panel-group panel-notes">
            <p>Interactive props</p>
            <ul>
              <li>Click the lamp to toggle practical light.</li>
              <li>Click the monitor to cycle its screen glow.</li>
              <li>Click the dinosaur to make it perk up and roar.</li>
              <li>Click the bot and plant, or drag the loose books.</li>
            </ul>
          </div>
        </section>
      </div>
    </main>
  )
}

export default App
