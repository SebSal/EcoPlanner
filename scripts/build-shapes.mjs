#!/usr/bin/env node
// Regenerates public/meshes/ and src/data/blockShapes.ts from
// scripts/eco-raw/meshes/MANIFEST.json (produced by the mesh-extraction
// agent) plus the two static tables below. Companion to build-palette.mjs,
// but much simpler on the file-processing side: OBJ text is used as-is, no
// image-style resizing needed. The interesting work here is turning the
// manifest's flat (family, shape) -> mesh list into the per-block-id
// shape/mesh lookups the app actually needs.
//
// Re-run this whenever the raw meshes change: refresh
// scripts/eco-raw/meshes/*.obj + MANIFEST.json, then run:
//   node scripts/build-shapes.mjs
//
// Extraction how-to: same UnityPy-based approach as build-palette.mjs (see
// ATTRIBUTION.md) — each mesh is a `Mesh` object in
// blocksetsandrubble_assets_all_*.bundle; UnityPy's Mesh.export() returns
// ready-to-use Wavefront OBJ text (vertices + UVs + normals + triangle faces)
// with no custom vertex-decoding needed. The manifest additionally records,
// per (family, shape), which in-game BlockMeshSet mesh was resolved as the
// authoritative source (see manifest.methodology) — MANIFEST.json is the
// single source of truth for which (family, shape) pairs have a real,
// confidently-matched mesh; nothing here fabricates or falls back to a
// placeholder for a shape the manifest didn't extract.

import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
const RAW_DIR = path.join(ROOT, 'scripts/eco-raw');
const RAW_MESHES_DIR = path.join(RAW_DIR, 'meshes');
const MANIFEST_PATH = path.join(RAW_MESHES_DIR, 'MANIFEST.json');
const PUBLIC_MESHES_DIR = path.join(ROOT, 'public/meshes');
const OUT_FILE = path.join(ROOT, 'src/data/blockShapes.ts');

