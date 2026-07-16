import { useBuildStore } from '../../state/useBuildStore';

export function ClearButton() {
  const clearGrid = useBuildStore((s) => s.clearGrid);

  const handleClick = () => {
    if (window.confirm('Clear all blocks in this project? This cannot be undone.')) {
      clearGrid();
    }
  };

  return (
    <button type="button" onClick={handleClick}>
      Clear
    </button>
  );
}
