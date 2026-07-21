import { useEffect, useRef, useState } from 'react';
import { getBlockIcon, getBlockTexture, type BlockType } from '../../data/blockPalette';
import { getPaletteItems, type PaletteItem } from '../../data/blockGroups';
import { useBuildStore } from '../../state/useBuildStore';

// Preview a block with its actual surface texture, falling back to the inventory
// icon (e.g. untextured glass) and, under that, the flat color on the swatch.
// `preferIconInPicker` flips that order for blocks whose extracted texture is
// a good tileable 3D surface but a poor standalone picture (e.g. Pipes).
function BlockPreview({ block }: { block: BlockType }) {
  const icon = getBlockIcon(block.id); // always defined
  const src = block.preferIconInPicker ? icon : (getBlockTexture(block.id) ?? icon);
  return <img src={src} alt="" draggable={false} />;
}

function Swatch({
  block,
  selected,
  extraClass,
  onClick,
}: {
  block: BlockType;
  selected: boolean;
  extraClass?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`block-swatch${selected ? ' selected' : ''}${extraClass ? ' ' + extraClass : ''}`}
      style={{ backgroundColor: block.color }}
      title={block.name}
      aria-label={block.name}
      onClick={onClick}
    >
      <BlockPreview block={block} />
    </button>
  );
}

export function BlockPalette() {
  const selectedBlockId = useBuildStore((s) => s.ui.selectedBlockId);
  const setSelectedBlock = useBuildStore((s) => s.setSelectedBlock);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const paletteRef = useRef<HTMLDivElement>(null);

  const items = getPaletteItems();

  // Close the open variant popover on outside click or Escape.
  useEffect(() => {
    if (!expandedGroupId) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!paletteRef.current?.contains(e.target as Node)) setExpandedGroupId(null);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpandedGroupId(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [expandedGroupId]);

  const renderItem = (item: PaletteItem) => {
    if (item.kind === 'single') {
      return (
        <Swatch
          key={item.block.id}
          block={item.block}
          selected={item.block.id === selectedBlockId}
          onClick={() => {
            setSelectedBlock(item.block.id);
            setExpandedGroupId(null);
          }}
        />
      );
    }

    const { group, members } = item;
    const activeMember = members.find((m) => m.id === selectedBlockId);
    const isActive = Boolean(activeMember);
    const open = expandedGroupId === group.id;
    // The group face reflects the selected member when one is active.
    const face = activeMember ?? item.face;

    return (
      <div className="block-group" key={group.id}>
        <button
          type="button"
          className={`block-swatch has-variants${isActive ? ' selected' : ''}`}
          style={{ backgroundColor: face.color }}
          title={`${group.label} (${members.length} options)`}
          aria-label={`${group.label} group`}
          aria-expanded={open}
          onClick={() => {
            // Header-only groups (no generic) just expand; groups with a generic
            // block also select it.
            if (group.genericId) setSelectedBlock(group.genericId);
            setExpandedGroupId(open ? null : group.id);
          }}
        >
          <BlockPreview block={face} />
        </button>
        {open && (
          <div className="block-variants-popover" role="menu">
            {members.map((member) => (
              <Swatch
                key={member.id}
                block={member}
                selected={member.id === selectedBlockId}
                extraClass={member.id === group.genericId ? 'variant-generic' : undefined}
                onClick={() => {
                  setSelectedBlock(member.id);
                  setExpandedGroupId(null);
                }}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="block-palette" ref={paletteRef}>
      {items.map(renderItem)}
    </div>
  );
}
