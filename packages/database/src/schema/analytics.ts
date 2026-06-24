import { pgTable, uuid, varchar, integer, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

export const analyticsEvents = pgTable('analytics_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  eventType: varchar('event_type', { length: 50 }).notNull(),
  productId: uuid('product_id'),
  customerId: uuid('customer_id'),
  sessionId: varchar('session_id', { length: 100 }),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