// The authoritative per-family shape catalog, captured directly from the
// game's AutoGen/Forms/*.cs source (PascalCase FormType names, space-free).
// This is the full in-game list — MANIFEST.json's `extracted` entries are
// the subset of these that a real mesh could be confidently matched to;
// only that subset ends up wired into the generated getAvailableShapes().
// `Cube` is always available for every family with no mesh needed (the
// existing shared boxGeometry path in VoxelInstancedMesh.tsx), so it's
// added unconditionally below rather than requiring a manifest entry.
const FAMILY_SHAPE_CATALOG = {
  ashlar:
    'BasicSlopeCorner BasicSlopePoint BasicSlopeSide BasicSlopeTurn Brace BraceCorner BraceTurn Chimney Column Cube DoubleWindow Fence FlatRoof FloatStairs FloatStairsCorner FloatStairsTurn Floor FullWall HalfSlopeA HalfSlopeB Ladder PeakSet RampA RampB RampC RampD RoofCorner RoofCube RoofPeak RoofPeakSet RoofSide RoofTurn SideBrace Stairs StairsCorner StairsTurn UnderBrace UnderBraceCorner UnderBraceTurn UnderInnerPeak UnderPeakSet UnderSlopeCorner UnderSlopePeak UnderSlopeSide UnderSlopeTurn UnderStairs Wall Window',
  hewnlog:
    'Column Cube DocksBarrelPlatform DocksColumn DocksFenceCorner DocksFenceEndCap DocksFenceEndCapDouble DocksFenceMid DocksFenceSolo DocksFenceT DocksFenceX DocksPillar DocksPillarBeam DocksPillarBeamCorner DocksPillarBeamEnd DocksPillarBeamEndAlt DocksPillarBeamJunction DocksPillarBeamT DocksPillarBeamX DocksPlatform DocksPlatformFill DocksRampA DocksRampB DocksRampC DocksRampD DocksRamps DocksRampsCorner DocksRampsCornerInverted Floor Ladder Roof RoofCorner RoofCube RoofPeak RoofPeakSet RoofSide RoofTurn Stairs Wall WindowGrilles',
  lumber:
    'Column Cube Fence Floor Ladder Roof RoofCorner RoofCube RoofPeak RoofPeakSet RoofSide RoofTurn Stairs Wall Window WindowGrilles',
  compositelumber:
    'BasicSlopeCorner BasicSlopePoint BasicSlopeSide BasicSlopeTurn Brace CladWall Column Cube DoubleWindow Fence FlatRoof FloatStairs FloatStairsCorner FloatStairsTurn Floor FullWall Ladder PeakSet RampA RampB RampC RampD RoofCorner RoofCube RoofPeak RoofPeakSet RoofSide RoofTurn SideBrace SideFence Stairs StairsCorner StairsTurn ThinColumn UnderBrace UnderInnerPeak UnderPeakSet UnderSlopeCorner UnderSlopePeak UnderSlopeSide UnderSlopeTurn UnderStairs Wall WallTrim Window WindowGrilles WindowWall',
  brick:
    'Aqueduct BasicSlopePoint BasicSlopeSide Brace BraceCorner BraceTurn Column Cube Floor RampA RampB RampC RampD Roof RoofCorner RoofCube RoofPeak RoofPeakSet RoofSide RoofTurn SideBrace SmallCornerBrace Stairs ThinFloorBottom ThinFloorTop ThinWallEdge UnderBrace UnderBraceCorner UnderBraceTurn UnderSlopePeak UnderSlopeSide Wall Window WindowEdge WindowGrilles WindowGrillesEdge',
  concrete:
    'BasicSlopeCorner BasicSlopePoint BasicSlopeSide BasicSlopeTurn Column Cube DoubleWindow Fence FlatRoof Floor HalfSlopeA HalfSlopeB Ladder PeakSet RoadBarrier Roof RoofCorner RoofCube RoofPeak RoofPeakSet RoofSide RoofTurn Stairs StairsCorner StairsTurn ThinColumn UnderInnerPeak UnderPeakSet UnderSlopeCorner UnderSlopePeak UnderSlopeSide UnderSlopeTurn UnderStairs Wall Window',
  framedglass:
    'BasicSlopeCorner BasicSlopePoint BasicSlopeSide BasicSlopeTurn Column Cube DoubleWindow Floor Roof RoofCorner RoofCube RoofPeak RoofPeakSet RoofSide RoofTurn Stairs UnderInnerPeak UnderSlopeCorner UnderSlopePeak UnderSlopeSide UnderSlopeTurn Wall Window WindowGrilles',
  adobe:
    'Cube FenceCorner FenceEnd FenceMid FenceSolo FenceT FenceX Floor Ladder RoofCorner RoofEnd RoofFill RoofMid RoofSolo RoofT RoofX StairsCorner StairsEndLeft StairsEndRight StairsMid StairsSolo StairsTurn UnderSlopeSide WallCorner WallEnd WallMid WallSolo WallT WallX Window',
  flatsteel:
    'BasicSlopeCorner BasicSlopePoint BasicSlopeSide BasicSlopeTurn Column Cube DoubleWindow Fence FlatRoof FloatStairs FloatStairsCorner FloatStairsTurn Floor Ladder PeakSet Roof RoofCorner RoofCube RoofPeak RoofPeakSet RoofSide RoofTurn ThinColumn UnderInnerPeak UnderPeakSet UnderSlopeCorner UnderSlopePeak UnderSlopeSide UnderSlopeTurn Wall Window WindowCorners',
  carpet: 'CanopyWindow Cube Floor FullWall SimpleFloor',
  stone_road: 'Cube RampA RampB RampC RampD',
  asphalt_road:
    'Cube RampA RampB RampC RampD TwoWhiteEdgeRotate WhiteCube WhiteDashLine WhiteEdge WhiteEdgeRotate WhiteLine WhiteRampDashLineA WhiteRampDashLineB WhiteRampDashLineC WhiteRampDashLineD WhiteRampEdgeA WhiteRampEdgeB WhiteRampEdgeC WhiteRampEdgeD WhiteRampLineA WhiteRampLineB WhiteRampLineC WhiteRampLineD',
  glass: 'Cube EdgeWall EdgeWallTurn FlatRoof ThinFloorBottom ThinFloorTop ThinWallCorner ThinWallStraight Window',
  mortaredstone:
    'Column Cube Floor Roof RoofCorner RoofCube RoofPeak RoofPeakSet RoofSide RoofTurn Stairs Wall WindowGrilles',
};

