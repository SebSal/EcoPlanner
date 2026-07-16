import { useCallback, useRef } from 'react';
import { useBuildStore } from '../../state/useBuildStore';
import { getCell } from '../../lib/voxelGrid';
import { getBlockColor } from '../../data/blockPalette';

const CELL_SIZE = 28;

export function LayerEditor() {
  const grid = useBuildStore((s) => s.project.grid);
  const dimensions = useBuildStore((s) => s.project.dimensions);
  const currentLayerY = useBuildStore((s) => s.ui.currentLayerY);
  const onionSkinEnabled = useBuildStore((s) => s.ui.onionSkinEnabled);
  const paintCell = useBuildStore((s) => s.paintCell);

  const isPaintingRef = useRef(false);
  const lastPaintedRef = useRef<string | null>(null);

  const paint = useCallback(
    (x: number, z: number) => {
      const key = `${x},${z}`;
      if (lastPaintedRef.current === key) return;
      lastPaintedRef.current = key;
      paintCell(x, z);
    },
    [paintCell],
  );

  const rows: number[] = [];
  for (let z = dimensions.depth - 1; z >= 0; z--) rows.push(z);

  return (
    <div
      className="layer-editor"
      onPointerLeave={() => {
        isPaintingRef.current = false;
        lastPaintedRef.current = null;
      }}
      onPointerUp={() => {
        isPaintingRef.current = false;
        lastPaintedRef.current = null;
      }}
    >
      <div
        className="layer-editor-grid"
        style={{
          gridTemplateColumns: `repeat(${dimensions.width}, ${CELL_SIZE}px)`,
          gridTemplateRows: `repeat(${dimensions.depth}, ${CELL_SIZE}px)`,
        }}
      >
        {rows.map((z) =>
          Array.from({ length: dimensions.width }, (_, x) => {
            const blockId = getCell(grid, x, currentLayerY, z);
            const belowBlockId =
              onionSkinEnabled && currentLayerY > 0
                ? getCell(grid, x, currentLayerY - 1, z)
                : null;

            let background = 'transparent';
            if (blockId) {
              background = getBlockColor(blockId);
            } else if (belowBlockId) {
              background = getBlockColor(belowBlockId) + '40'; // ~25% alpha
            }

            return (
              <div
                key={`${x},${z}`}
                className="layer-editor-cell"
                style={{ background }}
                onPointerDown={() => {
                  isPaintingRef.current = true;
                  paint(x, z);
                }}
                onPointerEnter={() => {
                  if (isPaintingRef.current) paint(x, z);
                }}
              />
            );
          }),
        )}
      </div>
    </div>
  );
}
