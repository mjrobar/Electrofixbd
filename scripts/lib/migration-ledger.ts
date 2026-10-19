/** File-backed manifest inspection for CLI/tests; runtime validation is shared. */
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { sqlEvidence } from "../../server/db/migration-ledger";
export * from "../../server/db/migration-ledger";
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export async function expectedMigrations() {
  const directory = new URL("../../db/migrations/", import.meta.url);
  return Promise.all(
    (await readdir(directory))
      .filter((n) => /^\d+.*\.sql$/.test(n))
      .sort()
      .map(async (name) => {
        const sql = await readFile(new URL(name, directory), "utf8");
        return {
          name,
          version: Number(name.split("_")[0]),
          sha256: hash(sql.replace(/\r\n/g, "\n")),
          checkout_sha256: hash(sql),
          crlf_sha256: hash(sql.replace(/\r\n/g, "\n").replace(/\n/g, "\r\n")),
          sql_evidence: sqlEvidence(sql),
        };
      }),
  );
}
