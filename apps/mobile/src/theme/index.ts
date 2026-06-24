/**
 * Theme configuration for the whitelabel mobile storefront.
 * These defaults are overridden at runtime by merchant branding.
 */

export interface ThemeColors {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  error: string;
  success: string;
  accent: string;
}

export interface ThemeFonts {
  regular: string;
  medium: string;
  bold: string;
}

export interface ThemeSpacing {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
}

export interface Theme {
  colors: ThemeColors;
  fonts: ThemeFonts;
  spacing: ThemeSpacing;
  borderRadius: number;
}

export const defaultTheme: Theme = {
  colors: {
    primary: '#5C6AC4',
    secondary: '#006FBB',
    background: '#FFFFFF',
    surface: '#F9FAFB',
    text: '#212B36',
    textSecondary: '#637381',
    border: '#DFE3E8',
    error: '#DE3618',
    success: '#108043',
    accent: '#9C6ADE',
  },
  fonts: {
    regular: 'System',
    medium: 'System',
    bold: 'System',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: 8,
};
