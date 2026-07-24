import * as THREE from 'three';

// Most of Eco's non-cube building meshes (ramps, walls, braces, roofs,
// aqueducts, ...) ship with collapsed/degenerate UVs — their large faces map
// to a single point on the texture — because in-game they're painted by a
// world-space *triplanar* shader that ignores UVs entirely. Rendered with plain
// UV mapping they come out as a smear of one texel. This material replicates the
// game's approach: it samples the texture by world-space position, projected on
// the three axis planes and blended by the face normal, so bricks are the same
// physical size on every face (flat or sloped), tile seamlessly across adjacent
// blocks, and need no UVs at all.
//
// `scale` is texture-units per world meter — the same value the box-rendered
// Cube uses (a block's `textureRepeat`), so mesh shapes match their own Cube's
// brick size exactly.
export function makeTriplanarMaterial(opts: {
  map: THREE.Texture;
  scale: [number, number];
  opacity: number;
  // Optional distinct texture for up-facing surfaces (Floor's herringbone
  // walking surface). Applied only where the world normal points up; the side
  // map is used for every other facing (sides + underside).
  topMap?: THREE.Texture;
}): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    map: opts.map,
    transparent: opts.opacity < 1,
    opacity: opts.opacity,
  });
  const uScale = new THREE.Vector2(opts.scale[0], opts.scale[1]);
  const hasTop = !!opts.topMap;

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTriScale = { value: uScale };
    if (opts.topMap) shader.uniforms.uTopMap = { value: opts.topMap };

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vTriPos;\nvarying vec3 vTriNormal;',
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          vec4 triPos = vec4(position, 1.0);
          vec3 triNrm = normal;
          #ifdef USE_INSTANCING
            triPos = instanceMatrix * triPos;
            triNrm = mat3(instanceMatrix) * triNrm;
          #endif
          vTriPos = (modelMatrix * triPos).xyz;
          vTriNormal = normalize(mat3(modelMatrix) * triNrm);
        }`,
      );

    const yPlane = hasTop
      ? // Up-facing surfaces (the floor's walking surface) sample the top map;
        // underside/sides keep the side map.
        'vTriNormal.y > 0.0 ? texture2D(uTopMap, vTriPos.xz * uTriScale) : texture2D(map, vTriPos.xz * uTriScale)'
      : 'texture2D(map, vTriPos.xz * uTriScale)';

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>\nuniform vec2 uTriScale;\nvarying vec3 vTriPos;\nvarying vec3 vTriNormal;${
          hasTop ? '\nuniform sampler2D uTopMap;' : ''
        }`,
      )
      .replace(
        '#include <map_fragment>',
        `
        vec3 triBlend = pow(abs(normalize(vTriNormal)), vec3(4.0));
        triBlend /= (triBlend.x + triBlend.y + triBlend.z);
        // texture on each axis plane; sRGB decode happens automatically because
        // the map is uploaded as an sRGB texture (colorSpace set on load).
        vec4 triX = texture2D(map, vTriPos.zy * uTriScale);
        vec4 triY = ${yPlane};
        vec4 triZ = texture2D(map, vTriPos.xy * uTriScale);
        vec4 sampledDiffuseColor = triX * triBlend.x + triY * triBlend.y + triZ * triBlend.z;
        diffuseColor *= sampledDiffuseColor;
        `,
      );
  };
  // Isolate triplanar programs from the default-keyed materials so a plain
  // meshStandardMaterial with the same props can't accidentally share this
  // onBeforeCompile-patched program (default cache key ignores onBeforeCompile).
  // The top-map variant compiles a different program, so key it separately.
  const cacheKey = hasTop ? 'brick-triplanar-top-v1' : 'brick-triplanar-v1';
  mat.customProgramCacheKey = () => cacheKey;
  return mat;
}
