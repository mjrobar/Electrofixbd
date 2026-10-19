// Synthetic history fixtures only; this module never opens a DB connection.
import { readFile } from "node:fs/promises";
import manifest from "../../server/db/migration-manifest.json";
import historical003 from "../fixtures/provenance/site-content-20261017052646.json";
export const nativeHistory = manifest.map((m) => ({
  name: m.name,
  checksum: m.sha256,
}));
const versions = [
  "20261016090000",
  "20261016100000",
  "20261017052646",
  "20261017100000",
  "20261018090000",
  "20261019000006",
];
export const managedHistory = await Promise.all(
  manifest.map(async (m, i) =>
    i === 2
      ? historical003.migration
      : {
          version: versions[i],
          name: m.name.slice(0, -4),
          statements: [
            await readFile(
              new URL("../../db/migrations/" + m.name, import.meta.url),
              "utf8",
            ),
          ],
        },
  ),
);
export function nativeMigrationResponse(sql: string) {
  if (sql.includes("AS source FROM pg_catalog.pg_class"))
    return { rows: [{ source: "public.schema_migrations" }] };
  if (
    sql.startsWith("SELECT to_jsonb(m) AS entry FROM public.schema_migrations")
  )
    return { rows: nativeHistory.map((entry) => ({ entry })) };
  return undefined;
}
