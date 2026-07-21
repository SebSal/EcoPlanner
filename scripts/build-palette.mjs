#!/usr/bin/env node
// Regenerates src/data/blockPalette.ts and the public texture/icon assets from
// raw extracted Eco game images in scripts/eco-raw/.
//
// Re-run this whenever the game updates: drop fresh extracted images into
// scripts/eco-raw/icons/<id>.png and scripts/eco-raw/textures/<id>.png (the
// latter is optional per block — see BLOCKS below), then run:
//   node scripts/build-palette.mjs
//
// Extraction how-to: the source images come from Eco's Unity asset bundles
// (StreamingAssets/aa/StandaloneWindows64/*.bundle), read with the Python
// `UnityPy` library. Icons are Sprite objects in icons_assets_all_*.bundle;
// block surface textures are Texture2D objects referenced by each block's
// Material (m_SavedProperties.m_TexEnvs._SideTex) in
// blocksetsandrubble_assets_all_*.bundle. See ATTRIBUTION.md.

import { readFile, mkdir, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
const RAW_DIR = path.join(ROOT, 'scripts/eco-raw');
const RAW_ICONS_DIR = path.join(RAW_DIR, 'icons');
const RAW_TEXTURES_DIR = path.join(RAW_DIR, 'textures');
const PUBLIC_ICONS_DIR = path.join(ROOT, 'public/icons/blocks');
const PUBLIC_TEXTURES_DIR = path.join(ROOT, 'public/textures/blocks');
const OUT_FILE = path.join(ROOT, 'src/data/blockPalette.ts');

const ICON_SIZE = 128;
const TEXTURE_SIZE = 256;
// Cap on the upsized resize below — keeps output file size/GPU memory sane
// even for a very small textureRepeat, and avoids upscaling past whatever
// detail the raw source actually has.
const MAX_TEXTURE_SIZE = 1024;

// `textureRepeat` (see BlockType's doc comment) means only a small crop of
// this texture is ever visible per face — resizing to a flat TEXTURE_SIZE
// like every other block would leave that crop looking blurry (256px of
// source detail spread over the whole face pre-fix; only ~256*repoint of it
// per face post-fix). Scale the output resolution up so the visible crop
// still has roughly TEXTURE_SIZE worth of detail, same sharpness as every
// unscaled material.
function effectiveTextureSize(textureRepeat) {
  if (!textureRepeat) return TEXTURE_SIZE;
  const minRepeat = Math.min(textureRepeat[0], textureRepeat[1]);
  return Math.min(MAX_TEXTURE_SIZE, Math.round(TEXTURE_SIZE / minRepeat));
}

// id, display name. `texture: false` means this block has no source texture
// (e.g. Glass, which in-game is a flat tinted shader with no albedo map) —
// it intentionally falls back to a flat color.
const BLOCKS = [
  { id: 'ashlar_basalt', name: 'Ashlar Basalt', texture: true },
  { id: 'ashlar_granite', name: 'Ashlar Granite', texture: true },
  { id: 'ashlar_gneiss', name: 'Ashlar Gneiss', texture: true },
  { id: 'ashlar_limestone', name: 'Ashlar Limestone', texture: true },
  { id: 'ashlar_sandstone', name: 'Ashlar Sandstone', texture: true },
  { id: 'ashlar_shale', name: 'Ashlar Shale', texture: true },
  // Brick has a genuinely distinct top-face texture in-game (its own
  // "Brick Floor" Material binds `BrickFloor_Albedo`, a herringbone paving
  // pattern, as `_TopTex` — while `_SideTex` is the same `BrickBuilding_Albedo`
  // used for the plain Cube). Checked every other family's equivalent floor
  // material and none of them have this split (either no dedicated floor
  // material at all, or an explicit "No Floor" variant using the identical
  // texture on every face) — so `floorTopTexture` is Brick-only for now, not
  // a general per-family flag.
  // `textureRepeat` corrects a general scale problem: our box-rendered faces
  // use plain 0..1 UVs, but Eco's real Cube mesh only samples a small crop of
  // the extracted texture per face (verified directly — its baked UVs span
  // just ~0.28x0.29 of the full "BrickBuilding_Albedo", consistent across all
  // 6 faces), not the whole thing. Without this, one block face shows the
  // texture's entire baked-in repeat count, which reads far too dense/small
  // compared to the real game. Only applied where verified — see
  // getBlockTextureRepeat's doc comment for how this generalizes (or
  // doesn't) to other materials.
  { id: 'brick', name: 'Brick', texture: true, floorTopTexture: true, textureRepeat: [0.279, 0.295] },
  { id: 'adobe', name: 'Adobe', texture: true },
  { id: 'hewn_log', name: 'Hewn Log', texture: true },
  { id: 'hardwood_hewn_log', name: 'Hardwood Hewn Log', texture: true },
  { id: 'softwood_hewn_log', name: 'Softwood Hewn Log', texture: true },
  { id: 'lumber', name: 'Lumber', texture: true },
  { id: 'hardwood_lumber', name: 'Hardwood Lumber', texture: true },
  { id: 'softwood_lumber', name: 'Softwood Lumber', texture: true },
  { id: 'composite_lumber', name: 'Composite Lumber', texture: true },
  { id: 'composite_lumber_birch', name: 'Composite Birch Lumber', texture: true },
  { id: 'composite_lumber_cedar', name: 'Composite Cedar Lumber', texture: true },
  { id: 'composite_lumber_ceiba', name: 'Composite Ceiba Lumber', texture: true },
  { id: 'composite_lumber_fir', name: 'Composite Fir Lumber', texture: true },
  { id: 'composite_lumber_joshua', name: 'Composite Joshua Lumber', texture: true },
  { id: 'composite_lumber_oak', name: 'Composite Oak Lumber', texture: true },
  { id: 'composite_lumber_palm', name: 'Composite Palm Lumber', texture: true },
  { id: 'composite_lumber_redwood', name: 'Composite Redwood Lumber', texture: true },
  { id: 'composite_lumber_saguaro', name: 'Composite Saguaro Lumber', texture: true },
  { id: 'composite_lumber_spruce', name: 'Composite Spruce Lumber', texture: true },
  { id: 'mortared_stone', name: 'Mortared Stone', texture: true },
  { id: 'mortared_granite', name: 'Mortared Granite', texture: true },
  { id: 'mortared_limestone', name: 'Mortared Limestone', texture: true },
  { id: 'mortared_sandstone', name: 'Mortared Sandstone', texture: true },
  { id: 'reinforced_concrete', name: 'Reinforced Concrete', texture: true },
  { id: 'flat_steel', name: 'Flat Steel', texture: true },
  { id: 'corrugated_steel', name: 'Corrugated Steel', texture: true },
  // Carpet's surface texture is a desaturated "tintable" base meant to be
  // dyed in-game; it averages to near-gray and doesn't read as the actual
  // carpet color. `color` here is a fixed override sampled from the top face
  // of each carpet's inventory icon (its default in-game dye), same
  // rationale as the Glass override below.
  { id: 'carpet_cotton', name: 'Cotton Carpet', texture: true, color: '#a18e46' },
  { id: 'carpet_nylon', name: 'Nylon Carpet', texture: true, color: '#6885a1' },
  { id: 'carpet_wool', name: 'Wool Carpet', texture: true, color: '#a5936a' },
  { id: 'dirt_road', name: 'Dirt Road', texture: true },
  { id: 'stone_road', name: 'Stone Road', texture: true },
  // Asphalt Road replaces the old "Asphalt Concrete" entry: it's the same
  // in-game item (AsphaltConcreteItem is tagged [MakesRoads]/"RoadType" and
  // is primarily placed as a road), so this uses the identical Asphalt_Albedo
  // texture the old entry used, just renamed/reframed as its road identity.
  { id: 'asphalt_road', name: 'Asphalt Road', texture: true },
  // Both glass types are rendered with partial opacity in the 3D view (see
  // VoxelInstancedMesh) — `opacity` here just carries that value through to
  // the generated palette. `color` is a fixed override: the source imagery
  // (a studio-lit icon render for Glass, a mostly-steel-frame texture for
  // Framed Glass) doesn't average out to a color that reads as "glass", so
  // both are pinned to a blue tint instead of computed.
  { id: 'glass', name: 'Glass', texture: false, opacity: 0.5, color: '#8fcce6' },
  { id: 'framed_glass', name: 'Framed Glass', texture: true, opacity: 0.7, color: '#8fcce6' },
  // Pipes aren't part of the Forms.cs wall/stairs/roof shape catalog — in
  // Eco they're their own PipeBlock system with a neighbor-connectivity mesh
  // selection table (25 usageCase variants per metal, keyed off which of the
  // 6 axis directions has an adjacent pipe/PipeSlot). We reproduce the
  // connectivity behavior procedurally (see PipeInstancedMesh.tsx) rather
  // than extracting/maintaining ~75 discrete junction meshes.
  //
  // All three metals' Pipe Blocks registry entries point at the exact same
  // shared "Pipes" Material (verified directly, not assumed) — so there's no
  // per-metal Material-level color/texture distinction at all. The actual
  // per-metal look instead comes from each metal's real pipe mesh sampling a
  // *different region* of that one shared "Pipes_Albedo" atlas (Iron/Steel
  // both land in grey regions at different atlas positions, Copper's lands
  // squarely in a distinct orange/copper region) — same "mesh UV position
  // determines the visual" pattern used everywhere else in this pipeline.
  // Cropped a clean plain-surface sub-region from each metal's real
  // UV-referenced area (avoiding baked valve/flange/bolt detail elsewhere in
  // that same region, which isn't meant to tile). That crop is a good
  // tileable 3D surface but a poor standalone picture — `preferIconInPicker`
  // keeps the block picker showing the clean IronPipeItem-style inventory
  // icon instead of the texture crop BlockPalette would otherwise prefer.
  { id: 'iron_pipe', name: 'Iron Pipe', texture: true, preferIconInPicker: true },
  { id: 'steel_pipe', name: 'Steel Pipe', texture: true, preferIconInPicker: true },
  { id: 'copper_pipe', name: 'Copper Pipe', texture: true, preferIconInPicker: true },
];

function toHex(r, g, b) {
  const c = (v) => Math.round(v).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

// Average color of an image, weighted by alpha (fully transparent pixels
// don't contribute) so icon padding doesn't skew the result.
async function averageColor(buffer) {
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let r = 0;
  let g = 0;
  let b = 0;
  let weight = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    const a = data[i + 3] / 255;
    if (a === 0) continue;
    r += data[i] * a;
    g += data[i + 1] * a;
    b += data[i + 2] * a;
    weight += a;
  }
  if (weight === 0) return toHex(0, 0, 0);
  return toHex(r / weight, g / weight, b / weight);
}

async function main() {
  await mkdir(PUBLIC_ICONS_DIR, { recursive: true });
  await mkdir(PUBLIC_TEXTURES_DIR, { recursive: true });

  const rawIconFiles = new Set(await readdir(RAW_ICONS_DIR).catch(() => []));
  const rawTextureFiles = new Set(await readdir(RAW_TEXTURES_DIR).catch(() => []));

  const entries = [];

  for (const block of BLOCKS) {
    const iconFile = `${block.id}.png`;
    if (!rawIconFiles.has(iconFile)) {
      throw new Error(`Missing raw icon for "${block.id}": ${path.join(RAW_ICONS_DIR, iconFile)}`);
    }

    const iconBuffer = await readFile(path.join(RAW_ICONS_DIR, iconFile));
    const iconOut = await sharp(iconBuffer)
      .resize(ICON_SIZE, ICON_SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toBuffer();
    await writeFile(path.join(PUBLIC_ICONS_DIR, iconFile), iconOut);

    let texturePath;
    let colorSourceBuffer = iconBuffer;

    if (block.texture) {
      const textureFile = `${block.id}.png`;
      if (!rawTextureFiles.has(textureFile)) {
        throw new Error(
          `Missing raw texture for "${block.id}" (texture: true): ${path.join(RAW_TEXTURES_DIR, textureFile)}`,
        );
      }
      const textureBuffer = await readFile(path.join(RAW_TEXTURES_DIR, textureFile));
      const size = effectiveTextureSize(block.textureRepeat);
      const textureOut = await sharp(textureBuffer)
        .resize(size, size, { fit: 'cover', kernel: 'lanczos3' })
        .png({ compressionLevel: 9 })
        .toBuffer();
      await writeFile(path.join(PUBLIC_TEXTURES_DIR, textureFile), textureOut);
      texturePath = `/textures/blocks/${textureFile}`;
      colorSourceBuffer = textureOut;
    }

    const color = block.color ?? (await averageColor(colorSourceBuffer));

    let floorTopTexturePath;
    if (block.floorTopTexture) {
      const floorTopFile = `${block.id}_floor_top.png`;
      if (!rawTextureFiles.has(floorTopFile)) {
        throw new Error(
          `Missing raw floor-top texture for "${block.id}" (floorTopTexture: true): ${path.join(RAW_TEXTURES_DIR, floorTopFile)}`,
        );
      }
      const floorTopBuffer = await readFile(path.join(RAW_TEXTURES_DIR, floorTopFile));
      const floorTopOut = await sharp(floorTopBuffer)
        .resize(TEXTURE_SIZE, TEXTURE_SIZE, { fit: 'cover', kernel: 'lanczos3' })
        .png({ compressionLevel: 9 })
        .toBuffer();
      await writeFile(path.join(PUBLIC_TEXTURES_DIR, floorTopFile), floorTopOut);
      floorTopTexturePath = `/textures/blocks/${floorTopFile}`;
    }

    entries.push({
      id: block.id,
      name: block.name,
      color,
      texture: texturePath,
      floorTopTexture: floorTopTexturePath,
      textureRepeat: block.textureRepeat,
      preferIconInPicker: block.preferIconInPicker,
      opacity: block.opacity,
    });
    console.log(
      `${block.id}: color=${color}${block.color ? ' (fixed)' : ''}${texturePath ? ` texture=${texturePath}` : ' (no texture)'}${floorTopTexturePath ? ` floorTop=${floorTopTexturePath}` : ''}`,
    );
  }

  // The Pipes atlas is shared across all 3 metals' real junction meshes
  // (Solo/Straight/Bend/T/Cross/Vert — see PipeInstancedMesh.tsx) rather than
  // per-block like everything else above: each metal's mesh has its own
  // baked UVs pointing at a different region of this one texture, so it
  // needs shipping uncropped/unscaled, not through the per-block pipeline.
  const pipesAtlasFile = 'pipes_atlas.png';
  if (rawTextureFiles.has(pipesAtlasFile)) {
    const atlasBuffer = await readFile(path.join(RAW_TEXTURES_DIR, pipesAtlasFile));
    const atlasOut = await sharp(atlasBuffer).png({ compressionLevel: 9 }).toBuffer();
    await mkdir(path.join(ROOT, 'public/textures'), { recursive: true });
    await writeFile(path.join(ROOT, 'public/textures', pipesAtlasFile), atlasOut);
    console.log(`Wrote shared ${pipesAtlasFile}`);
  }

  const lines = entries.map((e) => {
    const fields = [`id: '${e.id}'`, `name: '${e.name}'`, `color: '${e.color}'`];
    if (e.texture) fields.push(`texture: '${e.texture}'`);
    if (e.floorTopTexture) fields.push(`floorTopTexture: '${e.floorTopTexture}'`);
    if (e.textureRepeat) fields.push(`textureRepeat: [${e.textureRepeat[0]}, ${e.textureRepeat[1]}]`);
    if (e.preferIconInPicker) fields.push(`preferIconInPicker: true`);
    if (e.opacity !== undefined) fields.push(`opacity: ${e.opacity}`);
    return `  { ${fields.join(', ')} },`;
  });

  const out = `// GENERATED by scripts/build-palette.mjs — do not edit by hand.
// Re-run \`node scripts/build-palette.mjs\` after updating scripts/eco-raw/.
export interface BlockType {
  id: string;
  name: string;
  color: string; // hex fallback (average color of the texture, or of the icon if untextured)
  texture?: string; // path under /public to a tiling surface texture; optional
  // Path to a distinct top/bottom-face texture for the 'floor' shape, when the
  // block's in-game Floor material genuinely differs from its Cube/side
  // texture (verified per-family via the game's own Material bindings, not
  // assumed — see build-palette.mjs's BLOCKS comment). Falls back to
  // \`texture\` on every face when omitted, which is correct for every family
  // except Brick so far.
  floorTopTexture?: string;
  // [x, y] UV repeat scale for \`texture\` on box-rendered faces (Cube, and
  // Floor's side faces), correcting for our plain 0..1 box UVs vs Eco's real
  // Cube mesh, which only ever samples a small crop of the source texture
  // per face. Verified per-material from that real mesh's own baked UV span
  // — not guessed — so this is only present where confirmed; every material
  // without it renders at the original (pre-fix) 1:1 scale, unchanged.
  textureRepeat?: [number, number];
  // When true, the block picker prefers the inventory icon over the surface
  // texture for its preview swatch — for blocks whose extracted texture is a
  // good tileable 3D surface but a poor standalone picture (e.g. Pipes: a
  // plain metal swatch, vs. a clean IronPipeItem-style icon).
  preferIconInPicker?: boolean;
  opacity?: number; // 0-1; 3D-only, e.g. for glass. Defaults to fully opaque (1) when omitted.
}

export const BLOCK_PALETTE: BlockType[] = [
${lines.join('\n')}
];

export const DEFAULT_BLOCK_COLOR = '#e05fd0'; // fallback for unknown blockTypeId on import

export function getBlockColor(blockTypeId: string): string {
  return BLOCK_PALETTE.find((b) => b.id === blockTypeId)?.color ?? DEFAULT_BLOCK_COLOR;
}

export function getBlockName(blockTypeId: string): string {
  return BLOCK_PALETTE.find((b) => b.id === blockTypeId)?.name ?? blockTypeId;
}

export function getBlockTexture(blockTypeId: string): string | undefined {
  const texture = BLOCK_PALETTE.find((b) => b.id === blockTypeId)?.texture;
  // Resolve against Vite's base URL so assets load under a GitHub Pages project
  // subpath (e.g. /EcoPlanner/) rather than the domain root.
  return texture ? import.meta.env.BASE_URL + texture.replace(/^\\/+/, '') : undefined;
}

export function getBlockIcon(blockTypeId: string): string {
  return \`\${import.meta.env.BASE_URL}icons/blocks/\${blockTypeId}.png\`;
}

// undefined unless this block has a genuinely distinct top/bottom-face
// texture for the 'floor' shape — falls back to getBlockTexture() otherwise.
export function getBlockFloorTopTexture(blockTypeId: string): string | undefined {
  const texture = BLOCK_PALETTE.find((b) => b.id === blockTypeId)?.floorTopTexture;
  return texture ? import.meta.env.BASE_URL + texture.replace(/^\\/+/, '') : undefined;
}

// [1, 1] (i.e. no change) unless a verified scale exists for this block — see
// BlockType.textureRepeat's doc comment.
export function getBlockTextureRepeat(blockTypeId: string): [number, number] {
  return BLOCK_PALETTE.find((b) => b.id === blockTypeId)?.textureRepeat ?? [1, 1];
}

export function getBlockOpacity(blockTypeId: string): number {
  return BLOCK_PALETTE.find((b) => b.id === blockTypeId)?.opacity ?? 1;
}
`;

  await writeFile(OUT_FILE, out);
  console.log(`\nWrote ${entries.length} blocks to ${path.relative(ROOT, OUT_FILE)}`);
}

if (!existsSync(RAW_DIR)) {
  console.error(`Raw asset directory not found: ${RAW_DIR}`);
  console.error('Drop extracted icons/textures there first (see comment at top of this script).');
  process.exit(1);
}

main();
