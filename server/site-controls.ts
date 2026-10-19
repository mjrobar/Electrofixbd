import { assertMediaReferences } from "./media-storage";
import { ApiError } from "./errors";
import { transaction } from "./db/transaction";
import { mediaUrl } from "./media";
import { Router } from "express";
import { z } from "zod";
import type pg from "pg";

const link = mediaUrl;
const entry = z
  .object({
    source_id: z.number().int().optional(),
    source_flags: z
      .object({
        isPhoneCall: z.boolean().optional(),
        isWhatsApp: z.boolean().optional(),
        isNavigateServices: z.boolean().optional(),
      })
      .strict()
      .optional(),
    id: z.string().trim().min(1).max(100),
    title: z.string().trim().max(250).default(""),
    subtitle: z.string().trim().max(500).default(""),
    description: z.string().trim().max(5000).default(""),
    image_url: link.default(""),
    button_label: z.string().trim().max(100).default(""),
    button_url: link.default(""),
    actions_configured: z.boolean().default(false),
    badge: z.string().trim().max(250).default(""),
    primary_action: z
      .enum(["booking", "navigate", "phone", "whatsapp"])
      .default("booking"),
    service_hint: z.string().trim().max(150).default(""),
    secondary_label: z.string().trim().max(100).default(""),
    secondary_action: z
      .enum(["none", "booking", "navigate", "phone", "whatsapp"])
      .default("none"),
    secondary_url: link.default(""),
    is_active: z.boolean().default(true),
  })
  .strict();
const faq = z
  .object({
    id: z.string().trim().min(1).max(100),
    question: z.string().trim().min(2).max(500),
    answer: z.string().trim().min(2).max(5000),
    category: z.string().trim().max(120).default("General"),
    is_active: z.boolean().default(true),
  })
  .strict();
const businessSettings = z
  .object({
    business_name: z.string().trim().max(150).default(""),
    phone: z.string().trim().max(40).default(""),
    whatsapp: z.string().trim().max(40).default(""),
    email: z.union([z.literal(""), z.string().email().max(250)]).default(""),
    address: z.string().trim().max(1000).default(""),
    hours: z.string().trim().max(250).default(""),
    facebook_url: link.default(""),
    youtube_url: link.default(""),
    logo_url: link.default(""),
    favicon_url: link.optional(),
    site_title: z.string().trim().max(150).optional(),
    short_name: z.string().trim().max(100).default(""),
    tagline: z.string().trim().max(500).default(""),
    service_coverage: z.string().trim().max(500).default(""),
    experience: z.string().trim().max(250).default(""),
    circuit_board_specialty: z.string().trim().max(500).default(""),
    phone_clean: z.string().trim().max(40).default(""),
    phone_international: z.string().trim().max(40).default(""),
    about_image_url: link.default(""),
  })
  .strict();
const page = z
  .object({
    id: z.string().trim().min(1).max(100),
    page: z.enum(["home", "services", "works", "contact", "about"]),
    section: z.string().trim().min(1).max(100),
    heading: z.string().trim().max(250),
    body: z.string().trim().max(8000).default(""),
    description: z.string().trim().max(8000).default(""),
    image_url: link.default(""),
    eyebrow: z.string().trim().max(250).default(""),
    eyebrow_secondary: z.string().trim().max(250).default(""),
    group_heading: z.string().trim().max(250).default(""),
    highlights: z
      .array(
        z
          .object({
            id: z.string().trim().min(1).max(100),
            icon: z
              .enum([
                "cpu",
                "map-pin",
                "settings",
                "shield-check",
                "check-circle",
                "clock",
                "wrench",
                "headphones",
                "tag",
                "none",
              ])
              .default("none"),
            title: z.string().trim().max(250),
            subtitle: z.string().trim().max(500).default(""),
            description: z.string().trim().max(3000).default(""),
          })
          .strict(),
      )
      .max(30)
      .default([]),
    actions: z
      .array(
        z
          .object({
            id: z.string().trim().min(1).max(100),
            label: z.string().trim().max(150),
            action: z.enum(["booking", "phone", "whatsapp", "navigate"]),
            url: link.default(""),
          })
          .strict(),
      )
      .max(15)
      .default([]),
    statistics: z
      .array(
        z
          .object({
            id: z.string().trim().min(1).max(100),
            value: z.number().int().min(0).max(100000000),
            suffix: z.string().trim().max(20).default(""),
            label: z.string().trim().max(250),
          })
          .strict(),
      )
      .max(30)
      .default([]),
    is_active: z.boolean().default(true),
  })
  .strict();
