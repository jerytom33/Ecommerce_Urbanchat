import { pgTable, uuid, varchar, text, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  type: varchar('type', { length: 50 }).notNull(),
  channel: varchar('channel', { length: 20 }).notNull().default('email'),
  recipient: varchar('recipient', { length: 255 }).notNull(),
  subject: varchar('subject', { length: 255 }),
  body: text('body'),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  metadata: jsonb('metadata').default({}),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
