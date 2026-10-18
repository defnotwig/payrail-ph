import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool, type PoolClient } from "pg";

const migrationLockId = 73_614_205;

async function inTransaction(client: PoolClient, operation: () => Promise<void>): Promise<void> {
  await client.query("BEGIN");
  try {
    await operation();
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function runMigrations(): Promise<void> {
  const rootEnvironmentFile = resolve(process.cwd(), "../../.env");
  if (existsSync(rootEnvironmentFile)) {
    process.loadEnvFile(rootEnvironmentFile);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || !["postgres:", "postgresql:"].includes(new URL(databaseUrl).protocol)) {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL.");
  }

  const pool = new Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 1_000 });
  let client: PoolClient | undefined;
  let lockAcquired = false;

  try {
    client = await pool.connect();
    await client.query("SELECT pg_advisory_lock($1)", [migrationLockId]);
    lockAcquired = true;
    await inTransaction(client, async () => {
      await client?.query("CREATE SCHEMA IF NOT EXISTS payrail_private");
      await client?.query("REVOKE ALL ON SCHEMA payrail_private FROM PUBLIC");
      await client?.query(`
        CREATE TABLE IF NOT EXISTS payrail_private.schema_migrations (
          version TEXT PRIMARY KEY,
          checksum TEXT NOT NULL,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
        )
      `);
    });

    const migrationsDirectory = resolve(process.cwd(), "migrations");
    const migrationFiles = (await readdir(migrationsDirectory))
      .filter((file) => /^\d{4,}_[a-z0-9_-]+\.sql$/i.test(file))
      .sort();
    let appliedCount = 0;

    for (const version of migrationFiles) {
      const sql = await readFile(resolve(migrationsDirectory, version), "utf8");
      if (sql.trim().length === 0) {
        throw new Error(`Migration ${version} is empty.`);
      }

      const checksum = createHash("sha256").update(sql).digest("hex");
      const existing = await client.query<{ checksum: string }>(
        "SELECT checksum FROM payrail_private.schema_migrations WHERE version = $1",
        [version],
      );

      if (existing.rows[0]) {
        if (existing.rows[0].checksum !== checksum) {
          throw new Error(`Applied migration ${version} has changed; add a new migration instead.`);
        }
        continue;
      }

      await inTransaction(client, async () => {
        await client?.query(sql);
        await client?.query(
          "INSERT INTO payrail_private.schema_migrations (version, checksum) VALUES ($1, $2)",
          [version, checksum],
        );
      });

      appliedCount += 1;
      console.info(`Applied migration ${version}.`);
    }

    if (appliedCount === 0) {
      console.info("Database schema is current. Applied migrations: 0.");
    }
  } finally {
    if (client && lockAcquired) {
      try {
        await client.query("SELECT pg_advisory_unlock($1)", [migrationLockId]);
      } catch {
        // Closing the connection releases a session-level advisory lock if unlock fails.
      }
    }
    client?.release();
    await pool.end();
  }
}

runMigrations().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "unknown error";
  console.error(`Migration process failed: ${message}`);
  process.exitCode = 1;
});