function uniqueIds<T extends { id: string }>(schema: z.ZodType<T[]>) {
  return schema.refine(
    (rows) => new Set(rows.map((row) => row.id)).size === rows.length,
    "Each item must have a unique ID.",
  );
}
export const schemas = {
  hero_slides: uniqueIds(z.array(entry).max(30)).refine(
    (rows) =>
      rows.every(
        (row) =>
          (row.primary_action !== "navigate" || Boolean(row.button_url)) &&
          (row.secondary_action !== "navigate" || Boolean(row.secondary_url)),
      ),
    "Navigation actions need a destination URL.",
  ),
  faqs: uniqueIds(z.array(faq).max(150)),
  business_settings: businessSettings,
  page_sections: uniqueIds(z.array(page).max(120)),
} as const;
export type Key = keyof typeof schemas;
function isKey(value: string): value is Key {
  return Object.hasOwn(schemas, value);
}
export function validate(key: Key, body: unknown) {
  switch (key) {
    case "hero_slides": {
      const parsed = schemas.hero_slides.safeParse(body);
      if (parsed.success)
        for (const row of parsed.data)
          if (row.source_flags && row.actions_configured) {
            row.source_flags =
              row.secondary_action === "phone"
                ? { isPhoneCall: true }
                : row.secondary_action === "whatsapp"
                  ? { isWhatsApp: true }
                  : row.secondary_action === "navigate"
                    ? { isNavigateServices: true }
                    : {};
          }
      return parsed;
    }
    case "faqs":
      return schemas.faqs.safeParse(body);
    case "business_settings":
      return schemas.business_settings.safeParse(body);
    case "page_sections":
      return schemas.page_sections.safeParse(body);
  }
}
export function publishable(key: Key, data: unknown) {
  if (key === "business_settings")
    return (
      data !== null &&
      typeof data === "object" &&
      Object.values(data).some(
        (v) => typeof v === "string" && v.trim().length > 0,
      )
    );
  if (!Array.isArray(data)) return false;
  const active = data.filter((row) => row.is_active !== false);
  if (!active.length) return false;
  if (key === "hero_slides")
    return active.every(
      (row) =>
        row.title?.trim() &&
        row.image_url?.trim() &&
        row.button_label?.trim() &&
        (!row.actions_configured ||
          row.secondary_action === "none" ||
          row.secondary_label?.trim()),
    );
  if (key === "page_sections")
    return active.every((row) => row.heading?.trim() || row.body?.trim());
  return true;
}
export function createAdminSiteControlsRouter(db: pg.Pool) {
  const router = Router();
  router.get("/site-content/:key", async (req, res) => {
    const key = req.params.key;
    if (!isKey(key)) return res.status(404).json({ error: "Unknown module." });
    try {
      const result = await db.query(
        "SELECT key,draft,published,revision,updated_at FROM public.site_content WHERE key=$1",
        [key],
      );
      return result.rows[0]
        ? res.json({ item: result.rows[0] })
        : res.status(503).json({ error: "Run site content migration first." });
    } catch {
      return res
        .status(503)
        .json({ error: "Site content unavailable. Verify migration 003." });
    }
  });
  router.put("/site-content/:key/draft", async (req, res) => {
    const key = req.params.key;
    if (!isKey(key)) return res.status(404).json({ error: "Unknown module." });
    const parsed = validate(key, req.body?.data);
    if (!parsed.success)
      return res.status(400).json({
        error: "Invalid content.",
        issues: parsed.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    if (!Number.isSafeInteger(req.body?.revision) || req.body.revision < 0)
      return res.status(400).json({ error: "Valid revision required." });
    try {
      const result = await db.query(
        "UPDATE public.site_content SET draft=$1::jsonb,revision=revision+1,updated_at=now() WHERE key=$2 AND revision=$3 RETURNING key,draft,published,revision,updated_at",
        [JSON.stringify(parsed.data), key, req.body.revision],
      );
      return result.rowCount
        ? res.json({ item: result.rows[0] })
        : res.status(409).json({
            error:
              "Content changed in another session. Refresh before editing.",
          });
    } catch {
      return res.status(503).json({ error: "Unable to save draft." });
    }
  });
  router.post("/site-content/:key/publish", async (req, res) => {
    const key = req.params.key;
    if (!isKey(key)) return res.status(404).json({ error: "Unknown module." });
    if (!Number.isSafeInteger(req.body?.revision) || req.body.revision < 0)
      return res.status(400).json({ error: "Valid revision required." });
    const client = await db.connect().catch(() => null);
    if (!client)
      return res.status(503).json({ error: "Unable to publish content." });
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL lock_timeout = '5s'");
      await client.query("SET LOCAL statement_timeout = '15s'");
      const current = await client.query(
        "SELECT draft,revision FROM public.site_content WHERE key=$1 FOR UPDATE",
        [key],
      );
      if (!current.rows.length) {
        await client.query("ROLLBACK");
        return res
          .status(503)
          .json({ error: "Run site content migration first." });
      }
      if (current.rows[0].revision !== req.body.revision) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          error:
            "Content changed in another session. Reload before publishing.",
        });
      }
      if (current.rows[0].revision === 0) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          error: "Import existing content or save a draft before publishing.",
        });
      }
      const parsed = validate(key, current.rows[0].draft);
      if (!parsed.success || !publishable(key, parsed.data)) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          error:
            "Add active, complete content before publishing. Hero slides need headline, image and button text. Use Unpublish module to clear a publication.",
        });
      }
      await assertSiteMediaReferences(client, parsed.data);
      const result = await client.query(
        "UPDATE public.site_content SET published=draft,revision=revision+1,updated_at=now() WHERE key=$1 AND revision=$2 RETURNING key,draft,published,revision,updated_at",
        [key, req.body.revision],
      );
      await client.query(
        "INSERT INTO cms_publication_state(key,state) VALUES($1,'published') ON CONFLICT(key) DO UPDATE SET state='published',updated_at=now()",
        [key],
      );
      await client.query("COMMIT");
      return res.json({ item: result.rows[0] });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      if (error instanceof ApiError)
        return res.status(error.status).json({ error: error.message });
      return res.status(503).json({ error: "Unable to publish content." });
    } finally {
      client.release();
    }
  });
  router.post("/site-content/:key/unpublish", async (req, res) => {
    const key = req.params.key;
    if (!isKey(key)) return res.status(404).json({ error: "Unknown module." });
    if (!Number.isSafeInteger(req.body?.revision) || req.body.revision < 0)
      return res.status(400).json({ error: "Valid revision required." });
    try {
      const result = await transaction(db, async (client) => {
        const updated = await client.query(
          "UPDATE public.site_content SET published=$1::jsonb,updated_at=now() WHERE key=$2 AND revision=$3 RETURNING *",
          [
            JSON.stringify(key === "business_settings" ? {} : []),
            key,
            req.body.revision,
          ],
        );
        if (updated.rowCount)
          await client.query(
            "INSERT INTO cms_publication_state(key,state) VALUES($1,'unpublished') ON CONFLICT(key) DO UPDATE SET state='unpublished',updated_at=now()",
            [key],
          );
        return updated;
      });
      return result.rowCount
        ? res.json({ item: result.rows[0] })
        : res.status(409).json({ error: "Content changed. Reload first." });
    } catch {
      return res.status(503).json({ error: "Unable to unpublish." });
    }
  });
  return router;
}
export function createPublicSiteControlsRouter(db: pg.Pool) {
  const router = Router();
  router.get("/:key", async (req, res) => {
    const key = req.params.key;
    if (!isKey(key)) return res.status(404).json({ error: "Unknown module." });
    res.setHeader("Cache-Control", "no-store");
    try {
      const result = await db.query(
        "SELECT s.published,s.updated_at,coalesce(p.state,'uninitialized') AS state FROM public.site_content s LEFT JOIN cms_publication_state p ON p.key=s.key WHERE s.key=$1",
        [key],
      );
      return result.rows[0]
        ? res.json({
            success: true,
            data: result.rows[0].published,
            state: result.rows[0].state,
            fallback_allowed: result.rows[0].state === "uninitialized",
            updated_at: result.rows[0].updated_at,
          })
        : res.status(503).json({ error: "Content not configured." });
    } catch {
      return res
        .status(503)
        .json({ error: "Content temporarily unavailable." });
    }
  });
  return router;
}

// Only known media fields can make uploaded images public; CTA/text URLs cannot.
export async function assertSiteMediaReferences(
  db: Pick<pg.Pool, "query">,
  value: unknown,
): Promise<void> {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (
      ["image_url", "about_image_url", "logo_url", "favicon_url"].includes(key)
    )
      await assertMediaReferences(db, { media_url: child });
    else if (child && typeof child === "object")
      await assertSiteMediaReferences(db, child);
  }
}
