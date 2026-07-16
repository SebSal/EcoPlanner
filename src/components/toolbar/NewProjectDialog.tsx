import { useState } from 'react';
import { useBuildStore } from '../../state/useBuildStore';

const MIN_DIM = 1;
const MAX_DIM = 64;

interface NewProjectDialogProps {
  isOpen: boolean;
  canCancel: boolean;
  onClose: () => void;
}

export function NewProjectDialog({ isOpen, canCancel, onClose }: NewProjectDialogProps) {
  const newProject = useBuildStore((s) => s.newProject);
  const [name, setName] = useState('Untitled Build');
  const [width, setWidth] = useState(8);
  const [height, setHeight] = useState(8);
  const [depth, setDepth] = useState(8);

  if (!isOpen) return null;

  const clamp = (value: number) => Math.min(Math.max(Math.round(value) || MIN_DIM, MIN_DIM), MAX_DIM);

  const handleConfirm = () => {
    if (canCancel && !window.confirm('Start a new project? Your current build will be replaced.')) {
      return;
    }
    newProject({ width: clamp(width), height: clamp(height), depth: clamp(depth) }, name.trim() || 'Untitled Build');
    onClose();
  };

  return (
    <div className="dialog-overlay">
      <div className="dialog">
        <h2>New Project</h2>
        <label>
          Name
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="dialog-dimensions">
          <label>
            Width (X)
            <input
              type="number"
              min={MIN_DIM}
              max={MAX_DIM}
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
            />
          </label>
          <label>
            Height (Y)
            <input
              type="number"
              min={MIN_DIM}
              max={MAX_DIM}
              value={height}
              onChange={(e) => setHeight(Number(e.target.value))}
            />
          </label>
          <label>
            Depth (Z)
            <input
              type="number"
              min={MIN_DIM}
              max={MAX_DIM}
              value={depth}
              onChange={(e) => setDepth(Number(e.target.value))}
            />
          </label>
        </div>
        <p className="dialog-hint">
          Dimensions are set at creation and can't be changed later in this version.
        </p>
        <div className="dialog-actions">
          {canCancel && (
            <button type="button" onClick={onClose}>
              Cancel
            </button>
          )}
          <button type="button" className="primary" onClick={handleConfirm}>
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
