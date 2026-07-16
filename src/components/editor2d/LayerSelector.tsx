import { useBuildStore } from '../../state/useBuildStore';

const MAX_HEIGHT = 64;

export function LayerSelector() {
  const currentLayerY = useBuildStore((s) => s.ui.currentLayerY);
  const height = useBuildStore((s) => s.project.dimensions.height);
  const onionSkinEnabled = useBuildStore((s) => s.ui.onionSkinEnabled);
  const setLayer = useBuildStore((s) => s.setLayer);
  const goUpLayer = useBuildStore((s) => s.goUpLayer);
  const toggleOnionSkin = useBuildStore((s) => s.toggleOnionSkin);

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
      <label className="onion-toggle">
        <input type="checkbox" checked={onionSkinEnabled} onChange={toggleOnionSkin} />
        Show layer below
      </label>
    </div>
  );
}
