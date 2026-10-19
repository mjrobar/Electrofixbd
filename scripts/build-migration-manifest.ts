// Code-time only. Does not connect to a database or execute migration SQL.
import { readFile, writeFile } from "node:fs/promises";
import { expectedMigrations } from "./lib/migration-ledger";
const manifest = (await expectedMigrations()).map(
  ({ checkout_sha256: _, ...m }) => m,
);
const output = new URL("../server/db/migration-manifest.json", import.meta.url);
const text = JSON.stringify(manifest, null, 2) + "\n";
if (process.argv.includes("--check")) {
  if ((await readFile(output, "utf8")).replace(/\r\n/g, "\n") !== text)
    throw Error(
      "Embedded migration manifest differs from source. Review migration provenance; never refresh an applied migration hash to hide drift.",
    );
  console.log("Embedded migration manifest matches reviewed SQL sources.");
} else await writeFile(output, text);