// Known-redundant raw file from an earlier, separately-run extraction pass:
// cl_stairs.obj and the manifest's own compositelumber_stairs.obj are the
// same Composite Lumber stairs mesh (CL_Stairs), extracted independently at
// different times under different family-id naming conventions (see
// MANIFEST.json's `notes`). The manifest's `extracted` list (which uses the
// compositelumber_stairs.obj naming) is authoritative, so cl_stairs.obj is
// simply never referenced here — left alone on disk, not copied out, not
// wired into any block's shape list.

function humanizeShapeName(pascalName) {
  return pascalName.replace(/([A-Z])/g, ' $1').trim();
}

async function main() {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf-8'));
  const { extracted, perFamilyMemberIds } = manifest;

  // Build a lowercase-shape -> PascalCase-shape lookup per family, straight
  // from the static catalog, so we can validate manifest entries against it
  // and recover correct-casing labels.
  const catalogLowerToPascal = {};
  for (const [family, list] of Object.entries(FAMILY_SHAPE_CATALOG)) {
    const names = list.split(' ');
    catalogLowerToPascal[family] = new Map(names.map((n) => [n.toLowerCase(), n]));
  }

  // family -> Map(shapeLower -> meshId), excludes 'cube' (always boxGeometry,
  // never mesh-backed, matching the existing Stairs-era contract in
  // getShapeMeshId: undefined for 'cube').
  const familyShapeMesh = {};
  // Global shapeLower -> humanized label, deduped across families (same
  // FormType name means the same label everywhere it appears).
  const shapeLabels = {};
  const filesToCopy = [];
  let skippedAnomalies = 0;

  for (const entry of extracted) {
    const { family, shape, file } = entry;
    const pascalMap = catalogLowerToPascal[family];
    const pascalName = pascalMap?.get(shape);
    if (!pascalName) {
      console.warn(
        `Skipping manifest entry with no catalog match: family="${family}" shape="${shape}" (file ${file}). ` +
          `Not present in FAMILY_SHAPE_CATALOG for this family — possible extraction/catalog mismatch.`,
      );
      skippedAnomalies++;
      continue;
    }
    shapeLabels[shape] = humanizeShapeName(pascalName);
    filesToCopy.push(file);
    if (shape === 'cube') continue; // cube never gets wired to a mesh id
    (familyShapeMesh[family] ??= new Map()).set(shape, file.replace(/\.obj$/, ''));
  }

  // Make sure every catalog shape (including Cube) has a label, even ones
  // the manifest never extracted a mesh for (they still show up nowhere in
  // getAvailableShapes, but keeps getShapeLabel total over the full catalog
  // for anything that calls it defensively).
  for (const list of Object.values(FAMILY_SHAPE_CATALOG)) {
    for (const name of list.split(' ')) {
      shapeLabels[name.toLowerCase()] ??= humanizeShapeName(name);
    }
  }

  // family -> ordered shape id list, 'cube' always first, then every
  // manifest-extracted non-cube shape for that family.
  const familyShapes = {};
  for (const family of Object.keys(FAMILY_SHAPE_CATALOG)) {
    const meshShapes = familyShapeMesh[family] ? [...familyShapeMesh[family].keys()] : [];
    familyShapes[family] = ['cube', ...meshShapes];
  }

  // blockId -> family, from the manifest's own family->member-id mapping
  // (dirt_road maps to an empty member list — no Forms.cs, hardcoded to one
  // look — so it never gets an entry here and falls back to ['cube'] only).
  const blockFamily = {};
  for (const [family, memberIds] of Object.entries(perFamilyMemberIds)) {
    for (const blockId of memberIds) blockFamily[blockId] = family;
  }

  await mkdir(PUBLIC_MESHES_DIR, { recursive: true });
  for (const file of filesToCopy) {
    const srcPath = path.join(RAW_MESHES_DIR, file);
    if (!existsSync(srcPath)) {
      throw new Error(`Missing raw mesh listed in MANIFEST.json: ${srcPath}`);
    }
    const objText = await readFile(srcPath, 'utf-8');
    await writeFile(path.join(PUBLIC_MESHES_DIR, file), objText);
  }
  console.log(`Copied ${filesToCopy.length} meshes to ${path.relative(ROOT, PUBLIC_MESHES_DIR)}`);
  if (skippedAnomalies > 0) {
    console.log(`Skipped ${skippedAnomalies} manifest entr${skippedAnomalies === 1 ? 'y' : 'ies'} with no catalog match (see warnings above).`);
  }

  const source = `// GENERATED by scripts/build-shapes.mjs — do not edit by hand.
// Re-run \`node scripts/build-shapes.mjs\` after updating
// scripts/eco-raw/meshes/ (raw OBJs + MANIFEST.json).
//
// Shape availability and mesh assignment are shared per material *family*,
// not per individual block id (e.g. one ashlar_stairs.obj serves all six
// Ashlar variants) — mirrors how these families already share cube textures
// in blockPalette.ts/blockGroups.ts. Coverage is intentionally partial:
// MANIFEST.json only includes (family, shape) pairs the extraction agent
// could confidently match to a real mesh, so some materials expose fewer
// shapes than the game's full catalog would suggest (e.g. most of Hewn
// Log's Docks sub-system, most of Asphalt Road's White* road markings).

export type ShapeId = string;

// family -> ordered available shape ids ('cube' first, always mesh-free).
const FAMILY_SHAPES: Record<string, ShapeId[]> = ${JSON.stringify(familyShapes, null, 2)};

// family -> shape id -> mesh id (no entry for 'cube', which always uses the
// shared boxGeometry, or for any shape the manifest didn't extract).
const FAMILY_SHAPE_MESH: Record<string, Record<string, string>> = ${JSON.stringify(
    Object.fromEntries(
      Object.entries(familyShapeMesh).map(([family, map]) => [family, Object.fromEntries(map)]),
    ),
    null,
    2,
  )};

// block id -> family (only block ids with a shape family; ids absent here,
// e.g. dirt_road, only ever support 'cube').
const BLOCK_FAMILY: Record<string, string> = ${JSON.stringify(blockFamily, null, 2)};

// shape id -> humanized label for the UI, e.g. "roofcorner" -> "Roof Corner".
const SHAPE_LABELS: Record<string, string> = ${JSON.stringify(shapeLabels, null, 2)};

export function getAvailableShapes(blockId: string): ShapeId[] {
  const family = BLOCK_FAMILY[blockId];
  return family ? FAMILY_SHAPES[family] : ['cube'];
}

// undefined for 'cube' (it uses the shared boxGeometry, no mesh file) or for
// a block/shape combination with no extracted mesh.
export function getShapeMeshId(blockId: string, shape: ShapeId): string | undefined {
  if (shape === 'cube') return undefined;
  const family = BLOCK_FAMILY[blockId];
  return family ? FAMILY_SHAPE_MESH[family]?.[shape] : undefined;
}

export function getShapeMeshPath(meshId: string): string {
  return \`/meshes/\${meshId}.obj\`;
}

export function getShapeLabel(shape: ShapeId): string {
  return SHAPE_LABELS[shape] ?? shape.replace(/([A-Z])/g, ' $1').trim();
}
`;

  await writeFile(OUT_FILE, source);
  console.log(`Wrote ${path.relative(ROOT, OUT_FILE)}`);
}

if (!existsSync(RAW_DIR)) {
  console.error(`Raw asset directory not found: ${RAW_DIR}`);
  console.error('Drop extracted meshes + MANIFEST.json there first (see comment at top of this script).');
  process.exit(1);
}
if (!existsSync(MANIFEST_PATH)) {
  console.error(`Manifest not found: ${MANIFEST_PATH}`);
  process.exit(1);
}

main();
