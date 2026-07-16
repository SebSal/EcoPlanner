# Asset Attribution

## Eco block textures and icons

`public/textures/blocks/` and `public/icons/blocks/` contain surface textures
and inventory icons extracted from the game **Eco** (https://play.eco), which
is developed by **Strange Loop Games**. All rights to these assets belong to
Strange Loop Games.

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

See `scripts/build-palette.mjs` for the reproducible processing pipeline
(resizing, average-color computation, and `src/data/blockPalette.ts`
generation) that turns raw extracted images into what ships in this repo.
