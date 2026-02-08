import { create } from 'zustand';

const STORAGE_KEY = 'postboy.ui.theme';

export type UITheme = 'light' | 'dark';

function getSystemPreference(): UITheme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getStoredTheme(): UITheme | null {
  if (typeof window === 'undefined') return null;
  const v = localStorage.getItem(STORAGE_KEY);
  if (v === 'light' || v === 'dark') return v;
  return null;
}

function applyTheme(theme: UITheme) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
}

export function initTheme(): UITheme {
  const stored = getStoredTheme();
  const theme = stored ?? getSystemPreference();
  applyTheme(theme);
  return theme;
}

interface ThemeState {
  theme: UITheme;
  setTheme: (theme: UITheme) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: initTheme(),

  setTheme: (theme: UITheme) => {
    applyTheme(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore
    }
    set({ theme });
  },

  toggleTheme: () => {
    const next: UITheme = get().theme === 'light' ? 'dark' : 'light';
    get().setTheme(next);
  },
}));

// Re-apply theme when storage key is used (e.g. another tab)
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY && e.newValue === 'light') {
      applyTheme('light');
      useThemeStore.setState({ theme: 'light' });
    } else if (e.key === STORAGE_KEY && e.newValue === 'dark') {
      applyTheme('dark');
      useThemeStore.setState({ theme: 'dark' });
    }
  });
}
