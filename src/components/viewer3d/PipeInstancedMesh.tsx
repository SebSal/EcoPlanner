import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useBuildStore } from '../../state/useBuildStore';
import { coordsFromIndex, getCell } from '../../lib/voxelGrid';
import { getBlockColor, getBlockTexture } from '../../data/blockPalette';
import { loadBlockTexture } from '../../lib/blockTexture';
import { useShapeGeometry } from '../../lib/shapeGeometry';

// Pipes aren't part of the Forms.cs wall/stairs/roof shape catalog — in Eco
// they're a distinct PipeBlock system whose visual appearance is driven by
// which of the 6 axis-aligned neighbors also have a pipe (a connectivity
// mesh-selection table with per-metal junction/corner/T/cross variants).
//
// This renders the common, purely-horizontal-or-purely-vertical connectivity
// cases with Eco's own real extracted meshes (Solo/Straight/Onecap/Bend/T/
// Cross/Vert — verified per-shape via each mesh's actual open-port
// direction, not guessed) rotated to match. A junction that's connected on
// *both* a horizontal and the vertical axis at once (e.g. a bend that also
// goes up) isn't one of the shapes handled here yet — those cells fall back
// to the old procedural approximation (a hub + one full-length cylinder per
// connected axis, meeting flush but without a mitered bend). Full 3D
// combination coverage is a planned follow-up, not yet built.
const HUB_RADIUS = 0.16;
const SEGMENT_RADIUS = 0.11;
const RADIAL_SEGMENTS = 12;

type Axis = 'x' | 'y' | 'z';
type Direction = 'px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz';

const HORIZONTAL_DIRS: Direction[] = ['px', 'nx', 'pz', 'nz'];
const VERTICAL_DIRS: Direction[] = ['py', 'ny'];

const NEIGHBOR_OFFSET: Record<Direction, [number, number, number]> = {
  px: [1, 0, 0],
  nx: [-1, 0, 0],
  py: [0, 1, 0],
  ny: [0, -1, 0],
  pz: [0, 0, 1],
  nz: [0, 0, -1],
};

// Cylinder geometry's default axis is Y; these align a shared unit-length
// instance to each axis via instance-matrix rotation, avoiding the need for
// three separate pre-rotated geometries. Used only by the procedural
// fallback path.
const AXIS_QUATERNIONS: Record<Axis, THREE.Quaternion> = {
  y: new THREE.Quaternion(),
  x: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2)),
  z: new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)),
};

// The app's existing rotation convention (matrix.makeRotationY((r * Math.PI)
// / 2)) cycles the 4 horizontal directions pz -> px -> nz -> nx -> pz; py/ny
// are unaffected by a Y-axis rotation.
function rotateOnce(d: Direction): Direction {
  switch (d) {
    case 'pz':
      return 'px';
    case 'px':
      return 'nz';
    case 'nz':
      return 'nx';
    case 'nx':
      return 'pz';
    default:
      return d;
  }
}

function rotateSet(dirs: Direction[], r: number): Set<Direction> {
  let cur = dirs;
  for (let i = 0; i < r; i++) cur = cur.map(rotateOnce);
  return new Set(cur);
}

function setsEqual(a: Set<Direction>, b: Set<Direction>): boolean {
  return a.size === b.size && [...a].every((d) => b.has(d));
}

// Finds which of the 4 Y-axis rotations maps a mesh's native (unrotated)
// open-port directions onto the actual target directions for a cell.
function findYRotation(canonical: Direction[], target: Direction[]): number {
  const targetSet = new Set(target);
  for (let r = 0; r < 4; r++) {
    if (setsEqual(rotateSet(canonical, r), targetSet)) return r;
  }
  return 0;
}

const Y_ROTATIONS: THREE.Quaternion[] = [0, 1, 2, 3].map(
  (r) => new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (r * Math.PI) / 2, 0)),
);

// Rotates the Onecap mesh (native open port at -Z, capped at +Z) to point
// straight up or down instead, for a lone vertical dead-end connection.
// Derived from the rotation matrices directly: Rx(+90deg) maps -Z -> +Y
// (open end up, capped end down); Rx(-90deg) maps -Z -> -Y (open end down).
const ONECAP_POINT_UP = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
const ONECAP_POINT_DOWN = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));

