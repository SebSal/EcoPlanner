import { useMemo } from 'react';
import { useBuildStore } from '../../state/useBuildStore';
import { CLAIM_SIZE, getCell } from '../../lib/voxelGrid';

// User-facing axis labels follow the New Project dialog: the two ground axes
// are X (width) and Y (depth), and Z is the vertical stack of layers (height).
type MoveAxis = 'width' | 'height' | 'depth';

const MAX_GROUND = 40 * CLAIM_SIZE;

export function GridControls() {
  const grid = useBuildStore((s) => s.project.grid);
  const dimensions = useBuildStore((s) => s.project.dimensions);
  const extendAxis = useBuildStore((s) => s.extendAxis);
  const moveBlocks = useBuildStore((s) => s.moveBlocks);

  const { width, height, depth } = dimensions;

  // Bounding box of all placed blocks, in one pass. Move buttons are disabled
  // when the shift would push a block off the grid (mirrors the store's guard),
  // which also covers "nothing placed yet".
  const bounds = useMemo(() => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let y = 0; y < height; y++) {
      for (let z = 0; z < depth; z++) {
        for (let x = 0; x < width; x++) {
          if (!getCell(grid, x, y, z)) continue;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          if (z < minZ) minZ = z;
          if (z > maxZ) maxZ = z;
        }
      }
    }
    return { minX, maxX, minY, maxY, minZ, maxZ, hasBlocks: maxX >= 0 };
  }, [grid, width, height, depth]);

  const canMove = (axis: MoveAxis, delta: 1 | -1): boolean => {
    if (!bounds.hasBlocks) return false;
    if (axis === 'width') return delta < 0 ? bounds.minX > 0 : bounds.maxX < width - 1;
    if (axis === 'height') return delta < 0 ? bounds.minY > 0 : bounds.maxY < height - 1;
    return delta < 0 ? bounds.minZ > 0 : bounds.maxZ < depth - 1;
  };

  const moveGroup = (label: string, axis: MoveAxis) => (
    <div className="grid-controls-move-axis">
      <button
        type="button"
        onClick={() => moveBlocks(axis, -1)}
        disabled={!canMove(axis, -1)}
        title={`Move all blocks one block in −${label}`}
      >
        −
      </button>
      <span className="grid-controls-axis-label">{label}</span>
      <button
        type="button"
        onClick={() => moveBlocks(axis, 1)}
        disabled={!canMove(axis, 1)}
        title={`Move all blocks one block in +${label}`}
      >
        +
      </button>
    </div>
  );

  return (
    <div className="grid-controls">
      <div className="grid-controls-group">
        <span className="grid-controls-title">Extend</span>
        <button
          type="button"
          onClick={() => extendAxis('width')}
          disabled={width + CLAIM_SIZE > MAX_GROUND}
          title={`Add one claim (${CLAIM_SIZE} blocks) to the X axis (width)`}
        >
          ＋X claim
        </button>
        <button
          type="button"
          onClick={() => extendAxis('depth')}
          disabled={depth + CLAIM_SIZE > MAX_GROUND}
          title={`Add one claim (${CLAIM_SIZE} blocks) to the Y axis (depth)`}
        >
          ＋Y claim
        </button>
      </div>
      <div className="grid-controls-group">
        <span className="grid-controls-title">Move all</span>
        {moveGroup('X', 'width')}
        {moveGroup('Y', 'depth')}
        {moveGroup('Z', 'height')}
      </div>
    </div>
  );
}
