import { useRef } from 'react';
import { useBuildStore } from '../../state/useBuildStore';
import { exportProjectToFile, importProjectFromFile } from '../../lib/persistence';

export function ExportImportControls() {
  const exportProject = useBuildStore((s) => s.exportProject);
  const loadProject = useBuildStore((s) => s.loadProject);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    exportProjectToFile(exportProject());
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const project = await importProjectFromFile(file);
      loadProject(project);
    } catch (err) {
      window.alert(`Failed to import project: ${(err as Error).message}`);
    }
  };

  return (
    <div className="export-import-controls">
      <button type="button" onClick={handleExport}>
        Export
      </button>
      <button type="button" onClick={handleImportClick}>
        Import
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </div>
  );
}
