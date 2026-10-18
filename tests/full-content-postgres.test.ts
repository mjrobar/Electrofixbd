import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID, scryptSync } from "node:crypto";
import pg from "pg";
import { createApp } from "../server/app";
import { createStore } from "../server/store";
import { loadConfig } from "../server/config";
import { applyBrowserLockdown } from "../scripts/secure-database";
import {
  applyFullImport,
  fullPreview,
  rollbackFullImport,
  sourceUuid,
  fullImportApproval,
  staticRecords,
} from "../server/full-content-import";
import catalog from "../server/full-content-catalog.json";
import { canonical } from "../server/content-import";
import { disposable, postgresOptions } from "./helpers/disposable-postgres";
const password = "cms-test-password",
  secret = "cms-acceptance-secret-".repeat(3);
test(
  "full import under least privilege: backup, signed approvals, conflicts, every field, publish, history and no customer changes",
  postgresOptions,
  () =>
    disposable(async (owner, url) => {
      const role = "efb_cms_" + randomUUID().replaceAll("-", "");
      await owner.query(`CREATE ROLE ${role} LOGIN NOSUPERUSER NOBYPASSRLS`);
      const connection = new URL(url);
      connection.username = role;
      let runtime: pg.Pool | undefined,
        server: any,
        app: any,
        store: ReturnType<typeof createStore> | undefined;
      try {
        await applyBrowserLockdown(url, role, "REVOKE BROWSER DATABASE ACCESS");
        runtime = new pg.Pool({
          connectionString: connection.toString(),
          max: 3,
        });
        const config = loadConfig({
          NODE_ENV: "test",
          DATABASE_URL: connection.toString(),
          PUBLIC_ORIGIN: "http://localhost",
          ADMIN_USERNAME: "owner",
          ADMIN_PASSWORD_HASH:
            "test-salt:" +
            scryptSync(password, "test-salt", 64).toString("hex"),
          ADMIN_SESSION_SECRET: secret,
          CONTENT_IMPORT_ENABLED: "true",
          CONTENT_IMPORT_TARGET_LABEL: "Disposable localhost test database",
          API_RATE_LIMIT: "1000",
        });
        store = createStore(config);
        await store.createBooking({
          customer_name: "Synthetic booking",
          service_id: "srv-general",
          phone: "01700000000",
          address: "Synthetic test address",
          notes: "",
        });
        await store.createContact({
          name: "Synthetic contact",
          phone: "01700000000",
          message: "Do not alter this test message.",
        });
        await owner.query(
          "UPDATE services SET name='Owner edited service' WHERE id='srv-ac-repair'",
        );
        const protectedRows = async () => ({
          bookings: (
            await owner.query("SELECT to_jsonb(t) AS row FROM bookings t")
          ).rows,
          messages: (
            await owner.query(
              "SELECT to_jsonb(t) AS row FROM contact_messages t",
            )
          ).rows,
          service: (
            await owner.query(
              "SELECT to_jsonb(t) AS row FROM services t WHERE id='srv-ac-repair'",
            )
          ).rows,
        });
        const before = await protectedRows();
        app = createApp({ config, store });
        server = app.listen(0, "127.0.0.1");
        await new Promise<void>((r) => server.once("listening", r));
        let cookie = "";
        async function request(
          path: string,
          method = "GET",
          data?: unknown,
          auth = true,
        ) {
          const response = await fetch(
            "http://127.0.0.1:" + server.address().port + "/api" + path,
            {
              method,
              headers: {
                "Content-Type": "application/json",
                Origin: "http://localhost",
                "X-Admin-Request": "1",
                ...(auth ? { Cookie: cookie } : {}),
              },
              ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
            },
          );
          return {
            status: response.status,
            headers: response.headers,
            body: await response.json(),
          };
        }
        const login = await request("/admin/login", "POST", {
          username: "owner",
          password,
        });
        assert.equal(login.status, 200);
        cookie = login.headers.get("set-cookie")!.split(";")[0];
        assert.equal(
          (
            await request(
              "/admin/full-content-import/backup",
              "GET",
              undefined,
              false,
            )
          ).status,
          401,
        );
        const exported = await request("/admin/full-content-import/backup");
        assert.equal(exported.status, 200, JSON.stringify(exported.body));
        assert.equal(exported.body.totals.imported, 49);
        assert.equal(exported.body.totals.conflicted, 1);
        assert.equal(exported.body.backup.rows.bookings.length, 1);
        assert.ok(exported.body.backup.schema.trigger_functions.length);
        const approval = {
          approval: fullImportApproval,
          approval_token: exported.body.approval_token,
          acknowledge_conflicts: true,
        };
        assert.equal(
          (
            await request("/admin/full-content-import/apply", "POST", {
              ...approval,
              acknowledge_conflicts: false,
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await request("/admin/full-content-import/apply", "POST", {
              ...approval,
              approval_token: approval.approval_token + "invalid",
            })
          ).status,
          409,
        );
        assert.equal(
          (
            await request("/admin/site-content-import/apply", "POST", {
              approval: "IMPORT EXISTING CONTENT AS DRAFTS",
              approval_token: approval.approval_token,
            })
          ).status,
          409,
        );
        const race = await Promise.all([
          request("/admin/full-content-import/apply", "POST", approval),
          request("/admin/full-content-import/apply", "POST", approval),
        ]);
        assert.deepEqual(race.map((r) => r.status).sort(), [200, 409]);
        const run = race.find((r) => r.status === 200)!.body;
        assert.equal(run.imported.length, 49);
        assert.equal(run.conflicted.length, 1);
        assert.deepEqual(await protectedRows(), before);
        const retry = await fullPreview(runtime);
        assert.equal(retry.totals.imported, 0);
        assert.equal(retry.totals.skipped, 49);
        assert.equal(retry.totals.conflicted, 1);
        for (const e of retry.entries.filter((e) => e.action === "skip"))
          assert.equal(
            canonical(
              e.current[
                e.kind === "site_content" || e.kind === "cms_documents"
                  ? "draft"
                  : "admin_draft"
              ],
            ),
            canonical(e.data),
            e.kind + e.id,
          );
        for (const doc of catalog.documents) {
          const current = (await request("/admin/cms/documents/" + doc.id)).body
            .item;
          assert.equal(canonical(current.draft), canonical(doc));
          const initial = (await request("/cms/documents/" + doc.id)).body;
          assert.equal(initial.state, "uninitialized");
          assert.deepEqual(initial.data, {});
          assert.equal(initial.fallback_allowed, true);
        }
        assert.ok(
          (await request("/admin/full-content-import/export")).body.rows
            .content_history.length,
        );
        const id = catalog.documents.find((d) => d.title === "Navbar")!.id;
        let current = (await request("/admin/cms/documents/" + id)).body.item;
        const revision = current.revision;
        const changed = structuredClone(current.draft);
        const field = changed.groups
          .flatMap((g: any) => g.items)
          .flatMap((i: any) => i.fields)
          .find((f: any) => f.kind === "text");
        field.value = "Approved test label";
        let result = await request(
          "/admin/cms/documents/" + id + "/draft",
          "PUT",
          { revision, data: changed },
        );
        assert.equal(result.status, 200, JSON.stringify(result.body));
        current = result.body.item;
        assert.deepEqual((await request("/cms/documents/" + id)).body.data, {});
        result = await request(
          "/admin/cms/documents/" + id + "/publish",
          "POST",
          { revision: current.revision },
        );
        assert.equal(result.status, 200);
        current = result.body.item;
        assert.equal(
          canonical((await request("/cms/documents/" + id)).body.data),
          canonical(changed),
        );
        assert.ok((await request("/cms/documents/" + id)).body.render_ready);
        for (const action of ["unpublish", "archive", "restore"]) {
          result = await request(
            "/admin/cms/documents/" + id + "/" + action,
            "POST",
            { revision: current.revision },
          );
          assert.equal(result.status, 200);
          current = result.body.item;
          const publicState = (await request("/cms/documents/" + id)).body;
          assert.equal(publicState.fallback_allowed, false);
          assert.deepEqual(publicState.data, {});
        }
        result = await request(
          "/admin/history/cms_documents/" + id + "/restore",
          "POST",
          { revision: current.revision, source_revision: revision },
        );
        assert.equal(result.status, 200, JSON.stringify(result.body));
        current = result.body.item;
        assert.equal(
          canonical(current.draft),
          canonical(catalog.documents.find((d) => d.id === id)),
        );
        assert.deepEqual((await request("/cms/documents/" + id)).body.data, {});
        assert.equal(
          (
            await request(
              "/admin/full-content-import/runs/" + run.run_id + "/rollback",
              "POST",
              { approval: "ROLL BACK UNEDITED IMPORT DRAFTS" },
            )
          ).status,
          409,
        );
        assert.deepEqual(await protectedRows(), before);
        assert.equal(
          (
            await owner.query(
              "SELECT count(*)::int AS n FROM admin_audit WHERE action='static-import-draft'",
            )
          ).rows[0].n,
          49,
        );
      } finally {
        if (server) await new Promise<void>((r) => server.close(() => r()));
        await app?.locals.close();
        await store?.close();
        await runtime?.end();
        await owner.query(`DROP OWNED BY ${role}`);
        await owner.query(`DROP ROLE ${role}`);
      }
    }),
);
test(
  "import rollback is atomic, draft-only, idempotent and refuses concurrent edits without deleting records",
  postgresOptions,
  () =>
    disposable(async (pool) => {
      const preview = await fullPreview(pool);
      assert.equal(preview.totals.imported, 50);
      const result = await applyFullImport(pool, preview.preview_digest);
      assert.equal(result.imported.length, 50);
      const after = await fullPreview(pool);
      assert.equal(after.totals.skipped, 50);
      await assert.rejects(
        applyFullImport(pool, preview.preview_digest),
        /changed after backup/,
      );
      const rollback = await rollbackFullImport(pool, result.run_id);
      assert.equal(rollback.restored, 50);
      const second = await rollbackFullImport(pool, result.run_id);
      assert.equal(second.already_rolled_back, true);
      assert.equal(
        (await pool.query("SELECT count(*)::int AS n FROM works")).rows[0].n,
        12,
      );
      assert.equal(
        (await pool.query("SELECT count(*)::int AS n FROM testimonials"))
          .rows[0].n,
        9,
      );
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM works WHERE is_published IS TRUE OR archived_at IS NULL",
          )
        ).rows[0].n,
        0,
      );
      assert.equal(
        (
          await pool.query(
            "SELECT admin_draft FROM services WHERE id='srv-ac-repair'",
          )
        ).rows[0].admin_draft,
        null,
      );
      assert.ok(
        (
          await pool.query(
            "SELECT 1 FROM content_history WHERE entity='cms_documents'",
          )
        ).rowCount,
      );
      assert.ok(
        (
          await pool.query(
            "SELECT 1 FROM admin_audit WHERE action='static-import-rollback'",
          )
        ).rowCount,
      );
    }),
);
