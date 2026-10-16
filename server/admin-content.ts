import { randomUUID } from "node:crypto";
import { Router } from "express";
import type pg from "pg";
import { z } from "zod";

const safeText = z.string().trim().max(5000);
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100);
const webUrl = z.union([z.literal(""), z.string().url().max(1500)]).optional();
const schemas = {
  services: z.object({
    slug, name: safeText.min(2).max(150), short_description: safeText.min(1),
    full_description: safeText.min(1), common_problems: z.array(safeText).max(50),
    service_process: z.array(safeText).max(50), cover_image: webUrl,
    is_active: z.boolean()
  }).strict(),
  works: z.object({
    title: safeText.min(2).max(200), slug, service_type: safeText.min(1).max(150),
    category: safeText.min(1).max(100), description: safeText.min(1),
    media_url: z.string().url().max(1500), media_type: z.enum(["image","video"]),
    is_featured: z.boolean(), is_published: z.boolean()
  }).strict(),
  testimonials: z.object({
    customer_name: safeText.min(2).max(150), review: safeText.min(1),
    service_type: safeText.min(1).max(150), rating: z.number().int().min(1).max(5),
    avatar_url: webUrl, media_url: webUrl, media_type: z.enum(["image","video"]).nullable(),
    is_published: z.boolean()
  }).strict()
};
type Kind = keyof typeof schemas;
const kinds: Kind[] = ["services","works","testimonials"];
const cols: Record<Kind,string[]> = {
  services: ["slug","name","short_description","full_description","common_problems","service_process","cover_image","is_active"],
  works: ["title","slug","service_type","category","description","media_url","media_type","is_featured","is_published"],
  testimonials: ["customer_name","review","service_type","rating","avatar_url","media_url","media_type","is_published"]
};
function validKind(value: string): value is Kind { return kinds.includes(value as Kind); }
function dbError(error: unknown) {
  if (typeof error === "object" && error && "code" in error && (error.code === "23505" || error.code === "23514"))
    return { code: 409, message: "A unique field or validation rule conflicts with an existing record." };
  return { code: 503, message: "Unable to save content. Please retry." };
}
export function createAdminContentRouter(pool: pg.Pool) {
  const router = Router();
  router.get("/content/:kind", async (req,res) => {
    const kind = req.params.kind;
    if (!validKind(kind)) return res.status(404).json({ error: "Unknown content module." });
    try {
      const result = await pool.query(`SELECT * FROM public.${kind} ORDER BY created_at DESC LIMIT 200`);
      return res.json({ items: result.rows });
    } catch { return res.status(503).json({ error: "Content unavailable." }); }
  });
  router.post("/content/:kind", async (req,res) => {
    const kind = req.params.kind;
    if (!validKind(kind)) return res.status(404).json({ error: "Unknown content module." });
    const parsed = schemas[kind].safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Please check the required fields.", issues: parsed.error.issues.map(x=>({field:x.path.join("."),message:x.message})) });
    const values = cols[kind].map(c => (parsed.data as Record<string,unknown>)[c] ?? null);
    if (kind === "services") {
      const serviceId = "srv-" + parsed.data.slug;
      try {
        const names = ["id",...cols[kind]].join(",");
        const placeholders = Array.from({length:values.length + 1},(_,i)=>"$"+(i+1)).join(",");
        const result = await pool.query(`INSERT INTO public.services (${names}) VALUES (${placeholders}) RETURNING *`,[serviceId,...values.map((v,i)=>["common_problems","service_process"].includes(cols[kind][i])?JSON.stringify(v):v)]);
        return res.status(201).json({ item: result.rows[0] });
      } catch (e) { const d=dbError(e);return res.status(d.code).json({error:d.message}); }
    }
    try {
      const placeholders=Array.from({length:values.length+1},(_,i)=>"$"+(i+1)).join(",");
      const result=await pool.query(`INSERT INTO public.${kind} (id,${cols[kind].join(",")}) VALUES (${placeholders}) RETURNING *`,[randomUUID(),...values]);
      return res.status(201).json({ item: result.rows[0] });
    } catch(e){ const d=dbError(e);return res.status(d.code).json({error:d.message}); }
  });
  router.put("/content/:kind/:id", async (req,res) => {
    const kind = req.params.kind;
    if (!validKind(kind)) return res.status(404).json({ error: "Unknown content module." });
    const parsed=schemas[kind].safeParse(req.body);
    if(!parsed.success) return res.status(400).json({ error: "Please check the required fields.", issues: parsed.error.issues.map(x=>({field:x.path.join("."),message:x.message})) });
    if(kind!=="services" && !z.string().uuid().safeParse(req.params.id).success) return res.status(400).json({error:"Invalid record ID."});
    const values=cols[kind].map(c=>(parsed.data as Record<string,unknown>)[c]??null).map((v,i)=>["common_problems","service_process"].includes(cols[kind][i])?JSON.stringify(v):v);
    const update=cols[kind].map((c,i)=>`${c}=$${i+1}`).join(",");
    try {
      const result=await pool.query(`UPDATE public.${kind} SET ${update}${kind==="services"?",updated_at=now()":""} WHERE id=$${values.length+1} RETURNING *`,[...values,req.params.id]);
      if(!result.rowCount)return res.status(404).json({error:"Record not found."});
      return res.json({item:result.rows[0]});
    }catch(e){const d=dbError(e);return res.status(d.code).json({error:d.message});}
  });
  router.delete("/content/:kind/:id", async (req,res) => {
    const kind=req.params.kind;
    if(!validKind(kind))return res.status(404).json({error:"Unknown content module."});
    if(kind!=="services"&&!z.string().uuid().safeParse(req.params.id).success)return res.status(400).json({error:"Invalid ID."});
    const publicationColumn=kind==="services"?"is_active":"is_published";
    try {
      const result=await pool.query(`UPDATE public.${kind} SET ${publicationColumn}=false WHERE id=$1 RETURNING id`,[req.params.id]);
      if(!result.rowCount)return res.status(404).json({error:"Record not found."});
      return res.json({success:true,archived:true});
    }catch{return res.status(503).json({error:"Unable to archive record."});}
  });
  return router;
}
