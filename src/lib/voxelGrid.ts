import type { BlockTypeId, VoxelDimensions, VoxelGrid } from '../types/voxel';

// Eco divides the ground into "claims" of CLAIM_SIZE x CLAIM_SIZE blocks.
export const CLAIM_SIZE = 5;

export function createEmptyGrid(dimensions: VoxelDimensions): VoxelGrid {
  const size = dimensions.width * dimensions.height * dimensions.depth;
  return { dimensions, cells: new Array(size).fill(null) };
}

export function indexFromCoords(
  x: number,
  y: number,
  z: number,
  dimensions: VoxelDimensions,
): number {
  return x + z * dimensions.width + y * dimensions.width * dimensions.depth;
}

export function coordsFromIndex(
  index: number,
  dimensions: VoxelDimensions,
): { x: number; y: number; z: number } {
  const layerSize = dimensions.width * dimensions.depth;
  const y = Math.floor(index / layerSize);
  const remainder = index % layerSize;
  const z = Math.floor(remainder / dimensions.width);
  const x = remainder % dimensions.width;
  return { x, y, z };
}

function inBounds(x: number, y: number, z: number, dimensions: VoxelDimensions): boolean {
  return (
    x >= 0 &&
    x < dimensions.width &&
    y >= 0 &&
    y < dimensions.height &&
    z >= 0 &&
    z < dimensions.depth
  );
}

export function getCell(
  grid: VoxelGrid,
  x: number,
  y: number,
  z: number,
): BlockTypeId | null {
  if (!inBounds(x, y, z, grid.dimensions)) return null;
  return grid.cells[indexFromCoords(x, y, z, grid.dimensions)];
}

export function setCell(
  grid: VoxelGrid,
  x: number,
  y: number,
  z: number,
  value: BlockTypeId | null,
): void {
  if (!inBounds(x, y, z, grid.dimensions)) return;
  grid.cells[indexFromCoords(x, y, z, grid.dimensions)] = value;
}

export function countBlocksByType(grid: VoxelGrid): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of grid.cells) {
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

export function gridToSparseBlocks(
  grid: VoxelGrid,
): { x: number; y: number; z: number; blockTypeId: string }[] {
  const blocks: { x: number; y: number; z: number; blockTypeId: string }[] = [];
  for (let i = 0; i < grid.cells.length; i++) {
    const value = grid.cells[i];
    if (value) {
      const { x, y, z } = coordsFromIndex(i, grid.dimensions);
      blocks.push({ x, y, z, blockTypeId: value });
    }
  }
  return blocks;
}

export function gridFromSparseBlocks(
  dimensions: VoxelDimensions,
  blocks: { x: number; y: number; z: number; blockTypeId: string }[],
): VoxelGrid {
  const grid = createEmptyGrid(dimensions);
  for (const block of blocks) {
    setCell(grid, block.x, block.y, block.z, block.blockTypeId);
  }
  return grid;
}

export function resizeGrid(grid: VoxelGrid, newDimensions: VoxelDimensions): VoxelGrid {
  const next = createEmptyGrid(newDimensions);
  const maxX = Math.min(grid.dimensions.width, newDimensions.width);
  const maxY = Math.min(grid.dimensions.height, newDimensions.height);
  const maxZ = Math.min(grid.dimensions.depth, newDimensions.depth);
  for (let y = 0; y < maxY; y++) {
    for (let z = 0; z < maxZ; z++) {
      for (let x = 0; x < maxX; x++) {
        setCell(next, x, y, z, getCell(grid, x, y, z));
      }
    }
  }
  return next;
}
