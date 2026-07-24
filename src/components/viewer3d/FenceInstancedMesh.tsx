import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useBuildStore } from '../../state/useBuildStore';
import { coordsFromIndex, getCell } from '../../lib/voxelGrid';
import { getBlockColor, getBlockOpacity, getBlockTexture } from '../../data/blockPalette';
import { getBlockFamily } from '../../data/blockShapes';
import { loadBlockTexture } from '../../lib/blockTexture';
import { useShapeGeometries } from '../../lib/shapeGeometry';
import {
  FENCE_ROLE_SUFFIXES,
  classifyFence,
  getFenceBaseShapes,
  type FenceDir,
} from '../../data/fenceConnectivity';

// Fences are neighbor-aware, same junction system as WallInstancedMesh (see
// fenceConnectivity.ts): a fence cell renders as a straight run, L-corner,
// T-junction, or 4-way cross depending on which of its four in-plane
// neighbors are the same fence (same blockTypeId + same base shape — a
// family can have more than one fence style, e.g. compositelumber's
// 'fence' and 'sidefence', which don't connect to each other).

const FENCE_DIRS: FenceDir[] = ['px', 'nx', 'pz', 'nz'];
const NEIGHBOR_OFFSET: Record<FenceDir, [number, number, number]> = {
  px: [1, 0, 0],
  nx: [-1, 0, 0],
  pz: [0, 0, 1],
  nz: [0, 0, -1],
};

const Y_ROTATIONS: THREE.Quaternion[] = [0, 1, 2, 3].map(
  (r) => new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (r * Math.PI) / 2, 0)),
);

const ROLE_INDEX: Map<string, number> = new Map(FENCE_ROLE_SUFFIXES.map((s, i) => [s, i]));

function isSameFence(
  grid: Parameters<typeof getCell>[0],
  x: number,
  y: number,
  z: number,
  blockTypeId: string,
  baseShape: string,
): boolean {
  const cell = getCell(grid, x, y, z);
  return cell !== null && cell.blockTypeId === blockTypeId && cell.shape === baseShape;
}

function FenceGroup({
  blockTypeId,
  baseShape,
  count,
}: {
  blockTypeId: string;
  baseShape: string;
  count: number;
}) {
  const grid = useBuildStore((s) => s.project.grid);
  const dimensions = useBuildStore((s) => s.project.dimensions);
  const family = getBlockFamily(blockTypeId);

  const color = getBlockColor(blockTypeId);
  const opacity = getBlockOpacity(blockTypeId);
  const texturePath = getBlockTexture(blockTypeId);
  const map = useMemo(() => (texturePath ? loadBlockTexture(texturePath) : null), [texturePath]);

  const meshIds = useMemo(
    () => (family ? FENCE_ROLE_SUFFIXES.map((role) => `${family}_${baseShape}${role}`) : []),
    [family, baseShape],
  );
  const geometries = useShapeGeometries(meshIds);
  const allReady =
    geometries.length === FENCE_ROLE_SUFFIXES.length && geometries.every((g) => g !== null);

  const meshRefs = useRef<(THREE.InstancedMesh | null)[]>([]);

  useLayoutEffect(() => {
    if (!allReady) return;
    const refs = meshRefs.current;
    if (FENCE_ROLE_SUFFIXES.some((_, i) => !refs[i])) return;

    const indexByRole = new Array(FENCE_ROLE_SUFFIXES.length).fill(0);
    const matrix = new THREE.Matrix4();
    const scale = new THREE.Vector3(1, 1, 1);
    const position = new THREE.Vector3();

    for (let i = 0; i < grid.cells.length; i++) {
      const cell = grid.cells[i];
      if (!cell || cell.blockTypeId !== blockTypeId || cell.shape !== baseShape) continue;
      const { x, y, z } = coordsFromIndex(i, dimensions);
      position.set(x - dimensions.width / 2 + 0.5, y, z - dimensions.depth / 2 + 0.5);

      const connected: FenceDir[] = [];
      for (const dir of FENCE_DIRS) {
        const [dx, dy, dz] = NEIGHBOR_OFFSET[dir];
        if (isSameFence(grid, x + dx, y + dy, z + dz, blockTypeId, baseShape)) connected.push(dir);
      }

      const { role, rotation } = classifyFence(connected, cell.rotation);
      const roleIdx = ROLE_INDEX.get(role)!;
      matrix.compose(position, Y_ROTATIONS[rotation], scale);
      refs[roleIdx]!.setMatrixAt(indexByRole[roleIdx]++, matrix);
    }

    for (let i = 0; i < FENCE_ROLE_SUFFIXES.length; i++) {
      const mesh = refs[i];
      if (!mesh) continue;
      mesh.count = indexByRole[i];
      mesh.instanceMatrix.needsUpdate = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid, dimensions, blockTypeId, baseShape, allReady, ...geometries]);

  if (!allReady) return null;

  return (
    <>
      {FENCE_ROLE_SUFFIXES.map((role, i) => (
        <instancedMesh
          key={role || 'base'}
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

export function FenceInstancedMesh() {
  const grid = useBuildStore((s) => s.project.grid);

  const counts = useMemo(() => {
    const byKey = new Map<string, { blockTypeId: string; baseShape: string; count: number }>();
    for (const cell of grid.cells) {
      if (!cell) continue;
      const family = getBlockFamily(cell.blockTypeId);
      if (!family || !getFenceBaseShapes(family).includes(cell.shape)) continue;
      const key = `${cell.blockTypeId}|${cell.shape}`;
      const entry = byKey.get(key) ?? { blockTypeId: cell.blockTypeId, baseShape: cell.shape, count: 0 };
      entry.count++;
      byKey.set(key, entry);
    }
    return byKey;
  }, [grid]);

  return (
    <>
      {Array.from(counts.entries()).map(([key, { blockTypeId, baseShape, count }]) => (
        <FenceGroup key={key} blockTypeId={blockTypeId} baseShape={baseShape} count={count} />
      ))}
    </>
  );
}
