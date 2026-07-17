import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { OBJLoader, mergeBufferGeometries } from 'three-stdlib';
import { getShapeMeshPath } from '../data/blockShapes';

// Loaded shape geometries are shared across every InstancedGroup instance of
// the same mesh id (and across re-renders), so cache by mesh id — same
// pattern as the texture cache in VoxelInstancedMesh.tsx.
const geometryCache = new Map<string, THREE.BufferGeometry>();
const loadingPromises = new Map<string, Promise<THREE.BufferGeometry>>();

// The raw OBJs sometimes split a shape into multiple named groups (e.g.
// framedglass_stairs has a main body + a separate frame accent group) — pull
// every mesh's geometry out of the parsed object so nothing gets silently
// dropped.
function extractSubGeometries(object: THREE.Group): THREE.BufferGeometry[] {
  const geometries: THREE.BufferGeometry[] = [];
  object.traverse((child) => {
    if (child instanceof THREE.Mesh && child.geometry) {
      geometries.push(child.geometry);
    }
  });
  if (geometries.length === 0) {
    throw new Error('No mesh geometry found in loaded OBJ.');
  }
  return geometries;
}

function mergeSubs(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  if (geometries.length === 1) return geometries[0];
  const merged = mergeBufferGeometries(geometries, false);
  if (!merged) {
    throw new Error('Failed to merge shape geometry groups.');
  }
  return merged;
}

// A few "floor" meshes (ashlar/brick/concrete/lumber/mortaredstone) were
// extracted as a degenerate shell: a top quad + bottom quad spanning the full
// block, but with no side walls (every normal points ±Y), so they look like
// they have no depth. In Eco a placed Floor fills the whole block footprint, so
// rebuild these as a real solid cube. Properly-modeled floors (adobe, hewn log,
// etc.) have side faces and are left untouched.
function isDegenerateShell(geometry: THREE.BufferGeometry): boolean {
  const normal = geometry.getAttribute('normal');
  if (!normal) return false;
  for (let i = 0; i < normal.count; i++) {
    if (Math.abs(normal.getX(i)) > 0.1 || Math.abs(normal.getZ(i)) > 0.1) return false;
  }
  geometry.computeBoundingBox();
  const bb = geometry.boundingBox!;
  return (
    bb.max.x - bb.min.x > 0.9 && bb.max.y - bb.min.y > 0.9 && bb.max.z - bb.min.z > 0.9
  );
}

// A window grille's glass pane is a small, near-planar quad set inside the
// opening — few faces and a bounding box that stays well within the block's
// ±0.5 edges (the openwork frame reaches them). Detecting it lets us render the
// pane as transparent glass instead of the opaque family texture.
function isGlassPane(geometry: THREE.BufferGeometry): boolean {
  const position = geometry.getAttribute('position');
  const faceCount = (geometry.index ? geometry.index.count : position.count) / 3;
  if (faceCount > 6) return false;
  geometry.computeBoundingBox();
  const bb = geometry.boundingBox!;
  const reach = Math.max(
    Math.abs(bb.min.x),
    Math.abs(bb.max.x),
    Math.abs(bb.min.y),
    Math.abs(bb.max.y),
    Math.abs(bb.min.z),
    Math.abs(bb.max.z),
  );
  return reach < 0.48;
}

function buildGeometry(meshId: string, subs: THREE.BufferGeometry[]): THREE.BufferGeometry {
  // Window grilles: split the glass pane out into its own material group (index
  // 1) so the renderer can paint it with a transparent glass material while the
  // frame (index 0) keeps the opaque family texture.
  if (meshId.includes('windowgrilles')) {
    const paneGeoms = subs.filter(isGlassPane);
    const frameGeoms = subs.filter((g) => !isGlassPane(g));
    if (paneGeoms.length > 0 && frameGeoms.length > 0) {
      const merged = mergeBufferGeometries([mergeSubs(frameGeoms), mergeSubs(paneGeoms)], true);
      if (!merged) {
        throw new Error('Failed to merge grille geometry groups.');
      }
      merged.userData.hasGlassPane = true;
      return merged;
    }
  }

  const merged = mergeSubs(subs);
  if (isDegenerateShell(merged)) {
    return new THREE.BoxGeometry(1, 1, 1);
  }
  return merged;
}

async function loadShapeGeometry(meshId: string): Promise<THREE.BufferGeometry> {
  const cached = geometryCache.get(meshId);
  if (cached) return cached;
  let pending = loadingPromises.get(meshId);
  if (!pending) {
    pending = fetch(getShapeMeshPath(meshId))
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch mesh "${meshId}": ${res.status}`);
        return res.text();
      })
      .then((text) => {
        const object = new OBJLoader().parse(text);
        const geometry = buildGeometry(meshId, extractSubGeometries(object));
        geometryCache.set(meshId, geometry);
        return geometry;
      });
    loadingPromises.set(meshId, pending);
  }
  return pending;
}

// Renders nothing until the geometry for `meshId` has resolved (cached after
// first use) — same "renders once ready, nothing before that" spirit as the
// existing async texture loading in VoxelInstancedMesh.tsx. Pass undefined to
// get null back (e.g. for the cube shape, which has no mesh file).
export function useShapeGeometry(meshId: string | undefined): THREE.BufferGeometry | null {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(
    meshId ? (geometryCache.get(meshId) ?? null) : null,
  );

  useEffect(() => {
    if (!meshId) {
      setGeometry(null);
      return;
    }
    const cached = geometryCache.get(meshId);
    if (cached) {
      setGeometry(cached);
      return;
    }
    let cancelled = false;
    loadShapeGeometry(meshId)
      .then((geom) => {
        if (!cancelled) setGeometry(geom);
      })
      .catch((err) => {
        console.error(`Failed to load shape geometry "${meshId}":`, err);
      });
    return () => {
      cancelled = true;
    };
  }, [meshId]);

  return geometry;
}
