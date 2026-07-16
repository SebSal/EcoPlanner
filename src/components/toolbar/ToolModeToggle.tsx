import { useBuildStore } from '../../state/useBuildStore';

export function ToolModeToggle() {
  const toolMode = useBuildStore((s) => s.ui.toolMode);
  const setToolMode = useBuildStore((s) => s.setToolMode);

  return (
    <div className="tool-mode-toggle">
      <button
        type="button"
        className={toolMode === 'place' ? 'selected' : ''}
        onClick={() => setToolMode('place')}
      >
        Place
      </button>
      <button
        type="button"
        className={toolMode === 'erase' ? 'selected' : ''}
        onClick={() => setToolMode('erase')}
      >
        Erase
      </button>
    </div>
  );
}
