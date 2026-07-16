import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { BlockTypeId, VoxelDimensions, VoxelGrid } from '../types/voxel';
import type { ProjectFileV1 } from '../types/project';
import { BLOCK_PALETTE } from '../data/blockPalette';
import {
  createEmptyGrid,
  gridFromSparseBlocks,
  gridToSparseBlocks,
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
    toolMode: ToolMode;
    currentLayerY: number;
    onionSkinEnabled: boolean;
  };

  paintCell(x: number, z: number): void;
  setLayer(y: number): void;
  setSelectedBlock(id: BlockTypeId): void;
  setToolMode(mode: ToolMode): void;
  toggleOnionSkin(): void;

  newProject(dimensions: VoxelDimensions, name?: string): void;
  clearGrid(): void;
  loadProject(data: ProjectFileV1): void;
  exportProject(): ProjectFileV1;
}

const DEFAULT_DIMENSIONS: VoxelDimensions = { width: 8, height: 8, depth: 8 };

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

function toProjectFile(project: BuildState['project']): ProjectFileV1 {
  return {
    schemaVersion: 1,
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
      toolMode: 'place',
      currentLayerY: 0,
      onionSkinEnabled: true,
    },

    paintCell(x, z) {
      set((state) => {
        const { currentLayerY, toolMode, selectedBlockId } = state.ui;
        const value = toolMode === 'place' ? selectedBlockId : null;
        setCell(state.project.grid, x, currentLayerY, z, value);
      });
    },

    setLayer(y) {
      set((state) => {
        const maxY = state.project.dimensions.height - 1;
        state.ui.currentLayerY = Math.min(Math.max(y, 0), maxY);
      });
    },

    setSelectedBlock(id) {
      set((state) => {
        state.ui.selectedBlockId = id;
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
