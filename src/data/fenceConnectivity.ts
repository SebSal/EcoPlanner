// Fence junction connectivity → mesh selection.
//
// Eco's Fence blocks use the exact same junction system as Wall (see
// wallConnectivity.ts): a fence cell's appearance depends on which of its
// four in-plane neighbors are the same fence. Each family's Fence
// MonoBehaviour carries usageCases binding one of four meshes (plain run /
// corner / T / 4-way cross) to neighbor `conditions`, using the identical
// offsetType/ruleType encoding as walls (ruleType 4/5 = present/absent,
// ruleString "Building"). importRotation is identity for every fence
// usageCase, and each mesh's connected sides already match the wall
// classifier's canonical target directions — no rotation baking was needed
// at extraction time (unlike some wall families), so the extracted meshes
// are used as-is:
//   fence        straight run along X   → ports {px, nx}
//   fencecorner  L bend                 → ports {nx, nz}
//   fencet       T junction             → ports {nx, nz, pz}  (open side +x)
//   fencex       4-way cross            → ports {px, nx, pz, nz}
// Fences are vertical panels like walls, so connectivity is horizontal only.
//
// Composite Lumber has a second, visually distinct fence style ("Fence Side")
// selectable as its own shape ('sidefence') — same junction system, its own
// four meshes ({family}_sidefence / sidefencecorner / sidefencet / sidefencex).

// Families (and which of their fence-like base shapes) whose junction meshes
// have been extracted. Only these route through FenceInstancedMesh; other
// fence shapes (e.g. ashlar's wall-attached fence, flatsteel/lumber's
// terrain-following post+rail fences) keep rendering as a single static mesh
// in VoxelInstancedMesh.
const FENCE_CONNECTIVITY_FAMILIES: Record<string, string[]> = {
  corrugatedsteel: ['fence'],
  concrete: ['fence'],
  compositelumber: ['fence', 'sidefence'],
};

export function hasFenceConnectivity(family: string | undefined, baseShape: string): boolean {
  return family !== undefined && (FENCE_CONNECTIVITY_FAMILIES[family]?.includes(baseShape) ?? false);
}

export function getFenceBaseShapes(family: string | undefined): string[] {
  return family ? (FENCE_CONNECTIVITY_FAMILIES[family] ?? []) : [];
}

export type FenceDir = 'px' | 'nx' | 'pz' | 'nz';

export const FENCE_ROLE_SUFFIXES = ['', 'corner', 't', 'x'] as const;
export type FenceRole = (typeof FENCE_ROLE_SUFFIXES)[number];

// Canonical (normalized) ports per role — shared by every family/base shape.
const CANON: Record<Exclude<FenceRole, ''>, FenceDir[]> = {
  corner: ['nx', 'nz'],
  t: ['nx', 'nz', 'pz'],
  x: ['px', 'nx', 'pz', 'nz'],
};

// Same Y-rotation convention as walls: matrix.makeRotationY(r·π/2) cycles the
// four in-plane directions pz → px → nz → nx.
function rotateDirOnce(d: FenceDir): FenceDir {
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

function rotateSet(dirs: FenceDir[], r: number): Set<FenceDir> {
  let cur = dirs;
  for (let i = 0; i < ((r % 4) + 4) % 4; i++) cur = cur.map(rotateDirOnce);
  return new Set(cur);
}

function setsEqual(a: Set<FenceDir>, b: Set<FenceDir>): boolean {
  return a.size === b.size && [...a].every((d) => b.has(d));
}

function findRotation(canonical: FenceDir[], target: Set<FenceDir>): number {
  for (let r = 0; r < 4; r++) {
    if (setsEqual(rotateSet(canonical, r), target)) return r;
  }
  return 0;
}

export interface FenceMatch {
  role: FenceRole;
  rotation: number; // 0..3, number of 90° Y steps
}

// Resolves a fence cell's connected in-plane directions (plus its placement
// `facing` rotation, used only when isolated) to the mesh role + yaw.
export function classifyFence(connected: FenceDir[], facing: number): FenceMatch {
  const s = new Set(connected);
  const n = s.size;

  if (n === 0) return { role: '', rotation: ((facing % 4) + 4) % 4 };
  if (n === 4) return { role: 'x', rotation: 0 };
  if (n === 3) return { role: 't', rotation: findRotation(CANON.t, s) };
  if (n === 2) {
    const opposite = (s.has('px') && s.has('nx')) || (s.has('pz') && s.has('nz'));
    // A straight run reuses the plain fence mesh, aligned to the run axis.
    if (opposite) return { role: '', rotation: s.has('pz') ? 1 : 0 };
    return { role: 'corner', rotation: findRotation(CANON.corner, s) };
  }
  // n === 1: a dead-end still uses the plain fence panel, run-axis toward it.
  const d = connected[0];
  return { role: '', rotation: d === 'pz' || d === 'nz' ? 1 : 0 };
}
