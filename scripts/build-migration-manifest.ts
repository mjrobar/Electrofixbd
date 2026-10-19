// Code-time only. Does not connect to a database or execute migration SQL.
import { readFile, writeFile } from "node:fs/promises";
import {
  expectedMigrations,
  expectedOptionalMigrations,
} from "./lib/migration-ledger";
const manifests = [
  {
    file: "migration-manifest.json",
    rows: (await expectedMigrations()).map(({ checkout_sha256: _, ...m }) => m),
  },
  {
    file: "optional-migration-manifest.json",
    rows: await expectedOptionalMigrations(),
  },
];
for (const manifest of manifests) {
  const output = new URL("../server/db/" + manifest.file, import.meta.url),
    text = JSON.stringify(manifest.rows, null, 2) + "\n";
  if (process.argv.includes("--check")) {
    if ((await readFile(output, "utf8")).replace(/\r\n/g, "\n") !== text)
      throw Error(
        "Embedded migration manifest differs from source. Review migration provenance; never refresh an applied migration hash to hide drift.",
      );
  } else await writeFile(output, text);
}
if (process.argv.includes("--check"))
  console.log(
    "Embedded baseline and optional migration manifests match reviewed SQL sources.",
  );
