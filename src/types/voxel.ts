import type { ShapeId } from '../data/blockShapes';

export type BlockTypeId = string;

export interface VoxelDimensions {
  width: number; // X
  height: number; // Y (layers)
  depth: number; // Z
}

export interface VoxelCell {
  blockTypeId: BlockTypeId;
  shape: ShapeId; // 'cube' | 'stairs'
  rotation: 0 | 1 | 2 | 3; // quarter turns about Y
}

// A VoxelCell plus its grid coordinates, as used by the sparse (x, y, z, ...)
// block lists in project files and gridToSparseBlocks/gridFromSparseBlocks.
export interface SparseVoxel extends VoxelCell {
  x: number;
  y: number;
  z: number;
}

// Flat array, index = x + z*width + y*width*depth
export interface VoxelGrid {
  dimensions: VoxelDimensions;
  cells: (VoxelCell | null)[];
}
