# Asset Attribution

## Eco block textures, icons, and shape meshes

`public/textures/blocks/`, `public/icons/blocks/`, and `public/meshes/`
contain surface textures, inventory icons, and 3D shape geometry (e.g.
Stairs, Roof, Fence, Wall, and the rest of each material's shape catalog)
extracted from the game **Eco** (https://play.eco), which is developed by
**Strange Loop Games Inc**. All rights to these assets belong to, and they
are copyrighted by, **Strange Loop Games Inc**.

**Status: permission granted.** Use of these original game assets in
EcoPlanner was requested from Strange Loop Games Inc and has been confirmed.

> _(specific terms of use and any usage restrictions from Strange Loop Games
> Inc go here, if any were specified beyond the permission itself)_

### Provenance

Extracted from a local Eco installation's Unity asset bundles
(`Eco_Data/StreamingAssets/aa/StandaloneWindows64/*.bundle`) using the
[UnityPy](https://github.com/K0lb3/UnityPy) library:

- Icons: `Sprite` objects from `icons_assets_all_*.bundle`.
- Surface textures: `Texture2D` objects referenced by each block's `Material`
  (the `_SideTex` property) in `blocksetsandrubble_assets_all_*.bundle`.
- Shape geometry (e.g. Stairs, Roof, Fence, Wall, and the rest of each
  material's shape catalog — not just Cube): `Mesh` objects from
  `blocksetsandrubble_assets_all_*.bundle`, resolved via the game's own
  BlockMeshSet config assets (which map each FormType shape to its exact
  source mesh) rather than by guessing from mesh names. UnityPy's
  `Mesh.export()` returns ready-to-use Wavefront OBJ text (vertices, UVs,
  normals, and triangle faces) directly, with no custom vertex-decoding
  needed. Shape geometry is shared per material family rather than per
  individual block id (e.g. one `AshlarStairsSolid` mesh serves all six
  Ashlar variants) — see `src/data/blockShapes.ts` for the block-id-to-mesh
  mapping. Coverage is partial by design: only (family, shape) combinations
  the extraction pass could confidently resolve to a real mesh are included
  (see `scripts/eco-raw/meshes/MANIFEST.json`); ambiguous or unresolved
  combinations are simply absent rather than approximated.

See `scripts/build-palette.mjs` for the reproducible processing pipeline
(resizing, average-color computation, and `src/data/blockPalette.ts`
generation) that turns raw extracted images into what ships in this repo, and
`scripts/build-shapes.mjs` for the equivalent (much simpler — OBJ text is
used as-is) pipeline for shape meshes.

### Pipes (Iron/Steel/Copper)

Pipes are not part of the Forms.cs shape catalog above — in Eco they're a
distinct `PipeBlock` system whose appearance is driven by a per-metal,
~24-variant neighbor-connectivity mesh table (which junction/corner/T/cross
mesh to show, keyed off which of the 6 axis directions has an adjacent
pipe). Icons were extracted the same way as other blocks (`IronPipeItem`,
`SteelPipeItem`, `CopperPipeItem` sprites).

7 of the real meshes per metal are extracted and shipped — the ones covering
every purely-horizontal or purely-vertical connectivity case (`P_Solo`,
`P_Straight_Simple`, `P_Straight_Onecap`, `P_Bend`, `P_T`, `P_Cross`,
`P_Vert`), resolved the same GameObject/`usageCases` way as every other
shape, then rotated at render time in `PipeInstancedMesh.tsx` to match each
cell's actual live neighbors (which of the 4 horizontal or 2 vertical
directions have an adjacent pipe) — same "our own connectivity rule using
Eco's real meshes" approach as the paused Wall/Column plan, not a byte-exact
reproduction of Eco's internal condition DSL. Each mesh's true open-port
direction(s) were verified from its actual geometry (a boundary-edge
analysis on welded vertices — which end is watertight vs. an open ring —
not assumed from its bounding box). The remaining ~17 variants per metal
(junctions that are *also* connected vertically, e.g. a bend that goes up)
aren't extracted yet; those cells fall back to the older procedural
approximation (a hub + one full-length cylinder per connected axis, meeting
flush but without a mitered bend) until full 3D combination coverage is
built.

Surface texture: the real junction meshes' baked UVs address a shared
`Pipes_Albedo` atlas (each metal's mesh points at a different region of the
same texture — all three metals' `Pipe Blocks` registry entries point at the
exact same "Pipes" Material, so there's no per-metal Material-level
distinction at all), shipped once, uncropped, as `public/textures/
pipes_atlas.png`. The procedural-fallback path uses a separate, smaller
per-metal crop instead (`public/textures/blocks/{iron,steel,copper}_pipe.png`
— a clean plain-surface sub-region of each metal's own atlas area, avoiding
baked valve/flange/bolt decal detail nearby that isn't meant to tile), since
its simple cylinders use plain 0..1 UVs rather than the atlas's real
coordinates.
