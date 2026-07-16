import type { VoxelDimensions } from './voxel';

export interface ProjectFileV1 {
  schemaVersion: 1;
  name: string;
  createdAt: string; // ISO 8601
  updatedAt: string;
  dimensions: VoxelDimensions;
  palette: { id: string; name: string; color: string }[]; // snapshot for portability
  blocks: { x: number; y: number; z: number; blockTypeId: string }[]; // sparse: occupied cells only
}
