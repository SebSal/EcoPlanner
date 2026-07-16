import { BLOCK_PALETTE, getBlockIcon } from '../../data/blockPalette';
import { useBuildStore } from '../../state/useBuildStore';

export function BlockPalette() {
  const selectedBlockId = useBuildStore((s) => s.ui.selectedBlockId);
  const setSelectedBlock = useBuildStore((s) => s.setSelectedBlock);

  return (
    <div className="block-palette">
      {BLOCK_PALETTE.map((block) => (
        <button
          type="button"
          key={block.id}
          className={`block-swatch${block.id === selectedBlockId ? ' selected' : ''}`}
          style={{ backgroundColor: block.color }}
          title={block.name}
          aria-label={block.name}
          onClick={() => setSelectedBlock(block.id)}
        >
          <img src={getBlockIcon(block.id)} alt="" draggable={false} />
        </button>
      ))}
    </div>
  );
}
