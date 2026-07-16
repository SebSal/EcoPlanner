export type BlockTypeId = string;

export interface VoxelDimensions {
  width: number; // X
  height: number; // Y (layers)
  depth: number; // Z
}

// Flat array, index = x + z*width + y*width*depth
export interface VoxelGrid {
  dimensions: VoxelDimensions;
  cells: (BlockTypeId | null)[];
}
