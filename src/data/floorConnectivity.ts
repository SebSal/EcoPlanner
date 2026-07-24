// Floor junction connectivity → mesh selection.
//
// Eco's Floor is neighbor-aware exactly like walls/columns: a floor cell's
// appearance depends on which of its four in-plane neighbors are the same
// floor. In the game the "Brick Floor" MonoBehaviour carries 15 usageCases
// binding meshes to neighbor `conditions` (decoded from the bundle). The six
// orthogonal cases map 1:1 onto the wall junction set:
//
//   neighbors            mesh            wall analog
//   0                    floorsolo       (pedestal, all edges finished)
//   1                    floorthreeedge  dead-end (three edges finished)
//   2 adjacent           floorcorner     L-corner
//   2 opposite           floortwoedge    straight strip
//   3                    flooredge        T (one edge finished)
//   4                    floorcube       cross (interior fill, plain cube)
//
// (The game further splits the 4-neighbour interior into Floor1I..4I based on
// which diagonal cells are missing — a subtle inner-corner brick detail we
// approximate with the single floorcube for now.)
//
// Canonical ports below are the CONNECTED (neighbour-present) sides of each mesh
// in its as-extracted orientation, derived from the usageCase rules (ruleType 6
// = has-neighbour, 7 = none; orthogonal offsets 10/12/13/15). importRotation is
// identity for every case, so we match rotation at runtime like classifyWall.

// Families whose neighbor-aware floor meshes have been extracted (their Floor
// MonoBehaviour uses the same 6-case orthogonal pattern as brick — verified by
// matching the asymmetric cases' neighbor-rule signatures). Only these route
// through FloorInstancedMesh; every other family's 'floor' still renders as the
// box in VoxelInstancedMesh (unchanged). Families with genuinely different floor
// systems (adobe's fill-variants, flatsteel's numbered tiles, composite lumber)
// are intentionally excluded. Extend as more are extracted.
const FLOOR_CONNECTIVITY_FAMILIES = new Set([
  'brick',
  'lumber',
  'ashlar',
  'mortaredstone',
  'hewnlog',
  'corrugatedsteel',
]);

export function hasFloorConnectivity(family: string | undefined): boolean {
  return family !== undefined && FLOOR_CONNECTIVITY_FAMILIES.has(family);
}

export type FloorDir = 'px' | 'nx' | 'pz' | 'nz';

export const FLOOR_SHAPE_IDS = [
  'floorsolo',
  'floorthreeedge',
  'floorcorner',
  'floortwoedge',
  'flooredge',
  'floorcube',
] as const;
export type FloorShapeId = (typeof FLOOR_SHAPE_IDS)[number];

// Connected (neighbour-present) sides per mesh, canonical orientation.
const CANON: Record<FloorShapeId, FloorDir[]> = {
  floorsolo: [],
  floorthreeedge: ['pz'], // single connection toward +z
  floorcorner: ['nx', 'pz'], // two adjacent connections
  floortwoedge: ['px', 'nx'], // strip running along X
  flooredge: ['px', 'nx', 'pz'], // T, finished edge toward -z
  floorcube: ['px', 'nx', 'pz', 'nz'],
};

// Same Y-rotation convention as walls: matrix.makeRotationY(r·π/2) cycles the
// four in-plane directions pz → px → nz → nx.
function rotateDirOnce(d: FloorDir): FloorDir {
  switch (d) {
    case 'pz':
      return 'px';
    case 'px':
      return 'nz';
    case 'nz':
      return 'nx';
    case 'nx':
      return 'pz';
  }
}

function rotateSet(dirs: FloorDir[], r: number): Set<FloorDir> {
  let cur = dirs;
  for (let i = 0; i < ((r % 4) + 4) % 4; i++) cur = cur.map(rotateDirOnce);
  return new Set(cur);
}

function setsEqual(a: Set<FloorDir>, b: Set<FloorDir>): boolean {
  return a.size === b.size && [...a].every((d) => b.has(d));
}

function findRotation(canonical: FloorDir[], target: Set<FloorDir>): number {
  for (let r = 0; r < 4; r++) {
    if (setsEqual(rotateSet(canonical, r), target)) return r;
  }
  return 0;
}

export interface FloorMatch {
  shapeId: FloorShapeId;
  rotation: number; // 0..3, number of 90° Y steps
}

// Resolves a floor cell's connected in-plane directions to the mesh + yaw.
export function classifyFloor(connected: FloorDir[]): FloorMatch {
  const s = new Set(connected);
  const n = s.size;

  if (n === 0) return { shapeId: 'floorsolo', rotation: 0 };
  if (n === 4) return { shapeId: 'floorcube', rotation: 0 };
  if (n === 1) return { shapeId: 'floorthreeedge', rotation: findRotation(CANON.floorthreeedge, s) };
  if (n === 3) return { shapeId: 'flooredge', rotation: findRotation(CANON.flooredge, s) };
  // n === 2: adjacent → corner, opposite → straight strip.
  const opposite = (s.has('px') && s.has('nx')) || (s.has('pz') && s.has('nz'));
  if (opposite) return { shapeId: 'floortwoedge', rotation: findRotation(CANON.floortwoedge, s) };
  return { shapeId: 'floorcorner', rotation: findRotation(CANON.floorcorner, s) };
}
