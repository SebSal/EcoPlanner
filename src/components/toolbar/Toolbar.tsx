import { BlockPalette } from './BlockPalette';
import { ToolModeToggle } from './ToolModeToggle';
import { ExportImportControls } from './ExportImportControls';
import { ClearButton } from './ClearButton';

interface ToolbarProps {
  onNewProject: () => void;
}

export function Toolbar({ onNewProject }: ToolbarProps) {
  return (
    <div className="toolbar">
      <div className="toolbar-section">
        <button type="button" onClick={onNewProject}>
          New Project
        </button>
        <ClearButton />
      </div>
      <div className="toolbar-section">
        <ToolModeToggle />
        <BlockPalette />
      </div>
      <div className="toolbar-section">
        <ExportImportControls />
      </div>
    </div>
  );
}
