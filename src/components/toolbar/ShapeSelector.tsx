import { useEffect, useRef, useState } from 'react';
import { useBuildStore } from '../../state/useBuildStore';
import { getAvailableShapes, getShapeLabel } from '../../data/blockShapes';

export function ShapeSelector() {
  const selectedBlockId = useBuildStore((s) => s.ui.selectedBlockId);
  const selectedShape = useBuildStore((s) => s.ui.selectedShape);
  const setSelectedShape = useBuildStore((s) => s.setSelectedShape);
  const rotateSelection = useBuildStore((s) => s.rotateSelection);

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Available shapes can change out from under an open popover (e.g. the
  // user switches block while it's open) — always read fresh, and alphabetize
  // by label for scannability rather than exposing the underlying (largely
  // arbitrary) family-catalog order.
  const shapes = [...getAvailableShapes(selectedBlockId)].sort((a, b) =>
    getShapeLabel(a).localeCompare(getShapeLabel(b)),
  );

  // Close on outside click or Escape — same interaction as BlockPalette's
  // variant popover.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  // If the block changed underneath us and the previously-open list no
  // longer contains the current shape's family, there's nothing stale to
  // show — but simplest correctness fix is just closing whenever the block
  // (and therefore the list) changes.
  useEffect(() => {
    setOpen(false);
  }, [selectedBlockId]);

  return (
    <div className="shape-selector" ref={containerRef}>
      <button
        type="button"
        className="shape-selector-current"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
      >
        {getShapeLabel(selectedShape)}
        <span className="shape-selector-caret" aria-hidden="true" />
      </button>
      {open && (
        <div className="shape-selector-popover" role="menu">
          {shapes.map((shape) => (
            <button
              key={shape}
              type="button"
              role="menuitem"
              className={`shape-selector-row${shape === selectedShape ? ' selected' : ''}`}
              onClick={() => {
                setSelectedShape(shape);
                setOpen(false);
              }}
            >
              {getShapeLabel(shape)}
            </button>
          ))}
        </div>
      )}
      {selectedShape !== 'cube' && (
        <button type="button" onClick={rotateSelection} title="Rotate" aria-label="Rotate selection">
          ⟳
        </button>
      )}
    </div>
  );
}
