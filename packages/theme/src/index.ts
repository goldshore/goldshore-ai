/**
 * GoldShore Theme Package
 * Centralized theme configuration and utilities
 */

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  border: string;
  text: {
    primary: string;
    secondary: string;
    muted: string;
  };
}

export interface ThemeConfig {
  colors: ThemeColors;
  gradients: Record<string, string>;
  shadows: Record<string, string>;
  spacing: Record<string, string>;
  breakpoints: Record<string, string>;
}

export const LIGHT_THEME: ThemeConfig = {
  colors: {
    primary: '#3b82f6',
    secondary: '#8b5cf6',
    accent: '#ec4899',
    background: '#ffffff',
    surface: '#f9fafb',
    border: 'rgba(209, 213, 219, 0.5)',
    text: {
      primary: 'rgba(17, 24, 39, 0.92)',
      secondary: 'rgba(107, 114, 128, 0.8)',
      muted: 'rgba(156, 163, 175, 0.6)',
    },
  },
  gradients: {
    hero: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
    dark: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
    accent: 'linear-gradient(135deg, #ec4899 0%, #f97316 100%)',
  },
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    '2xl': '48px',
  },
  breakpoints: {
    xs: '0px',
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
  },
};

export const DARK_THEME: ThemeConfig = {
  colors: {
    primary: '#3b82f6',
    secondary: '#8b5cf6',
    accent: '#ec4899',
    background: '#050b14',
    surface: '#0f1622',
    border: 'rgba(226, 232, 240, 0.1)',
    text: {
      primary: 'rgba(226, 232, 240, 0.92)',
      secondary: 'rgba(226, 232, 240, 0.7)',
      muted: 'rgba(226, 232, 240, 0.5)',
    },
  },
  gradients: {
    hero: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
    dark: 'linear-gradient(135deg, #050b14 0%, #0f1622 100%)',
    accent: 'linear-gradient(135deg, #ec4899 0%, #f97316 100%)',
  },
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.4)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.6)',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    '2xl': '48px',
  },
  breakpoints: {
    xs: '0px',
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
  },
};

export function getTheme(isDark: boolean = true): ThemeConfig {
  return isDark ? DARK_THEME : LIGHT_THEME;
}

export function getCSSVariables(theme: ThemeConfig): string {
  const vars: Record<string, string> = {};

  // Colors
  Object.entries(theme.colors).forEach(([key, value]) => {
    if (typeof value === 'string') {
      vars[`--color-${key}`] = value;
    } else {
      Object.entries(value).forEach(([subKey, subValue]) => {
        vars[`--color-${key}-${subKey}`] = subValue;
      });
    }
  });

  // Gradients
  Object.entries(theme.gradients).forEach(([key, value]) => {
    vars[`--gradient-${key}`] = value;
  });

  // Shadows
  Object.entries(theme.shadows).forEach(([key, value]) => {
    vars[`--shadow-${key}`] = value;
  });

  // Spacing
  Object.entries(theme.spacing).forEach(([key, value]) => {
    vars[`--spacing-${key}`] = value;
  });

  return Object.entries(vars)
    .map(([key, value]) => `${key}: ${value};`)
    .join('\n');
}

export function applyThemeToDom(theme: ThemeConfig): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const variables = getCSSVariables(theme);

  root.style.cssText = variables;
}
