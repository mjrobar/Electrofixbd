// Native browser regression with synthetic API fixtures only. No database helper,
// credential loading, migrations, real customer records or external delivery.
import assert from "node:assert/strict";
import express from "express";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
for (const key of [
  "DATABASE_URL",
  "MIGRATION_DATABASE_URL",
  "TEST_DATABASE_URL",
  "SECONDARY_DATABASE_URL",
  "SECURITY_DATABASE_URL",
])
  if (process.env[key])
    throw Error("Clear database configuration before UI-only checks: " + key);
if (!process.env.PLAYWRIGHT_MODULE)
  throw Error("Set PLAYWRIGHT_MODULE to an existing Playwright index.mjs.");
const { chromium } = await import(
  pathToFileURL(process.env.PLAYWRIGHT_MODULE).href
);
const output = path.resolve(
  process.env.ADMIN_UPGRADE_UI_OUTPUT || "work/issue29-ui",
);
await mkdir(output, { recursive: true });
const app = express();
app.use("/api", (_req, res) =>
  res
    .status(500)
    .json({ error: "UI fixtures must intercept every API request." }),
);
app.use(express.static(path.resolve("dist/client")));
app.get("*", (_req, res) =>
  res.sendFile(path.resolve("dist/client/index.html")),
);
const server = app.listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_EXECUTABLE === "auto"
    ? {}
    : {
        executablePath: process.env.CHROMIUM_EXECUTABLE || "/usr/bin/chromium",
      }),
  args: ["--no-sandbox"],
});
let page;
try {
  page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    timezoneId: "America/New_York",
    reducedMotion: "reduce",
  });
  const errors = [],
    unexpected = [],
    calls = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.accept());
  await page.addInitScript(() => {
    window.__notifications = [];
    window.__opened = [];
    window.open = (url, target, features) => {
      window.__opened.push({ url, target, features });
      return null;
    };
    window.__permissionRequests = 0;
    window.__visible = "visible";
    window.__online = true;
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => window.__visible,
    });
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      get: () => window.__online,
    });
    window.Notification = class {
      static permission = "default";
      static async requestPermission() {
        window.__permissionRequests++;
        this.permission = "granted";
        return "granted";
      }
      constructor(title, options) {
        window.__notifications.push({ title, ...options });
      }
    };
  });
  await page.clock.install({ time: new Date("2026-10-19T03:00:00Z") });
  const png = await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 0, g: 65, b: 121, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
  const books = Array.from({ length: 36 }, (_, i) => ({
    booking_number: `EFB-20261019-${10000 + i}`,
    customer_name:
      i === 35
        ? "বাংলাদেশের গ্রাহকের দীর্ঘ নাম — Synthetic customer"
        : "Synthetic customer " + i,
    service_name: "Synthetic AC service",
    phone: "01700000000",
    address: "Synthetic address " + "একটিদীর্ঘঠিকানা".repeat(15),
    notes: "Synthetic customer note",
    status: "pending",
    admin_notes: "",
    revision: 0,
    created_at: new Date(
      Date.parse("2026-10-19T02:00:00Z") + i * 1000,
    ).toISOString(),
  }));
  const messages = [
    {
      id: "bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbbb",
      name: "Synthetic message sender",
      phone: "01700000000",
      message: "Original synthetic message. " + "দীর্ঘবার্তা".repeat(80),
      status: "new",
      admin_notes: "",
      revision: 0,
      created_at: "2026-10-19T02:30:00Z",
    },
  ];
  let loggedIn = false,
    change = 0,
    seen = false,
    branding = {
      business_name: "Original fixture business",
      site_title: "Original fixture title",
      phone: "01700000000",
      address: "Preserve this existing business setting",
      logo_url: "",
      favicon_url: "",
    },
    brandRevision = 2,
    published = 0,
    uploads = 0;
  const immutableBook = structuredClone(books[35]);
  await page.route("https://**/*", (r) => r.abort());
  await page.route("**/api/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      p = url.pathname,
      method = request.method();
    calls.push({ p, method, query: url.search });
    const json = (body, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    if (p === "/api/admin/me")
      return json(
        loggedIn
          ? { user: { name: "Administrator", role: "owner" } }
          : { error: "Authentication required." },
        loggedIn ? 200 : 401,
      );
    if (p === "/api/admin/login") {
      loggedIn = true;
      return json({ success: true });
    }
    if (p === "/api/admin/logout" || p === "/api/admin/logout-all") {
      loggedIn = false;
      return json({ success: true });
    }
    if (p === "/api/admin/overview")
      return json({
        today_bookings: books.length,
        bookings: {
          total: books.length,
          pending: books.filter((b) => b.status === "pending").length,
        },
        contacts: {
          total: messages.length,
          unread: messages.filter((m) => m.status === "new").length,
        },
        services: 6,
        works: 12,
        testimonials: 9,
        statuses: [{ status: "pending", total: books.length }],
        days: [],
      });
    if (p === "/api/admin/updates")
      return json({
        server_time: "2026-10-19T03:00:00Z",
        change_token: "fixture-" + change,
        unread: seen ? 0 : books.length,
        total: books.length,
        items: books
          .slice()
          .reverse()
          .slice(0, 20)
          .map((b) => ({
            booking_number: b.booking_number,
            created_at: b.created_at,
          })),
        latest_cursor: "synthetic-signed-cursor",
        read_state: "shared-owner",
      });
    if (p === "/api/admin/updates/seen") {
      seen = true;
      return json({ success: true, unread: 0, read_state: "shared-owner" });
    }
    if (p === "/api/admin/analytics") {
      const period = url.searchParams.get("period") || "day";
      return json({
        period,
        time_zone: "Asia/Dhaka",
        range_label:
          period === "year"
            ? "Last 5 calendar years"
            : period === "month"
              ? "Last 12 calendar months"
              : period === "week"
                ? "Last 12 calendar weeks · Monday start"
                : "Last 30 calendar days",
        points: [
          { day: "2026-10-17", bookings: 1 },
          { day: "2026-10-18", bookings: 3 },
          { day: "2026-10-19", bookings: books.length },
        ],
      });
    }
    if (p === "/api/admin/bookings" || p === "/api/admin/contacts") {
      let rows = p.endsWith("bookings") ? books : messages;
      const q = (url.searchParams.get("q") || "").toLowerCase(),
        status = url.searchParams.get("status") || "all",
        offset = Number(url.searchParams.get("offset") || 0);
      rows = rows
        .filter(
          (r) =>
            (status === "all" || r.status === status) &&
            Object.values(r).join(" ").toLowerCase().includes(q),
        )
        .slice()
        .reverse();
      return json({
        items: rows.slice(offset, offset + 30),
        total: rows.length,
      });
    }
    if (method === "PATCH" && /^\/api\/admin\/(bookings|contacts)\//.test(p)) {
      const rows = p.includes("/bookings/") ? books : messages,
        id = p.split("/").at(-1),
        row = rows.find((r) => (r.booking_number || r.id) === id),
        body = request.postDataJSON();
      assert.deepEqual(
        Object.keys(body).filter(
          (k) => !["revision", "status", "admin_notes"].includes(k),
        ),
        [],
      );
      if (body.revision !== row.revision)
        return json(
          {
            error:
              "Content changed in another session. Reload before retrying.",
            code: "REVISION_CONFLICT",
          },
          409,
        );
      if (body.status !== undefined) row.status = body.status;
      if (body.admin_notes !== undefined) row.admin_notes = body.admin_notes;
      row.revision++;
      change++;
      return json({ item: row });
    }
    if (p.startsWith("/api/admin/booking-receipts/"))
      return json({
        mode: "manual",
        text:
          "ElectroFix BD · Booking receipt\nBooking: " +
          p.split("/").at(-1) +
          "\nService: Synthetic AC service\nReceived: 19 October 2026 (Bangladesh time)\nStatus: pending" +
          (url.searchParams.get("details") === "true"
            ? "\nPhone: 01700000000\nAddress: Synthetic address"
            : ""),
        automatic_delivery: "disabled",
      });
    if (p === "/api/admin/account")
      return json({
        username: "owner",
        storage_enabled: true,
        email_delivery_ready: true,
        verified_email: "verified@example.invalid",
      });
    if (p === "/api/admin/account/password") {
      assert.equal(
        request.postDataJSON().current_password,
        "synthetic-old-password",
      );
      loggedIn = false;
      return json({ success: true, sign_in_required: true });
    }
    if (p === "/api/admin/account/email")
      return json(
        {
          success: true,
          message: "Verification queued. Existing address remains active.",
        },
        202,
      );
    if (p === "/api/admin/integrations")
      return json({
        storage_enabled: true,
        email: {
          configured: false,
          provider: "Resend HTTPS adapter",
          worker_enabled: false,
        },
        whatsapp: {
          configured: false,
          worker_enabled: false,
          recipient_configured: false,
          includes_customer_details: false,
        },
        queue: [],
      });
    if (p === "/api/admin/sessions")
      return json({
        items: [
          {
            current: true,
            last_seen_at: "2026-10-19T03:00:00Z",
            expires_at: "2026-10-19T11:00:00Z",
          },
        ],
      });
    if (p === "/api/admin/audit") return json({ items: [] });
    if (p === "/api/admin/security/readiness")
      return json({ database_hardened: false });
    if (p === "/api/admin/site-content/business_settings")
      return json({
        item: {
          key: "business_settings",
          draft: branding,
          published: {},
          revision: brandRevision,
        },
      });
    if (p === "/api/admin/site-content/business_settings/draft") {
      const body = request.postDataJSON();
      assert.equal(body.revision, brandRevision);
      assert.equal(
        body.data.address,
        "Preserve this existing business setting",
      );
      assert.equal(body.data.phone, "01700000000");
      branding = body.data;
      brandRevision++;
      return json({ item: { draft: branding, revision: brandRevision } });
    }
    if (p === "/api/admin/site-content/business_settings/publish") {
      assert.equal(request.postDataJSON().revision, brandRevision);
      published++;
      brandRevision++;
      return json({
        item: { draft: branding, published: branding, revision: brandRevision },
      });
    }
    if (p === "/api/admin/media" && method === "POST") {
      assert.equal(request.headers()["content-type"], "image/png");
      assert.ok(request.postDataBuffer().length);
      uploads++;
      return json(
        {
          image: {
            id: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
            url: "/api/media/aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
            preview_url:
              "/api/admin/media/aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa/blob",
            width: 512,
            height: 512,
          },
        },
        201,
      );
    }
    if (p.includes("/media/") && p.endsWith("/blob"))
      return route.fulfill({
        status: 200,
        contentType: "image/png",
        body: png,
      });
    if (p === "/api/admin/recovery/status") return json({ available: false });
    unexpected.push(method + " " + p);
    return json({ error: "Unexpected fixture request" }, 500);
  });
  const root = "http://127.0.0.1:" + server.address().port;
  const nav = async (name) => {
    const mobile = page.viewportSize().width < 1024;
    await page
      .locator(mobile ? ".efb-mobile-nav" : ".efb-sidebar-nav")
      .getByRole("button", {
        name: mobile && name === "Website Content" ? "Content" : name,
        exact: true,
      })
      .click();
  };
  const screenshot = async (name) => {
    for (const width of [375, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        "Horizontal overflow " + name + " " + width,
      );
      const activeDialog = page.getByRole("dialog");
      if (await activeDialog.count()) {
        const box = await activeDialog.boundingBox();
        if (width < 640)
          assert.ok(
            Math.abs(box.y + box.height - 1000) < 3,
            "Mobile details must anchor to the bottom",
          );
        else
          assert.ok(
            Math.abs(box.x + box.width - width) < 3,
            "Desktop details must anchor to the right",
          );
      }
      await page.screenshot({
        path: path.join(output, `${name}-${width}.png`),
        fullPage: true,
      });
    }
  };
  await page.goto(root + "/admin");
  await page.getByLabel("Username", { exact: true }).waitFor();
  await screenshot("login");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByLabel("Username", { exact: true }).fill("owner");
  await page
    .getByLabel("Password", { exact: true })
    .fill("synthetic-old-password");
  await page
    .getByRole("button", { name: "Secure sign in", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Business overview", exact: true })
    .waitFor();
  await page.waitForFunction(() => localStorage.getItem("efb-admin-alerts-v1"));
  assert.equal(await page.evaluate(() => window.__permissionRequests), 0);
  await screenshot("overview-light");
  const clock = page.getByLabel("Bangladesh time (Asia/Dhaka)");
  assert.match(await clock.innerText(), /09:/);
  const clockBefore = await clock.innerText();
  await page.clock.fastForward(1000);
  assert.notEqual(await clock.innerText(), clockBefore);
  assert.equal(
    await page
      .locator(".efb-clock-dot")
      .evaluate((e) => getComputedStyle(e).animationName),
    "none",
  );
  for (const period of ["Weekly", "Monthly", "Yearly", "Daily"]) {
    const response = page.waitForResponse((r) =>
      r.url().includes("/api/admin/analytics"),
    );
    await page.getByRole("button", { name: period, exact: true }).click();
    await response;
  }
  await page.getByRole("button", { name: /Booking notifications/ }).click();
  let dialog = page.getByRole("dialog", { name: "Booking notifications" });
  await dialog
    .getByRole("button", { name: "Enable browser notifications" })
    .click();
  assert.equal(await page.evaluate(() => window.__permissionRequests), 1);
  await dialog
    .getByRole("button", { name: "Mark current bookings seen" })
    .click();
  await dialog.getByRole("button", { name: "Close details" }).click();
  await nav("Bookings");
  await page
    .getByRole("button", { name: "Open EFB-20261019-10035", exact: true })
    .waitFor();
  await screenshot("bookings-light");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .getByRole("button", { name: "Open EFB-20261019-10035", exact: true })
    .click();
  dialog = page.getByRole("dialog", { name: "Booking details" });
  await dialog
    .getByLabel("Internal notes")
    .fill("An unsaved synthetic follow-up");
  const before = calls.filter((c) => c.p === "/api/admin/updates").length;
  await page.clock.fastForward(60000);
  assert.equal(
    calls.filter((c) => c.p === "/api/admin/updates").length,
    before,
  );
  assert.equal(
    await dialog.getByLabel("Internal notes").inputValue(),
    "An unsaved synthetic follow-up",
  );
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    assert.ok(
      await dialog.evaluate((d) => d.contains(document.activeElement)),
      "Modal keyboard focus must stay inside the details",
    );
  }
  await screenshot("booking-drawer-light");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await dialog.getByLabel("Status", { exact: true }).selectOption("confirmed");
  await dialog
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await dialog.getByText("Changes saved.", { exact: true }).waitFor();
  assert.equal(books[35].status, "confirmed");
  assert.equal(books[35].customer_name, immutableBook.customer_name);
  assert.equal(books[35].address, immutableBook.address);
  await dialog.getByRole("button", { name: "Preview manual receipt" }).click();
  await dialog.locator(".efb-receipt-preview").waitFor();
  assert.equal(
    (await dialog.locator(".efb-receipt-preview").innerText()).includes(
      "01700000000",
    ),
    false,
  );
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "Preview manual receipt" }).click();
  await dialog.locator(".efb-receipt-preview").waitFor();
  assert.match(
    await dialog.locator(".efb-receipt-preview").innerText(),
    /01700000000/,
  );
  assert.equal(await page.evaluate(() => window.__opened.length), 0);
  await dialog
    .getByRole("button", { name: "Open WhatsApp manually", exact: true })
    .click();
  const shared = await page.evaluate(() => window.__opened[0]);
  assert.match(shared.url, /^https:\/\/wa.me\/\?text=/);
  assert.match(decodeURIComponent(shared.url), /01700000000/);
  assert.equal(shared.features, "noopener,noreferrer");
  await dialog.getByRole("button", { name: "Close details" }).click();
  books.push({
    ...books[0],
    booking_number: "EFB-20261019-19999",
    customer_name: "New synthetic request",
    revision: 0,
    created_at: "2026-10-19T03:05:00Z",
  });
  change++;
  seen = false;
  await page.locator("h1").click();
  await page.clock.fastForward(20000);
  await page.getByText("A new booking has arrived.", { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.__notifications.length), 1);
  await page.clock.fastForward(20000);
  assert.equal(await page.evaluate(() => window.__notifications.length), 1);
  for (const [key, value, event] of [
    ["__visible", "hidden", "visibilitychange"],
    ["__online", false, "offline"],
  ]) {
    await page.evaluate(
      ([key, value, event]) => {
        window[key] = value;
        (event === "visibilitychange" ? document : window).dispatchEvent(
          new Event(event),
        );
      },
      [key, value, event],
    );
    const n = calls.filter((c) => c.p === "/api/admin/updates").length;
    await page.clock.fastForward(60000);
    assert.equal(calls.filter((c) => c.p === "/api/admin/updates").length, n);
    await page.evaluate(
      ([key]) => {
        window[key] = key === "__visible" ? "visible" : true;
      },
      [key],
    );
  }
  await page.getByLabel("Search bookings").fill("no matching fixture");
  await page.locator("h1").click();
  const filterPendingRequests = calls.filter(
    (c) => c.p === "/api/admin/updates",
  ).length;
  await page.clock.fastForward(20000);
  assert.equal(
    calls.filter((c) => c.p === "/api/admin/updates").length,
    filterPendingRequests,
    "Unapplied filter edits must pause polling after blur",
  );

  await page.getByRole("button", { name: "Apply filters" }).click();
  await page.getByRole("heading", { name: "No matching requests" }).waitFor();
  await page.getByLabel("Search bookings").fill("");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await page
    .getByRole("button", { name: "Open EFB-20261019-19999", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Previous", exact: true }).waitFor();
  // The existing button is visible while the next-page request is loading.
  // Wait for the completed transition before asserting its enabled state.
  await page.waitForFunction(() =>
    [...document.querySelectorAll("button")].some(
      (button) => button.textContent.trim() === "Previous" && !button.disabled,
    ),
  );
  assert.ok(
    !(await page
      .getByRole("button", { name: "Previous", exact: true })
      .isDisabled()),
  );
  await nav("Messages");
  await page
    .getByRole("button", { name: "Open message from Synthetic message sender" })
    .click();
  dialog = page.getByRole("dialog", { name: "Message details" });
  await screenshot("message-drawer-light");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await dialog.getByLabel("Status", { exact: true }).selectOption("replied");
  await dialog.getByLabel("Internal notes").fill("Synthetic phone follow-up");
  await dialog
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await dialog
    .getByText("Marked as replied for tracking. No reply was sent.", {
      exact: true,
    })
    .waitFor();
  assert.equal(messages[0].status, "replied");
  await dialog.getByRole("button", { name: "Close details" }).click();
  await screenshot("messages-light");
  await nav("Settings");
  await page
    .getByRole("heading", { name: "Owner account", exact: true })
    .waitFor();
  await screenshot("account-light");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .getByRole("button", { name: "Website branding", exact: true })
    .click();
  await page
    .getByLabel("Business name", { exact: true })
    .fill("Reviewed fixture brand");
  await page
    .getByLabel("Website document title")
    .fill("Reviewed fixture title");
  await page.getByLabel("Choose logo image").setInputFiles({
    name: "synthetic.png",
    mimeType: "image/png",
    buffer: png,
  });
  await page.getByRole("button", { name: "Upload reviewed crop" }).click();
  await page.getByAltText("Primary logo preview at 48px").waitFor();
  assert.equal(uploads, 1);
  await page.getByRole("button", { name: "Save branding draft" }).click();
  await page
    .getByText(
      "Branding draft saved in the existing business settings. Nothing was published.",
      { exact: true },
    )
    .waitFor();
  assert.equal(branding.phone, "01700000000");
  await page
    .getByRole("button", { name: "Publish saved Business settings" })
    .click();
  await page.waitForFunction(() =>
    document.body.innerText.includes("Business settings published to the API."),
  );
  assert.equal(published, 1);
  await screenshot("branding-light");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .getByRole("button", { name: "Delivery integrations", exact: true })
    .click();
  await screenshot("delivery-light");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .getByRole("button", { name: "Sessions & audit", exact: true })
    .click();
  await screenshot("security-light");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Use dark mode" }).click();
  await nav("Overview");
  await screenshot("overview-dark");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await nav("Bookings");
  await screenshot("bookings-dark");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .getByRole("button", { name: "Open EFB-20261019-19999", exact: true })
    .click();
  await screenshot("booking-drawer-dark");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Close details" }).click();
  await nav("Messages");
  await screenshot("messages-dark");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await nav("Settings");
  await screenshot("account-dark");
  await page.reload();
  await page
    .getByRole("heading", { name: "Business overview", exact: true })
    .waitFor();
  assert.equal(await page.locator(".efb-admin-dark").count(), 1);
  assert.equal(
    await page.evaluate(() => window.__notifications.length),
    0,
    "Reload must not duplicate prior alerts",
  );
  assert.equal(
    await page.evaluate(() => window.__permissionRequests),
    0,
    "Permission must never be requested automatically",
  );
  assert.deepEqual(unexpected, []);
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      result: "PASS",
      widths: [375, 390, 768, 1440],
      themes: ["light", "dark"],
      checks: [
        "login",
        "booking/message list and drawer",
        "existing PATCH contracts/revisions",
        "private notes",
        "manual receipt opt-in",
        "20-second refresh",
        "hidden/offline/modal gates",
        "dedup/reload",
        "permission gesture",
        "clock/timezone/reduced motion",
        "search/pagination",
        "branding crop/upload/save/publish preserves other settings",
        "account/recovery/integration states",
        "CMS-independent navigation",
      ],
      database: "none",
      external_delivery: "none",
      screenshots: output,
    }),
  );
} catch (error) {
  if (page)
    await page
      .screenshot({ path: path.join(output, "failure.png"), fullPage: true })
      .catch(() => {});
  throw error;
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
