import { useEffect, useState } from 'react';
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

  // Press R to rotate the current selection (skip while typing in a field, and
  // no-op for cube which has no facing). Reads state fresh so the listener
  // doesn't need re-registering.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'r' || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const s = useBuildStore.getState();
      if (s.ui.selectedShape === 'cube') return;
      e.preventDefault();
      s.rotateSelection();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
