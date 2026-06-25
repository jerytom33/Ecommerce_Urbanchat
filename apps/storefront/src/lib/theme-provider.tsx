/**
 * Theme Provider - Server Component that fetches the active theme configuration
 * and injects CSS custom properties to override design tokens at runtime.
 *
 * This enables each merchant's storefront to have unique branding (colors, fonts,
 * border-radius) driven by their active theme without client-side JavaScript.
 *
 * Requirements: 4.2, 14.1, 14.2
 */

import React from 'react';

export interface ThemeConfig {
  id: string;
  name: string;
  storeName: string;
  logo?: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    muted: string;
    border: string;
  };
  fonts: {
    heading: string;
    body: string;
  };
  borderRadius: {
    sm: string;
    md: string;
    lg: string;
  };
  navigation: {
    links: Array<{ label: string; href: string }>;
  };
  footer: {
    description: string;
    links: Array<{ label: string; href: string }>;
    socialLinks: Array<{ platform: string; url: string }>;
  };
}

/**
 * Default theme configuration used when no merchant theme is available.
 * In production, this would be fetched from the Theme Service via the Admin API.
 */
const defaultTheme: ThemeConfig = {
  id: 'default',
  name: 'Default Theme',
  storeName: 'Store',
  colors: {
    primary: '#6366f1',
    secondary: '#8b5cf6',
    accent: '#06b6d4',
    background: '#ffffff',
    surface: '#f8fafc',
    text: '#0f172a',
    muted: '#64748b',
    border: '#e2e8f0',
  },
  fonts: {
    heading: "'Inter', system-ui, sans-serif",
    body: "'Inter', system-ui, sans-serif",
  },
  borderRadius: {
    sm: '0.25rem',
    md: '0.375rem',
    lg: '0.5rem',
  },
  navigation: {
    links: [
      { label: 'Home', href: '/' },
      { label: 'Shop', href: '/products' },
      { label: 'Categories', href: '/products?view=categories' },
      { label: 'Search', href: '/search' },
    ],
  },
  footer: {
    description: 'Your one-stop shop for amazing products.',
    links: [
      { label: 'About Us', href: '/about' },
      { label: 'Contact', href: '/contact' },
      { label: 'Shipping Policy', href: '/shipping' },
      { label: 'Returns', href: '/returns' },
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms of Service', href: '/terms' },
    ],
    socialLinks: [
      { platform: 'Twitter', url: '#' },
      { platform: 'Instagram', url: '#' },
      { platform: 'Facebook', url: '#' },
    ],
  },
};

/**
 * Fetches the active theme for the current storefront.
 * In production, this reads from Redis cache or the Theme Service.
 * For the prototype, returns the default theme configuration.
 */
export async function getActiveTheme(): Promise<ThemeConfig> {
  // In production: fetch from Theme Service / Redis cache
  // const theme = await fetch(`${THEME_SERVICE_URL}/api/themes/active`, { next: { revalidate: 60 } });
  return defaultTheme;
}

/**
 * Generates a CSS string of custom properties from the theme configuration.
 * These override the default design tokens defined in tokens.css.
 */
export function generateThemeCSSVariables(theme: ThemeConfig): string {
  return `
    :root {
      --color-primary: ${theme.colors.primary};
      --color-secondary: ${theme.colors.secondary};
      --color-accent: ${theme.colors.accent};
      --color-background: ${theme.colors.background};
      --color-surface: ${theme.colors.surface};
      --color-text: ${theme.colors.text};
      --color-muted: ${theme.colors.muted};
      --color-border: ${theme.colors.border};
      --font-sans: ${theme.fonts.body};
      --font-heading: ${theme.fonts.heading};
      --radius-sm: ${theme.borderRadius.sm};
      --radius-md: ${theme.borderRadius.md};
      --radius-lg: ${theme.borderRadius.lg};
    }
  `.trim();
}

/**
 * ThemeStyles - Server Component that injects theme CSS variables into the page.
 * Renders as a <style> tag in the <head> for zero-JS theme application.
 */
export async function ThemeStyles(): Promise<React.ReactElement> {
  const theme = await getActiveTheme();
  const cssVariables = generateThemeCSSVariables(theme);

  return <style dangerouslySetInnerHTML={{ __html: cssVariables }} />;
}
