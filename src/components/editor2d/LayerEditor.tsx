import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useBuildStore } from '../../state/useBuildStore';
import { CLAIM_SIZE, getCell } from '../../lib/voxelGrid';
import { getBlockColor } from '../../data/blockPalette';

const CELL_SIZE = 28;
const MIN_SCALE = 0.2;
const MAX_SCALE = 5;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

interface View {
  scale: number;
  x: number;
  y: number;
}

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

  // Pan/zoom: scroll wheel zooms toward the cursor, right-drag pans. Left-drag
  // still paints (guarded to the primary button below). viewRef mirrors state
  // so the native, non-passive wheel listener reads the current view.
  const viewportRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const panRef = useRef<{ x: number; y: number } | null>(null);

  const gridW = dimensions.width * CELL_SIZE;
  const gridH = dimensions.depth * CELL_SIZE;

  // Center (and shrink-to-fit if larger than the viewport) whenever the grid
  // footprint changes, e.g. after New Project.
  useLayoutEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const { width, height } = vp.getBoundingClientRect();
    if (width === 0 || height === 0) return;
    const fit = clamp(Math.min((width - 24) / gridW, (height - 24) / gridH), MIN_SCALE, 1);
    setView({ scale: fit, x: (width - gridW * fit) / 2, y: (height - gridH * fit) / 2 });
  }, [gridW, gridH]);

  // Wheel-to-zoom, anchored on the cursor. Registered natively so it can be
  // non-passive (preventDefault stops the page/pane from scrolling).
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = vp.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const cur = viewRef.current;
      const scale = clamp(cur.scale * Math.exp(-e.deltaY * 0.0015), MIN_SCALE, MAX_SCALE);
      const k = scale / cur.scale;
      // Keep the world point under the cursor fixed while scaling.
      setView({ scale, x: cx - (cx - cur.x) * k, y: cy - (cy - cur.y) * k });
    };
    vp.addEventListener('wheel', onWheel, { passive: false });
    return () => vp.removeEventListener('wheel', onWheel);
  }, []);

  const onViewportPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 2) return; // right button pans; left paints (on the cells)
    panRef.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onViewportPointerMove = useCallback((e: React.PointerEvent) => {
    const pan = panRef.current;
    if (!pan) return;
    const dx = e.clientX - pan.x;
    const dy = e.clientY - pan.y;
    panRef.current = { x: e.clientX, y: e.clientY };
    setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
  }, []);

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

  // Pointer release/leave ends both an in-progress paint stroke and a pan.
  const endPointer = useCallback(() => {
    panRef.current = null;
    endStroke();
  }, [endStroke]);

  // Render depth top-to-bottom (z ascending) so the 2D grid is a top-down view
  // from ABOVE — the near/front of the build sits at the bottom of the grid,
  // matching the 3D camera. (Rendering z descending made it a mirrored,
  // from-below view.)
  const rows: number[] = [];
  for (let z = 0; z < dimensions.depth; z++) rows.push(z);

  return (
    <div
      className="layer-editor"
      ref={viewportRef}
      onPointerDown={onViewportPointerDown}
      onPointerMove={onViewportPointerMove}
      onPointerLeave={endPointer}
      onPointerUp={endPointer}
      onContextMenu={(e) => e.preventDefault()}
      // Painting is a press-and-drag gesture; stop the browser from starting a
      // native element/selection drag ("ghost" image of the grid) instead.
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
    >
      <div
        className="layer-editor-canvas"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
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
            // Rows now render z-ascending, so a cell's bottom border sits between
            // z and z+1 — same form as claimX (matches on the last cell of each
            // claim, skipping the outer frame).
            const claimZ = (z + 1) % CLAIM_SIZE === 0 && z !== dimensions.depth - 1;
            const className =
              'layer-editor-cell' +
              (claimX ? ' claim-x' : '') +
              (claimZ ? ' claim-z' : '');

            return (
              <div
                key={`${x},${z}`}
                className={className}
                style={{ background }}
                onPointerDown={(e) => {
                  if (e.button === 0) beginStroke(x, z);
                }}
                onPointerEnter={() => extendStroke(x, z)}
              >
                {/* Non-cube shapes have a facing direction that isn't visible
                    in the 3D view alone (the 2D editor is the only placement
                    surface) — a small triangle points the way, rotated in
                    lockstep with the 3D matrix rotation applied in
                    VoxelInstancedMesh. */}
                {cell && cell.shape !== 'cube' && cell.shape !== 'floor' && (
                  <span
                    className="shape-rotation-indicator"
                    // Negative so the arrow spins counter-clockwise to match the
                    // 3D mesh's rotationY (CCW seen from above) in the top-down
                    // view — a plain positive CSS rotation would spin the arrow
                    // the opposite way and mismatch on odd rotations.
                    style={{ transform: `translate(-50%, -50%) rotate(${-cell.rotation * 90}deg)` }}
                  />
                )}
              </div>
            );
          }),
          )}
        </div>
      </div>
    </div>
  );
}
