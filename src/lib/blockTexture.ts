import * as THREE from 'three';

// Shared across every InstancedGroup/PipeGroup instance of the same block
// type (and across re-renders), keyed by (path, repeat) since the same
// texture path can need a different repeat depending on shape — box-rendered
// faces need a verified-scale repeat, while real extracted meshes already
// bake their own correct scale into their UVs and must stay at (1,1), or the
// repeat would double up. Each distinct (path, repeat) pair gets its own
// Texture instance; cloning is cheap; it shares the underlying image data.
const textureCache = new Map<string, THREE.Texture>();

export function loadBlockTexture(
  texturePath: string,
  repeat: [number, number] = [1, 1],
): THREE.Texture {
  const key = `${texturePath}|${repeat[0]}|${repeat[1]}`;
  const cached = textureCache.get(key);
  if (cached) return cached;
  const texture = new THREE.TextureLoader().load(texturePath);
  texture.colorSpace = THREE.SRGBColorSpace;
  // Nearest-neighbor filtering keeps the blocky, crisp look of Eco's textures
  // instead of blurring them at typical voxel viewing distances.
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat[0], repeat[1]);
  textureCache.set(key, texture);
  return texture;
}
