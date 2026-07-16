import { BLOCK_PALETTE, type BlockType } from './blockPalette';

// Curated groupings for the palette. Members reference block ids from the
// generated BLOCK_PALETTE; a missing id is simply ignored, so this stays safe
// across palette regenerations. `parentId` is the placeable "generic" block
// shown as the group's face.
export interface BlockGroup {
  id: string;
  parentId: string;
  variantIds: string[];
}

export const BLOCK_GROUPS: BlockGroup[] = [
  {
    id: 'hewn_log',
    parentId: 'hewn_log',
    variantIds: ['hardwood_hewn_log', 'softwood_hewn_log'],
  },
  {
    id: 'lumber',
    parentId: 'lumber',
    variantIds: ['hardwood_lumber', 'softwood_lumber'],
  },
  {
    id: 'composite_lumber',
    parentId: 'composite_lumber',
    variantIds: [
      'composite_lumber_birch',
      'composite_lumber_cedar',
      'composite_lumber_ceiba',
      'composite_lumber_fir',
      'composite_lumber_joshua',
      'composite_lumber_oak',
      'composite_lumber_palm',
      'composite_lumber_redwood',
      'composite_lumber_saguaro',
      'composite_lumber_spruce',
    ],
  },
];

const groupByMemberId = new Map<string, BlockGroup>();
for (const group of BLOCK_GROUPS) {
  groupByMemberId.set(group.parentId, group);
  for (const variantId of group.variantIds) groupByMemberId.set(variantId, group);
}

// Returns the group a block belongs to (as parent or variant), if any.
export function getBlockGroup(blockId: string): BlockGroup | undefined {
  return groupByMemberId.get(blockId);
}

export type PaletteItem =
  | { kind: 'single'; block: BlockType }
  | { kind: 'group'; group: BlockGroup; parent: BlockType; variants: BlockType[] };

// The ordered palette layout: standalone blocks stay put, and each group is
// rendered once at its parent's position (its variant blocks are folded in).
export function getPaletteItems(): PaletteItem[] {
  const byId = new Map(BLOCK_PALETTE.map((b) => [b.id, b]));
  const items: PaletteItem[] = [];
  for (const block of BLOCK_PALETTE) {
    const group = groupByMemberId.get(block.id);
    if (!group) {
      items.push({ kind: 'single', block });
      continue;
    }
    if (group.parentId !== block.id) continue; // a variant — folded into its group
    const parent = byId.get(group.parentId);
    if (!parent) continue;
    const variants = group.variantIds
      .map((id) => byId.get(id))
      .filter((b): b is BlockType => Boolean(b));
    items.push({ kind: 'group', group, parent, variants });
  }
  return items;
}
