import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useBuildStore } from '../../state/useBuildStore';
import { coordsFromIndex } from '../../lib/voxelGrid';
import { getBlockColor, getBlockTexture } from '../../data/blockPalette';

type Position = [number, number, number];

// Textures are shared across every InstancedGroup instance of the same block
// type (and across re-renders), so cache the loaded THREE.Texture by path.
const textureCache = new Map<string, THREE.Texture>();

function loadBlockTexture(texturePath: string): THREE.Texture {
  const cached = textureCache.get(texturePath);
  if (cached) return cached;
  const texture = new THREE.TextureLoader().load(texturePath);
  texture.colorSpace = THREE.SRGBColorSpace;
  // Nearest-neighbor filtering keeps the blocky, crisp look of Eco's textures
  // instead of blurring them at typical voxel viewing distances.
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  textureCache.set(texturePath, texture);
  return texture;
}

function InstancedGroup({
  blockTypeId,
  positions,
}: {
  blockTypeId: string;
  positions: Position[];
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const color = getBlockColor(blockTypeId);
  const texturePath = getBlockTexture(blockTypeId);
  const map = useMemo(() => (texturePath ? loadBlockTexture(texturePath) : null), [texturePath]);

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
      {/* When a texture is present, leave the material color white so the
          texture isn't tinted by the (darker) average fallback color. */}
      <meshStandardMaterial color={map ? '#ffffff' : color} map={map} />
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
