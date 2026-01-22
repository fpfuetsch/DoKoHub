import { vi } from 'vitest';

// Mock the database module to use an in-memory PGlite instance for testing
vi.mock('$lib/server/db', async (_importOriginal) => {
	// Use the actual schema definitions
	const schema = await vi.importActual<typeof import('./src/lib/server/db/schema')>(
		'./src/lib/server/db/schema'
	);

	const { PGlite } = await vi.importActual<typeof import('@electric-sql/pglite')>(
		'@electric-sql/pglite'
	);
	const { drizzle } = await vi.importActual<typeof import('drizzle-orm/pglite')>(
		'drizzle-orm/pglite'
	);

	// use require to defeat dynamic require error
	const { createRequire } = await vi.importActual<typeof import('node:module')>('node:module');
	const require = createRequire(import.meta.url);
	const { pushSchema } = require('drizzle-kit/api') as typeof import('drizzle-kit/api');

	const client = new PGlite();
	const db = drizzle(client, { schema });

	// apply schema to db
	const { apply } = await pushSchema(schema, db as any);
	await apply();

	return { default: db, db };
});
