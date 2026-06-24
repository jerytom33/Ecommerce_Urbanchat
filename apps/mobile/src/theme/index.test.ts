import { describe, it, expect } from 'vitest';
import { defaultTheme } from './index';

describe('theme', () => {
  describe('defaultTheme', () => {
    it('should have all required color properties', () => {
      expect(defaultTheme.colors).toHaveProperty('primary');
      expect(defaultTheme.colors).toHaveProperty('secondary');
      expect(defaultTheme.colors).toHaveProperty('background');
      expect(defaultTheme.colors).toHaveProperty('surface');
      expect(defaultTheme.colors).toHaveProperty('text');
      expect(defaultTheme.colors).toHaveProperty('textSecondary');
      expect(defaultTheme.colors).toHaveProperty('border');
      expect(defaultTheme.colors).toHaveProperty('error');
      expect(defaultTheme.colors).toHaveProperty('success');
    });

    it('should have all font variants', () => {
      expect(defaultTheme.fonts).toHaveProperty('regular');
      expect(defaultTheme.fonts).toHaveProperty('medium');
      expect(defaultTheme.fonts).toHaveProperty('bold');
    });

    it('should have all spacing values', () => {
      expect(defaultTheme.spacing.xs).toBeLessThan(defaultTheme.spacing.sm);
      expect(defaultTheme.spacing.sm).toBeLessThan(defaultTheme.spacing.md);
      expect(defaultTheme.spacing.md).toBeLessThan(defaultTheme.spacing.lg);
      expect(defaultTheme.spacing.lg).toBeLessThan(defaultTheme.spacing.xl);
    });

    it('should have a borderRadius value', () => {
      expect(defaultTheme.borderRadius).toBeGreaterThan(0);
    });

    it('should use valid hex color strings', () => {
      const hexRegex = /^#[0-9A-Fa-f]{6}$/;
      Object.values(defaultTheme.colors).forEach((color) => {
        expect(color).toMatch(hexRegex);
      });
    });
  });
});
