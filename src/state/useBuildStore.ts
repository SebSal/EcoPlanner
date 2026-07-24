import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { BlockTypeId, VoxelCell, VoxelDimensions, VoxelGrid } from '../types/voxel';
import type { ProjectFileV2 } from '../types/project';
import { BLOCK_PALETTE } from '../data/blockPalette';
import { getAvailableShapes, type ShapeId } from '../data/blockShapes';
import {
  CLAIM_SIZE,
  createEmptyGrid,
  getCell,
  gridFromSparseBlocks,
  gridToSparseBlocks,
  resizeGrid,
  setCell,
} from '../lib/voxelGrid';
import { loadAutosave, saveAutosave } from '../lib/persistence';

export type ToolMode = 'place' | 'erase';

interface BuildState {
  hasProject: boolean;
  project: {
    name: string;
    createdAt: string;
    updatedAt: string;
    dimensions: VoxelDimensions;
    grid: VoxelGrid;
  };
  ui: {
    selectedBlockId: BlockTypeId;
    selectedShape: ShapeId;
    selectedRotation: 0 | 1 | 2 | 3;
    toolMode: ToolMode;
    currentLayerY: number;
    onionSkinEnabled: boolean;
  };

  paintCell(x: number, z: number, allowToggle?: boolean): void;
  setLayer(y: number): void;
  goUpLayer(): void;
  copyLayer(direction: 'up' | 'down'): void;
  extendAxis(axis: 'width' | 'depth'): void;
  moveBlocks(axis: 'width' | 'height' | 'depth', delta: 1 | -1): void;
  setSelectedBlock(id: BlockTypeId): void;
  setSelectedShape(shape: ShapeId): void;
  rotateSelection(): void;
  setToolMode(mode: ToolMode): void;
  toggleOnionSkin(): void;

  newProject(dimensions: VoxelDimensions, name?: string): void;
  clearGrid(): void;
  loadProject(data: ProjectFileV2): void;
  exportProject(): ProjectFileV2;
}

const DEFAULT_DIMENSIONS: VoxelDimensions = { width: 8, height: 8, depth: 8 };
const MAX_HEIGHT = 64;
// Ground cap mirrors the New Project dialog's 40-claim limit (40 × 5 = 200
// blocks per axis) so growing an axis can't build a runaway grid either.
const MAX_GROUND = 40 * CLAIM_SIZE;

function emptyProject(dimensions: VoxelDimensions, name: string) {
  const now = new Date().toISOString();
  return {
    name,
    createdAt: now,
    updatedAt: now,
    dimensions,
    grid: createEmptyGrid(dimensions),
  };
}

function toProjectFile(project: BuildState['project']): ProjectFileV2 {
  return {
    schemaVersion: 2,
    name: project.name,
    createdAt: project.createdAt,
    updatedAt: new Date().toISOString(),
    dimensions: project.dimensions,
    palette: BLOCK_PALETTE.map(({ id, name, color }) => ({ id, name, color })),
    blocks: gridToSparseBlocks(project.grid),
  };
}

const autosaved = loadAutosave();

