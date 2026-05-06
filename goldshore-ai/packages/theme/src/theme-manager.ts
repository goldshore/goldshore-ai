export type ThemeMode = 'dark' | 'light' | 'slate';
export type Density = 'comfortable' | 'compact';
export type Accent = 'blue' | 'gold' | 'cyan' | 'violet';

export interface ThemeSettings {
  mode: ThemeMode;
  density: Density;
  accent: Accent;
}

const STORAGE_KEY = 'goldshore:theme';

const defaults: ThemeSettings = {
  mode: 'dark',
  density: 'comfortable',
  accent: 'blue',
};

export function loadThemeSettings(): ThemeSettings {
  if (typeof localStorage === 'undefined') return defaults;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return defaults;

  try {
    const parsed = JSON.parse(stored);
    return {
      ...defaults,
      ...parsed,
    };
  } catch (err) {
    console.warn('Invalid theme settings detected, resetting to defaults', err);
    return defaults;
  }
}

function applyAccent(accent: Accent, root: HTMLElement) {
  if (accent === 'gold') root.setAttribute('data-accent', 'gold');
  else if (accent === 'cyan') root.setAttribute('data-accent', 'cyan');
  else if (accent === 'violet') {
    root.removeAttribute('data-accent');
    root.style.setProperty('--gs-accent', '#a855f7');
    root.style.setProperty('--gs-accent-strong', '#9333ea');
    root.style.setProperty('--gs-accent-soft', 'rgba(168,85,247,0.18)');
    root.style.setProperty('--gs-accent-contrast', '#0f172a');
  } else {
    root.removeAttribute('data-accent');
    root.style.removeProperty('--gs-accent');
    root.style.removeProperty('--gs-accent-strong');
    root.style.removeProperty('--gs-accent-soft');
    root.style.removeProperty('--gs-accent-contrast');
  }
}

export function applyTheme(settings: ThemeSettings = defaults) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-theme', settings.mode);
  if (settings.density === 'compact') {
    root.setAttribute('data-density', 'compact');
  } else {
    root.removeAttribute('data-density');
  }
  applyAccent(settings.accent, root);
}

export function saveTheme(settings: ThemeSettings) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function setTheme(partial: Partial<ThemeSettings>) {
  const current = loadThemeSettings();
  const next = { ...current, ...partial } as ThemeSettings;
  applyTheme(next);
  saveTheme(next);
}

export function initTheme() {
  const settings = loadThemeSettings();
  applyTheme(settings);
  document.documentElement.classList.add('gs-theme-ready');
  return settings;
}
