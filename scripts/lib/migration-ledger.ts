/** Read-only migration evidence. Never creates, adopts, repairs or executes a ledger. */
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import type pg from "pg";
import verifiedIdentities from "./verified-migration-identities.json";
export type LedgerSource =
  "public.schema_migrations" | "supabase_migrations.schema_migrations";
export const ledgerSources: LedgerSource[] = [
  "public.schema_migrations",
  "supabase_migrations.schema_migrations",
];
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
// Ignore SQL formatting/comments outside quoted values. Dollar-quoted bodies
// remain exact (apart from checkout line endings), never parsed or executed.
function sqlTokens(sql: string) {
  sql = sql.replace(/\r\n/g, "\n");
  const tokens: string[] = [];
  let i = 0;
  while (i < sql.length) {
    if (/\s/.test(sql[i])) {
      i++;
      continue;
    }
    if (sql.startsWith("--", i)) {
      const end = sql.indexOf("\n", i);
      i = end < 0 ? sql.length : end + 1;
      continue;
    }
    if (sql.startsWith("/*", i)) {
      let depth = 1;
      i += 2;
      while (depth && i < sql.length) {
        if (sql.startsWith("/*", i)) {
          depth++;
          i += 2;
        } else if (sql.startsWith("*/", i)) {
          depth--;
          i += 2;
        } else i++;
      }
      if (depth) throw Error("Unterminated SQL evidence comment.");
      continue;
    }
    const dollar = sql.slice(i).match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/)?.[0];
    if (dollar) {
      const end = sql.indexOf(dollar, i + dollar.length);
      if (end < 0) throw Error("Unterminated SQL evidence body.");
      tokens.push(sql.slice(i, end + dollar.length));
      i = end + dollar.length;
      continue;
    }
    if (sql[i] === "'" || sql[i] === '"') {
      const start = i,
        quote = sql[i++];
      let closed = false;
      const escaped =
        quote === "'" && /(?:^|[^A-Za-z0-9_])E$/i.test(sql.slice(0, start));
      while (i < sql.length) {
        if (escaped && sql[i] === "\\") {
          i += 2;
          continue;
        }
        if (sql[i++] === quote) {
          if (sql[i] === quote) i++;
          else {
            closed = true;
            break;
          }
        }
      }
      if (!closed) throw Error("Unterminated SQL evidence value.");
      tokens.push(sql.slice(start, i));
      continue;
    }
    const word = sql
      .slice(i)
      .match(
        /^[A-Za-z_][A-Za-z0-9_$]*|^[0-9]+(?:\.[0-9]+)?|^(?:::|>=|<=|<>|!=|\|\|)/,
      )?.[0];
    if (word) {
      tokens.push(word.toLowerCase());
      i += word.length;
    } else {
      tokens.push(sql[i++]);
    }
  }
  // CLI arrays may omit the final statement delimiter, but internal delimiters
  // remain significant. Callers join statement array elements with semicolons.
  while (tokens.at(-1) === ";") tokens.pop();
  return tokens;
}
export function sqlEvidence(sql: string) {
  return hash(JSON.stringify(sqlTokens(sql)));
}
export function statementEvidence(statements: string[]) {
  return hash(
    JSON.stringify(
      statements.flatMap((s, i) => [...(i ? [";"] : []), ...sqlTokens(s)]),
    ),
  );
}
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
          sql_evidence: sqlEvidence(sql),
        };
      }),
  );
}
export type MigrationArtifact = Awaited<
  ReturnType<typeof expectedMigrations>
