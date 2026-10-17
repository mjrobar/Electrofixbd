// Optional browser check: no project dependency or browser binary is installed by this script.
// Run with TEST_DATABASE_URL pointing to a disposable local cluster and PLAYWRIGHT_MODULE
// pointing to an installed Playwright index.mjs. Build the client first. Every mutation is in a new random test DB.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { createServer } from "node:http";
import { scryptSync } from "node:crypto";
import { createDisposable } from "./helpers/disposable-postgres.ts";
import { startServer } from "../server/node.ts";
import { createStore } from "../server/store.ts";
import { loadConfig } from "../server/config.ts";
if (!process.env.PLAYWRIGHT_MODULE)
  throw Error(
    "Set PLAYWRIGHT_MODULE to the absolute path of an installed Playwright index.mjs.",
  );
const { chromium } = await import(
  pathToFileURL(process.env.PLAYWRIGHT_MODULE).href
);
const resource = await createDisposable();
const store = createStore(
  loadConfig({ NODE_ENV: "test", DATABASE_URL: resource.url }),
);
let app, browser;
try {
  await store.createBooking({
    customer_name: "Issue 11 browser customer",
    phone: "01700000000",
    address: "Synthetic local test address",
    notes: "Test only",
    service_id: "srv-general",
  });
  await store.createContact({
    name: "Issue 11 browser sender",
    phone: "01700000000",
    message: "Synthetic local browser message",
  });
  const reservation = createServer();
  await new Promise((resolve) => reservation.listen(0, "127.0.0.1", resolve));
  const port = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));
  const root = `http://127.0.0.1:${port}`;
  app = await startServer({
    NODE_ENV: "test",
    HOST: "127.0.0.1",
    PORT: String(port),
    DATABASE_URL: resource.url,
    PUBLIC_ORIGIN: root,
    TRUST_PROXY: "false",
    ADMIN_USERNAME: "test-admin",
    ADMIN_PASSWORD_HASH:
      "local-test-salt:" +
      scryptSync("test-password", "local-test-salt", 64).toString("hex"),
    ADMIN_SESSION_SECRET: "disposable-browser-session-secret-12345678",
  });
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      timezoneId: "Asia/Dhaka",
    }),
    errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("dialog", (dialog) => dialog.accept());
  const output = path.resolve(process.env.ADMIN_UI_OUTPUT || "work/admin-ui");
  await mkdir(output, { recursive: true });
  async function shots(name) {
    for (const width of [375, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.waitForTimeout(400);
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        "overflow " + name + " " + width,
      );
      if (name === "content") {
        const search = page.getByLabel("Search content");
        assert.ok(
          (await search.boundingBox()).width >= 150,
          "Content search needs usable touch width",
        );
      }
      await page.screenshot({
        path: `${output}/${name}-${width}.png`,
        fullPage: true,
      });
    }
  }
  async function nav(name) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole("button", { name, exact: true }).click();
  }
  await page.goto(root + "/admin");
  await page.getByLabel("Username").waitFor();
  await shots("login");
  await page.getByLabel("Username").fill("test-admin");
  await page.getByLabel("Password", { exact: true }).fill("test-password");
  await page.locator("form button").click();
  await page.getByRole("heading", { name: "Business overview" }).waitFor();
  await shots("dashboard");
  await nav("Website Content");
  const services = page.getByRole("region", { name: "services management" });
  await services.getByRole("button", { name: "Add new", exact: true }).click();
  const slug = "issue11-browser-" + Date.now(),
    title = "Issue 11 browser draft " + Date.now();
  await services.getByLabel("URL slug").fill(slug);
  await services.getByLabel("Service title").fill(title);
  await services.getByLabel("Short description").fill("Short draft summary");
  await services
    .getByLabel("Full description")
    .fill("Full reviewed service description");
  await services
    .getByLabel("Common problems (one per line)")
    .fill("First problem\nSecond problem");
  await services
    .getByRole("button", { name: "Preview draft", exact: true })
    .click();
  await services
    .getByRole("button", { name: "Save draft", exact: true })
    .click();
  await services
    .getByRole("status")
    .filter({ hasText: "Draft saved" })
    .waitFor();
  let result = await (
    await page.request.get(root + "/api/services?limit=100")
  ).json();
  assert.ok(!result.services.some((s) => s.slug === slug));
  let article = services
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
  await article.getByRole("button", { name: "Publish", exact: true }).click();
  await services
    .getByRole("status")
    .filter({ hasText: "publish confirmed" })
    .waitFor();
  result = await (
    await page.request.get(root + "/api/services?limit=100")
  ).json();
  assert.ok(
    result.services.some(
      (s) => s.slug === slug && s.common_problems.length === 2,
    ),
  );
  await article
    .getByRole("button", { name: "Edit draft", exact: true })
    .click();
  await services.getByLabel("Service title").fill("Issue 11 pending version");
  await services
    .getByRole("button", { name: "Save draft", exact: true })
    .click();
  await services
    .getByRole("status")
    .filter({ hasText: "Draft saved" })
    .waitFor();
  article = services
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
  await article.getByRole("button", { name: "Version history" }).click();
  const historical = article
    .locator("details")
    .filter({ hasText: "Revision 0" })
    .last();
  await historical.locator("summary").click();
  await historical.getByRole("button", { name: "Restore as draft" }).click();
  await services
    .getByRole("status")
    .filter({ hasText: "Earlier version restored" })
    .waitFor();
  await article.getByRole("button", { name: "Archive", exact: true }).click();
  await services
    .getByRole("status")
    .filter({ hasText: "archive confirmed" })
    .waitFor();
  await services.getByLabel("Publication").selectOption("archived");
  await services.getByRole("button", { name: "Search / refresh" }).click();
  await services
    .getByRole("button", { name: "Restore archived item" })
    .first()
    .click();
  await services
    .getByRole("status")
    .filter({ hasText: "restore confirmed" })
    .waitFor();
  await page.route("**/api/admin/content/works?*", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: '{"error":"Simulated storage failure"}',
    }),
  );
  await page.getByRole("button", { name: "works", exact: true }).click();
  const works = page.getByRole("region", { name: "works management" });
  await works
    .getByRole("alert")
    .filter({ hasText: "Simulated storage failure" })
    .waitFor();
  assert.equal(
    await works
      .getByRole("button", { name: "Add new", exact: true })
      .isDisabled(),
    true,
  );
  await page.unroute("**/api/admin/content/works?*");
  await works.getByRole("button", { name: "Search / refresh" }).click();
  await works.getByRole("heading", { name: /^works \(/ }).waitFor();
  await shots("content");
  await nav("Bookings");
  await page.getByRole("heading", { name: "Manage bookings" }).waitFor();
  await page.getByLabel("Search bookings").fill("Issue 11 browser customer");
  await page.getByRole("button", { name: "Search / reload" }).click();
  const booking = page
    .locator("article")
    .filter({
      has: page.getByRole("heading", { name: "Issue 11 browser customer" }),
    })
    .first();
  await booking.getByLabel("Booking status").selectOption("confirmed");
  await page
    .getByRole("status")
    .filter({ hasText: "Saved to PostgreSQL" })
    .waitFor();
  await booking
    .getByLabel("Internal notes")
    .fill("Synthetic private browser note");
  await booking.getByRole("button", { name: "Save internal notes" }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Saved to PostgreSQL" })
    .waitFor();
  await shots("bookings");
  await nav("Messages");
  await page.getByRole("heading", { name: "Customer inbox" }).waitFor();
  await page.getByLabel("Search contacts").fill("Issue 11 browser sender");
  await page.getByRole("button", { name: "Search / reload" }).click();
  const message = page
    .locator("article")
    .filter({
      has: page.getByRole("heading", { name: "Issue 11 browser sender" }),
    })
    .first();
  await message.getByLabel("Message status").selectOption("replied");
  await page
    .getByRole("status")
    .filter({ hasText: "Saved to PostgreSQL" })
    .waitFor();
  await shots("messages");
  await nav("Settings");
  await page
    .getByRole("heading", { name: "Active sessions", exact: false })
    .waitFor();
  await shots("settings");
  await page.getByRole("button", { name: "Revoke all sessions" }).click();
  await page.getByLabel("Username").waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: create/draft/publish, multiline fields, previews, version restore, archive recovery, failed-load recovery, session revocation and six admin views at 375/768/1440.",
  );
} finally {
  await browser?.close();
  await app?.close();
  await store.close();
  await resource.close();
}
