import { writeFile } from "node:fs/promises";
import pg from "pg";
import { readImportPreview } from "../server/content-import";

// A separate variable avoids accidentally selecting an inherited production DATABASE_URL.
const target = process.env.IMPORT_DATABASE_URL;
const output = process.argv[2];
if (!target || !output) {
  console.error("Set IMPORT_DATABASE_URL to the reviewed target and pass a new backup filename. This command only reads site_content.");
  process.exitCode = 1;
} else {
  const db = new pg.Pool({ connectionString: target, max: 1, connectionTimeoutMillis: 5000, statement_timeout: 15000, options: "-c default_transaction_read_only=on" });
  try {
    const preview = await readImportPreview(db);
    await writeFile(output, JSON.stringify(preview,null,2)+"\n", {mode:0o600,flag:"wx"});
    console.log(JSON.stringify({output,preview_digest:preview.preview_digest,modules:preview.modules.map(({key,action,reason})=>({key,action,reason}))},null,2));
  } catch { console.error("Preview/export failed. No content was changed. Check the target, migration 003 and a new writable output path."); process.exitCode=1; }
  finally { await db.end(); }
}
