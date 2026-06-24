import { pgTable, uuid, varchar, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

export const themes = pgTable('themes', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  templateConfig: jsonb('template_config').default({}),
  colorPalette: jsonb('color_palette').default({}),
  fontConfig: jsonb('font_config').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const themeCustomizations = pgTable('theme_customizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  themeId: uuid('theme_id').notNull().references(() => themes.id),
  customizations: jsonb('customizations').default({}),
  isActive: varchar('is_active', { length: 5 }).notNull().default('false'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
