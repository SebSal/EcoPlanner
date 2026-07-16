import type { ProjectFileV1 } from '../types/project';

const AUTOSAVE_KEY = 'eco-build-planner:autosave:v1';
const AUTOSAVE_DEBOUNCE_MS = 500;

let autosaveTimer: ReturnType<typeof setTimeout> | undefined;

export function saveAutosave(project: ProjectFileV1): void {
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(project));
  }, AUTOSAVE_DEBOUNCE_MS);
}

export function loadAutosave(): ProjectFileV1 | null {
  const raw = localStorage.getItem(AUTOSAVE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.schemaVersion !== 1) return null;
    return parsed as ProjectFileV1;
  } catch {
    return null;
  }
}

export function clearAutosave(): void {
  localStorage.removeItem(AUTOSAVE_KEY);
}

export function exportProjectToFile(project: ProjectFileV1): void {
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

export async function importProjectFromFile(file: File): Promise<ProjectFileV1> {
  const text = await file.text();
  const parsed = JSON.parse(text);
  if (parsed?.schemaVersion !== 1) {
    throw new Error('Unsupported or missing project schema version.');
  }
  if (!parsed.dimensions || !Array.isArray(parsed.blocks)) {
    throw new Error('Invalid project file: missing dimensions or blocks.');
  }
  return parsed as ProjectFileV1;
}