// Canonical (unrotated) open-port directions per real mesh — verified from
// each extracted mesh's actual geometry (boundary-edge analysis on welded
// vertices to find which end is genuinely open vs. capped, not guessed from
// bounding boxes alone). Onecap's open end is -Z (flipped from an initial
// +Z assumption after visual confirmation in-app showed it backwards).
const ONECAP_OPEN_DIR: Direction = 'nz';
const STRAIGHT_DIRS: Direction[] = ['pz', 'nz'];
const BEND_DIRS: Direction[] = ['nx', 'pz'];
const T_DIRS: Direction[] = ['nx', 'px', 'pz'];
const CROSS_DIRS: Direction[] = ['nx', 'px', 'nz', 'pz'];

const REAL_SHAPES = ['solo', 'straight_simple', 'straight_onecap', 'bend', 't', 'cross', 'vert'] as const;
type RealShape = (typeof REAL_SHAPES)[number];

// Onecap's cross-section isn't centered in its native (horizontal) frame —
// it's mounted low, offset -0.2813 on its native Y axis (consistent across
// all 3 metals, measured directly from the exported meshes), unlike Vert
// which is perfectly centered. That's intentional for the normal horizontal
// case (matches how Eco visually mounts a horizontal run low against a
// wall/floor), but rotating Onecap 90° to point vertically carries that
// offset over into a sideways misalignment against Vert's centered
// mounting — these constants cancel it back out for that one case.
const ONECAP_VERTICAL_Z_OFFSET = 0.2813;

