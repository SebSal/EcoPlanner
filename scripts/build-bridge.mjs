// Generates designs/bridge-30-claims.json — a ready-to-import ProjectFileV2
// (see src/types/project.ts) describing a modern concrete girder bridge.
//
// Run with: node scripts/build-bridge.mjs
//
// Output is deterministic (fixed timestamps, blocks emitted in the same
// y/z/x order gridToSparseBlocks produces), so re-running after a tweak gives
// a clean, readable diff.
//
// Design brief:
//   - 30 claims long (150 blocks) along Z.
//   - Roadway: 8 asphalt lanes flanked by one stone road on each side.
//   - Driving surface on layer 11 (y = 10; the layer readout is 1-based).
//   - Railings stand on their own concrete curb outside the stone roads, so
//     the deck is 12 blocks wide overall.
//   - At least 5 blocks of head clearance over the asphalt: the whole
//     structure hangs below the deck, nothing spans overhead.

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_PATH = join(ROOT, 'designs', 'bridge-30-claims.json');

const CLAIM = 5; // blocks per Eco claim (mirrors CLAIM_SIZE in src/lib/voxelGrid.ts)

// ---------------------------------------------------------------------------
// Dimensions
// ---------------------------------------------------------------------------

const LENGTH_CLAIMS = 30;
const DEPTH = LENGTH_CLAIMS * CLAIM; // 150 — the span, along Z
const WIDTH = 12; // curb | stone | 8 x asphalt | stone | curb
const DECK_Y = 10; // layer 11
const RAILING_Y = DECK_Y + 1;
const CLEARANCE = 5; // blocks of head room reserved above the roadway
// The reserved head room is part of the grid, so layers 12-16 read as the
// clearance envelope in the editor rather than being invisible.
const HEIGHT = DECK_Y + 1 + CLEARANCE; // 16

// Deck cross-section (x -> what sits there on DECK_Y).
const CURB_X = [0, WIDTH - 1];
const STONE_X = [1, WIDTH - 2];
const ASPHALT_X0 = 2;
const ASPHALT_X1 = WIDTH - 3; // inclusive -> 8 lanes

// ---------------------------------------------------------------------------
// Structure below the deck
// ---------------------------------------------------------------------------

const SLAB_Y = DECK_Y - 1; // 9  — full-width soffit under the roadway
const GIRDER_Y = SLAB_Y - 1; // 8  — longitudinal beams + pier caps
const GIRDER_X = [1, 4, 7, 10];

// One bent per claim, 5 claims apart, leaving 2 claims of deck free at each end.
const BENT_Z0 = [10, 35, 60, 85, 110, 135]; // first z of the bent's claim
const BENT_LEG_X = [[2, 3], [8, 9]]; // twin legs, 2 blocks wide each
const LEG_Y0 = 1;
const LEG_Y1 = GIRDER_Y - 1; // 7 — legs stop under the pier cap

// Abutments: the span lands on something solid at both ends.
const ABUTMENT_DEPTH = 3;
const ABUTMENT_Y1 = GIRDER_Y - 1; // 7

const CONCRETE = 'reinforced_concrete';
const ASPHALT = 'asphalt_road';
const STONE = 'stone_road';

// ---------------------------------------------------------------------------
// Grid assembly
// ---------------------------------------------------------------------------

/** @type {Map<string, {x:number,y:number,z:number,blockTypeId:string,shape:string,rotation:number}>} */
const cells = new Map();

function set(x, y, z, blockTypeId, shape = 'cube', rotation = 0) {
  cells.set(`${x},${y},${z}`, { x, y, z, blockTypeId, shape, rotation });
}

function fill(x0, x1, y0, y1, z0, z1, blockTypeId, shape = 'cube') {
  for (let y = y0; y <= y1; y++) {
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) set(x, y, z, blockTypeId, shape);
    }
  }
}

// Bents: footing, twin legs, pier cap — each one filling exactly one claim in Z
// so it lines up with the editor's heavier claim gridlines. Single-block legs
// read as toothpicks under a 12-wide deck, so each leg is a 2 x 3 shaft; the
// footing and cap are a block deeper on each side, which gives the pier its
// stepped profile.
for (const z0 of BENT_Z0) {
  fill(2, WIDTH - 3, 0, 0, z0, z0 + 4, CONCRETE); // footing
  for (const [xa, xb] of BENT_LEG_X) {
    fill(xa, xb, LEG_Y0, LEG_Y1, z0 + 1, z0 + 3, CONCRETE);
  }
  fill(1, WIDTH - 2, GIRDER_Y, GIRDER_Y, z0, z0 + 4, CONCRETE); // pier cap
}

// Abutments at both ends.
fill(0, WIDTH - 1, 0, ABUTMENT_Y1, 0, ABUTMENT_DEPTH - 1, CONCRETE);
fill(0, WIDTH - 1, 0, ABUTMENT_Y1, DEPTH - ABUTMENT_DEPTH, DEPTH - 1, CONCRETE);

// Longitudinal girders running the full span.
for (const x of GIRDER_X) fill(x, x, GIRDER_Y, GIRDER_Y, 0, DEPTH - 1, CONCRETE);

// Deck slab.
fill(0, WIDTH - 1, SLAB_Y, SLAB_Y, 0, DEPTH - 1, CONCRETE);

