import { useMemo } from 'react';
import { useBuildStore } from '../../state/useBuildStore';
import { getCell } from '../../lib/voxelGrid';

const MAX_HEIGHT = 64;

export function LayerSelector() {
  const currentLayerY = useBuildStore((s) => s.ui.currentLayerY);
  const dimensions = useBuildStore((s) => s.project.dimensions);
  const grid = useBuildStore((s) => s.project.grid);
  const onionSkinEnabled = useBuildStore((s) => s.ui.onionSkinEnabled);
  const setLayer = useBuildStore((s) => s.setLayer);
  const goUpLayer = useBuildStore((s) => s.goUpLayer);
  const copyLayer = useBuildStore((s) => s.copyLayer);
  const toggleOnionSkin = useBuildStore((s) => s.toggleOnionSkin);

  const height = dimensions.height;

  // Copy actions are meaningless with nothing on the current layer.
  const layerHasBlocks = useMemo(() => {
    for (let z = 0; z < dimensions.depth; z++) {
      for (let x = 0; x < dimensions.width; x++) {
        if (getCell(grid, x, currentLayerY, z)) return true;
      }
    }
    return false;
  }, [grid, dimensions.width, dimensions.depth, currentLayerY]);

  const atCeiling = currentLayerY >= height - 1 && height >= MAX_HEIGHT;

  return (
    <div className="layer-selector">
      <button type="button" onClick={() => setLayer(currentLayerY - 1)} disabled={currentLayerY <= 0}>
        ▼ Down
      </button>
      <span className="layer-readout">
        Layer {currentLayerY + 1} / {height}
      </span>
      <button
        type="button"
        onClick={goUpLayer}
        disabled={currentLayerY >= height - 1 && height >= MAX_HEIGHT}
      >
        ▲ Up
      </button>
      <button
        type="button"
        onClick={() => copyLayer('down')}
        disabled={!layerHasBlocks || currentLayerY <= 0}
        title="Copy this layer's blocks onto the layer below"
      >
        ⧉ Copy ↓
      </button>
      <button
        type="button"
        onClick={() => copyLayer('up')}
        disabled={!layerHasBlocks || atCeiling}
        title="Copy this layer's blocks onto the layer above (adds a layer at the top)"
      >
        ⧉ Copy ↑
      </button>
      <label className="onion-toggle">
        <input type="checkbox" checked={onionSkinEnabled} onChange={toggleOnionSkin} />
        Show layer below
      </label>
    </div>
  );
}