>[number];
export function validateLedger(
  source: LedgerSource,
  rows: Record<string, any>[],
  expected: MigrationArtifact[],
) {
  const errors: string[] = [],
    warnings: string[] = [],
    seen = new Set<number>();
  const versions: { recorded: string; local: number }[] = [];
  const entries = rows.map((row) => {
    const name =
      typeof row.name === "string" ? row.name.replace(/\.sql$/, "") : "";
    const byName = expected.find((m) =>
      [m.name.slice(0, -4), m.name.slice(4, -4)].includes(name),
    );
    const version =
      typeof row.version === "string" || typeof row.version === "number"
        ? String(row.version)
        : "";
    const shortVersion = /^\d{1,3}$/.test(version) ? Number(version) : null;
    let storedEvidence: string | null = null;
    const statementsAvailable =
      row.statements != null &&
      (!Array.isArray(row.statements) || row.statements.length > 0);
    if (statementsAvailable) {
      try {
        if (
          !Array.isArray(row.statements) ||
          !row.statements.every((v: unknown) => typeof v === "string")
        )
          throw Error();
        storedEvidence = statementEvidence(row.statements);
      } catch {
        /* Invalid available evidence fails below, never falls back. */
      }
    }
    const byEvidence = expected.find((m) => storedEvidence === m.sql_evidence);
    const reviewedIdentity = verifiedIdentities.find(
      (m) =>
        m.source === source &&
        m.recorded_version === version &&
        m.recorded_name === row.name,
    );
    const reviewedArtifact =
      reviewedIdentity &&
      expected.find((m) => m.name === reviewedIdentity.local_name);
    const statementHash =
      Array.isArray(row.statements) &&
      row.statements.length > 0 &&
      row.statements.every((s: unknown) => typeof s === "string")
        ? hash(
            JSON.stringify(
              row.statements.map((s: string) => s.replace(/\r\n/g, "\n")),
            ),
          )
        : null;
    if (
      reviewedIdentity &&
      (!reviewedArtifact ||
        reviewedArtifact.sha256 !== reviewedIdentity.local_sha256 ||
        statementHash !== reviewedIdentity.stored_statements_sha256)
    ) {
      errors.push(
        `Reviewed identity mapping rejected: ${version}/${row.name}; both the pinned local SQL and original stored statements are required unchanged. See ${reviewedIdentity.review}`,
      );
      return { identity: version, status: "reviewed-evidence-mismatch" };
    }
    const artifact =
      source === "public.schema_migrations"
        ? expected.find((m) => row.name === m.name)
        : (reviewedArtifact ??
          byName ??
          byEvidence ??
          expected.find((m) => m.version === shortVersion));
    const identity = String(row.version ?? row.name ?? "unknown");
    if (
      !artifact ||
      (source.startsWith("supabase_") &&
        (!/^\d{1,3}$|^\d{14}$/.test(version) ||
          (shortVersion !== null && shortVersion !== artifact.version) ||
          (name && !byName && !byEvidence && !reviewedArtifact)))
    ) {
      errors.push(`Unknown or conflicting migration identity: ${identity}`);
      return { identity, status: "invalid-identity" };
    }
    if (seen.has(artifact.version))
      errors.push(`Duplicate migration ${artifact.name}`);
    seen.add(artifact.version);
    if (source === "supabase_migrations.schema_migrations")
      versions.push({ recorded: version, local: artifact.version });
    let checksum = "unavailable",
      statements = "unavailable";
    if (row.checksum != null) {
      checksum =
        typeof row.checksum === "string" &&
        [artifact.sha256, artifact.checkout_sha256].includes(
          row.checksum.toLowerCase(),
        )
          ? "verified"
          : "mismatch";
      if (checksum === "mismatch")
        errors.push(`Checksum mismatch: ${artifact.name}`);
    } else if (source === "public.schema_migrations")
      errors.push(`Missing native checksum: ${artifact.name}`);
    if (statementsAvailable) {
      statements = reviewedArtifact
        ? "verified-historical-variant"
        : storedEvidence === artifact.sql_evidence
          ? "verified"
          : "mismatch";
      if (statements === "mismatch")
        errors.push(`Stored SQL provenance mismatch: ${artifact.name}`);
    }
    if (checksum === "unavailable" && statements === "unavailable")
      warnings.push(
        `Historical SQL/checksum unavailable: ${artifact.name}; version metadata is not source proof.`,
      );
    return {
      identity,
      name: artifact.name,
      expected_sha256: artifact.sha256,
      checksum,
      statements,
      ...(reviewedIdentity
        ? {
            identity_mapping: reviewedIdentity.id,
            stored_statements_sha256: statementHash,
            comparison_review: reviewedIdentity.review,
          }
        : {}),
    };
  });
  const ordered = [...versions].sort(
    (a, b) =>
      a.recorded.length - b.recorded.length ||
      a.recorded.localeCompare(b.recorded),
  );
  if (
    new Set(versions.map((v) => v.recorded)).size !== versions.length ||
    ordered.some((v, i) => i > 0 && ordered[i - 1].local >= v.local)
  )
    errors.push(
      "Supabase migration versions are duplicated or out of source order.",
    );
  for (const m of expected)
    if (!seen.has(m.version)) errors.push(`Missing migration: ${m.name}`);
  return {
    source,
    valid: !errors.length,
    provenance_verified: !errors.length && !warnings.length,
    entries,
    errors,
    warnings,
  };
}
export async function inspectMigrationLedgers(
  db: Pick<pg.Pool, "query">,
  expected: MigrationArtifact[],
) {
  const found = (
    await db.query(
      "SELECT n.nspname||'.'||c.relname AS source FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE c.relname='schema_migrations' AND n.nspname IN ('public','supabase_migrations') AND c.relkind IN ('r','p') ORDER BY n.nspname",
    )
  ).rows.map((r) => r.source);
  const ledgers = [];
  for (const source of ledgerSources.filter((s) => found.includes(s))) {
    // to_jsonb accommodates older Supabase ledgers without name/statements and
    // optional checksums. Identifiers come exclusively from the closed allowlist.
    const rows = (
      await db.query(
        `SELECT to_jsonb(m) AS entry FROM ${source} m ORDER BY to_jsonb(m)->>'version',to_jsonb(m)->>'name'`,
      )
    ).rows.map((r) => r.entry);
    ledgers.push(validateLedger(source, rows, expected));
  }
  return {
    valid: !!ledgers.length && ledgers.every((l) => l.valid),
    provenance_verified:
      !!ledgers.length && ledgers.every((l) => l.provenance_verified),
    selected: ledgers[0]?.source ?? null,
    ledgers,
    errors: ledgers.length
      ? ledgers.flatMap((l) => l.errors)
      : [
          "No supported migration ledger exists; do not create or repair one automatically.",
        ],
    warnings: ledgers.flatMap((l) => l.warnings),
  };
}
