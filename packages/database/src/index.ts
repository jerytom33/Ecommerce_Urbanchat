import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ecommerce_prototype';

const client = postgres(connectionString);

export const db = drizzle(client, { schema });

export { schema };
export type Database = typeof db;

// Re-export commonly used drizzle-orm operators
export { eq, and, or, ne, gt, gte, lt, lte, like, ilike, inArray, sql } from 'drizzle-orm';
