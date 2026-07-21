import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useBuildStore } from '../../state/useBuildStore';
import { coordsFromIndex, getCell } from '../../lib/voxelGrid';
import { loadBlockTexture } from '../../lib/blockTexture';
import { useShapeGeometries } from '../../lib/shapeGeometry';
import { PIPE_SHAPES, classifyPipe, type PipeDir } from '../../data/pipeConnectivity';

// Pipes aren't part of the Forms.cs wall/stairs/roof shape catalog — in Eco
// they're a distinct PipeBlock system whose appearance is driven by which of
// the 6 axis-aligned neighbors are also pipes. We render every connectivity
// case with Eco's own extracted junction meshes: one instanced pool per shape
// (24 shapes covering all 64 neighbor combinations, including combined
// horizontal+vertical junctions like bend-plus-riser and T-plus-riser),
// selected + yaw-rotated by classifyPipe. See src/data/pipeConnectivity.ts for
// the shape/port table and how it maps to a mesh + rotation.

const NEIGHBOR_OFFSET: Record<PipeDir, [number, number, number]> = {
  px: [1, 0, 0],
  nx: [-1, 0, 0],
  py: [0, 1, 0],
  ny: [0, -1, 0],
  pz: [0, 0, 1],
  nz: [0, 0, -1],
};

const ALL_DIRS: PipeDir[] = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];

const Y_ROTATIONS: THREE.Quaternion[] = [0, 1, 2, 3].map(
  (r) => new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (r * Math.PI) / 2, 0)),
);

// Shape id -> its index in PIPE_SHAPES (and in the parallel geometry/ref/pool
// arrays), so a classifyPipe result routes to the right instanced pool.
const SHAPE_INDEX: Map<string, number> = new Map(PIPE_SHAPES.map((s, i) => [s.id, i]));

function hasPipeNeighbor(
  grid: Parameters<typeof getCell>[0],
  x: number,
  y: number,
  z: number,
  blockTypeId: string,
): boolean {
  const cell = getCell(grid, x, y, z);
  return cell !== null && cell.blockTypeId === blockTypeId && cell.shape === 'pipe';
}

function PipeGroup({ blockTypeId, count }: { blockTypeId: string; count: number }) {
  const grid = useBuildStore((s) => s.project.grid);
  const dimensions = useBuildStore((s) => s.project.dimensions);

  // Each metal's junction meshes share one atlas — every mesh's baked UVs
  // address a different region of the full Pipes_Albedo (per-metal color comes
  // from *which* region a mesh samples, not a material tint), so it must ship
  // uncropped, unlike the small per-block tileable crops used elsewhere.
  const atlasMap = useMemo(
    () => loadBlockTexture(`${import.meta.env.BASE_URL}textures/pipes_atlas.png`),
    [],
  );

  // Load every junction geometry for this metal (one instanced pool each).
  const meshIds = useMemo(() => PIPE_SHAPES.map((s) => `${blockTypeId}_${s.id}`), [blockTypeId]);
  const geometries = useShapeGeometries(meshIds);
  const allReady = geometries.length === PIPE_SHAPES.length && geometries.every((g) => g !== null);

  const meshRefs = useRef<(THREE.InstancedMesh | null)[]>([]);

  useLayoutEffect(() => {
    if (!allReady) return;
    const refs = meshRefs.current;
    if (PIPE_SHAPES.some((_, i) => !refs[i])) return;

    const indexByShape = new Array(PIPE_SHAPES.length).fill(0);
    const matrix = new THREE.Matrix4();
    const scale = new THREE.Vector3(1, 1, 1);
    const position = new THREE.Vector3();

    for (let i = 0; i < grid.cells.length; i++) {
      const cell = grid.cells[i];
      if (!cell || cell.blockTypeId !== blockTypeId || cell.shape !== 'pipe') continue;
      const { x, y, z } = coordsFromIndex(i, dimensions);
      position.set(x - dimensions.width / 2 + 0.5, y, z - dimensions.depth / 2 + 0.5);

      const connected: PipeDir[] = [];
      for (const dir of ALL_DIRS) {
        const [dx, dy, dz] = NEIGHBOR_OFFSET[dir];
        if (hasPipeNeighbor(grid, x + dx, y + dy, z + dz, blockTypeId)) connected.push(dir);
      }

      const { shapeId, rotation } = classifyPipe(connected);
      const shapeIdx = SHAPE_INDEX.get(shapeId)!;
      matrix.compose(position, Y_ROTATIONS[rotation], scale);
      refs[shapeIdx]!.setMatrixAt(indexByShape[shapeIdx]++, matrix);
    }

    for (let i = 0; i < PIPE_SHAPES.length; i++) {
      const mesh = refs[i];
      if (!mesh) continue;
      mesh.count = indexByShape[i];
      mesh.instanceMatrix.needsUpdate = true;
    }
    // geometries is intentionally spread into the deps: the effect must re-run
    // once each async-loaded geometry resolves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid, dimensions, blockTypeId, allReady, ...geometries]);

  if (!allReady) return null;

  return (
    <>
      {PIPE_SHAPES.map((shape, i) => (
        <instancedMesh
          key={shape.id}
          ref={(el) => {
            meshRefs.current[i] = el;
          }}
          args={[undefined, undefined, count]}
        >
          <primitive object={geometries[i]!} attach="geometry" />
          <meshStandardMaterial color="#ffffff" map={atlasMap} />
        </instancedMesh>
      ))}
    </>
  );
}

export function PipeInstancedMesh() {
  const grid = useBuildStore((s) => s.project.grid);

  const counts = useMemo(() => {
    const byBlockTypeId = new Map<string, number>();
    for (const cell of grid.cells) {
      if (cell && cell.shape === 'pipe') {
        byBlockTypeId.set(cell.blockTypeId, (byBlockTypeId.get(cell.blockTypeId) ?? 0) + 1);
      }
    }
    return byBlockTypeId;
  }, [grid]);

  return (
    <>
      {Array.from(counts.entries()).map(([blockTypeId, count]) => (
        <PipeGroup key={blockTypeId} blockTypeId={blockTypeId} count={count} />
      ))}
    </>
  );
}