export const useBuildStore = create<BuildState>()(
  immer((set, get) => ({
    hasProject: autosaved !== null,
    project: autosaved
      ? {
          name: autosaved.name,
          createdAt: autosaved.createdAt,
          updatedAt: autosaved.updatedAt,
          dimensions: autosaved.dimensions,
          grid: gridFromSparseBlocks(autosaved.dimensions, autosaved.blocks),
        }
      : emptyProject(DEFAULT_DIMENSIONS, 'Untitled Build'),
    ui: {
      selectedBlockId: BLOCK_PALETTE[0].id,
      selectedShape: 'cube',
      selectedRotation: 0,
      toolMode: 'place',
      currentLayerY: 0,
      onionSkinEnabled: true,
    },

    paintCell(x, z, allowToggle = false) {
      set((state) => {
        const { currentLayerY, toolMode, selectedBlockId, selectedShape, selectedRotation } = state.ui;
        if (toolMode === 'erase') {
          setCell(state.project.grid, x, currentLayerY, z, null);
          return;
        }
        const existing = getCell(state.project.grid, x, currentLayerY, z);
        const isSameSelection =
          existing !== null &&
          existing.blockTypeId === selectedBlockId &&
          existing.shape === selectedShape &&
          existing.rotation === selectedRotation;
        const value: VoxelCell | null =
          allowToggle && isSameSelection
            ? null
            : { blockTypeId: selectedBlockId, shape: selectedShape, rotation: selectedRotation };
        setCell(state.project.grid, x, currentLayerY, z, value);
      });
    },

    setLayer(y) {
      set((state) => {
        const maxY = state.project.dimensions.height - 1;
        state.ui.currentLayerY = Math.min(Math.max(y, 0), maxY);
      });
    },

    goUpLayer() {
      set((state) => {
        const { height } = state.project.dimensions;
        if (state.ui.currentLayerY < height - 1) {
          state.ui.currentLayerY += 1;
          return;
        }
        // Already on the top layer: grow the build upward by one empty layer.
        if (height >= MAX_HEIGHT) return;
        const newDims = { ...state.project.dimensions, height: height + 1 };
        state.project.grid = resizeGrid(state.project.grid, newDims);
        state.project.dimensions = newDims;
        state.ui.currentLayerY = height;
      });
    },

    copyLayer(direction) {
      set((state) => {
        const from = state.ui.currentLayerY;
        const { width, depth, height } = state.project.dimensions;

        let to: number;
        if (direction === 'up') {
          to = from + 1;
          if (to >= height) {
            // No layer above yet — grow the build by one (like ▲ Up), same cap.
            if (height >= MAX_HEIGHT) return;
            const newDims = { ...state.project.dimensions, height: height + 1 };
            state.project.grid = resizeGrid(state.project.grid, newDims);
            state.project.dimensions = newDims;
          }
        } else {
          to = from - 1;
          if (to < 0) return; // nothing below layer 0
        }

        // Merge: stamp only the occupied cells onto the target, leaving any
        // existing target blocks that don't overlap untouched.
        for (let z = 0; z < depth; z++) {
          for (let x = 0; x < width; x++) {
            const cell = getCell(state.project.grid, x, from, z);
            if (cell) setCell(state.project.grid, x, to, z, { ...cell });
          }
        }
        state.ui.currentLayerY = to;
      });
    },

    // Grow one of the two ground axes (X = width, Z = depth) by a full claim.
    // resizeGrid keeps existing blocks in place and fills the new space (on the
    // positive side) with empty cells.
    extendAxis(axis) {
      set((state) => {
        const dims = state.project.dimensions;
        const current = dims[axis];
        if (current + CLAIM_SIZE > MAX_GROUND) return;
        const newDims = { ...dims, [axis]: current + CLAIM_SIZE };
        state.project.grid = resizeGrid(state.project.grid, newDims);
        state.project.dimensions = newDims;
      });
    },

    // Shift every placed block by one cell along an axis. The whole move is
    // rejected (no-op) if any block would leave the grid, so blocks are never
    // clipped and never pushed to a negative coordinate.
    moveBlocks(axis, delta) {
      set((state) => {
        const grid = state.project.grid;
        const { width, height, depth } = grid.dimensions;
        const dx = axis === 'width' ? delta : 0;
        const dy = axis === 'height' ? delta : 0;
        const dz = axis === 'depth' ? delta : 0;

        for (let y = 0; y < height; y++) {
          for (let z = 0; z < depth; z++) {
            for (let x = 0; x < width; x++) {
              if (!getCell(grid, x, y, z)) continue;
              const nx = x + dx;
              const ny = y + dy;
              const nz = z + dz;
              if (nx < 0 || nx >= width || ny < 0 || ny >= height || nz < 0 || nz >= depth) {
                return; // move would push a block out of bounds — cancel entirely
              }
            }
          }
        }

        const next = createEmptyGrid(grid.dimensions);
        for (let y = 0; y < height; y++) {
          for (let z = 0; z < depth; z++) {
            for (let x = 0; x < width; x++) {
              const cell = getCell(grid, x, y, z);
              if (cell) setCell(next, x + dx, y + dy, z + dz, { ...cell });
            }
          }
        }
        state.project.grid = next;
      });
    },

    setSelectedBlock(id) {
      set((state) => {
        state.ui.selectedBlockId = id;
        // If the newly selected block doesn't support the currently selected
        // shape (e.g. switching from Hewn Log/Stairs to Cotton Carpet, or to
        // a pipe block which only ever supports 'pipe', never 'cube'), fall
        // back to that block's first available shape rather than leaving a
        // shape it can't actually render.
        const available = getAvailableShapes(id);
        if (!available.includes(state.ui.selectedShape)) {
          state.ui.selectedShape = available[0];
        }
      });
    },

    setSelectedShape(shape) {
      set((state) => {
        state.ui.selectedShape = shape;
      });
    },

    rotateSelection() {
      set((state) => {
        state.ui.selectedRotation = ((state.ui.selectedRotation + 1) % 4) as 0 | 1 | 2 | 3;
      });
    },

    setToolMode(mode) {
      set((state) => {
        state.ui.toolMode = mode;
      });
    },

    toggleOnionSkin() {
      set((state) => {
        state.ui.onionSkinEnabled = !state.ui.onionSkinEnabled;
      });
    },

    newProject(dimensions, name = 'Untitled Build') {
      set((state) => {
        state.hasProject = true;
        state.project = emptyProject(dimensions, name);
        state.ui.currentLayerY = 0;
      });
    },

    clearGrid() {
      set((state) => {
        state.project.grid = createEmptyGrid(state.project.dimensions);
      });
    },

    loadProject(data) {
      set((state) => {
        state.hasProject = true;
        state.project = {
          name: data.name,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          dimensions: data.dimensions,
          grid: gridFromSparseBlocks(data.dimensions, data.blocks),
        };
        state.ui.currentLayerY = Math.min(state.ui.currentLayerY, data.dimensions.height - 1);
      });
    },

    exportProject() {
      return toProjectFile(get().project);
    },
  })),
);

// Autosave whenever the project changes (debounced inside saveAutosave).
useBuildStore.subscribe((state, prevState) => {
  if (state.hasProject && state.project !== prevState.project) {
    saveAutosave(toProjectFile(state.project));
  }
});
