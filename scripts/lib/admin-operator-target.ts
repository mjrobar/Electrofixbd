// Operator-only write commands require an explicit URL and independently checked
// host/database/user. Never inherit the application's DATABASE_URL as a target.
export function assertAdminOperatorTarget(
  connection: string,
  env: NodeJS.ProcessEnv,
) {
  let target: URL;
  try {
    target = new URL(connection);
  } catch {
    throw Error(
      "A valid explicit PostgreSQL operator URL is required. No credentials were logged.",
    );
  }
  if (
    !["postgres:", "postgresql:"].includes(target.protocol) ||
    target.searchParams.get("sslmode") === "no-verify"
  )
    throw Error("Verified PostgreSQL target required.");
  if (
    !env.ADMIN_OPERATOR_EXPECTED_HOST ||
    !env.ADMIN_OPERATOR_EXPECTED_DATABASE ||
    !env.ADMIN_OPERATOR_EXPECTED_USER ||
    target.hostname !== env.ADMIN_OPERATOR_EXPECTED_HOST ||
    decodeURIComponent(target.pathname.slice(1)) !==
      env.ADMIN_OPERATOR_EXPECTED_DATABASE ||
    decodeURIComponent(target.username) !== env.ADMIN_OPERATOR_EXPECTED_USER
  )
    throw Error(
      "Operator target does not match the independently verified host/database/user.",
    );
  if (env.PRIMARY_PROJECT_REF && connection.includes(env.PRIMARY_PROJECT_REF))
    throw Error("Primary project is prohibited.");
  if (/(?:^|\.)supabase\.(?:com|co)$/.test(target.hostname)) {
    const secondary = env.SECONDARY_PROJECT_REF || "",
      primary = env.PRIMARY_PROJECT_REF || "";
    if (
      !/^[a-z0-9]{20}$/.test(secondary) ||
      !/^[a-z0-9]{20}$/.test(primary) ||
      secondary === primary ||
      env.SECONDARY_PROJECT_NAME !== "Electrofixbd.Test Project" ||
      env.ADMIN_OPERATOR_TARGET_LABEL !== "OWNER VERIFIED SECONDARY" ||
      !(
        target.hostname === "db." + secondary + ".supabase.co" ||
        decodeURIComponent(target.username).split(".").at(-1) === secondary
      ) ||
      target.searchParams.get("sslmode") !== "verify-full"
    )
      throw Error(
        "Only independently verified Secondary identity with verify-full TLS is accepted for Supabase.",
      );
  } else if (
    env.ADMIN_OPERATOR_TARGET_LABEL !== "OWNER VERIFIED NODE POSTGRES HOST"
  )
    throw Error("Explicit portable PostgreSQL host approval is required.");
  return {
    hostname: target.hostname,
    database: decodeURIComponent(target.pathname.slice(1)),
    user: decodeURIComponent(target.username),
  };
}
export async function verifyOperatorConnection(
  db: { query: (sql: string) => Promise<{ rows: any[] }> },
  target: ReturnType<typeof assertAdminOperatorTarget>,
) {
  const row = (
    await db.query(
      "SELECT current_database() AS database,current_user AS username",
    )
  ).rows[0];
  // Supabase pooler may use an external project-qualified login that resolves to
  // the same role without the suffix inside PostgreSQL.
  if (
    row?.database !== target.database ||
    !(
      /\.pooler\.supabase\.com$/.test(target.hostname)
        ? [target.user, target.user.split(".")[0]]
        : [target.user]
    ).includes(row?.username)
  )
    throw Error("Connected database/role identity was not verified.");
}
