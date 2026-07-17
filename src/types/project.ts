import type { SparseVoxel, VoxelDimensions } from './voxel';

export interface ProjectFileV1 {
  schemaVersion: 1;
  name: string;
  createdAt: string; // ISO 8601
  updatedAt: string;
  dimensions: VoxelDimensions;
  palette: { id: string; name: string; color: string }[]; // snapshot for portability
  blocks: { x: number; y: number; z: number; blockTypeId: string }[]; // sparse: occupied cells only
}

// v2 adds per-block shape + rotation (see src/data/blockShapes.ts). A v1 file
// is migrated on load by defaulting every block to shape: 'cube', rotation: 0
// (see src/lib/persistence.ts).
export interface ProjectFileV2 {
  schemaVersion: 2;
  name: string;
  createdAt: string;
  updatedAt: string;
  dimensions: VoxelDimensions;
  palette: { id: string; name: string; color: string }[];
  blocks: SparseVoxel[]; // sparse: occupied cells only
}

export type ProjectFile = ProjectFileV1 | ProjectFileV2;
