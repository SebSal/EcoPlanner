import { BLOCK_PALETTE, type BlockType } from './blockPalette';

// Curated groupings for the palette. Members reference block ids from the
// generated BLOCK_PALETTE; a missing id is simply ignored, so this stays safe
// across palette regenerations.
//
// `genericId` (optional) is a placeable "generic" block: clicking the group's
// face selects it and opens the variants. Groups without a generic (e.g. Ashlar
// stone, which has no plain "ashlar" block) are header-only — clicking the face
// just opens the variants and you pick a specific one.
export interface BlockGroup {
  id: string;
  label: string;
  memberIds: string[];
  genericId?: string;
}

export const BLOCK_GROUPS: BlockGroup[] = [
  {
    id: 'ashlar',
    label: 'Ashlar Stone',
    memberIds: [
      'ashlar_basalt',
      'ashlar_granite',
      'ashlar_gneiss',
      'ashlar_limestone',
      'ashlar_sandstone',
      'ashlar_shale',
    ],
  },
  {
    id: 'hewn_log',
    label: 'Hewn Log',
    genericId: 'hewn_log',
    memberIds: ['hewn_log', 'hardwood_hewn_log', 'softwood_hewn_log'],
  },
  {
    id: 'lumber',
    label: 'Lumber',
    genericId: 'lumber',
    memberIds: ['lumber', 'hardwood_lumber', 'softwood_lumber'],
  },
  {
    id: 'composite_lumber',
    label: 'Composite Lumber',
    genericId: 'composite_lumber',
    memberIds: [
      'composite_lumber',
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
  for (const memberId of group.memberIds) groupByMemberId.set(memberId, group);
}

// Returns the group a block belongs to, if any.
export function getBlockGroup(blockId: string): BlockGroup | undefined {
  return groupByMemberId.get(blockId);
}

export type PaletteItem =
  | { kind: 'single'; block: BlockType }
  | { kind: 'group'; group: BlockGroup; face: BlockType; members: BlockType[] };

// The ordered palette layout: standalone blocks stay put, and each group is
// rendered once at the position of its first member (the rest are folded in).
export function getPaletteItems(): PaletteItem[] {
  const byId = new Map(BLOCK_PALETTE.map((b) => [b.id, b]));
  const emitted = new Set<string>();
  const items: PaletteItem[] = [];
  for (const block of BLOCK_PALETTE) {
    const group = groupByMemberId.get(block.id);
    if (!group) {
      items.push({ kind: 'single', block });
      continue;
    }
    if (emitted.has(group.id)) continue;
    emitted.add(group.id);
    const members = group.memberIds
      .map((id) => byId.get(id))
      .filter((b): b is BlockType => Boolean(b));
    if (members.length === 0) continue;
    const face = (group.genericId && byId.get(group.genericId)) || members[0];
    items.push({ kind: 'group', group, face, members });
  }
  return items;
}
