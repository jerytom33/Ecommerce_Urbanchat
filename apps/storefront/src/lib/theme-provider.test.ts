import { describe, it, expect } from 'vitest';
import { generateThemeCSSVariables, getActiveTheme, type ThemeConfig } from './theme-provider';

describe('Theme Provider', () => {
  describe('getActiveTheme', () => {
    it('returns a valid theme configuration', async () => {
      const theme = await getActiveTheme();

      expect(theme).toBeDefined();
      expect(theme.id).toBe('default');
      expect(theme.storeName).toBe('Store');
      expect(theme.colors.primary).toBe('#6366f1');
      expect(theme.navigation.links.length).toBeGreaterThan(0);
      expect(theme.footer.links.length).toBeGreaterThan(0);
    });
  });

  describe('generateThemeCSSVariables', () => {
    it('generates CSS variables from theme config', () => {
      const theme: ThemeConfig = {
        id: 'test',
        name: 'Test Theme',
        storeName: 'Test Store',
        colors: {
          primary: '#ff0000',
          secondary: '#00ff00',
          accent: '#0000ff',
          background: '#ffffff',
          surface: '#f0f0f0',
          text: '#111111',
          muted: '#666666',
          border: '#cccccc',
        },
        fonts: {
          heading: "'Roboto', sans-serif",
          body: "'Open Sans', sans-serif",
        },
        borderRadius: {
          sm: '0.125rem',
          md: '0.25rem',
          lg: '0.5rem',
        },
        navigation: { links: [] },
        footer: { description: '', links: [], socialLinks: [] },
      };

      const css = generateThemeCSSVariables(theme);

      expect(css).toContain('--color-primary: #ff0000');
      expect(css).toContain('--color-secondary: #00ff00');
      expect(css).toContain('--color-accent: #0000ff');
      expect(css).toContain('--color-background: #ffffff');
      expect(css).toContain('--color-surface: #f0f0f0');
      expect(css).toContain('--color-text: #111111');
      expect(css).toContain('--color-muted: #666666');
      expect(css).toContain('--color-border: #cccccc');
      expect(css).toContain("--font-sans: 'Open Sans', sans-serif");
      expect(css).toContain("--font-heading: 'Roboto', sans-serif");
      expect(css).toContain('--radius-sm: 0.125rem');
      expect(css).toContain('--radius-md: 0.25rem');
      expect(css).toContain('--radius-lg: 0.5rem');
    });

    it('wraps variables in :root selector', () => {
      const theme: ThemeConfig = {
        id: 'test',
        name: 'Test',
        storeName: 'Test',
        colors: {
          primary: '#000',
          secondary: '#000',
          accent: '#000',
          background: '#000',
          surface: '#000',
          text: '#000',
          muted: '#000',
          border: '#000',
        },
        fonts: { heading: 'sans-serif', body: 'sans-serif' },
        borderRadius: { sm: '0', md: '0', lg: '0' },
        navigation: { links: [] },
        footer: { description: '', links: [], socialLinks: [] },
      };

      const css = generateThemeCSSVariables(theme);
      expect(css).toContain(':root {');
    });
  });
});