// Driving surface (layer 11) + railings on the curbs (layer 12).
for (let z = 0; z < DEPTH; z++) {
  for (const x of CURB_X) {
    set(x, DECK_Y, z, CONCRETE);
    // 'fence' is neighbor-aware for concrete (src/data/fenceConnectivity.ts),
    // so a straight run picks its own junction mesh.
    set(x, RAILING_Y, z, CONCRETE, 'fence');
  }
  for (const x of STONE_X) set(x, DECK_Y, z, STONE);
  for (let x = ASPHALT_X0; x <= ASPHALT_X1; x++) set(x, DECK_Y, z, ASPHALT);
}

// ---------------------------------------------------------------------------
// Checks — the brief's hard constraints, verified on the assembled grid
// ---------------------------------------------------------------------------

function assert(condition, message) {
  if (!condition) throw new Error(`build-bridge: ${message}`);
}

// Available shapes per block id, read straight out of the generated
// src/data/blockShapes.ts so a palette/shape regeneration can't silently
// invalidate this design.
function loadAvailableShapes() {
  const source = readFileSync(join(ROOT, 'src', 'data', 'blockShapes.ts'), 'utf8');
  const object = (declaration) => {
    const start = source.indexOf(declaration);
    assert(start !== -1, `could not find "${declaration}" in blockShapes.ts`);
    const open = source.indexOf('{', start);
    const close = source.indexOf('\n};', open);
    return JSON.parse(source.slice(open, close + 2));
  };
  const familyShapes = object('const FAMILY_SHAPES');
  const blockFamily = object('const BLOCK_FAMILY');
  return (blockId) => {
    const family = blockFamily[blockId];
    return family ? familyShapes[family] : ['cube'];
  };
}

const availableShapes = loadAvailableShapes();
const blocks = [...cells.values()];

for (const b of blocks) {
  assert(
    b.x >= 0 && b.x < WIDTH && b.y >= 0 && b.y < HEIGHT && b.z >= 0 && b.z < DEPTH,
    `block out of bounds at ${b.x},${b.y},${b.z}`,
  );
  assert(
    availableShapes(b.blockTypeId).includes(b.shape),
    `${b.blockTypeId} does not support shape "${b.shape}"`,
  );
}

// Head clearance: nothing at all above the roadway for CLEARANCE layers. The
// brief only requires it over the asphalt; the design keeps the stone-road
// lanes clear too, so check the full 10-block roadway.
for (let y = DECK_Y + 1; y <= DECK_Y + CLEARANCE; y++) {
  for (let z = 0; z < DEPTH; z++) {
    for (let x = STONE_X[0]; x <= STONE_X[1]; x++) {
      assert(!cells.has(`${x},${y},${z}`), `clearance envelope blocked at ${x},${y},${z}`);
    }
  }
}
assert(DECK_Y + CLEARANCE === HEIGHT - 1, 'grid is not tall enough to hold the clearance envelope');

// Deck cross-section, every step of the span.
for (let z = 0; z < DEPTH; z++) {
  const row = [];
  for (let x = 0; x < WIDTH; x++) row.push(cells.get(`${x},${DECK_Y},${z}`)?.blockTypeId);
  const expected = [
    CONCRETE,
    STONE,
    ...new Array(8).fill(ASPHALT),
    STONE,
    CONCRETE,
  ];
  assert(
    row.length === expected.length && row.every((id, i) => id === expected[i]),
    `deck cross-section wrong at z=${z}: ${row.join(', ')}`,
  );
}

// ---------------------------------------------------------------------------
// Emit
// ---------------------------------------------------------------------------

// Same order gridToSparseBlocks (src/lib/voxelGrid.ts) walks the flat grid.
blocks.sort((a, b) => a.y - b.y || a.z - b.z || a.x - b.x);

const TIMESTAMP = '2026-07-31T00:00:00.000Z';

// Portability snapshot only — loadProject ignores it — so it carries just the
// block types this design uses, with the ids/names/colors from
// src/data/blockPalette.ts.
const palette = [
  { id: 'reinforced_concrete', name: 'Reinforced Concrete', color: '#929592' },
  { id: 'stone_road', name: 'Stone Road', color: '#697676' },
  { id: 'asphalt_road', name: 'Asphalt Road', color: '#5e5d5e' },
];

const project = {
  schemaVersion: 2,
  name: 'Bridge — 30 claims',
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP,
  dimensions: { width: WIDTH, height: HEIGHT, depth: DEPTH },
  palette,
  blocks,
};

// One block per line: readable and diffable without the 5x size of full
// pretty-printing.
const json = [
  '{',
  '"schemaVersion": 2,',
  `"name": ${JSON.stringify(project.name)},`,
  `"createdAt": ${JSON.stringify(project.createdAt)},`,
  `"updatedAt": ${JSON.stringify(project.updatedAt)},`,
  `"dimensions": ${JSON.stringify(project.dimensions)},`,
  `"palette": ${JSON.stringify(project.palette)},`,
  '"blocks": [',
  blocks.map((b) => JSON.stringify(b)).join(',\n'),
  ']',
  '}',
].join('\n');

mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, json + '\n');

const counts = new Map();
for (const b of blocks) counts.set(b.blockTypeId, (counts.get(b.blockTypeId) ?? 0) + 1);

console.log(`Wrote ${OUT_PATH}`);
console.log(`  ${WIDTH} x ${DEPTH} x ${HEIGHT} (w x d x h), ${blocks.length} blocks`);
for (const [id, n] of [...counts].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${id.padEnd(22)} ${n}`);
}
