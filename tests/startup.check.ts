import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createDisposable } from "./helpers/disposable-postgres";
import { applyBrowserLockdown } from "../scripts/secure-database";
import { before, after, test } from "node:test";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";

const root = path.resolve(import.meta.dirname, "..");
let runtimeUrl: string | undefined;
let cleanup: (() => Promise<void>) | undefined;
before(async () => {
  if (!process.env.TEST_DATABASE_URL) return;
  const db = await createDisposable();
  const role = "efb_startup_" + randomUUID().replaceAll("-", "");
  try {
    await db.pool.query(`CREATE ROLE ${role} LOGIN`);
    await applyBrowserLockdown(db.url, role, "REVOKE BROWSER DATABASE ACCESS");
    const target = new URL(db.url);
    target.username = role;
    target.password = "";
    runtimeUrl = target.toString();
    cleanup = async () => {
      await db.pool.query(`DROP OWNED BY ${role}`);
      await db.pool.query(`DROP ROLE ${role}`);
      await db.close();
    };
  } catch (error) {
    await db.close();
    throw error;
  }
});
after(async () => {
  await cleanup?.();
});
let previousProcessBooking: string | undefined;
for (const mode of ["development", "production"]) {
  const shutdown =
    process.platform === "win32" ? "process termination" : "graceful shutdown";
  test(`${mode}: Node startup, frontend/API routing and ${shutdown}`, async (t) => {
    const reservation = createServer();
    await new Promise<void>((resolve) =>
      reservation.listen(0, "127.0.0.1", resolve),
    );
    const port = (reservation.address() as { port: number }).port;
    await new Promise<void>((resolve) => reservation.close(() => resolve()));
    const url = runtimeUrl || "postgresql://127.0.0.1:1/electrofix_test";
    if (process.env.TEST_DATABASE_URL) {
      const target = new URL(url);
      assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(target.hostname));
      assert.match(target.pathname, /test/);
    }
    const args =
      mode === "production"
        ? ["dist/server.mjs"]
        : ["--import", "tsx", "server.ts"];
    const child = spawn(process.execPath, args, {
      cwd: root,
      env: {
        ...process.env,
        NODE_ENV: mode,
        HOST: "127.0.0.1",
        PORT: String(port),
        DATABASE_URL: url,
        PUBLIC_ORIGIN: "https://electrofix.test",
        DB_TIMEOUT_MS: "500",
        ADMIN_USERNAME: "",
        ADMIN_PASSWORD_HASH: "",
        ADMIN_SESSION_SECRET: "",
        TRUST_PROXY: "false",
      },
    });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      output += chunk;
    });
    const exited = once(child, "exit");
    t.after(async () => {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGTERM");
        await Promise.race([
          exited,
          delay(12000).then(() => child.kill("SIGKILL")),
        ]);
      }
    });
    const base = `http://127.0.0.1:${port}`;
    let healthy = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      if (child.exitCode !== null)
        assert.fail(`Server exited before startup: ${output}`);
      try {
        healthy = (await fetch(base + "/api/health")).status === 200;
      } catch {}
      if (healthy) break;
      await delay(100);
    }
    assert.ok(healthy, `Server failed to start: ${output}`);
    for (const route of ["/", "/services/ac-repair"]) {
      const page = await fetch(base + route);
      assert.equal(page.status, 200);
      const html = await page.text();
      assert.match(html, /id="root"/);
      const script = html.match(/<script[^>]*src="([^"]+)"/);
      assert.ok(script);
      const js = await fetch(base + script[1]);
      assert.equal(js.status, 200);
      assert.match(js.headers.get("content-type")!, /javascript/);
      if (mode === "production")
        assert.doesNotMatch(html, /\/src\/main\.tsx|@vite\/client/);
    }
    assert.equal((await fetch(base + "/api/missing")).status, 404);
    if (mode === "production")
      assert.equal((await fetch(base + "/assets/missing.js")).status, 404);
    if (mode === "production") {
      assert.equal((await fetch(base + "/server.mjs")).status, 404);
      assert.equal((await fetch(base + "/server.mjs.map")).status, 404);
      const csp = (await fetch(base + "/")).headers.get(
        "content-security-policy",
      );
      assert.match(csp!, /img-src [^;]*https:/);
      assert.match(csp!, /media-src [^;]*https:/);
      assert.match(csp!, /script-src 'self';/);
      assert.match(csp!, /https:\/\/fonts.gstatic.com/);
    }
    const status = await fetch(base + "/api/status");
    assert.equal(status.status, process.env.TEST_DATABASE_URL ? 200 : 503);
    if (process.env.TEST_DATABASE_URL) {
      if (previousProcessBooking) {
        const recovered = await fetch(
          base + "/api/bookings/" + previousProcessBooking,
        );
        assert.equal(recovered.status, 200);
        assert.equal(
          (await recovered.json()).booking.booking_number,
          previousProcessBooking,
        );
      }
      const created = await fetch(base + "/api/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          customer_name: "Startup Test",
          phone: "01700000000",
          address: "Dhaka startup test",
          service_id: "srv-general",
        }),
      });
      assert.equal(created.status, 201);
      const number = (await created.json()).booking.booking_number;
      previousProcessBooking = number;
      assert.equal((await fetch(base + "/api/bookings/" + number)).status, 200);
      assert.equal(
        (
          await fetch(base + "/api/contact", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              name: "Startup Test",
              phone: "01700000000",
              message: "Startup test contact",
            }),
          })
        ).status,
        200,
      );
    }
    child.kill("SIGTERM");
    const [code, signal] = await exited;
    if (process.platform === "win32") {
      // Windows child.kill(SIGTERM) force-terminates the process; it does not
      // deliver a POSIX signal to Node's graceful-shutdown handler.
      assert.equal(code, null);
      assert.equal(signal, "SIGTERM");
    } else {
      assert.equal(code, 0);
      assert.equal(signal, null);
    }
  });
}
