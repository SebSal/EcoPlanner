import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useBuildStore } from '../../state/useBuildStore';
import { coordsFromIndex } from '../../lib/voxelGrid';
import { getBlockColor, getBlockOpacity, getBlockTexture } from '../../data/blockPalette';
import { getShapeMeshId, type ShapeId } from '../../data/blockShapes';
import { useShapeGeometry } from '../../lib/shapeGeometry';

interface Placement {
  x: number;
  y: number;
  z: number;
  rotation: 0 | 1 | 2 | 3;
}

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
  shape,
  placements,
}: {
  blockTypeId: string;
  shape: ShapeId;
  placements: Placement[];
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const color = getBlockColor(blockTypeId);
  const texturePath = getBlockTexture(blockTypeId);
  const opacity = getBlockOpacity(blockTypeId);
  const map = useMemo(() => (texturePath ? loadBlockTexture(texturePath) : null), [texturePath]);

  const meshId = getShapeMeshId(blockTypeId, shape);
  const stairsGeometry = useShapeGeometry(meshId);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const matrix = new THREE.Matrix4();
    placements.forEach(({ x, y, z, rotation }, i) => {
      matrix.makeRotationY((rotation * Math.PI) / 2);
      matrix.setPosition(x, y, z); // only touches the translation column, keeps the rotation set above
      mesh.setMatrixAt(i, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [placements]);

  // Non-cube shapes load their geometry asynchronously (fetched OBJ, parsed,
  // cached); skip rendering this group until it resolves. This only happens
  // once per mesh id — cached after that.
  if (shape !== 'cube' && !stairsGeometry) return null;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, placements.length]}>
      {shape === 'cube' ? (
        <boxGeometry args={[1, 1, 1]} />
      ) : (
        <primitive object={stairsGeometry!} attach="geometry" />
      )}
      {/* When a texture is present, leave the material color white so the
          texture isn't tinted by the (darker) average fallback color.
          Default FrontSide (backface culling) — verified visually against
          all 7 extracted stair meshes (see the Stairs plan's winding-order
          callout re: Unity left-handed vs Three.js right-handed conversion):
          the raw OBJ winding already matches Three's CCW-front convention,
          no mirroring/inside-out faces, so no DoubleSide workaround needed. */}
      <meshStandardMaterial
        color={map ? '#ffffff' : color}
        map={map}
        transparent={opacity < 1}
        opacity={opacity}
      />
    </instancedMesh>
  );
}

export function VoxelInstancedMesh() {
  const grid = useBuildStore((s) => s.project.grid);
  const dimensions = useBuildStore((s) => s.project.dimensions);

  const groups = useMemo(() => {
    const byKey = new Map<
      string,
      { blockTypeId: string; shape: ShapeId; placements: Placement[] }
    >();
    for (let i = 0; i < grid.cells.length; i++) {
      const cell = grid.cells[i];
      if (!cell) continue;
      const { x, y, z } = coordsFromIndex(i, dimensions);
      const position = {
        x: x - dimensions.width / 2 + 0.5,
        y,
        z: z - dimensions.depth / 2 + 0.5,
        rotation: cell.rotation,
      };
      const key = `${cell.blockTypeId}|${cell.shape}`;
      const group = byKey.get(key) ?? { blockTypeId: cell.blockTypeId, shape: cell.shape, placements: [] };
      group.placements.push(position);
      byKey.set(key, group);
    }
    return Array.from(byKey.entries());
  }, [grid, dimensions]);

  return (
    <>
      {groups.map(([key, group]) => (
        <InstancedGroup
          key={key}
          blockTypeId={group.blockTypeId}
          shape={group.shape}
          placements={group.placements}
        />
      ))}
    </>
  );
}
