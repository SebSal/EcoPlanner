import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useBuildStore } from '../../state/useBuildStore';
import { coordsFromIndex, getCell } from '../../lib/voxelGrid';
import {
  getBlockFloorTopTexture,
  getBlockOpacity,
  getBlockTexture,
  getBlockTextureRepeat,
} from '../../data/blockPalette';
import { getBlockFamily } from '../../data/blockShapes';
import { loadBlockTexture } from '../../lib/blockTexture';
import { useShapeGeometries } from '../../lib/shapeGeometry';
import { makeTriplanarMaterial } from '../../lib/triplanarMaterial';
import {
  FLOOR_SHAPE_IDS,
  classifyFloor,
  hasFloorConnectivity,
  type FloorDir,
} from '../../data/floorConnectivity';

// Floors are neighbor-aware exactly like walls: a 'floor' cell renders as an
// isolated pedestal, a finished edge/corner, a strip, or a plain interior cube
// depending on which of its four in-plane neighbours are the same floor. Same
// "classify connectivity, render Eco's real meshes" approach as
// WallInstancedMesh — but the floor meshes have collapsed UVs, so they're
// painted with the world-space triplanar material (see makeTriplanarMaterial),
// with the herringbone floor-top texture on the up-facing walking surface.

const FLOOR_DIRS: FloorDir[] = ['px', 'nx', 'pz', 'nz'];
const NEIGHBOR_OFFSET: Record<FloorDir, [number, number, number]> = {
  px: [1, 0, 0],
  nx: [-1, 0, 0],
  pz: [0, 0, 1],
  nz: [0, 0, -1],
};

const Y_ROTATIONS: THREE.Quaternion[] = [0, 1, 2, 3].map(
  (r) => new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (r * Math.PI) / 2, 0)),
);

const SHAPE_INDEX: Map<string, number> = new Map(FLOOR_SHAPE_IDS.map((s, i) => [s, i]));

function isSameFloor(
  grid: Parameters<typeof getCell>[0],
  x: number,
  y: number,
  z: number,
  blockTypeId: string,
): boolean {
  const cell = getCell(grid, x, y, z);
  return cell !== null && cell.blockTypeId === blockTypeId && cell.shape === 'floor';
}

function FloorGroup({ blockTypeId, count }: { blockTypeId: string; count: number }) {
  const grid = useBuildStore((s) => s.project.grid);
  const dimensions = useBuildStore((s) => s.project.dimensions);
  const family = getBlockFamily(blockTypeId);

  const opacity = getBlockOpacity(blockTypeId);
  const texturePath = getBlockTexture(blockTypeId);
  const topTexturePath = getBlockFloorTopTexture(blockTypeId);
  const scale = getBlockTextureRepeat(blockTypeId);

  const material = useMemo(() => {
    if (!texturePath) return null;
    const map = loadBlockTexture(texturePath);
    const topMap = topTexturePath ? loadBlockTexture(topTexturePath) : undefined;
    return makeTriplanarMaterial({ map, scale, opacity, topMap });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texturePath, topTexturePath, scale[0], scale[1], opacity]);

  const meshIds = useMemo(
    () => (family ? FLOOR_SHAPE_IDS.map((s) => `${family}_${s}`) : []),
    [family],
  );
  const geometries = useShapeGeometries(meshIds);
  const allReady =
    geometries.length === FLOOR_SHAPE_IDS.length && geometries.every((g) => g !== null);

  const meshRefs = useRef<(THREE.InstancedMesh | null)[]>([]);

  useLayoutEffect(() => {
    if (!allReady) return;
    const refs = meshRefs.current;
    if (FLOOR_SHAPE_IDS.some((_, i) => !refs[i])) return;

    const indexByShape = new Array(FLOOR_SHAPE_IDS.length).fill(0);
    const matrix = new THREE.Matrix4();
    const scaleV = new THREE.Vector3(1, 1, 1);
    const position = new THREE.Vector3();

    for (let i = 0; i < grid.cells.length; i++) {
      const cell = grid.cells[i];
      if (!cell || cell.blockTypeId !== blockTypeId || cell.shape !== 'floor') continue;
      const { x, y, z } = coordsFromIndex(i, dimensions);
      position.set(x - dimensions.width / 2 + 0.5, y, z - dimensions.depth / 2 + 0.5);

      const connected: FloorDir[] = [];
      for (const dir of FLOOR_DIRS) {
        const [dx, dy, dz] = NEIGHBOR_OFFSET[dir];
        if (isSameFloor(grid, x + dx, y + dy, z + dz, blockTypeId)) connected.push(dir);
      }

      const { shapeId, rotation } = classifyFloor(connected);
      const shapeIdx = SHAPE_INDEX.get(shapeId)!;
      matrix.compose(position, Y_ROTATIONS[rotation], scaleV);
      refs[shapeIdx]!.setMatrixAt(indexByShape[shapeIdx]++, matrix);
    }

    for (let i = 0; i < FLOOR_SHAPE_IDS.length; i++) {
      const mesh = refs[i];
      if (!mesh) continue;
      mesh.count = indexByShape[i];
      mesh.instanceMatrix.needsUpdate = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid, dimensions, blockTypeId, allReady, ...geometries]);

  if (!allReady || !material) return null;

  return (
    <>
      {FLOOR_SHAPE_IDS.map((shape, i) => (
        <instancedMesh
          key={shape}
          ref={(el) => {
            meshRefs.current[i] = el;
          }}
          args={[undefined, undefined, count]}
        >
          <primitive object={geometries[i]!} attach="geometry" />
          <primitive object={material} attach="material" />
        </instancedMesh>
      ))}
    </>
  );
}

export function FloorInstancedMesh() {
  const grid = useBuildStore((s) => s.project.grid);

  const counts = useMemo(() => {
    const byBlockTypeId = new Map<string, number>();
    for (const cell of grid.cells) {
      if (cell && cell.shape === 'floor' && hasFloorConnectivity(getBlockFamily(cell.blockTypeId))) {
        byBlockTypeId.set(cell.blockTypeId, (byBlockTypeId.get(cell.blockTypeId) ?? 0) + 1);
      }
    }
    return byBlockTypeId;
  }, [grid]);

  return (
    <>
      {Array.from(counts.entries()).map(([blockTypeId, count]) => (
        <FloorGroup key={blockTypeId} blockTypeId={blockTypeId} count={count} />
      ))}
    </>
  );
}
