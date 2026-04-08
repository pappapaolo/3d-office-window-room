Drop compressed `.glb` props in this folder as you replace the procedural placeholders.

Recommended pipeline:
- Export `glb` with baked transforms.
- Compress geometry with `draco` or `meshopt`.
- Prefer `KTX2` textures for heavier assets.
