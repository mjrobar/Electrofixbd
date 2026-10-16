import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { test } from "node:test";
import pg from "pg";
import { migrate } from "../scripts/migrate";
import { createStore } from "../server/store";
import { createApp } from "../server/app";
import { createVercelHandler } from "../server/vercel";
import { loadConfig } from "../server/config";

const url = process.env.TEST_DATABASE_URL;
test(
  "all five PostgreSQL tables: content persistence, publication filters and adapter API contracts",
  {
    skip: !url
      ? "Set TEST_DATABASE_URL to a disposable local database."
      : false,
  },
  async () => {
    const target = new URL(url!);
    assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(target.hostname));
    assert.match(target.pathname, /test/);
    await migrate(url!);
    const db = new pg.Client({ connectionString: url });
    await db.connect();
    const marker = randomUUID();
    const workId = randomUUID(),
      hiddenWorkId = randomUUID(),
      reviewId = randomUUID(),
      hiddenReviewId = randomUUID();
    let store = createStore(
      loadConfig({ NODE_ENV: "test", DATABASE_URL: url }),
    );
    const config = loadConfig({
      NODE_ENV: "test",
      DATABASE_URL: url,
      API_RATE_LIMIT: "1000",
    });
    try {
      await db.query(
        `INSERT INTO works(id,title,slug,service_type,category,description,media_url,media_type,is_featured,is_published)
      VALUES ($1,'Published video',$2,'AC',$3,'Description','https://example.test/work.mp4','video',true,true),
      ($4,'Private work',$5,'AC',$3,'Private','https://example.test/private.jpg','image',false,false)`,
        [workId, marker, marker, hiddenWorkId, marker + "-hidden"],
      );
      await db.query(
        `INSERT INTO testimonials(id,customer_name,review,service_type,rating,avatar_url,media_url,media_type,is_published)
      VALUES ($1,'Published reviewer',$2,'AC',4,'https://example.test/avatar.jpg','https://example.test/review.mp4','video',true),
      ($3,'Private reviewer',$2,'AC',1,NULL,NULL,NULL,false)`,
        [reviewId, marker, hiddenReviewId],
      );
      await store.close();
      store = createStore(config);
      const works = await store.listWorks({
        limit: 20,
        offset: 0,
        category: marker,
        featured: true,
      });
      assert.equal(works.length, 1);
      assert.equal(works[0].id, workId);
      assert.equal(works[0].media_type, "video");
      const reviews = await store.listTestimonials({ limit: 100, offset: 0 });
      assert.ok(
        reviews.some(
          (row) =>
            row.id === reviewId &&
            row.rating === 4 &&
            row.media_type === "video",
        ),
      );
      assert.ok(!reviews.some((row) => row.id === hiddenReviewId));
      assert.ok(
        (await store.listServices({ limit: 100, offset: 0 })).some(
          (row) => row.id === "srv-ac-repair",
        ),
      );
      for (const adapter of [false, true]) {
        const app = createApp({ config, store });
        const server = createServer(
          adapter ? createVercelHandler(() => app) : app,
        );
        await new Promise<void>((resolve) =>
          server.listen(0, "127.0.0.1", resolve),
        );
        const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
        try {
          for (const route of [
            "/api/services",
            "/api/works",
            "/api/testimonials",
          ]) {
            const response = await fetch(base + route);
            assert.equal(response.status, 200);
            const body = await response.json();
            assert.equal(body.success, true);
            assert.equal(body.pagination.limit, 20);
            const post = await fetch(base + route, { method: "POST" });
            assert.equal(post.status, 405);
          }
          const response = await fetch(
            base + "/api/works?category=" + marker + "&featured=true&limit=1",
          );
          const body = await response.json();
          assert.equal(body.works.length, 1);
          assert.equal(body.works[0].id, workId);
          assert.equal(
            (
              await (
                await fetch(
                  base + "/api/works?category=" + marker + "&offset=1",
                )
              ).json()
            ).works.length,
            0,
          );
          for (const route of [
            "/api/works?limit=101",
            "/api/works?featured=yes",
            "/api/testimonials?offset=-1",
            "/api/services?unexpected=true",
          ])
            assert.equal((await fetch(base + route)).status, 400);
          const injection = await fetch(
            base + "/api/works?category=" + encodeURIComponent("' OR 1=1 --"),
          );
          assert.deepEqual((await injection.json()).works, []);
          assert.equal((await fetch(base + "/api/status")).status, 200);
        } finally {
          server.closeAllConnections();
          await new Promise<void>((resolve) => server.close(() => resolve()));
        }
      }
      // Prove rows are not fabricated by the content repositories.
      assert.equal(
        (
          await db.query(
            "SELECT media_url,rating,is_published FROM testimonials WHERE id=$1",
            [reviewId],
          )
        ).rows[0].rating,
        4,
      );
    } finally {
      await store.close();
      await db.query("DELETE FROM works WHERE id=ANY($1::uuid[])", [
        [workId, hiddenWorkId],
      ]);
      await db.query("DELETE FROM testimonials WHERE id=ANY($1::uuid[])", [
        [reviewId, hiddenReviewId],
      ]);
      await db.end();
    }
  },
);
