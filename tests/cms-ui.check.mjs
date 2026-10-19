// UI-only regression: all API requests are intercepted with synthetic in-memory fixtures.
// Does not import a database helper, connect to PostgreSQL, migrate, or import data.
import assert from "node:assert/strict";
import express from "express";
import { readFile, mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { documentSchema } from "../server/cms-contract.ts";
import { buildFullPreview } from "../server/full-content-import.ts";
const catalog = JSON.parse(
  await readFile(
    new URL("../server/full-content-catalog.json", import.meta.url),
    "utf8",
  ),
);
if (!process.env.PLAYWRIGHT_MODULE)
  throw Error("Set PLAYWRIGHT_MODULE to an installed Playwright index.mjs.");
const { chromium } = await import(
  pathToFileURL(process.env.PLAYWRIGHT_MODULE).href
);
const app = express();
app.use("/api", (_req, res) =>
  res.status(500).json({
    error: "Unexpected API request: UI mocks must intercept every API call.",
  }),
);
app.use(express.static(path.resolve("dist/client")));
app.get("*", (_req, res) =>
  res.sendFile(path.resolve("dist/client/index.html")),
);
const server = app.listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_EXECUTABLE || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    }),
    errors = [],
    requests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.accept());
  const records = new Map(
    catalog.documents.map((d) => [
      d.id,
      {
        id: d.id,
        title: d.title,
        source_path: d.source_path,
        mapping_version: 2,
        draft: structuredClone(d),
        published: {},
        revision: 1,
        publication_state: "uninitialized",
      },
    ]),
  );
  const history = new Map();
  const preview = buildFullPreview({
    format: "ui-mock-only",
    schema_version: 6,
    rows: {},
  });
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url()),
      p = url.pathname,
      method = route.request().method();
    requests.push(method + " " + p);
    const json = async (body, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    if (p === "/api/admin/me")
      return json({ user: { name: "UI fixture owner", role: "owner" } });
    if (p === "/api/admin/overview")
      return json({
        bookings: { total: 0, pending: 0 },
        contacts: { total: 0, unread: 0 },
        services: 6,
        works: 12,
        testimonials: 9,
        days: [],
        statuses: [],
        audit: [],
      });
    if (
      p === "/api/admin/bookings" ||
      p === "/api/admin/contacts" ||
      p.startsWith("/api/admin/content/")
    )
      return json({ items: [], total: 0 });
    if (p === "/api/admin/service-categories") return json({ items: [] });
    if (p === "/api/admin/cms/documents")
      return json({
        definitions: catalog.documents.map((d) => ({
          id: d.id,
          title: d.title,
          source_path: d.source_path,
          field_count: d.groups.reduce(
            (n, g) => n + g.items.reduce((m, i) => m + i.fields.length, 0),
            0,
          ),
          action_count: d.actions.length,
        })),
        items: [...records.values()],
      });
    if (p.startsWith("/api/admin/cms/documents/")) {
      const parts = p.split("/"),
        id = parts[5],
        item = records.get(id),
        action = parts[6];
      if (!item) return json({ error: "Unknown fixture" }, 404);
      if (method === "GET")
        return json({
          item,
          template: catalog.documents.find((d) => d.id === id),
        });
      const body = route.request().postDataJSON();
      if (body.revision !== item.revision)
        return json({ error: "Fixture revision conflict" }, 409);
      if (action === "draft") {
        const valid = documentSchema.safeParse(body.data);
        if (!valid.success)
          return json({ error: valid.error.issues[0].message }, 400);
        history.set(id, [
          ...(history.get(id) || []),
          {
            revision: item.revision,
            snapshot: structuredClone(item),
            saved_at: new Date().toISOString(),
          },
        ]);
        item.draft = valid.data;
        item.revision++;
        return json({ item });
      }
      if (action === "publish") {
        item.published = structuredClone(item.draft);
        item.publication_state = "published";
      } else if (action === "unpublish") {
        item.published = {};
        item.publication_state = "unpublished";
      }
      item.revision++;
      return json({ item });
    }
    if (p.startsWith("/api/admin/history/cms_documents/")) {
      const id = p.split("/")[5],
        item = records.get(id);
      if (method === "GET") return json({ items: history.get(id) || [] });
      const body = route.request().postDataJSON(),
        old = (history.get(id) || []).find(
          (h) => h.revision === body.source_revision,
        );
      item.draft = structuredClone(old.snapshot.draft);
      item.revision++;
      return json({ item });
    }
    if (p.startsWith("/api/admin/history/")) return json({ items: [] });
    if (p.startsWith("/api/admin/site-content/"))
      return json({ item: { draft: [], published: [], revision: 0 } });
    if (p === "/api/admin/full-content-import/runs") return json({ items: [] });
    if (p === "/api/admin/full-content-import/preview")
      return json({
        ...preview,
        target: { enabled: false, label: "UI fixture only — no database" },
      });
    return json({ error: "Unmocked API " + p }, 500);
  });
  await page.goto("http://127.0.0.1:" + server.address().port + "/admin");
  await page
    .getByRole("button", { name: "Website Content", exact: true })
    .click();
  const cms = page.getByRole("region", { name: "Complete website CMS" });
  await cms
    .getByLabel("Website section")
    .selectOption("ui_components_layout_navbar");
  const group = cms
    .locator("details")
    .filter({ has: page.locator("summary", { hasText: "nav Links" }) })
    .first();
  await group.locator("summary").first().click();
  await group
    .getByLabel("name", { exact: true })
    .first()
    .fill("Reviewed home label");
  await cms
    .getByRole("button", { name: "Preview section draft", exact: true })
    .click();
  assert.equal((await cms.textContent()).includes("[object Object]"), false);
  const output = path.resolve(process.env.ADMIN_UI_OUTPUT || "work/cms-ui");
  await mkdir(output, { recursive: true });
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await cms.evaluate((el) => {
      el.scrollIntoView({ block: "start" });
      window.scrollBy(0, -90);
    });
    await page.waitForTimeout(400);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "CMS overflow at " + width,
    );
    await page.screenshot({ path: path.join(output, "cms-" + width + ".png") });
  }
  await cms
    .getByRole("button", { name: "Save section draft", exact: true })
    .click();
  await cms.getByText("Draft saved. Publication is unchanged.").waitFor();
  assert.equal(
    records.get("ui_components_layout_navbar").published &&
      Object.keys(records.get("ui_components_layout_navbar").published).length,
    0,
  );
  await cms
    .getByRole("button", { name: "Publish section", exact: true })
    .click();
  await cms.getByText("Section publish confirmed.").waitFor();
  assert.equal(
    records.get("ui_components_layout_navbar").publication_state,
    "published",
  );
  await cms
    .getByRole("button", { name: "Unpublish section", exact: true })
    .click();
  await cms.getByText("Section unpublish confirmed.").waitFor();
  assert.deepEqual(records.get("ui_components_layout_navbar").published, {});
  const importer = page.getByRole("region", {
    name: "Existing content import",
  });
  await importer
    .getByRole("button", { name: "Preview import", exact: true })
    .click();
  await importer.getByText(/50 eligible/).waitFor();
  await importer.getByText(/UI fixture only/).waitFor();
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await importer.evaluate((el) => {
      el.scrollIntoView({ block: "start" });
      window.scrollBy(0, -90);
    });
    await page.waitForTimeout(400);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "Import preview overflow at " + width,
    );
    await page.screenshot({
      path: path.join(output, "import-" + width + ".png"),
    });
  }
  assert.deepEqual(errors, []);
  assert.ok(
    requests.includes(
      "PUT /api/admin/cms/documents/ui_components_layout_navbar/draft",
    ),
  );
  console.log(
    "PASS: mocked CMS edit/preview/save/publish/unpublish and complete import preview at 375/768/1440. No database was connected or modified.",
  );
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
