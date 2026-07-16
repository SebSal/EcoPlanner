# Asset Attribution

## Eco block textures, icons, and shape meshes

`public/textures/blocks/`, `public/icons/blocks/`, and `public/meshes/`
contain surface textures, inventory icons, and 3D shape geometry (e.g.
Stairs, Roof, Fence, Wall, and the rest of each material's shape catalog)
extracted from the game **Eco** (https://play.eco), which is developed by
**Strange Loop Games**. All rights to these assets belong to Strange Loop
Games. Real extracted mesh geometry is an even clearer case of a copyrighted
game asset than a derived average color or a resized texture, so it stays
under the same pending-permission constraint as the rest of this branch
below.

**Status: pending permission.** Use of these original game assets in
EcoPlanner has been requested from Strange Loop Games' community manager but
is not yet confirmed. Until approval is granted:

- These assets live only on the `add-eco-textures` branch and must not be
  merged into `main` (which auto-deploys to the public GitHub Pages site).
- If permission is declined, these files will be replaced with original
  redraws inspired by — but not copied from — the game's visual style. The
  `BlockType.texture` field is optional and swappable by design specifically
  to make this replacement painless (see `src/data/blockPalette.ts`).

Terms of use will be filled in here once permission is confirmed:

> _(pending — terms of use, required credit line, and any usage restrictions
> from Strange Loop Games go here)_

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
