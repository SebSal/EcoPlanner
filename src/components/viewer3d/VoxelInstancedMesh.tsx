import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useBuildStore } from '../../state/useBuildStore';
import { coordsFromIndex } from '../../lib/voxelGrid';
import { getBlockColor } from '../../data/blockPalette';

type Position = [number, number, number];

function InstancedGroup({
  blockTypeId,
  positions,
}: {
  blockTypeId: string;
  positions: Position[];
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const color = getBlockColor(blockTypeId);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const matrix = new THREE.Matrix4();
    positions.forEach(([x, y, z], i) => {
      matrix.setPosition(x, y, z);
      mesh.setMatrixAt(i, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [positions]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, positions.length]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={color} />
    </instancedMesh>
  );
}

export function VoxelInstancedMesh() {
  const grid = useBuildStore((s) => s.project.grid);
  const dimensions = useBuildStore((s) => s.project.dimensions);

  const groups = useMemo(() => {
    const byType = new Map<string, Position[]>();
    for (let i = 0; i < grid.cells.length; i++) {
      const blockTypeId = grid.cells[i];
      if (!blockTypeId) continue;
      const { x, y, z } = coordsFromIndex(i, dimensions);
      const position: Position = [
        x - dimensions.width / 2 + 0.5,
        y,
        z - dimensions.depth / 2 + 0.5,
      ];
      const list = byType.get(blockTypeId) ?? [];
      list.push(position);
      byType.set(blockTypeId, list);
    }
    return Array.from(byType.entries());
  }, [grid, dimensions]);

  return (
    <>
      {groups.map(([blockTypeId, positions]) => (
        <InstancedGroup key={blockTypeId} blockTypeId={blockTypeId} positions={positions} />
      ))}
    </>
  );
}
