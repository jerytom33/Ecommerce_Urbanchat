import { pgTable, uuid, varchar, text, integer, numeric, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  customerId: uuid('customer_id'),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  subtotal: numeric('subtotal', { precision: 12, scale: 2 }).notNull(),
  tax: numeric('tax', { precision: 12, scale: 2 }).notNull().default('0'),
  shipping: numeric('shipping', { precision: 12, scale: 2 }).notNull().default('0'),
  discount: numeric('discount', { precision: 12, scale: 2 }).notNull().default('0'),
  total: numeric('total', { precision: 12, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),
  shippingAddress: jsonb('shipping_address'),
  billingAddress: jsonb('billing_address'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const orderLineItems = pgTable('order_line_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  orderId: uuid('order_id').notNull().references(() => orders.id),
  listingId: uuid('listing_id'),
  title: varchar('title', { length: 255 }).notNull(),
  sku: varchar('sku', { length: 64 }),
  quantity: integer('quantity').notNull(),
  unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).notNull(),
  fulfillmentStatus: varchar('fulfillment_status', { length: 20 }).notNull().default('pending'),
  carrierName: varchar('carrier_name', { length: 100 }),
  trackingNumber: varchar('tracking_number', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
