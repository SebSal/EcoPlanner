import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useBuildStore } from '../../state/useBuildStore';
import { coordsFromIndex, getCell } from '../../lib/voxelGrid';
import { getBlockColor, getBlockOpacity, getBlockTexture } from '../../data/blockPalette';
import { getBlockFamily } from '../../data/blockShapes';
import { loadBlockTexture } from '../../lib/blockTexture';
import { useShapeGeometries } from '../../lib/shapeGeometry';
import { COLUMN_SHAPE_IDS, classifyColumn } from '../../data/columnConnectivity';

// Columns are neighbor-aware vertically: a 'column' cell renders with a foot,
// a capital, both (solo), or neither (plain shaft) depending on whether the
// cell above/below is the same column — so a stack reads as base → shaft →
// capital. Same "classify connectivity, render Eco's real meshes" approach as
// walls/pipes, but vertical-only. See src/data/columnConnectivity.ts.

const Y_ROTATIONS: THREE.Quaternion[] = [0, 1, 2, 3].map(
  (r) => new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (r * Math.PI) / 2, 0)),
);

const SHAPE_INDEX: Map<string, number> = new Map(COLUMN_SHAPE_IDS.map((s, i) => [s, i]));

function isSameColumn(
  grid: Parameters<typeof getCell>[0],
  x: number,
  y: number,
  z: number,
  blockTypeId: string,
): boolean {
  const cell = getCell(grid, x, y, z);
  return cell !== null && cell.blockTypeId === blockTypeId && cell.shape === 'column';
}

function ColumnGroup({ blockTypeId, count }: { blockTypeId: string; count: number }) {
  const grid = useBuildStore((s) => s.project.grid);
  const dimensions = useBuildStore((s) => s.project.dimensions);
  const family = getBlockFamily(blockTypeId);

  const color = getBlockColor(blockTypeId);
  const opacity = getBlockOpacity(blockTypeId);
  const texturePath = getBlockTexture(blockTypeId);
  const map = useMemo(() => (texturePath ? loadBlockTexture(texturePath) : null), [texturePath]);

  const meshIds = useMemo(
    () => (family ? COLUMN_SHAPE_IDS.map((s) => `${family}_${s}`) : []),
    [family],
  );
  const geometries = useShapeGeometries(meshIds);
  const allReady =
    geometries.length === COLUMN_SHAPE_IDS.length && geometries.every((g) => g !== null);

  const meshRefs = useRef<(THREE.InstancedMesh | null)[]>([]);

  useLayoutEffect(() => {
    if (!allReady) return;
    const refs = meshRefs.current;
    if (COLUMN_SHAPE_IDS.some((_, i) => !refs[i])) return;

    const indexByShape = new Array(COLUMN_SHAPE_IDS.length).fill(0);
    const matrix = new THREE.Matrix4();
    const scale = new THREE.Vector3(1, 1, 1);
    const position = new THREE.Vector3();

    for (let i = 0; i < grid.cells.length; i++) {
      const cell = grid.cells[i];
      if (!cell || cell.blockTypeId !== blockTypeId || cell.shape !== 'column') continue;
      const { x, y, z } = coordsFromIndex(i, dimensions);
      position.set(x - dimensions.width / 2 + 0.5, y, z - dimensions.depth / 2 + 0.5);

      const hasAbove = isSameColumn(grid, x, y + 1, z, blockTypeId);
      const hasBelow = isSameColumn(grid, x, y - 1, z, blockTypeId);
      const shapeId = classifyColumn(hasAbove, hasBelow);
      const shapeIdx = SHAPE_INDEX.get(shapeId)!;
      matrix.compose(position, Y_ROTATIONS[cell.rotation], scale);
      refs[shapeIdx]!.setMatrixAt(indexByShape[shapeIdx]++, matrix);
    }

    for (let i = 0; i < COLUMN_SHAPE_IDS.length; i++) {
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
      {COLUMN_SHAPE_IDS.map((shape, i) => (
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

export function ColumnInstancedMesh() {
  const grid = useBuildStore((s) => s.project.grid);

  const counts = useMemo(() => {
    const byBlockTypeId = new Map<string, number>();
    for (const cell of grid.cells) {
      if (cell && cell.shape === 'column' && getBlockFamily(cell.blockTypeId)) {
        byBlockTypeId.set(cell.blockTypeId, (byBlockTypeId.get(cell.blockTypeId) ?? 0) + 1);
      }
    }
    return byBlockTypeId;
  }, [grid]);

  return (
    <>
      {Array.from(counts.entries()).map(([blockTypeId, count]) => (
        <ColumnGroup key={blockTypeId} blockTypeId={blockTypeId} count={count} />
      ))}
    </>
  );
}
