import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useBuildStore } from '../../state/useBuildStore';
import { coordsFromIndex } from '../../lib/voxelGrid';
import {
  getBlockColor,
  getBlockFloorTopTexture,
  getBlockOpacity,
  getBlockTexture,
  getBlockTextureRepeat,
} from '../../data/blockPalette';
import { getShapeMeshId, type ShapeId } from '../../data/blockShapes';
import { useShapeGeometry } from '../../lib/shapeGeometry';
import { loadBlockTexture } from '../../lib/blockTexture';

interface Placement {
  x: number;
  y: number;
  z: number;
  rotation: 0 | 1 | 2 | 3;
}

// The transparent pane inside a window grille reuses the Glass block's tint and
// opacity so grille glass matches standalone glass.
const GLASS_PANE_COLOR = getBlockColor('glass');
const GLASS_PANE_OPACITY = getBlockOpacity('glass');

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
  // Only box-rendered faces (Cube, Floor's sides) need the verified repeat
  // scale — real extracted meshes (Stairs, Wall, ...) already bake their own
  // correct scale into their UVs, so applying it there would double it up.
  const isBoxShape = shape === 'cube' || shape === 'floor';
  const textureRepeat = isBoxShape ? getBlockTextureRepeat(blockTypeId) : ([1, 1] as [number, number]);
  const map = useMemo(
    () => (texturePath ? loadBlockTexture(texturePath, textureRepeat) : null),
    [texturePath, textureRepeat[0], textureRepeat[1]],
  );

  // Only 'floor' ever needs a distinct top/bottom texture — verified per
  // family via the game's own Floor Material bindings (Brick's Floor has its
  // own herringbone `_TopTex`; every other checked family's Floor material
  // either doesn't exist or is identical to the side texture already used
  // above). undefined here means "use the same texture on every face."
  const floorTopTexturePath = shape === 'floor' ? getBlockFloorTopTexture(blockTypeId) : undefined;
  const floorTopMap = useMemo(
    () => (floorTopTexturePath ? loadBlockTexture(floorTopTexturePath) : null),
    [floorTopTexturePath],
  );

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
    // stairsGeometry is included so this re-runs the first time a non-cube
    // shape's mesh finishes loading: until then the group renders null (see
    // below), meshRef.current is null, and this effect bails out early —
    // without stairsGeometry in the deps, the render where the mesh actually
    // mounts wouldn't re-run this (placements hasn't changed), leaving that
    // first instance at the default identity matrix until another placement
    // change happened to touch it.
  }, [placements, stairsGeometry]);

  // Non-cube, non-floor shapes load their geometry asynchronously (fetched
  // OBJ, parsed, cached); skip rendering this group until it resolves. This
  // only happens once per mesh id — cached after that.
  if (!isBoxShape && !stairsGeometry) return null;

  // Window grilles carry a glass pane split into a second material group (see
  // shapeGeometry.ts): frame → material-0 (family texture), pane → material-1
  // (transparent glass).
  const hasGlassPane = stairsGeometry?.userData.hasGlassPane === true;

  // When a texture is present, leave the material color white so the texture
  // isn't tinted by the (darker) average fallback color. Default FrontSide
  // (backface culling) — verified visually against all 7 extracted stair meshes
  // (see the Stairs plan's winding-order callout re: Unity left-handed vs Three
  // right-handed conversion): the raw OBJ winding already matches Three's
  // CCW-front convention, no mirroring/inside-out faces, so no DoubleSide needed.
  const frameMaterial = (
    <meshStandardMaterial
      attach={hasGlassPane ? 'material-0' : 'material'}
      color={map ? '#ffffff' : color}
      map={map}
      transparent={opacity < 1}
      opacity={opacity}
    />
  );

  // BoxGeometry always has 6 per-face groups (material indices 0-5, in the
  // fixed order +X -X +Y(top) -Y(bottom) +Z -Z) regardless of whether one or
  // several materials are supplied — a single material just gets used for
  // every group. When Floor has a distinct top/bottom texture, supply all 6
  // explicitly so the top/bottom groups (2 and 3) get the floor-specific
  // material and the four side groups keep the normal one.
  if (isBoxShape && floorTopMap) {
    return (
      <instancedMesh ref={meshRef} args={[undefined, undefined, placements.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial attach="material-0" color={map ? '#ffffff' : color} map={map} />
        <meshStandardMaterial attach="material-1" color={map ? '#ffffff' : color} map={map} />
        <meshStandardMaterial attach="material-2" color="#ffffff" map={floorTopMap} />
        <meshStandardMaterial attach="material-3" color="#ffffff" map={floorTopMap} />
        <meshStandardMaterial attach="material-4" color={map ? '#ffffff' : color} map={map} />
        <meshStandardMaterial attach="material-5" color={map ? '#ffffff' : color} map={map} />
      </instancedMesh>
    );
  }

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, placements.length]}>
      {isBoxShape ? (
        <boxGeometry args={[1, 1, 1]} />
      ) : (
        <primitive object={stairsGeometry!} attach="geometry" />
      )}
      {frameMaterial}
      {hasGlassPane && (
        // DoubleSide so the thin pane is visible from both faces through the
        // openwork frame.
        <meshStandardMaterial
          attach="material-1"
          color={GLASS_PANE_COLOR}
          transparent
          opacity={GLASS_PANE_OPACITY}
          side={THREE.DoubleSide}
        />
      )}
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
