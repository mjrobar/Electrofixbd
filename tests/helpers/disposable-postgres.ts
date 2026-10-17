import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { migrate } from "../../scripts/migrate";
export const postgresOptions = {
  skip: !process.env.TEST_DATABASE_URL
    ? "Set TEST_DATABASE_URL to a disposable local PostgreSQL cluster."
    : false,
};
export async function createDisposable() {
  const url = new URL(process.env.TEST_DATABASE_URL!);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
  assert.match(url.pathname, /test/);
  const owner = new pg.Client({ connectionString: url.toString() });
  await owner.connect();
  const name = "efb_issue11_test_" + randomUUID().replaceAll("-", "");
  await owner.query(`CREATE DATABASE ${name}`);
  url.pathname = "/" + name;
  const pool = new pg.Pool({ connectionString: url.toString() });
  const close = async () => {
    await pool.end();
    await owner.query(`DROP DATABASE ${name}`);
    await owner.end();
  };
  try {
    await migrate(url.toString());
    return { pool, url: url.toString(), close };
  } catch (error) {
    await close();
    throw error;
  }
}
export async function disposable<T>(
  run: (pool: pg.Pool, url: string) => Promise<T>,
) {
  const db = await createDisposable();
  try {
    return await run(db.pool, db.url);
  } finally {
    await db.close();
  }
}
