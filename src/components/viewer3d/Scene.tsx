import { Canvas } from '@react-three/fiber';
import { Grid, OrbitControls } from '@react-three/drei';
import { useBuildStore } from '../../state/useBuildStore';
import { CLAIM_SIZE } from '../../lib/voxelGrid';
import { VoxelInstancedMesh } from './VoxelInstancedMesh';

export function Scene() {
  const dimensions = useBuildStore((s) => s.project.dimensions);
  const maxDim = Math.max(dimensions.width, dimensions.height, dimensions.depth);
  const cameraDistance = maxDim * 1.6 + 4;

  return (
    <Canvas
      className="scene-canvas"
      camera={{ position: [cameraDistance, cameraDistance, cameraDistance], fov: 50 }}
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[10, 20, 10]} intensity={1} />
      <Grid
        position={[0, -0.51, 0]}
        args={[Math.max(20, maxDim * 2), Math.max(20, maxDim * 2)]}
        cellSize={1}
        cellColor="#666"
        sectionSize={CLAIM_SIZE}
        sectionThickness={1.5}
        sectionColor="#8a8ca0"
        fadeDistance={maxDim * 6}
      />
      <VoxelInstancedMesh />
      <OrbitControls makeDefault />
    </Canvas>
  );
}
