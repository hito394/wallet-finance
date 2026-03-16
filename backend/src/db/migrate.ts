import fs from "node:fs/promises";
import path from "node:path";

import { Client } from "pg";

import { env } from "../config/env.js";

const MIGRATIONS_DIR = path.resolve("src/db/migrations");

async function ensureMigrationsTable(client: Client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function appliedMigrations(client: Client): Promise<Set<string>> {
  const result = await client.query("SELECT id FROM schema_migrations");
  return new Set(result.rows.map((row: { id: string }) => row.id));
}

async function run() {
  const client = new Client({ connectionString: env.databaseUrl });
  await client.connect();

  try {
    await ensureMigrationsTable(client);
    const applied = await appliedMigrations(client);
    const files = (await fs.readdir(MIGRATIONS_DIR))
      .filter((name) => name.endsWith(".sql"))
      .sort();

    for (const file of files) {
      if (applied.has(file)) {
        continue;
      }

      const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [file]);
        await client.query("COMMIT");
        console.log(`Applied migration: ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
