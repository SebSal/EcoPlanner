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
  { id: 'brick', name: 'Brick', texture: true },
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
  { id: 'reinforced_concrete', name: 'Reinforced Concrete', texture: true },
  { id: 'flat_steel', name: 'Flat Steel', texture: true },
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
      const textureOut = await sharp(textureBuffer)
        .resize(TEXTURE_SIZE, TEXTURE_SIZE, { fit: 'cover', kernel: 'lanczos3' })
        .png({ compressionLevel: 9 })
        .toBuffer();
      await writeFile(path.join(PUBLIC_TEXTURES_DIR, textureFile), textureOut);
      texturePath = `/textures/blocks/${textureFile}`;
      colorSourceBuffer = textureOut;
    }

    const color = block.color ?? (await averageColor(colorSourceBuffer));

    entries.push({
      id: block.id,
      name: block.name,
      color,
      texture: texturePath,
      opacity: block.opacity,
    });
    console.log(
      `${block.id}: color=${color}${block.color ? ' (fixed)' : ''}${texturePath ? ` texture=${texturePath}` : ' (no texture)'}`,
    );
  }

  const lines = entries.map((e) => {
    const fields = [`id: '${e.id}'`, `name: '${e.name}'`, `color: '${e.color}'`];
    if (e.texture) fields.push(`texture: '${e.texture}'`);
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
  return BLOCK_PALETTE.find((b) => b.id === blockTypeId)?.texture;
}

export function getBlockIcon(blockTypeId: string): string {
  return \`/icons/blocks/\${blockTypeId}.png\`;
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
