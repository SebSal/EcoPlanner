import { useState } from 'react';
import { useBuildStore } from '../../state/useBuildStore';
import { Toolbar } from '../toolbar/Toolbar';
import { NewProjectDialog } from '../toolbar/NewProjectDialog';
import { LayerEditor } from '../editor2d/LayerEditor';
import { LayerSelector } from '../editor2d/LayerSelector';
import { Scene } from '../viewer3d/Scene';
import { BlockCounter } from './BlockCounter';
import { CopyrightNotice } from './CopyrightNotice';

export function AppShell() {
  const hasProject = useBuildStore((s) => s.hasProject);
  const [dialogOpen, setDialogOpen] = useState(!hasProject);

  return (
    <div className="app-shell">
      <Toolbar onNewProject={() => setDialogOpen(true)} />
      <div className="app-panes">
        <div className="pane pane-2d">
          <LayerSelector />
          <LayerEditor />
        </div>
        <div className="pane pane-3d">
          <Scene />
        </div>
        <CopyrightNotice />
      </div>
      <BlockCounter />
      <NewProjectDialog
        isOpen={dialogOpen || !hasProject}
        canCancel={hasProject}
        onClose={() => setDialogOpen(false)}
      />
    </div>
  );
}
