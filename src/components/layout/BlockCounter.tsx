import { useMemo } from 'react';
import { useBuildStore } from '../../state/useBuildStore';
import { countBlocksByType } from '../../lib/voxelGrid';
import { BLOCK_PALETTE, getBlockColor, getBlockName } from '../../data/blockPalette';

export function BlockCounter() {
  const grid = useBuildStore((s) => s.project.grid);

  const { entries, total } = useMemo(() => {
    const counts = countBlocksByType(grid);
    // Order by the palette, then append any block ids not in the palette
    // (e.g. from an imported project) so nothing is dropped.
    const order = [
      ...BLOCK_PALETTE.map((b) => b.id).filter((id) => counts.has(id)),
      ...[...counts.keys()].filter((id) => !BLOCK_PALETTE.some((b) => b.id === id)),
    ];
    const entries = order.map((id) => ({
      id,
      name: getBlockName(id),
      color: getBlockColor(id),
      count: counts.get(id) ?? 0,
    }));
    const total = entries.reduce((sum, e) => sum + e.count, 0);
    return { entries, total };
  }, [grid]);

  return (
    <div className="block-counter">
      {entries.length === 0 ? (
        <span className="block-counter-empty">No blocks placed yet</span>
      ) : (
        <>
          {entries.map((e) => (
            <span className="block-count" key={e.id}>
              <span className="block-count-swatch" style={{ background: e.color }} />
              <strong>{e.count}</strong> {e.name}
            </span>
          ))}
          <span className="block-count-total">{total} total</span>
        </>
      )}
    </div>
  );
}
