import { Suspense, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';
import { useBuildStore } from '../../state/useBuildStore';
import { coordsFromIndex } from '../../lib/voxelGrid';
import { getBlockColor, getBlockTexture } from '../../data/blockPalette';

type Position = [number, number, number];

// Shared instanced cubes; the material is supplied by the caller so we can use
// either a flat color or a texture without duplicating the matrix bookkeeping.
function InstancedBoxes({
  positions,
  children,
}: {
  positions: Position[];
  children: React.ReactNode;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

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
      {children}
    </instancedMesh>
  );
}

function ColorGroup({ color, positions }: { color: string; positions: Position[] }) {
  return (
    <InstancedBoxes positions={positions}>
      <meshStandardMaterial color={color} />
    </InstancedBoxes>
  );
}

function TexturedGroup({
  textureUrl,
  positions,
}: {
  textureUrl: string;
  positions: Position[];
}) {
  const texture = useTexture(textureUrl);

  useMemo(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
  }, [texture]);

  return (
    <InstancedBoxes positions={positions}>
      <meshStandardMaterial map={texture} />
    </InstancedBoxes>
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
      {groups.map(([blockTypeId, positions]) => {
        const color = getBlockColor(blockTypeId);
        const textureUrl = getBlockTexture(blockTypeId);
        // Textured blocks fall back to their flat color while the image loads
        // (and forever, if the block has no texture defined).
        return textureUrl ? (
          <Suspense
            key={blockTypeId}
            fallback={<ColorGroup color={color} positions={positions} />}
          >
            <TexturedGroup textureUrl={textureUrl} positions={positions} />
          </Suspense>
        ) : (
          <ColorGroup key={blockTypeId} color={color} positions={positions} />
        );
      })}
    </>
  );
}
