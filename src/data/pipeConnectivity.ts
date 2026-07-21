// Pipe junction connectivity → mesh selection.
//
// Eco's PipeBlock system isn't part of the Forms.cs shape catalog; a pipe
// cell's appearance is driven by which of its 6 axis-aligned neighbors are
// also pipes. In the game each metal's Pipe MonoBehaviour (IronPipe/SteelPipe/
// CopperPipe) carries 25 usageCases, each binding a junction mesh
// (P_Bend, P_T_PlusUp, P_Cross_B, …) to a `conditions` set describing which
// directions must/mustn't have a neighbor. We extract those meshes and
// reproduce the *selection* ourselves rather than shipping Eco's internal
// condition DSL.
//
// `ports` below is each mesh's canonical (unrotated) set of open directions,
// read straight from that mesh's usageCase `conditions` (ruleType 0 = a
// neighbor is present = an open port). The offsetType→direction mapping was
// calibrated against the seven meshes whose ports were already verified
// in-app (straight/bend/t/cross/vert/onecap/solo) and reproduces them exactly.
// Mesh files live at public/meshes/{metal}_pipe_{id}.obj.
//
// The game applies only Y-axis (yaw) rotation to match all four horizontal
// orientations (usageCase axis=1, applyConditionsToAllRotations=1); up/down
// ports are yaw-invariant. The 24 distinct meshes are exactly the 24
// yaw-equivalence classes of the 64 possible neighbor combinations, so every
// combination resolves to exactly one (mesh, yaw) — no fallback needed.

export type PipeDir = 'px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz';

export interface PipeShape {
  id: string; // matches the mesh file suffix: {metal}_pipe_{id}.obj
  ports: PipeDir[]; // canonical open directions (unrotated)
}

// Derived from the game's PipeBlock usageCases (see header). Order is not
// significant — the runtime lookup below is exhaustive over all 64 combos.
export const PIPE_SHAPES: PipeShape[] = [
  { id: 'solo', ports: [] },
  { id: 'straight_simple', ports: ['nz', 'pz'] },
  { id: 'straight_onecap', ports: ['nz'] },
  { id: 'bend', ports: ['nx', 'pz'] },
  { id: 't', ports: ['nx', 'px', 'pz'] },
  { id: 'cross', ports: ['nx', 'nz', 'px', 'pz'] },
  { id: 'vert', ports: ['ny', 'py'] },
  { id: 'vert_onecap', ports: ['ny'] },
  { id: 'vert_onecap_upsidedown', ports: ['py'] },
  { id: 'bend_vert', ports: ['py', 'pz'] },
  { id: 'bend_vert1', ports: ['ny', 'pz'] },
  { id: 'bend_b', ports: ['ny', 'py', 'pz'] },
  { id: 'bend_b_vert', ports: ['nx', 'ny', 'pz'] },
  { id: 'bendplusup', ports: ['nx', 'py', 'pz'] },
  { id: 'bendplusup_b', ports: ['nx', 'ny', 'py', 'pz'] },
  { id: 'straight_b', ports: ['ny', 'nz', 'pz'] },
  { id: 't_vert', ports: ['nz', 'py', 'pz'] },
  { id: 't_b', ports: ['nx', 'ny', 'px', 'pz'] },
  { id: 't_b_vert', ports: ['ny', 'nz', 'py', 'pz'] },
  { id: 't_plusup', ports: ['nx', 'px', 'py', 'pz'] },
  { id: 't_plusup_b', ports: ['nx', 'ny', 'px', 'py', 'pz'] },
  { id: 'cross_b', ports: ['nx', 'ny', 'nz', 'px', 'pz'] },
  { id: 'cross_plusup', ports: ['nx', 'nz', 'px', 'py', 'pz'] },
  { id: 'cross_plusup_b', ports: ['nx', 'ny', 'nz', 'px', 'py', 'pz'] },
];

// The app's Y-rotation convention (matrix.makeRotationY(r·π/2)) cycles the four
// horizontal directions pz → px → nz → nx; py/ny are unaffected.
function rotateDirOnce(d: PipeDir): PipeDir {
  switch (d) {
    case 'pz':
      return 'px';
    case 'px':
      return 'nz';
    case 'nz':
      return 'nx';
    case 'nx':
      return 'pz';
    default:
      return d; // py, ny
  }
}

function dirKey(dirs: Iterable<PipeDir>): string {
  return [...dirs].sort().join(',');
}

export interface PipeMatch {
  shapeId: string;
  rotation: number; // 0..3, number of 90° Y-axis steps
}

// Exhaustive lookup from a cell's connected-direction set to its (mesh, yaw).
// Built once from PIPE_SHAPES × 4 rotations. Lower rotation counts win on the
// rare symmetric ties (e.g. a straight run), which is purely cosmetic.
const LOOKUP: Map<string, PipeMatch> = (() => {
  const map = new Map<string, PipeMatch>();
  for (const shape of PIPE_SHAPES) {
    let ports = shape.ports;
    for (let r = 0; r < 4; r++) {
      const key = dirKey(ports);
      if (!map.has(key)) map.set(key, { shapeId: shape.id, rotation: r });
      ports = ports.map(rotateDirOnce);
    }
  }
  return map;
})();

// Resolves a cell's set of connected directions to the matching junction mesh
// and yaw. Every one of the 64 possible subsets is covered, so this never
// returns undefined for a valid direction set.
export function classifyPipe(connected: Iterable<PipeDir>): PipeMatch {
  return LOOKUP.get(dirKey(connected)) ?? { shapeId: 'solo', rotation: 0 };
}
