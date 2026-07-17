import { useCallback, useRef } from 'react';
import { useBuildStore } from '../../state/useBuildStore';
import { CLAIM_SIZE, getCell } from '../../lib/voxelGrid';
import { getBlockColor } from '../../data/blockPalette';

const CELL_SIZE = 28;

export function LayerEditor() {
  const grid = useBuildStore((s) => s.project.grid);
  const dimensions = useBuildStore((s) => s.project.dimensions);
  const currentLayerY = useBuildStore((s) => s.ui.currentLayerY);
  const onionSkinEnabled = useBuildStore((s) => s.ui.onionSkinEnabled);
  const paintCell = useBuildStore((s) => s.paintCell);

  const isPaintingRef = useRef(false);
  const draggedRef = useRef(false);
  const pendingCellRef = useRef<{ x: number; z: number } | null>(null);
  const lastPaintedRef = useRef<string | null>(null);

  // Press: remember the cell but don't paint yet — we don't know if this is a
  // single click (toggle) or the start of a drag (place) until the pointer moves.
  const beginStroke = useCallback((x: number, z: number) => {
    isPaintingRef.current = true;
    draggedRef.current = false;
    pendingCellRef.current = { x, z };
    lastPaintedRef.current = `${x},${z}`;
  }, []);

  // Entering a new cell while pressed means this stroke is a drag: commit the
  // pressed cell as a plain place, then place each entered cell (never toggles).
  const extendStroke = useCallback(
    (x: number, z: number) => {
      if (!isPaintingRef.current) return;
      const key = `${x},${z}`;
      if (lastPaintedRef.current === key) return;
      if (!draggedRef.current) {
        draggedRef.current = true;
        const pending = pendingCellRef.current;
        if (pending) paintCell(pending.x, pending.z);
        pendingCellRef.current = null;
      }
      lastPaintedRef.current = key;
      paintCell(x, z);
    },
    [paintCell],
  );

  // Release (or leave): a stroke that never became a drag was a single click, so
  // apply the toggle to the pressed cell.
  const endStroke = useCallback(() => {
    const pending = pendingCellRef.current;
    if (!draggedRef.current && pending) {
      paintCell(pending.x, pending.z, true);
    }
    isPaintingRef.current = false;
    draggedRef.current = false;
    pendingCellRef.current = null;
    lastPaintedRef.current = null;
  }, [paintCell]);

  const rows: number[] = [];
  for (let z = dimensions.depth - 1; z >= 0; z--) rows.push(z);

  return (
    <div
      className="layer-editor"
      onPointerLeave={endStroke}
      onPointerUp={endStroke}
      // Painting is a press-and-drag gesture; stop the browser from starting a
      // native element/selection drag ("ghost" image of the grid) instead.
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
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
            const cell = getCell(grid, x, currentLayerY, z);
            const belowCell =
              onionSkinEnabled && currentLayerY > 0
                ? getCell(grid, x, currentLayerY - 1, z)
                : null;

            let background = 'transparent';
            if (cell) {
              background = getBlockColor(cell.blockTypeId);
            } else if (belowCell) {
              background = getBlockColor(belowCell.blockTypeId) + '40'; // ~25% alpha
            }

            // Heavier borders on interior claim boundaries (every CLAIM_SIZE
            // blocks). Skip boundaries that fall on the outer frame so the grid
            // edge stays a thin line.
            const claimX = (x + 1) % CLAIM_SIZE === 0 && x !== dimensions.width - 1;
            const claimZ = z % CLAIM_SIZE === 0 && z > 0;
            const className =
              'layer-editor-cell' +
              (claimX ? ' claim-x' : '') +
              (claimZ ? ' claim-z' : '');

            return (
              <div
                key={`${x},${z}`}
                className={className}
                style={{ background }}
                onPointerDown={() => beginStroke(x, z)}
                onPointerEnter={() => extendStroke(x, z)}
              >
                {/* Non-cube shapes have a facing direction that isn't visible
                    in the 3D view alone (the 2D editor is the only placement
                    surface) — a small triangle points the way, rotated in
                    lockstep with the 3D matrix rotation applied in
                    VoxelInstancedMesh. */}
                {cell && cell.shape !== 'cube' && (
                  <span
                    className="shape-rotation-indicator"
                    style={{ transform: `translate(-50%, -50%) rotate(${cell.rotation * 90}deg)` }}
                  />
                )}
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}
