// Column junction connectivity → mesh selection.
//
// Like walls and pipes (see wallConnectivity.ts / pipeConnectivity.ts), a
// column's appearance depends on its neighbors — but columns connect only
// vertically, so there are just four states based on whether the cell directly
// above and/or below is the same column:
//   column         solo (neither)  — foot + capital, a standalone column
//   columnbottom   neighbor above  — foot at the base of a stack
//   columntop      neighbor below  — capital at the top of a stack
//   columnmiddle   both            — plain shaft
//
// In the game each family's Column MonoBehaviour binds these via usageCases
// keyed on the up/down neighbor conditions (offsetType o4=up, o21=down;
// ruleType 6=neighbor present, 7=absent). We extract the four meshes per family
// (some families reuse one mesh flipped 180° for the opposite end — that flip
// is baked in at extraction time) and select among them here. No rotation is
// implied by connectivity; the cell's placement rotation is applied as-is.

export const COLUMN_SHAPE_IDS = ['column', 'columnbottom', 'columnmiddle', 'columntop'] as const;
export type ColumnShapeId = (typeof COLUMN_SHAPE_IDS)[number];

// Resolves the vertical-neighbor state to the mesh to render. `hasAbove` /
// `hasBelow` are whether the cell directly above / below is the same column.
export function classifyColumn(hasAbove: boolean, hasBelow: boolean): ColumnShapeId {
  if (hasAbove && hasBelow) return 'columnmiddle';
  if (hasAbove) return 'columnbottom'; // something above, nothing below → base
  if (hasBelow) return 'columntop'; // something below, nothing above → capital
  return 'column'; // solo
}
