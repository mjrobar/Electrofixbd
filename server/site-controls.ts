import { Router } from "express";
import { z } from "zod";
import type pg from "pg";

const link = z.string().trim().max(1500).refine(value => !value || value.startsWith("/") && !value.startsWith("//") || /^https:\/\//i.test(value), "Use HTTPS or a relative path.");
const entry = z.object({
  id: z.string().trim().min(1).max(100),
  title: z.string().trim().max(250).default(""),
  subtitle: z.string().trim().max(500).default(""),
  description: z.string().trim().max(5000).default(""),
  image_url: link.default(""),
  button_label: z.string().trim().max(100).default(""),
  button_url: link.default(""),
  is_active: z.boolean().default(true)
}).strict();
const faq = z.object({
  id: z.string().trim().min(1).max(100),
  question: z.string().trim().min(2).max(500),
  answer: z.string().trim().min(2).max(5000),
  category: z.string().trim().max(120).default("General"),
  is_active: z.boolean().default(true)
}).strict();
const businessSettings = z.object({
  business_name: z.string().trim().max(150).default(""),
  phone: z.string().trim().max(40).default(""),
  whatsapp: z.string().trim().max(40).default(""),
  email: z.union([z.literal(""), z.string().email().max(250)]).default(""),
  address: z.string().trim().max(1000).default(""),
  hours: z.string().trim().max(250).default(""),
  facebook_url: link.default(""),
  youtube_url: link.default(""),
  logo_url: link.default("")
}).strict();
const page = z.object({
  id: z.string().trim().min(1).max(100),
  page: z.enum(["home","services","works","contact","about"]),
  section: z.string().trim().min(1).max(100),
  heading: z.string().trim().max(250),
  body: z.string().trim().max(8000).default(""),
  image_url: link.default(""),
  is_active: z.boolean().default(true)
}).strict();
const schemas = {
  hero_slides: z.array(entry).max(30),
  faqs: z.array(faq).max(150),
  business_settings: businessSettings,
  page_sections: z.array(page).max(120)
} as const;
type Key = keyof typeof schemas;
function isKey(value: string): value is Key { return Object.hasOwn(schemas, value); }
function validate(key: Key, body: unknown) {
  switch(key) {
    case "hero_slides": return schemas.hero_slides.safeParse(body);
    case "faqs": return schemas.faqs.safeParse(body);
    case "business_settings": return schemas.business_settings.safeParse(body);
    case "page_sections": return schemas.page_sections.safeParse(body);
  }
}
export function createAdminSiteControlsRouter(db: pg.Pool) {
  const router = Router();
  router.get("/site-content/:key", async (req,res) => {
    const key = req.params.key;
    if (!isKey(key)) return res.status(404).json({ error: "Unknown module." });
    try {
      const result = await db.query("SELECT key,draft,published,revision,updated_at FROM public.site_content WHERE key=$1",[key]);
      return result.rows[0] ? res.json({ item: result.rows[0] }) : res.status(503).json({ error: "Run site content migration first." });
    } catch { return res.status(503).json({ error: "Site content unavailable. Verify migration 003." }); }
  });
  router.put("/site-content/:key/draft", async (req,res) => {
    const key = req.params.key;
    if (!isKey(key)) return res.status(404).json({ error: "Unknown module." });
    const parsed = validate(key, req.body?.data);
    if (!parsed.success) return res.status(400).json({ error: "Invalid content.", issues: parsed.error.issues.map(issue=>({field:issue.path.join("."),message:issue.message})) });
    if (!Number.isSafeInteger(req.body?.revision) || req.body.revision < 0) return res.status(400).json({error:"Valid revision required."});
    try {
      const result = await db.query("UPDATE public.site_content SET draft=$1::jsonb,revision=revision+1,updated_at=now() WHERE key=$2 AND revision=$3 RETURNING key,draft,published,revision,updated_at",[JSON.stringify(parsed.data),key,req.body.revision]);
      return result.rowCount ? res.json({item:result.rows[0]}) : res.status(409).json({error:"Content changed in another session. Refresh before editing."});
    } catch { return res.status(503).json({ error:"Unable to save draft." }); }
  });
  router.post("/site-content/:key/publish", async (req,res) => {
    const key = req.params.key;
    if (!isKey(key)) return res.status(404).json({ error: "Unknown module." });
    if (!Number.isSafeInteger(req.body?.revision) || req.body.revision < 0) return res.status(400).json({error:"Valid revision required."});
    try {
      const current = await db.query("SELECT draft,revision FROM public.site_content WHERE key=$1",[key]);
      if(!current.rows.length) return res.status(503).json({error:"Run site content migration first."});
      const parsed = validate(key,current.rows[0].draft);
      if(!parsed.success) return res.status(409).json({error:"Draft failed content validation."});
      const result = await db.query("UPDATE public.site_content SET published=draft,revision=revision+1,updated_at=now() WHERE key=$1 AND revision=$2 RETURNING key,published,revision,updated_at",[key,req.body.revision]);
      return result.rowCount ? res.json({item:result.rows[0]}) : res.status(409).json({error:"Content changed in another session. Refresh before publishing."});
    } catch { return res.status(503).json({error:"Unable to publish content."}); }
  });
  return router;
}
export function createPublicSiteControlsRouter(db: pg.Pool) {
  const router = Router();
  router.get("/:key", async(req,res)=>{
    const key=req.params.key;
    if(!isKey(key))return res.status(404).json({error:"Unknown module."});
    res.setHeader("Cache-Control","no-store");
    try {
      const result=await db.query("SELECT published,updated_at FROM public.site_content WHERE key=$1",[key]);
      return result.rows[0] ? res.json({success:true,data:result.rows[0].published,updated_at:result.rows[0].updated_at}) : res.status(503).json({error:"Content not configured."});
    }catch{return res.status(503).json({error:"Content temporarily unavailable."});}
  });
  return router;
}
