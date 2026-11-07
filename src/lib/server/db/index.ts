import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { DATABASE_URL } from '$app/env/private';

const client = postgres(DATABASE_URL ?? 'postgresql://missing:missing@missing:5432/missing');

export const db = drizzle(client, { schema });
