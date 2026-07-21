// Wall junction connectivity → mesh selection.
//
// Like Eco's PipeBlock system (see pipeConnectivity.ts), a wall cell's
// appearance is driven by which of its in-plane neighbors are also the same
// wall: a straight run, an L-corner, a T-junction, or a 4-way cross. In the
// game each family's Wall MonoBehaviour carries usageCases binding one of four
// meshes (Wall / WallCorner / T_Wall / X_Wall) to neighbor `conditions`. We
// extract those four meshes per family and reproduce the *selection* ourselves.
//
// The four meshes are normalized at extraction time (scripts bake a Y-rotation
// derived from each usageCase's conditions + importRotation) so every family
// shares one canonical orientation, letting this classifier be family-agnostic:
//   wall       straight run along X   → ports {px, nx}
//   wallcorner L bend                 → ports {nx, nz}
//   wallt      T junction             → ports {nx, nz, pz}  (open side +x)
//   wallx      4-way cross            → ports {px, nx, pz, nz}
// Walls are vertical panels, so connectivity is horizontal only (the 4 in-plane
// directions); a wall never connects up/down. The game applies only Y-axis
// (yaw) rotation to reorient a mesh, matching the app's rotation convention.

export type WallDir = 'px' | 'nx' | 'pz' | 'nz';

export const WALL_SHAPE_IDS = ['wall', 'wallcorner', 'wallt', 'wallx'] as const;
export type WallShapeId = (typeof WALL_SHAPE_IDS)[number];

// Canonical (normalized) ports per mesh — shared by every family.
const CANON: Record<WallShapeId, WallDir[]> = {
  wall: ['px', 'nx'],
  wallcorner: ['nx', 'nz'],
  wallt: ['nx', 'nz', 'pz'],
  wallx: ['px', 'nx', 'pz', 'nz'],
};

// The app's Y-rotation convention (matrix.makeRotationY(r·π/2)) cycles the four
// in-plane directions pz → px → nz → nx.
function rotateDirOnce(d: WallDir): WallDir {
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

function rotateSet(dirs: WallDir[], r: number): Set<WallDir> {
  let cur = dirs;
  for (let i = 0; i < ((r % 4) + 4) % 4; i++) cur = cur.map(rotateDirOnce);
  return new Set(cur);
}

function setsEqual(a: Set<WallDir>, b: Set<WallDir>): boolean {
  return a.size === b.size && [...a].every((d) => b.has(d));
}

// Y-rotation (0..3) that maps a mesh's canonical ports onto `target`.
function findRotation(canonical: WallDir[], target: Set<WallDir>): number {
  for (let r = 0; r < 4; r++) {
    if (setsEqual(rotateSet(canonical, r), target)) return r;
  }
  return 0;
}

export interface WallMatch {
  shapeId: WallShapeId;
  rotation: number; // 0..3, number of 90° Y steps
}

// Resolves a wall cell's connected in-plane directions (plus its placement
// `facing` rotation, used only when isolated) to the mesh + yaw to render.
export function classifyWall(connected: WallDir[], facing: number): WallMatch {
  const s = new Set(connected);
  const n = s.size;

  if (n === 0) return { shapeId: 'wall', rotation: ((facing % 4) + 4) % 4 };
  if (n === 4) return { shapeId: 'wallx', rotation: 0 };
  if (n === 3) return { shapeId: 'wallt', rotation: findRotation(CANON.wallt, s) };
  if (n === 2) {
    const opposite = (s.has('px') && s.has('nx')) || (s.has('pz') && s.has('nz'));
    // A straight run reuses the plain Wall mesh, aligned to the run axis.
    if (opposite) return { shapeId: 'wall', rotation: s.has('pz') ? 1 : 0 };
    return { shapeId: 'wallcorner', rotation: findRotation(CANON.wallcorner, s) };
  }
  // n === 1: a dead-end still uses the plain Wall panel, run-axis toward it.
  const d = connected[0];
  return { shapeId: 'wall', rotation: d === 'pz' || d === 'nz' ? 1 : 0 };
}
