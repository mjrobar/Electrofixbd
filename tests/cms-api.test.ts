import {
  assertSiteMediaReferences,
  createPublicSiteControlsRouter,
} from "../server/site-controls";
import assert from "node:assert/strict";
import { test } from "node:test";
import express from "express";
import type pg from "pg";
import { createHmac } from "node:crypto";
import { createCmsRouter, createPublicCmsRouter } from "../server/cms";
import {
  createFullImportRouter,
  fullImportApproval,
} from "../server/full-content-import";
import { errorHandler } from "../server/errors";
import catalog from "../server/full-content-catalog.json";
async function serve(
  app: express.Express,
  run: (
    request: (path: string, method?: string, body?: unknown) => Promise<any>,
  ) => Promise<void>,
) {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  try {
    await run(async (path, method = "GET", body) => {
      const r = await fetch(
        "http://127.0.0.1:" + (server.address() as any).port + path,
        {
          method,
          headers: { "Content-Type": "application/json" },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        },
      );
      return { status: r.status, headers: r.headers, body: await r.json() };
    });
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
}
test("CMS API validates immutable bindings and exposes authoritative empty publications without using a database", async () => {
  const doc = catalog.documents.find((d) => d.title === "Navbar")!,
    queries: string[] = [];
  const database = {
    query: async (sql: string) => {
      queries.push(sql);
      return {
        rows: sql.includes("SELECT published")
          ? [{ published: {}, publication_state: "unpublished", revision: 4 }]
          : [
              {
                id: doc.id,
                draft: doc,
                published: {},
                revision: 4,
                publication_state: "unpublished",
              },
            ],
      };
    },
  } as unknown as pg.Pool;
  const app = express();
  app.use(express.json());
  app.use("/admin", createCmsRouter(database));
  app.use("/api", createPublicCmsRouter(database));
  app.use(errorHandler);
  await serve(app, async (request) => {
    const empty = await request("/api/cms/documents/" + doc.id);
    assert.equal(empty.status, 200);
    assert.equal(empty.body.fallback_allowed, false);
    assert.deepEqual(empty.body.data, {});
    assert.equal(empty.body.render_ready, null);
    assert.equal(empty.headers.get("cache-control"), "no-store");
    const unknown = await request("/api/cms/documents/unknown");
    assert.equal(unknown.status, 404);
    const malformed = structuredClone(doc);
    malformed.actions[0].binding = "execute arbitrary code";
    const count = queries.length;
    assert.equal(
      (
        await request("/admin/cms/documents/" + doc.id + "/draft", "PUT", {
          revision: 4,
          data: malformed,
        })
      ).status,
      400,
    );
    assert.equal(queries.length, count);
  });
});
test("full import is disabled by default and malformed/expired approval never reaches SQL", async () => {
  let queries = 0;
  const database = {
    query: async () => {
      queries++;
      throw Error("No database allowed");
    },
    connect: async () => {
      queries++;
      throw Error("No database allowed");
    },
  } as unknown as pg.Pool;
  const secret = "unit-test-private-secret";
  const app = express();
  app.use(express.json());
  app.use("/disabled", createFullImportRouter(database, secret));
  app.use(
    "/enabled",
    createFullImportRouter(database, secret, {
      enabled: true,
      label: "Unit mock only",
    }),
  );
  app.use(errorHandler);
  await serve(app, async (request) => {
    assert.equal(
      (await request("/disabled/full-content-import/apply", "POST", {})).status,
      409,
    );
    assert.equal(
      (
        await request(
          "/disabled/full-content-import/runs/00000000-0000-4000-a000-000000000000/rollback",
          "POST",
          { approval: "ROLL BACK UNEDITED IMPORT DRAFTS" },
        )
      ).status,
      409,
    );
    assert.equal(queries, 0);
    const data = {
      approval: fullImportApproval,
      approval_token: "invalid",
      acknowledge_conflicts: true,
    };
    assert.equal(
      (await request("/enabled/full-content-import/apply", "POST", data))
        .status,
      409,
    );
    assert.equal(queries, 0);
    const payload = "a".repeat(64) + "." + "b".repeat(64) + ".1",
      signature = createHmac("sha256", secret).update(payload).digest("hex");
    assert.equal(
      (
        await request("/enabled/full-content-import/apply", "POST", {
          ...data,
          approval_token: payload + "." + signature,
        })
      ).status,
      409,
    );
    assert.equal(queries, 0);
    const failed = await request("/enabled/full-content-import/backup");
    assert.equal(failed.status, 503);
    assert.equal(failed.body.approval_token, undefined);
    assert.equal(failed.body.success, undefined);
  });
});

test("managed empty collections remain authoritative in one read-only snapshot", async () => {
  const statements: string[] = [];
  const client = {
    release() {},
    async query(sql: string) {
      statements.push(sql);
      return {
        rows: sql.includes("SELECT state") ? [{ state: "unpublished" }] : [],
      };
    },
  };
  const app = express();
  app.use(
    "/api",
    createPublicCmsRouter({ connect: async () => client } as any),
  );
  app.use(errorHandler);
  await serve(app, async (request) => {
    const response = await request("/api/cms/collections/testimonials");
    assert.equal(response.status, 200);
    assert.deepEqual(response.body.items, []);
    assert.equal(response.body.fallback_allowed, false);
    assert.equal(response.body.state, "unpublished");
    assert.equal(
      statements[0],
      "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY",
    );
    assert.equal(statements.at(-1), "COMMIT");
  });
});

test("draft-only legacy modules keep fallback and uploaded site images cannot reuse pending review assets", async () => {
  const app = express();
  app.use(
    "/api/site-content",
    createPublicSiteControlsRouter({
      query: async () => ({
        rows: [{ published: [], state: "uninitialized", revision: 1 }],
      }),
    } as any),
  );
  await serve(app, async (request) => {
    const response = await request("/api/site-content/hero_slides");
    assert.equal(response.body.fallback_allowed, true);
    assert.deepEqual(response.body.data, []);
  });
  const image = "/api/media/00000000-0000-4000-a000-000000000000";
  let queries = 0;
  const privateAsset = {
    query: async () => {
      queries++;
      return { rows: [{ owner_type: "review", review_id: "pending-review" }] };
    },
  };
  await assert.rejects(
    assertSiteMediaReferences(privateAsset as any, [{ image_url: image }]),
    /not available/,
  );
  assert.equal(queries, 1);
  await assertSiteMediaReferences(
    { query: async () => ({ rows: [{ owner_type: "admin" }] }) } as any,
    { about_image_url: image },
  );
});
