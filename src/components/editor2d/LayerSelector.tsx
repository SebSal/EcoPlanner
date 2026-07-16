import { useBuildStore } from '../../state/useBuildStore';

export function LayerSelector() {
  const currentLayerY = useBuildStore((s) => s.ui.currentLayerY);
  const height = useBuildStore((s) => s.project.dimensions.height);
  const onionSkinEnabled = useBuildStore((s) => s.ui.onionSkinEnabled);
  const setLayer = useBuildStore((s) => s.setLayer);
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
        onClick={() => setLayer(currentLayerY + 1)}
        disabled={currentLayerY >= height - 1}
      >
        ▲ Up
      </button>
      <label className="onion-toggle">
        <input type="checkbox" checked={onionSkinEnabled} onChange={toggleOnionSkin} />
        Onion skin
      </label>
    </div>
  );
}
