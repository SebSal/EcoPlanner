import { useState } from 'react';
import { useBuildStore } from '../../state/useBuildStore';
import { CLAIM_SIZE } from '../../lib/voxelGrid';

const MIN_CLAIMS = 1;
// Just a sanity cap so a stray keystroke can't request a multi-thousand-block
// grid; 40 claims = 200 blocks per axis, well beyond typical builds.
const MAX_CLAIMS = 40;

interface NewProjectDialogProps {
  isOpen: boolean;
  canCancel: boolean;
  onClose: () => void;
}

export function NewProjectDialog({ isOpen, canCancel, onClose }: NewProjectDialogProps) {
  const newProject = useBuildStore((s) => s.newProject);
  const [name, setName] = useState('Untitled Build');
  const [widthClaims, setWidthClaims] = useState(2);
  const [depthClaims, setDepthClaims] = useState(2);

  if (!isOpen) return null;

  const clampClaims = (value: number) =>
    Math.min(Math.max(Math.round(value) || MIN_CLAIMS, MIN_CLAIMS), MAX_CLAIMS);

  const widthBlocks = clampClaims(widthClaims) * CLAIM_SIZE;
  const depthBlocks = clampClaims(depthClaims) * CLAIM_SIZE;

  const handleConfirm = () => {
    if (canCancel && !window.confirm('Start a new project? Your current build will be replaced.')) {
      return;
    }
    newProject(
      { width: widthBlocks, height: 1, depth: depthBlocks },
      name.trim() || 'Untitled Build',
    );
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
            Width (X, claims)
            <input
              type="number"
              min={MIN_CLAIMS}
              max={MAX_CLAIMS}
              value={widthClaims}
              onChange={(e) => setWidthClaims(Number(e.target.value))}
            />
          </label>
          <label>
            Depth (Y, claims)
            <input
              type="number"
              min={MIN_CLAIMS}
              max={MAX_CLAIMS}
              value={depthClaims}
              onChange={(e) => setDepthClaims(Number(e.target.value))}
            />
          </label>
        </div>
        <p className="dialog-hint">
          1 claim = {CLAIM_SIZE} blocks → {widthBlocks} × {depthBlocks} blocks, 1 layer tall.
          Build upward with the ▲ Up button.
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
