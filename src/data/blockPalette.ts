export interface BlockType {
  id: string;
  name: string;
  color: string; // hex — used for the 2D grid and as a fallback when no texture
  texture?: string; // optional URL to a tiling surface texture for the 3D cubes
  icon?: string; // optional URL to an inventory icon for the palette swatch
}

// PLACEHOLDER data — not sourced from the real game, refine later with real ECO material colors.
export const BLOCK_PALETTE: BlockType[] = [
  { id: 'stone', name: 'Stone', color: '#9a9a9a' },
  { id: 'hewn_rock', name: 'Hewn Rock', color: '#7d7568' },
  { id: 'wood_log', name: 'Wood Log', color: '#6b4a2f' },
  { id: 'wood_planks', name: 'Wood Planks', color: '#b08a5a' },
  { id: 'straw_thatch', name: 'Straw/Thatch', color: '#d4c078' },
  { id: 'concrete_gray', name: 'Concrete', color: '#c7c7c7' },
  { id: 'dye_red', name: 'Red Dye Concrete', color: '#b23b3b' },
  { id: 'dye_blue', name: 'Blue Dye Concrete', color: '#3b5fb2' },
  { id: 'dye_green', name: 'Green Dye Concrete', color: '#3f9142' },
];

export const DEFAULT_BLOCK_COLOR = '#e05fd0'; // fallback for unknown blockTypeId on import

export function getBlockColor(blockTypeId: string): string {
  return BLOCK_PALETTE.find((b) => b.id === blockTypeId)?.color ?? DEFAULT_BLOCK_COLOR;
}

export function getBlockName(blockTypeId: string): string {
  return BLOCK_PALETTE.find((b) => b.id === blockTypeId)?.name ?? blockTypeId;
}

export function getBlockTexture(blockTypeId: string): string | undefined {
  return BLOCK_PALETTE.find((b) => b.id === blockTypeId)?.texture;
}

export function getBlockIcon(blockTypeId: string): string | undefined {
  return BLOCK_PALETTE.find((b) => b.id === blockTypeId)?.icon;
}
