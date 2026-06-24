import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ecommerce_prototype';
const client = postgres(connectionString);
const db = drizzle(client, { schema });

/**
 * Default themes for the platform.
 * These are global/shared themes available to all merchants.
 */
const defaultThemes = [
  {
    name: 'Modern',
    templateConfig: {
      layout: 'full-width',
      headerStyle: 'sticky',
      productGrid: 'masonry',
      footerStyle: 'minimal',
    },
    colorPalette: {
      primary: '#4F46E5',       // Indigo
      secondary: '#7C3AED',    // Violet
      accent: '#06B6D4',       // Cyan
      background: '#FFFFFF',
      surface: '#F9FAFB',
      text: '#111827',
      textSecondary: '#6B7280',
      border: '#E5E7EB',
      success: '#10B981',
      warning: '#F59E0B',
      error: '#EF4444',
    },
    fontConfig: {
      heading: 'Inter',
      body: 'Inter',
      headingWeight: '700',
      bodyWeight: '400',
      baseSize: '16px',
      scaleRatio: 1.25,
    },
  },
  {
    name: 'Classic',
    templateConfig: {
      layout: 'contained',
      headerStyle: 'simple',
      productGrid: 'grid',
      footerStyle: 'compact',
    },
    colorPalette: {
      primary: '#2C3E50',       // Dark slate (traditional)
      secondary: '#34495E',    // Muted blue-gray
      accent: '#8E7352',       // Warm bronze
      background: '#FFFFFF',
      surface: '#FAFAFA',
      text: '#2C3E50',
      textSecondary: '#7F8C8D',
      border: '#E0E0E0',
      success: '#27AE60',
      warning: '#F39C12',
      error: '#C0392B',
    },
    fontConfig: {
      heading: 'Georgia, serif',
      body: 'system-ui, -apple-system, sans-serif',
      headingWeight: '600',
      bodyWeight: '400',
      baseSize: '16px',
      scaleRatio: 1.2,
    },
  },
  {
    name: 'Bold',
    templateConfig: {
      layout: 'full-width',
      headerStyle: 'overlay',
      productGrid: 'featured',
      footerStyle: 'rich',
    },
    colorPalette: {
      primary: '#F97316',       // Orange
      secondary: '#EC4899',    // Pink
      accent: '#8B5CF6',       // Purple
      background: '#0F172A',   // Dark navy
      surface: '#1E293B',      // Slate
      text: '#F8FAFC',
      textSecondary: '#94A3B8',
      border: '#334155',
      success: '#34D399',
      warning: '#FBBF24',
      error: '#F87171',
    },
    fontConfig: {
      heading: 'Poppins',
      body: 'Poppins',
      headingWeight: '800',
      bodyWeight: '400',
      baseSize: '18px',
      scaleRatio: 1.333,
    },
  },
];

async function seedThemes() {
  console.log('🎨 Seeding default themes...');

  for (const theme of defaultThemes) {
    // Check if theme already exists by name
    const existing = await db.query.themes.findFirst({
      where: (themes, { eq }) => eq(themes.name, theme.name),
    });

    if (existing) {
      console.log(`  ⏭️  Theme "${theme.name}" already exists, skipping.`);
      continue;
    }

    await db.insert(schema.themes).values(theme);
    console.log(`  ✅ Inserted theme: "${theme.name}"`);
  }

  console.log('🎨 Theme seeding complete.');
  await client.end();
}

seedThemes().catch((err) => {
  console.error('❌ Error seeding themes:', err);
  process.exit(1);
});
