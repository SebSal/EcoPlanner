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
// every mesh's geometry out of the parsed object and merge them into one, so
// nothing gets silently dropped.
function extractGeometry(object: THREE.Group): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];
  object.traverse((child) => {
    if (child instanceof THREE.Mesh && child.geometry) {
      geometries.push(child.geometry);
    }
  });
  if (geometries.length === 0) {
    throw new Error('No mesh geometry found in loaded OBJ.');
  }
  if (geometries.length === 1) return geometries[0];
  const merged = mergeBufferGeometries(geometries, false);
  if (!merged) {
    throw new Error('Failed to merge shape geometry groups.');
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
        const geometry = extractGeometry(object);
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
