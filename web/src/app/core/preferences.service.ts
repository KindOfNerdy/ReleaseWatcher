import { Injectable, effect, signal } from '@angular/core';

export type RepositoryLayout = 'list' | 'grid';

const STORAGE_KEY = 'releasewatcher.preferences';

interface Preferences {
  repositoryLayout: RepositoryLayout;
}

const DEFAULTS: Preferences = { repositoryLayout: 'list' };

/** Per-browser UI preferences (kept in localStorage; the app works the same without it). */
@Injectable({ providedIn: 'root' })
export class PreferencesService {
  readonly repositoryLayout = signal<RepositoryLayout>(load().repositoryLayout);

  constructor() {
    effect(() => save({ repositoryLayout: this.repositoryLayout() }));
  }
}

function load(): Preferences {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<Preferences>;
    return {
      repositoryLayout: stored.repositoryLayout === 'grid' ? 'grid' : DEFAULTS.repositoryLayout,
    };
  } catch {
    return DEFAULTS;
  }
}

function save(preferences: Preferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Storage unavailable (private mode, blocked cookies) – preference lasts for this session only.
  }
}
