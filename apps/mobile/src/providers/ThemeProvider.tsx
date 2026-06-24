/**
 * Theme provider for whitelabel branding injection.
 * Wraps the app with merchant-specific colors, fonts, and spacing.
 */

import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { Theme, defaultTheme } from '@/theme';

interface ThemeContextValue {
  theme: Theme;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: defaultTheme,
});

interface ThemeProviderProps {
  children: ReactNode;
  overrides?: Partial<Theme>;
}

export function ThemeProvider({ children, overrides }: ThemeProviderProps) {
  const theme = useMemo<Theme>(
    () => ({
      ...defaultTheme,
      ...overrides,
      colors: {
        ...defaultTheme.colors,
        ...overrides?.colors,
      },
      fonts: {
        ...defaultTheme.fonts,
        ...overrides?.fonts,
      },
      spacing: {
        ...defaultTheme.spacing,
        ...overrides?.spacing,
      },
    }),
    [overrides]
  );

  return (
    <ThemeContext.Provider value={{ theme }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context.theme;
}
