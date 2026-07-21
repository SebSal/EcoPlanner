import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useBuildStore } from '../../state/useBuildStore';
import { coordsFromIndex, getCell } from '../../lib/voxelGrid';
import { getBlockColor, getBlockOpacity, getBlockTexture } from '../../data/blockPalette';
import { getBlockFamily } from '../../data/blockShapes';
import { loadBlockTexture } from '../../lib/blockTexture';
import { useShapeGeometries } from '../../lib/shapeGeometry';
import { WALL_SHAPE_IDS, classifyWall, type WallDir } from '../../data/wallConnectivity';

// Walls are neighbor-aware: a 'wall' cell renders as a straight run, L-corner,
// T-junction, or 4-way cross depending on which of its four in-plane neighbors
// are the same wall — the same "classify connectivity ourselves, render Eco's
// real meshes" approach as PipeInstancedMesh, but horizontal-only (walls never
// connect up/down) and textured with the family surface texture. Selection +
// yaw come from classifyWall; the four meshes are normalized to one canonical
// orientation at extraction time (see src/data/wallConnectivity.ts).

// In-plane neighbor directions only (walls are vertical panels).
const WALL_DIRS: WallDir[] = ['px', 'nx', 'pz', 'nz'];
const NEIGHBOR_OFFSET: Record<WallDir, [number, number, number]> = {
  px: [1, 0, 0],
  nx: [-1, 0, 0],
  pz: [0, 0, 1],
  nz: [0, 0, -1],
};

const Y_ROTATIONS: THREE.Quaternion[] = [0, 1, 2, 3].map(
  (r) => new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (r * Math.PI) / 2, 0)),
);

const SHAPE_INDEX: Map<string, number> = new Map(WALL_SHAPE_IDS.map((s, i) => [s, i]));

function isSameWall(
  grid: Parameters<typeof getCell>[0],
  x: number,
  y: number,
  z: number,
  blockTypeId: string,
): boolean {
  const cell = getCell(grid, x, y, z);
  return cell !== null && cell.blockTypeId === blockTypeId && cell.shape === 'wall';
}

function WallGroup({ blockTypeId, count }: { blockTypeId: string; count: number }) {
  const grid = useBuildStore((s) => s.project.grid);
  const dimensions = useBuildStore((s) => s.project.dimensions);
  const family = getBlockFamily(blockTypeId);

  const color = getBlockColor(blockTypeId);
  const opacity = getBlockOpacity(blockTypeId);
  const texturePath = getBlockTexture(blockTypeId);
  const map = useMemo(() => (texturePath ? loadBlockTexture(texturePath) : null), [texturePath]);

  const meshIds = useMemo(
    () => (family ? WALL_SHAPE_IDS.map((s) => `${family}_${s}`) : []),
    [family],
  );
  const geometries = useShapeGeometries(meshIds);
  const allReady =
    geometries.length === WALL_SHAPE_IDS.length && geometries.every((g) => g !== null);

  const meshRefs = useRef<(THREE.InstancedMesh | null)[]>([]);

  useLayoutEffect(() => {
    if (!allReady) return;
    const refs = meshRefs.current;
    if (WALL_SHAPE_IDS.some((_, i) => !refs[i])) return;

    const indexByShape = new Array(WALL_SHAPE_IDS.length).fill(0);
    const matrix = new THREE.Matrix4();
    const scale = new THREE.Vector3(1, 1, 1);
    const position = new THREE.Vector3();

    for (let i = 0; i < grid.cells.length; i++) {
      const cell = grid.cells[i];
      if (!cell || cell.blockTypeId !== blockTypeId || cell.shape !== 'wall') continue;
      const { x, y, z } = coordsFromIndex(i, dimensions);
      position.set(x - dimensions.width / 2 + 0.5, y, z - dimensions.depth / 2 + 0.5);

      const connected: WallDir[] = [];
      for (const dir of WALL_DIRS) {
        const [dx, dy, dz] = NEIGHBOR_OFFSET[dir];
        if (isSameWall(grid, x + dx, y + dy, z + dz, blockTypeId)) connected.push(dir);
      }

      const { shapeId, rotation } = classifyWall(connected, cell.rotation);
      const shapeIdx = SHAPE_INDEX.get(shapeId)!;
      matrix.compose(position, Y_ROTATIONS[rotation], scale);
      refs[shapeIdx]!.setMatrixAt(indexByShape[shapeIdx]++, matrix);
    }

    for (let i = 0; i < WALL_SHAPE_IDS.length; i++) {
      const mesh = refs[i];
      if (!mesh) continue;
      mesh.count = indexByShape[i];
      mesh.instanceMatrix.needsUpdate = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid, dimensions, blockTypeId, allReady, ...geometries]);

  if (!allReady) return null;

  return (
    <>
      {WALL_SHAPE_IDS.map((shape, i) => (
        <instancedMesh
          key={shape}
          ref={(el) => {
            meshRefs.current[i] = el;
          }}
          args={[undefined, undefined, count]}
        >
          <primitive object={geometries[i]!} attach="geometry" />
          <meshStandardMaterial
            color={map ? '#ffffff' : color}
            map={map}
            transparent={opacity < 1}
            opacity={opacity}
          />
        </instancedMesh>
      ))}
    </>
  );
}

export function WallInstancedMesh() {
  const grid = useBuildStore((s) => s.project.grid);

  const counts = useMemo(() => {
    const byBlockTypeId = new Map<string, number>();
    for (const cell of grid.cells) {
      if (cell && cell.shape === 'wall' && getBlockFamily(cell.blockTypeId)) {
        byBlockTypeId.set(cell.blockTypeId, (byBlockTypeId.get(cell.blockTypeId) ?? 0) + 1);
      }
    }
    return byBlockTypeId;
  }, [grid]);

  return (
    <>
      {Array.from(counts.entries()).map(([blockTypeId, count]) => (
        <WallGroup key={blockTypeId} blockTypeId={blockTypeId} count={count} />
      ))}
    </>
  );
}
