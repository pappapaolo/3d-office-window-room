# 3D Office Window Room

An interactive `React + Vite + React Three Fiber` scene prototype for a stylized office/window composition with:

- live time-of-day lighting
- cursor-based parallax camera motion
- interactive desk props
- tweakable debug controls for zoom, parallax, and effects

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Controls

- Toggle `Auto synced` to follow the viewer's local time.
- Use the preset chips to jump between `Dawn`, `Day`, `Sunset`, and `Night`.
- Open `Show debug` to tweak zoom, parallax, and effects.
- Click the lamp, monitor, and dinosaur inside the scene.

## Assets

Starter asset folders are included for future upgrades:

- `public/assets/models/` for compressed `.glb` props
- `public/assets/window/` for swappable skyline and sky plates

## Notes

This first pass uses procedural geometry and a generated skyline texture so the lighting rig and scene composition are easy to iterate on before replacing pieces with custom models or Midjourney-derived window art.
