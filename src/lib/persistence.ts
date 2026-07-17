import type { ProjectFileV2 } from '../types/project';

const AUTOSAVE_KEY = 'eco-build-planner:autosave:v1';
const AUTOSAVE_DEBOUNCE_MS = 500;

let autosaveTimer: ReturnType<typeof setTimeout> | undefined;

// Accepts a v1 (pre-shapes) or v2 project file and returns v2, defaulting
// every block to shape: 'cube', rotation: 0 when migrating from v1. Throws
// for anything else (missing/unrecognized schemaVersion).
function migrateProjectFile(parsed: any): ProjectFileV2 {
  if (parsed?.schemaVersion === 2) return parsed as ProjectFileV2;
  if (parsed?.schemaVersion === 1) {
    return {
      ...parsed,
      schemaVersion: 2,
      blocks: Array.isArray(parsed.blocks)
        ? parsed.blocks.map((b: any) => ({ ...b, shape: 'cube' as const, rotation: 0 as const }))
        : parsed.blocks,
    };
  }
  throw new Error('Unsupported or missing project schema version.');
}

export function saveAutosave(project: ProjectFileV2): void {
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(project));
  }, AUTOSAVE_DEBOUNCE_MS);
}

export function loadAutosave(): ProjectFileV2 | null {
  const raw = localStorage.getItem(AUTOSAVE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return migrateProjectFile(parsed);
  } catch {
    return null;
  }
}

export function clearAutosave(): void {
  localStorage.removeItem(AUTOSAVE_KEY);
}

export function exportProjectToFile(project: ProjectFileV2): void {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = project.name.trim().replace(/[^a-z0-9-_]+/gi, '_') || 'eco-build';
  a.download = `${safeName}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importProjectFromFile(file: File): Promise<ProjectFileV2> {
  const text = await file.text();
  const parsed = JSON.parse(text);
  const migrated = migrateProjectFile(parsed);
  if (!migrated.dimensions || !Array.isArray(migrated.blocks)) {
    throw new Error('Invalid project file: missing dimensions or blocks.');
  }
  return migrated;
}
