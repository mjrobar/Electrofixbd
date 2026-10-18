import { createHmac, randomUUID } from "node:crypto";
import { Router, json, raw } from "express";
import { rateLimit } from "express-rate-limit";
import type pg from "pg";
import { z } from "zod";
import type { Config } from "./config";
import { ApiError } from "./errors";
import { parse, route, text, transaction } from "./admin-utils";
import { hashClaim, serveImage, uploadImage } from "./media-storage";
import { reviewQuota } from "./review-quota";
const schema = z
  .object({
    submission_key: z.string().uuid(),
    customer_name: text.min(2).max(150),
    address: text.max(150).default(""),
    service_id: text.min(1).max(150),
    review: text.min(10).max(3000),
    rating: z.number().int().min(1).max(5),
    consent: z.literal(true),
    website: z.literal("").optional(),
    image: z
      .object({
        id: z.string().uuid(),
        claim_token: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .strict()
      .optional(),
  })
  .strict();
export function createCustomerReviewsRouter(pool: pg.Pool, config: Config) {
  const router = Router();
  router.get(
    "/media/:id",
    route(async (req, res) => serveImage(pool, config, req.params.id, res)),
  );
  router.use(
    ["/reviews", "/review-images"],
    (req, res, next) => {
      res.set("Cache-Control", "no-store");
      if (req.method !== "POST")
        return next(new ApiError(405, "METHOD_NOT_ALLOWED", "Use POST."));
      if (!config.PUBLIC_ORIGIN || req.get("origin") !== config.PUBLIC_ORIGIN)
        return next(
          new ApiError(
            403,
            "ORIGIN_NOT_ALLOWED",
            "Submit from the configured website.",
          ),
        );
      if (
        (config.REVIEW_ABUSE_SECRET || config.ADMIN_SESSION_SECRET || "")
          .length < 32
      )
        return next(
          new ApiError(
            503,
            "REVIEWS_UNAVAILABLE",
            "Reviews are temporarily unavailable.",
          ),
        );
      next();
    },
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 15,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
  const secret =
    config.REVIEW_ABUSE_SECRET || config.ADMIN_SESSION_SECRET || "";
  router.post(
    "/review-images",
    route(async (req, _res, next) => {
      await reviewQuota(pool, secret, req.ip || "unknown", "uploads");
      next();
    }),
    raw({ type: ["image/jpeg", "image/png", "image/webp"], limit: "5mb" }),
    route(async (req, res) => {
      const image = await uploadImage(
        pool,
        config,
        req.body,
        req.get("content-type") || "",
        "review",
      );
      res.status(201).json({ image });
    }),
  );
  router.post(
    "/reviews",
    json({ limit: "16kb" }),
    route(async (req, res) => {
      if (
        !req.is("application/json") ||
        Buffer.byteLength(JSON.stringify(req.body ?? {})) > 16384
      )
        throw new ApiError(
          415,
          "INVALID_BODY",
          "Use a JSON request up to 16 KiB.",
        );
      const input = parse(schema, req.body);
      const digest = createHmac("sha256", secret)
        .update(
          JSON.stringify([
            input.customer_name.normalize("NFC").toLowerCase(),
            input.address.normalize("NFC"),
            input.service_id,
            input.review.normalize("NFC"),
            input.rating,
            input.image?.id ?? null,
          ]),
        )
        .digest("hex");
      const result = await transaction(pool, async (db) => {
        // Serialize retry/deduplication across server processes without leaking lookup data.
        await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,1))", [
          input.submission_key,
        ]);
        await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
          digest,
        ]);
        const existing = (
          await db.query(
            "SELECT id,submission_key,submission_digest FROM public.testimonials WHERE submission_key=$1 OR submission_digest=$2",
            [input.submission_key, digest],
          )
        ).rows[0];
        if (existing) {
          if (
            existing.submission_key !== input.submission_key ||
            existing.submission_digest !== digest
          )
            throw new ApiError(
              409,
              "DUPLICATE_REVIEW",
              "This review was already submitted or this submission key was reused.",
            );
          return existing.id;
        }
        await reviewQuota(db, secret, req.ip || "unknown", "submissions");
        const service = (
          await db.query(
            "SELECT name FROM public.services WHERE id=$1 AND is_active IS TRUE AND archived_at IS NULL FOR SHARE",
            [input.service_id],
          )
        ).rows[0];
        if (!service)
          throw new ApiError(
            400,
            "INVALID_SERVICE",
            "Select an active service category.",
          );
        const id = randomUUID();
        let imageUrl = null;
        if (input.image) {
          const asset = (
            await db.query(
              "SELECT * FROM public.media_assets WHERE id=$1 AND owner_type='review' AND review_id IS NULL AND deleted_at IS NULL AND created_at>now()-interval '24 hours' FOR UPDATE",
              [input.image.id],
            )
          ).rows[0];
          if (!asset || asset.claim_hash !== hashClaim(input.image.claim_token))
            throw new ApiError(
              400,
              "INVALID_IMAGE_CLAIM",
              "Upload a new image for this submission.",
            );
          imageUrl = "/api/media/" + input.image.id;
        }
        await db.query(
          `INSERT INTO public.testimonials(id,customer_name,review,service_type,service_id,address,rating,media_url,media_type,is_published,submission_source,moderation_status,consent_at,submission_key,submission_digest)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,false,'customer','pending',now(),$10,$11)`,
          [
            id,
            input.customer_name,
            input.review,
            service.name,
            input.service_id,
            input.address,
            input.rating,
            imageUrl,
            imageUrl ? "image" : null,
            input.submission_key,
            digest,
          ],
        );
        if (input.image)
          await db.query(
            "UPDATE public.media_assets SET review_id=$1,claim_hash=NULL WHERE id=$2",
            [id, input.image.id],
          );
        return id;
      });
      res.status(201).json({
        success: true,
        reference: result,
        status: "pending",
        message:
          "Your review was saved for administrator approval. It is not published.",
      });
    }),
  );
  return router;
}
