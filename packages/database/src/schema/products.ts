import { pgTable, uuid, varchar, text, integer, numeric, jsonb, timestamp, check, unique, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  name: varchar('name', { length: 128 }).notNull(),
  parentId: uuid('parent_id'),
  path: text('path').notNull(),
  depth: integer('depth').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('categories_depth_check', sql`${table.depth} >= 0 AND ${table.depth} <= 4`),
  index('categories_tenant_id_idx').on(table.tenantId),
]);

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  categoryId: uuid('category_id').references(() => categories.id),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('products_title_length_check', sql`length(${table.title}) >= 1 AND length(${table.title}) <= 255`),
  check('products_description_length_check', sql`${table.description} IS NULL OR length(${table.description}) <= 10000`),
  index('products_tenant_id_idx').on(table.tenantId),
]);

export const listings = pgTable('listings', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  productId: uuid('product_id').notNull().references(() => products.id),
  sku: varchar('sku', { length: 64 }).notNull(),
  price: numeric('price', { precision: 12, scale: 2 }).notNull(),
  weight: integer('weight'),
  inventoryQuantity: integer('inventory_quantity').notNull().default(0),
  options: jsonb('options').default({}),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('listings_price_check', sql`${table.price} >= 0.01 AND ${table.price} <= 999999999.99`),
  check('listings_weight_check', sql`${table.weight} IS NULL OR (${table.weight} >= 0 AND ${table.weight} <= 1000000)`),
  check('listings_inventory_quantity_check', sql`${table.inventoryQuantity} >= 0 AND ${table.inventoryQuantity} <= 999999`),
  unique('listings_tenant_id_sku_unique').on(table.tenantId, table.sku),
  index('listings_tenant_id_idx').on(table.tenantId),
  index('listings_product_id_idx').on(table.productId),
]);

export const media = pgTable('media', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  productId: uuid('product_id').notNull().references(() => products.id),
  url: text('url').notNull(),
  altText: varchar('alt_text', { length: 255 }),
  mimeType: varchar('mime_type', { length: 100 }),
  size: integer('size'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('media_product_id_idx').on(table.productId),
  index('media_tenant_id_idx').on(table.tenantId),
]);
