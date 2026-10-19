import { Router, raw, type Response } from "express";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import {
  mkdir,
  writeFile,
  unlink,
  realpath,
  lstat,
  open,
} from "node:fs/promises";
import { resolve, join, relative, isAbsolute, parse, sep } from "node:path";
import sharp from "sharp";
import type pg from "pg";
import type { Config } from "./config";
import { ApiError } from "./errors";
import { route } from "./admin-utils";
export const hashClaim = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const unavailable = () =>
  new ApiError(
    503,
    "MEDIA_UNAVAILABLE",
    "Durable image storage is not configured.",
  );
export async function mediaRoot(config: Config) {
  if (!config.MEDIA_ROOT || !config.MEDIA_STORAGE_DURABLE) throw unavailable();
  const root = resolve(config.MEDIA_ROOT);
  const app = resolve(".");
  const within = (parent: string, child: string) => {
    const path = relative(parent, child);
    return (
      path === "" ||
      (path !== ".." && !path.startsWith(".." + sep) && !isAbsolute(path))
    );
  };
  if (
    root === parse(root).root ||
    within(root, app) ||
    within(app, root) ||
    (config.NODE_ENV === "production" &&
      process.platform !== "win32" &&
      /^\/(tmp|var\/tmp)(\/|$)/.test(root))
  )
    throw unavailable();
  await mkdir(root, { recursive: true, mode: 0o700 });
  if ((await realpath(root)) !== root) throw unavailable();
  const directory = await lstat(root);
  if (
    !directory.isDirectory() ||
    (process.platform !== "win32" && (directory.mode & 0o077) !== 0) ||
    (process.getuid && directory.uid !== process.getuid())
  )
    throw unavailable();
  return root;
}
let decoders = 0;
export async function normalizeImage(input: Buffer, mime: string) {
  if (
    !Buffer.isBuffer(input) ||
    !input.length ||
    input.length > 5 * 1024 * 1024
  )
    throw new ApiError(413, "IMAGE_SIZE", "Choose an image up to 5 MiB.");
  const detected = input
    .subarray(0, 8)
    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    ? "image/png"
    : input[0] === 255 && input[1] === 216 && input[2] === 255
      ? "image/jpeg"
      : input.toString("ascii", 0, 4) === "RIFF" &&
          input.toString("ascii", 8, 12) === "WEBP"
        ? "image/webp"
        : null;
  if (!detected || mime !== detected)
    throw new ApiError(
      415,
      "IMAGE_TYPE",
      "Only matching JPEG, PNG and WebP images are accepted.",
    );
  if (decoders >= 2)
    throw new ApiError(
      429,
      "IMAGE_BUSY",
      "Image processing is busy. Please retry shortly.",
    );
  decoders++;
  try {
    const image = sharp(input, {
      limitInputPixels: 16000000,
      failOn: "warning",
      animated: true,
    });
    const meta = await image.metadata();
    if (
      !meta.width ||
      !meta.height ||
      meta.width > 6000 ||
      meta.height > 6000 ||
      (meta.pages ?? 1) !== 1
    )
      throw Error("dimensions");
    const { data, info } = await image
      .rotate()
      .webp({ quality: 85 })
      .toBuffer({ resolveWithObject: true });
    if (data.length > 5 * 1024 * 1024) throw Error("size");
    return { data, width: info.width, height: info.height };
  } catch {
    throw new ApiError(
      400,
      "INVALID_IMAGE",
      "Invalid image, animation, or image exceeds 16 million pixels / 6000 pixels per side.",
    );
  } finally {
    decoders--;
  }
}
export async function uploadImage(
  pool: pg.Pool,
  config: Config,
  body: Buffer,
  mime: string,
  owner: "admin" | "review",
) {
  const root = await mediaRoot(config);
  const image = await normalizeImage(body, mime);
  const id = randomUUID(),
    filename = id + ".webp",
    claim = owner === "review" ? randomBytes(32).toString("hex") : null;
  await writeFile(join(root, filename), image.data, {
    flag: "wx",
    mode: 0o600,
    flush: true,
  });
  try {
    const directory = await open(root, "r");
    try {
      try {
        await directory.sync();
      } catch (error) {
        // Directory fsync is unsupported by Windows; file flush remains enforced.
        if (process.platform !== "win32") throw error;
      }
    } finally {
      await directory.close();
    }
    await pool.query(
      "INSERT INTO public.media_assets(id,filename,mime_type,bytes,width,height,owner_type,claim_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
      [
        id,
        filename,
        "image/webp",
        image.data.length,
        image.width,
        image.height,
        owner,
        claim ? hashClaim(claim) : null,
      ],
    );
  } catch (error) {
    await unlink(join(root, filename));
    throw error;
  }
  return {
    id,
    url: "/api/media/" + id,
    preview_url:
      owner === "admin" ? "/api/admin/media/" + id + "/blob" : undefined,
    ...(claim ? { claim_token: claim } : {}),
    width: image.width,
    height: image.height,
  };
}
export async function assertMediaReferences(
  db: Pick<pg.Pool, "query">,
  data: Record<string, unknown>,
  current?: Record<string, unknown>,
) {
  for (const key of ["cover_image", "media_url", "avatar_url"]) {
    const value = data[key];
    if (typeof value !== "string" || !value.startsWith("/api/media/")) continue;
    const id = value.slice("/api/media/".length);
    if (!uuid.test(id))
      throw new ApiError(
        400,
        "INVALID_MEDIA",
        "Invalid uploaded image reference.",
      );
    const asset = (
      await db.query(
        "SELECT owner_type,review_id FROM public.media_assets WHERE id=$1 AND deleted_at IS NULL FOR SHARE",
        [id],
      )
    ).rows[0];
    if (
      !asset ||
      (asset.owner_type === "review" && asset.review_id !== current?.id)
    )
      throw new ApiError(
        400,
        "INVALID_MEDIA",
        "Image is not available for this record.",
      );
  }
}
export async function serveImage(
  pool: pg.Pool,
  config: Config,
  id: string,
  res: Response,
  admin = false,
) {
  if (!uuid.test(id))
    throw new ApiError(404, "MEDIA_NOT_FOUND", "Image not found.");
  const asset = (
    await pool.query(
      "SELECT * FROM public.media_assets WHERE id=$1 AND deleted_at IS NULL",
      [id],
    )
  ).rows[0];
  if (!asset) throw new ApiError(404, "MEDIA_NOT_FOUND", "Image not found.");
  if (!admin) {
    const url = "/api/media/" + id;
    const visible = await pool.query(
      `SELECT 1 WHERE EXISTS(SELECT 1 FROM public.services WHERE is_active IS TRUE AND archived_at IS NULL AND cover_image=$1) OR EXISTS(SELECT 1 FROM public.works WHERE is_published IS TRUE AND archived_at IS NULL AND media_url=$1) OR EXISTS(SELECT 1 FROM public.testimonials WHERE is_published IS TRUE AND archived_at IS NULL AND (avatar_url=$1 OR media_url=$1)) OR EXISTS(SELECT 1 FROM public.site_content WHERE jsonb_path_exists(published, '$.**.image_url ? (@ == $url)', jsonb_build_object('url',$1::text)) OR jsonb_path_exists(published, '$.about_image_url ? (@ == $url)', jsonb_build_object('url',$1::text)) OR jsonb_path_exists(published, '$.logo_url ? (@ == $url)', jsonb_build_object('url',$1::text))) OR EXISTS(SELECT 1 FROM public.cms_documents WHERE publication_state='published' AND archived_at IS NULL AND jsonb_path_exists(published, '$.groups[*].items[*].fields[*] ? (@.kind == "media" && @.value == $url)', jsonb_build_object('url',$1::text)))`,
      [url],
    );
    if (!visible.rowCount)
      throw new ApiError(404, "MEDIA_NOT_FOUND", "Image not found.");
  }
  if (asset.filename !== id + ".webp")
    throw new ApiError(404, "MEDIA_NOT_FOUND", "Image not found.");
  const file = join(await mediaRoot(config), asset.filename);
  try {
    const stat = await lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw Error();
  } catch {
    throw new ApiError(404, "MEDIA_NOT_FOUND", "Image not found.");
  }
  res.set({
    "Content-Type": "image/webp",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": 'inline; filename="' + asset.filename + '"',
    "Cache-Control": "private, no-store",
  });
  res.sendFile(file, { dotfiles: "deny", cacheControl: false });
}
export function createAdminMediaRouter(pool: pg.Pool, config: Config) {
  const router = Router();
  router.post(
    "/media",
    raw({ type: ["image/jpeg", "image/png", "image/webp"], limit: "5mb" }),
    route(async (req, res) => {
      const image = await uploadImage(
        pool,
        config,
        req.body,
        req.get("content-type") || "",
        "admin",
      );
      res.status(201).json({ image });
    }),
  );
  router.get(
    "/media/:id/blob",
    route(async (req, res) =>
      serveImage(pool, config, req.params.id, res, true),
    ),
  );
  return router;
}
