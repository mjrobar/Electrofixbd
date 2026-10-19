import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { once } from "node:events";
import { scryptSync } from "node:crypto";
import express from "express";
import { createAdminAuth } from "../server/admin-auth";
import { loadConfig } from "../server/config";
import {
  credentialFingerprint,
  encodeOwnerPassword,
  verifyOwnerPassword,
} from "../server/admin-identity";
import { openDelivery } from "../server/admin-delivery";
import { errorHandler } from "../server/errors";
import { adminMemory } from "./helpers/admin-upgrade-memory";
const legacyPassword = "legacy-test-password",
  legacyHash =
    "test-salt:" + scryptSync(legacyPassword, "test-salt", 64).toString("hex"),
  key = "12".repeat(32);
async function fixture(
  t: TestContext,
  options: { legacy?: boolean; missingOwner?: boolean; email?: boolean } = {},
) {
  const config = loadConfig({
    NODE_ENV: "test",
    PUBLIC_ORIGIN: "http://localhost",
    ADMIN_USERNAME: "owner",
    ADMIN_PASSWORD_HASH: legacyHash,
    ADMIN_SESSION_SECRET: "test-only-admin-session-secret-".repeat(2),
    ADMIN_UPGRADE_ENABLED: options.legacy ? "false" : "true",
    ...(options.email
      ? {
          EMAIL_DELIVERY_ENABLED: "true",
          EMAIL_FROM: "owner@example.invalid",
          RESEND_API_KEY: "test-api-key-not-real",
          ADMIN_DELIVERY_ENCRYPTION_KEY: key,
          ADMIN_DELIVERY_APPROVAL: "OWNER APPROVED DELIVERY",
        }
      : {}),
  });
  const memory = adminMemory(
      options.missingOwner
        ? null
        : {
            username: "owner",
            password_hash: legacyHash,
            credential_revision: 0,
            verified_email: "old-owner@example.invalid",
            email_verified_at: "2026-01-01T00:00:00Z",
          },
    ),
    app = express();
  app.use("/api/admin", createAdminAuth(config, memory.pool));
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise<void>((r) => server.close(() => r())));
  let cookie = "";
  async function request(
    path: string,
    method = "GET",
    body?: unknown,
    csrf = true,
    overrideCookie?: string,
  ) {
    const r = await fetch(
      "http://127.0.0.1:" +
        (server.address() as any).port +
        "/api/admin" +
        path,
      {
        method,
        headers: {
          Cookie: overrideCookie ?? cookie,
          ...(csrf
            ? { Origin: "http://localhost", "X-Admin-Request": "1" }
            : {}),
          "Content-Type": "application/json",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      },
    );
    const data = await r.json();
    if (path === "/login" && r.ok)
      cookie = r.headers.get("set-cookie")!.split(";")[0];
    return { status: r.status, body: data, headers: r.headers };
  }
  async function login(password = legacyPassword) {
    return request("/login", "POST", { username: "owner", password });
  }
  function actionToken() {
    const job = [...memory.state.jobs.values()]
      .filter(
        (j) => j.state === "queued" && j.dedupe_key.startsWith("owner-action:"),
      )
      .at(-1)!;
    const payload = openDelivery(job.payload, key, job.id, "email");
    assert.ok(!job.payload.includes("token="));
    return {
      raw: payload.text.match(/token=([a-f0-9]{64})/)[1] as string,
      payload,
      job,
    };
  }
  return {
    config,
    memory,
    request,
    login,
    actionToken,
    get cookie() {
      return cookie;
    },
  };
}
test("Legacy scrypt hashes and session fingerprints remain compatible; new hashes are salted and verified", async () => {
  assert.equal(await verifyOwnerPassword(legacyPassword, legacyHash), true);
  assert.equal(await verifyOwnerPassword("wrong", legacyHash), false);
  const first = await encodeOwnerPassword("new-test-passphrase-123"),
    second = await encodeOwnerPassword("new-test-passphrase-123");
  assert.notEqual(first, second);
  assert.equal(
    await verifyOwnerPassword("new-test-passphrase-123", first),
    true,
  );
});
test("Authenticated password change requires old password and CSRF, throttles, audits and invalidates every session", async (t) => {
  const f = await fixture(t);
  assert.equal((await f.login()).status, 200);
  const oldCookie = f.cookie;
  assert.equal(
    (
      await f.request(
        "/account/password",
        "POST",
        {
          current_password: legacyPassword,
          new_password: "changed-test-password",
        },
        false,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await f.request("/account/password", "POST", {
        current_password: "wrong",
        new_password: "changed-test-password",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await f.request("/account/password", "POST", {
        current_password: legacyPassword,
        new_password: "short",
      })
    ).status,
    400,
  );
  assert.equal(f.memory.state.owner!.password_hash, legacyHash);
  assert.equal(
    (
      await f.request("/account/password", "POST", {
        current_password: legacyPassword,
        new_password: "changed-test-password",
      })
    ).status,
    200,
  );
  assert.equal(f.memory.state.sessions.size, 0);
  assert.ok(
    f.memory.state.audits.some((a) =>
      a.includes("password_changed_sessions_revoked"),
    ),
  );
  assert.equal(
    (await f.request("/me", "GET", undefined, true, oldCookie)).status,
    401,
  );
  assert.equal((await f.login()).status, 401);
  assert.equal((await f.login("changed-test-password")).status, 200);
  const account = (await f.request("/account")).body;
  assert.equal(account.password_hash, undefined);
  assert.equal(account.ADMIN_SESSION_SECRET, undefined);
  for (let i = 0; i < 4; i++)
    await f.request("/account/password", "POST", {
      current_password: "wrong",
      new_password: "another-test-password",
    });
  assert.equal(
    (
      await f.request("/account/password", "POST", {
        current_password: "wrong",
        new_password: "another-test-password",
      })
    ).status,
    429,
  );
});
test("Verified email changes preserve the current address until single-use, expiring ownership verification; no tokens leak to API", async (t) => {
  const f = await fixture(t, { email: true });
  await f.login();
  const cookie = f.cookie;
  assert.equal(
    (
      await f.request("/account/email", "POST", {
        current_password: "wrong",
        email: "new-owner@example.invalid",
      })
    ).status,
    403,
  );
  const queued = await f.request("/account/email", "POST", {
    current_password: legacyPassword,
    email: "new-owner@example.invalid",
  });
  assert.equal(queued.status, 202);
  assert.equal(queued.body.token, undefined);
  assert.equal(
    f.memory.state.owner!.verified_email,
    "old-owner@example.invalid",
  );
  const action = f.actionToken();
  assert.equal(action.payload.to, "new-owner@example.invalid");
  assert.match(
    action.payload.text,
    /http:\/\/localhost\/admin#action=verify_email/,
  );
  assert.equal(
    (
      await f.request("/recovery/complete", "POST", {
        token: action.raw,
        password: "recovered-test-password",
      })
    ).status,
    400,
    "Wrong token purpose must fail",
  );
  assert.equal(
    (await f.request("/account/verify-email", "POST", { token: action.raw }))
      .status,
    200,
  );
  assert.equal(
    f.memory.state.owner!.verified_email,
    "new-owner@example.invalid",
  );
  assert.equal(f.memory.state.sessions.size, 0);
  assert.equal(
    (await f.request("/account/verify-email", "POST", { token: action.raw }))
      .status,
    400,
  );
  assert.equal(
    (await f.request("/me", "GET", undefined, true, cookie)).status,
    401,
  );
  await f.login();
  await f.request("/account/email", "POST", {
    current_password: legacyPassword,
    email: "third-owner@example.invalid",
  });
  const expired = f.actionToken();
  for (const a of f.memory.state.tokens.values())
    if (!a.used_at) a.expires_at = "2000-01-01T00:00:00Z";
  assert.equal(
    (await f.request("/account/verify-email", "POST", { token: expired.raw }))
      .status,
    400,
  );
  assert.equal(
    f.memory.state.owner!.verified_email,
    "new-owner@example.invalid",
  );
});
test("Recovery is enumeration-safe, only uses the verified email, rejects expiry/replay, and revokes sessions after reset", async (t) => {
  const f = await fixture(t, { email: true });
  await f.login();
  const unknown = await f.request("/recovery/request", "POST", {
      email: "unknown@example.invalid",
    }),
    known = await f.request("/recovery/request", "POST", {
      email: "old-owner@example.invalid",
    });
  assert.equal(unknown.status, 202);
  assert.deepEqual(unknown.body, known.body);
  assert.equal(f.memory.state.jobs.size, 1);
  const action = f.actionToken();
  assert.equal(action.payload.to, "old-owner@example.invalid");
  assert.equal(
    (
      await f.request("/recovery/complete", "POST", {
        token: "0".repeat(64),
        password: "recovered-test-password",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await f.request("/recovery/complete", "POST", {
        token: action.raw,
        password: "recovered-test-password",
      })
    ).status,
    200,
  );
  assert.equal(f.memory.state.sessions.size, 0);
  assert.equal((await f.login()).status, 401);
  assert.equal((await f.login("recovered-test-password")).status, 200);
  assert.equal(
    (
      await f.request("/recovery/complete", "POST", {
        token: action.raw,
        password: "another-test-password",
      })
    ).status,
    400,
  );
  assert.ok(
    [...f.memory.state.jobs.values()].every(
      (j) => j.state === "cancelled" && j.payload === null,
    ),
  );
});
test("Disabled/uninitialized upgrade storage never falls back to a stale environment password or pretends email delivery works", async (t) => {
  const legacy = await fixture(t, { legacy: true });
  assert.equal((await legacy.login()).status, 200);
  assert.equal(
    (
      await legacy.request("/account/password", "POST", {
        current_password: legacyPassword,
        new_password: "changed-test-password",
      })
    ).status,
    409,
  );
  assert.equal(
    (await legacy.request("/recovery/status")).body.available,
    false,
  );
  assert.equal(legacy.memory.state.sessions.size, 1);
  const missing = await fixture(t, { missingOwner: true });
  const result = await missing.login();
  assert.equal(result.status, 503);
  assert.equal(result.body.code, "OWNER_NOT_INITIALIZED");
  assert.equal(missing.memory.state.sessions.size, 0);
  assert.equal(
    credentialFingerprint(
      { username: "owner", password_hash: legacyHash, credential_revision: 0 },
      legacy.config,
    ),
    credentialFingerprint(
      { username: "owner", password_hash: legacyHash, credential_revision: 0 },
      missing.config,
    ),
  );
  assert.equal(
    missing.memory.queries.some((q) =>
      q.sql.startsWith("INSERT INTO public.admin_owner"),
    ),
    false,
  );
});
