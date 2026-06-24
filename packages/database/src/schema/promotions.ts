import { pgTable, uuid, varchar, numeric, integer, boolean, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

export const promotions = pgTable('promotions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  type: varchar('type', { length: 30 }).notNull(),
  code: varchar('code', { length: 32 }),
  value: numeric('value', { precision: 12, scale: 2 }).notNull(),
  conditions: jsonb('conditions').default({}),
  stackingRules: jsonb('stacking_rules').default({}),
  maxRedemptions: integer('max_redemptions'),
  currentRedemptions: integer('current_redemptions').notNull().default(0),
  perCustomerLimit: integer('per_customer_limit'),
  active: boolean('active').notNull().default(true),
  startsAt: timestamp('starts_at', { withTimezone: true }),
  endsAt: timestamp('ends_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
