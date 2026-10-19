import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import type pg from "pg";
import { readFile, lstat } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import type { Config } from "./config";
import { mediaRoot } from "./media-storage";
import { route } from "./admin-utils";
import { ApiError } from "./errors";
export function createBrandingRouter(pool: pg.Pool, config: Config) {
  const router = Router();
  router.use(
    "/branding",
    rateLimit({
      windowMs: 60000,
      limit: config.API_RATE_LIMIT,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      handler: (_req, _res, next) =>
        next(
          new ApiError(
            429,
            "RATE_LIMITED",
            "Please wait before requesting more branding images.",
          ),
        ),
    }),
  );
  const cache = new Map<string, Buffer>();
  let encoding = 0;
  router.get(
    "/branding/favicon/:size.png",
    route(async (req, res) => {
      const size = Number(req.params.size);
      if (![48, 192, 512].includes(size))
        throw new ApiError(404, "FAVICON_NOT_FOUND", "Favicon not found.");
      // Only the published source of truth can expose a derived icon. No remote fetch.
      const asset = (
        await pool.query(
          "SELECT m.id,m.filename FROM public.media_assets m JOIN public.site_content s ON s.key='business_settings' AND s.published->>'favicon_url'='/api/media/'||m.id::text JOIN public.cms_publication_state p ON p.key=s.key AND p.state='published' WHERE m.owner_type='admin' AND m.deleted_at IS NULL",
        )
      ).rows[0];
      if (
        !asset ||
        !/^[a-f0-9-]{36}$/.test(asset.id) ||
        asset.filename !== asset.id + ".webp"
      )
        throw new ApiError(404, "FAVICON_NOT_FOUND", "Favicon not found.");
      const cacheKey = asset.id + ":" + size,
        cached = cache.get(cacheKey);
      if (cached)
        return res
          .set({
            "Content-Type": "image/png",
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "no-store",
          })
          .send(cached);
      if (encoding >= 2)
        throw new ApiError(
          503,
          "FAVICON_BUSY",
          "Image processing is busy. Retry shortly.",
        );
      const file = join(await mediaRoot(config), asset.filename),
        stat = await lstat(file);
      if (
        !stat.isFile() ||
        stat.isSymbolicLink() ||
        stat.size > 5 * 1024 * 1024
      )
        throw new ApiError(404, "FAVICON_NOT_FOUND", "Favicon not found.");
      if (encoding >= 2)
        throw new ApiError(
          503,
          "FAVICON_BUSY",
          "Image processing is busy. Retry shortly.",
        );
      encoding++;
      let png: Buffer;
      try {
        png = await sharp(await readFile(file), {
          limitInputPixels: 16000000,
        })
          .resize(size, size, {
            fit: "contain",
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          })
          .png()
          .toBuffer();
      } finally {
        encoding--;
      }
      if (cache.size >= 3) cache.delete(cache.keys().next().value!);
      cache.set(cacheKey, png);
      res
        .set({
          "Content-Type": "image/png",
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "no-store",
        })
        .send(png);
    }),
  );
  return router;
}
