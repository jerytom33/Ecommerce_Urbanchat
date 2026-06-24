import { pgTable, uuid, varchar, integer, numeric, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

export const customers = pgTable('customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  email: varchar('email', { length: 255 }).notNull(),
  firstName: varchar('first_name', { length: 100 }),
  lastName: varchar('last_name', { length: 100 }),
  totalOrders: integer('total_orders').notNull().default(0),
  totalSpend: numeric('total_spend', { precision: 12, scale: 2 }).notNull().default('0'),
  averageOrderValue: numeric('average_order_value', { precision: 12, scale: 2 }).notNull().default('0'),
  lastPurchaseDate: timestamp('last_purchase_date', { withTimezone: true }),
  tags: jsonb('tags').default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