function isOppositePair(a: Direction, b: Direction): boolean {
  return (a === 'px' && b === 'nx') || (a === 'nx' && b === 'px') || (a === 'pz' && b === 'nz') || (a === 'nz' && b === 'pz');
}

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
  const color = getBlockColor(blockTypeId);
  const swatchTexturePath = getBlockTexture(blockTypeId);
  const swatchMap = useMemo(
    () => (swatchTexturePath ? loadBlockTexture(swatchTexturePath) : null),
    [swatchTexturePath],
  );
  // The real junction meshes' baked UVs address the full shared Pipes_Albedo
  // atlas (each metal's mesh points at a different region of it), not our
  // small per-metal tileable crop used for the procedural fallback's simple
  // 0..1 cylinder UVs — applying the crop here would repeat the exact "wrong
  // atlas region" mismatch already fixed for Floor.
  const atlasMap = useMemo(
    () => loadBlockTexture(`${import.meta.env.BASE_URL}textures/pipes_atlas.png`),
    [],
  );

  const soloGeom = useShapeGeometry(`${blockTypeId}_solo`);
  const straightGeom = useShapeGeometry(`${blockTypeId}_straight_simple`);
  const onecapGeom = useShapeGeometry(`${blockTypeId}_straight_onecap`);
  const bendGeom = useShapeGeometry(`${blockTypeId}_bend`);
  const tGeom = useShapeGeometry(`${blockTypeId}_t`);
  const crossGeom = useShapeGeometry(`${blockTypeId}_cross`);
  const vertGeom = useShapeGeometry(`${blockTypeId}_vert`);
  const allRealGeomsReady =
    soloGeom && straightGeom && onecapGeom && bendGeom && tGeom && crossGeom && vertGeom;

  const soloRef = useRef<THREE.InstancedMesh>(null);
  const straightRef = useRef<THREE.InstancedMesh>(null);
  const onecapRef = useRef<THREE.InstancedMesh>(null);
  const bendRef = useRef<THREE.InstancedMesh>(null);
  const tRef = useRef<THREE.InstancedMesh>(null);
  const crossRef = useRef<THREE.InstancedMesh>(null);
  const vertRef = useRef<THREE.InstancedMesh>(null);
  const hubRef = useRef<THREE.InstancedMesh>(null);
  const segmentRef = useRef<THREE.InstancedMesh>(null);

  // Every pool is capacity-bounded by `count` (the total pipe cells of this
  // metal) — a safe upper bound for any single shape, and for the fallback
  // segment pool times 3 (at most 3 procedural axes per cell), same as
  // before this real-mesh rendering existed.
  const maxSegments = count * 3;

  useLayoutEffect(() => {
    const refsByShape: Record<RealShape, THREE.InstancedMesh | null> = {
      solo: soloRef.current,
      straight_simple: straightRef.current,
      straight_onecap: onecapRef.current,
      bend: bendRef.current,
      t: tRef.current,
      cross: crossRef.current,
      vert: vertRef.current,
    };
    const hubMesh = hubRef.current;
    const segmentMesh = segmentRef.current;
    if (!hubMesh || !segmentMesh) return;
    if (allRealGeomsReady && REAL_SHAPES.some((s) => !refsByShape[s])) return;

    const indexByShape: Record<RealShape, number> = {
      solo: 0,
      straight_simple: 0,
      straight_onecap: 0,
      bend: 0,
      t: 0,
      cross: 0,
      vert: 0,
    };
    const matrix = new THREE.Matrix4();
    const scale = new THREE.Vector3(1, 1, 1);
    let hubIndex = 0;
    let segmentIndex = 0;

    for (let i = 0; i < grid.cells.length; i++) {
      const cell = grid.cells[i];
      if (!cell || cell.blockTypeId !== blockTypeId || cell.shape !== 'pipe') continue;
      const { x, y, z } = coordsFromIndex(i, dimensions);
      const position = new THREE.Vector3(
        x - dimensions.width / 2 + 0.5,
        y,
        z - dimensions.depth / 2 + 0.5,
      );

      const connected: Record<Direction, boolean> = {
        px: false,
        nx: false,
        py: false,
        ny: false,
        pz: false,
        nz: false,
      };
      for (const dir of [...HORIZONTAL_DIRS, ...VERTICAL_DIRS]) {
        const [dx, dy, dz] = NEIGHBOR_OFFSET[dir];
        connected[dir] = hasPipeNeighbor(grid, x + dx, y + dy, z + dz, blockTypeId);
      }
      const horizontalDirs = HORIZONTAL_DIRS.filter((d) => connected[d]);
      const verticalDirs = VERTICAL_DIRS.filter((d) => connected[d]);
      const total = horizontalDirs.length + verticalDirs.length;

      // Mixed horizontal+vertical junctions aren't one of the real shapes
      // handled here yet — fall back to the procedural approximation.
      const useReal = allRealGeomsReady && !(horizontalDirs.length > 0 && verticalDirs.length > 0);

      if (useReal) {
        let shape: RealShape;
        let quat: THREE.Quaternion;
        let instancePosition = position;

        if (total === 0) {
          shape = 'solo';
          quat = Y_ROTATIONS[cell.rotation];
        } else if (verticalDirs.length === 2) {
          shape = 'vert';
          quat = Y_ROTATIONS[0];
        } else if (verticalDirs.length === 1) {
          shape = 'straight_onecap';
          const pointingUp = verticalDirs[0] === 'py';
          quat = pointingUp ? ONECAP_POINT_UP : ONECAP_POINT_DOWN;
          // Cancel out Onecap's native off-center mounting (see
          // ONECAP_VERTICAL_Z_OFFSET's doc comment) so it lines up with
          // Vert's centered cross-section instead of sitting skewed sideways.
          instancePosition = position
            .clone()
            .add(new THREE.Vector3(0, 0, pointingUp ? ONECAP_VERTICAL_Z_OFFSET : -ONECAP_VERTICAL_Z_OFFSET));
        } else if (horizontalDirs.length === 1) {
          shape = 'straight_onecap';
          quat = Y_ROTATIONS[findYRotation([ONECAP_OPEN_DIR], horizontalDirs)];
        } else if (horizontalDirs.length === 2 && isOppositePair(horizontalDirs[0], horizontalDirs[1])) {
          shape = 'straight_simple';
          quat = Y_ROTATIONS[findYRotation(STRAIGHT_DIRS, horizontalDirs)];
        } else if (horizontalDirs.length === 2) {
          shape = 'bend';
          quat = Y_ROTATIONS[findYRotation(BEND_DIRS, horizontalDirs)];
        } else if (horizontalDirs.length === 3) {
          shape = 't';
          quat = Y_ROTATIONS[findYRotation(T_DIRS, horizontalDirs)];
        } else {
          shape = 'cross';
          quat = Y_ROTATIONS[findYRotation(CROSS_DIRS, horizontalDirs)];
        }

        matrix.compose(instancePosition, quat, scale);
        refsByShape[shape]!.setMatrixAt(indexByShape[shape]++, matrix);
      } else {
        // ---- procedural fallback (hub + one full-length cylinder per
        // connected axis) — same approach as before real meshes existed. ----
        matrix.makeTranslation(position.x, position.y, position.z);
        hubMesh.setMatrixAt(hubIndex++, matrix);

        const activeAxes: Axis[] = [];
        if (connected.px || connected.nx) activeAxes.push('x');
        if (connected.py || connected.ny) activeAxes.push('y');
        if (connected.pz || connected.nz) activeAxes.push('z');
        if (activeAxes.length === 0) {
          activeAxes.push(cell.rotation === 1 || cell.rotation === 3 ? 'x' : 'z');
        }
        for (const axis of activeAxes) {
          matrix.compose(position, AXIS_QUATERNIONS[axis], scale);
          segmentMesh.setMatrixAt(segmentIndex++, matrix);
        }
      }
    }

    for (const shape of REAL_SHAPES) {
      const mesh = refsByShape[shape];
      if (!mesh) continue;
      mesh.count = indexByShape[shape];
      mesh.instanceMatrix.needsUpdate = true;
    }
    hubMesh.count = hubIndex;
    segmentMesh.count = segmentIndex;
    hubMesh.instanceMatrix.needsUpdate = true;
    segmentMesh.instanceMatrix.needsUpdate = true;
  }, [grid, dimensions, blockTypeId, count, allRealGeomsReady, soloGeom, straightGeom, onecapGeom, bendGeom, tGeom, crossGeom, vertGeom]);

  const realMaterial = <meshStandardMaterial color="#ffffff" map={atlasMap} />;

  return (
    <>
      {allRealGeomsReady && (
        <>
          <instancedMesh ref={soloRef} args={[undefined, undefined, count]}>
            <primitive object={soloGeom} attach="geometry" />
            {realMaterial}
          </instancedMesh>
          <instancedMesh ref={straightRef} args={[undefined, undefined, count]}>
            <primitive object={straightGeom} attach="geometry" />
            {realMaterial}
          </instancedMesh>
          <instancedMesh ref={onecapRef} args={[undefined, undefined, count]}>
            <primitive object={onecapGeom} attach="geometry" />
            {realMaterial}
          </instancedMesh>
          <instancedMesh ref={bendRef} args={[undefined, undefined, count]}>
            <primitive object={bendGeom} attach="geometry" />
            {realMaterial}
          </instancedMesh>
          <instancedMesh ref={tRef} args={[undefined, undefined, count]}>
            <primitive object={tGeom} attach="geometry" />
            {realMaterial}
          </instancedMesh>
          <instancedMesh ref={crossRef} args={[undefined, undefined, count]}>
            <primitive object={crossGeom} attach="geometry" />
            {realMaterial}
          </instancedMesh>
          <instancedMesh ref={vertRef} args={[undefined, undefined, count]}>
            <primitive object={vertGeom} attach="geometry" />
            {realMaterial}
          </instancedMesh>
        </>
      )}
      <instancedMesh ref={hubRef} args={[undefined, undefined, count]}>
        <sphereGeometry args={[HUB_RADIUS, RADIAL_SEGMENTS, RADIAL_SEGMENTS / 2]} />
        <meshStandardMaterial color={swatchMap ? '#ffffff' : color} map={swatchMap} />
      </instancedMesh>
      <instancedMesh ref={segmentRef} args={[undefined, undefined, maxSegments]}>
        <cylinderGeometry args={[SEGMENT_RADIUS, SEGMENT_RADIUS, 1, RADIAL_SEGMENTS]} />
        <meshStandardMaterial color={swatchMap ? '#ffffff' : color} map={swatchMap} />
      </instancedMesh>
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
