import { createCustomerReviewsRouter } from "./customer-reviews";
import { createBrandingRouter } from "./branding";
import { createPublicCmsRouter } from "./cms";
import { configureProxy } from "./proxy";
import { randomUUID } from "node:crypto";
import express, { type RequestHandler } from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import {
  bookingSchema,
  contactSchema,
  paginationSchema,
  worksQuerySchema,
} from "../shared/api";
import type { Config } from "./config";
import { ApiError, errorHandler } from "./errors";
import type { Store } from "./store";
import { createAdminRouter } from "./admin";
import pg from "pg";
import { createPublicSiteControlsRouter } from "./site-controls";

const asyncRoute =
  (handler: RequestHandler): RequestHandler =>
  (req, res, next) => {
    Promise.resolve()
      .then(() => handler(req, res, next))
      .catch(next);
  };
const methodGuard =
  (methods: string[]): RequestHandler =>
  (req, res, next) => {
    const allow = [
      ...methods,
      ...(methods.includes("GET") ? ["HEAD"] : []),
      "OPTIONS",
    ];
    if (req.method === "OPTIONS") {
      res.setHeader("Allow", allow.join(", "));
      res.sendStatus(204);
      return;
    }
    if (!allow.includes(req.method)) {
      res.setHeader("Allow", allow.join(", "));
      return next(
        new ApiError(
          405,
          "METHOD_NOT_ALLOWED",
          "Please use a supported request method.",
        ),
      );
    }
    next();
  };
export function createApp({ config, store }: { config: Config; store: Store }) {
  const app = express();
  app.disable("x-powered-by");
  app.set("case sensitive routing", true);
  configureProxy(app, config.TRUST_PROXY);
  app.use((_req, res, next) => {
    res.locals.requestId = randomUUID();
    res.setHeader("X-Request-ID", res.locals.requestId);
    next();
  });
  app.use(
    helmet({
      contentSecurityPolicy:
        config.NODE_ENV === "production"
          ? {
              directives: {
                scriptSrc: ["'self'"],
                styleSrc: [
                  "'self'",
                  "'unsafe-inline'",
                  "https://fonts.googleapis.com",
                ],
                fontSrc: ["'self'", "https://fonts.gstatic.com"],
                imgSrc: ["'self'", "data:", "blob:", "https:"],
                mediaSrc: ["'self'", "https:", "blob:"],
                connectSrc: ["'self'"],
              },
            }
          : false,
      strictTransportSecurity:
        config.NODE_ENV === "production" ? undefined : false,
    }),
  );
  const api = express.Router({ caseSensitive: true });
  api.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  api.use(
    rateLimit({
      windowMs: 60_000,
      limit: config.API_RATE_LIMIT,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      handler: (_req, _res, next) =>
        next(
          new ApiError(429, "RATE_LIMITED", "Please wait before trying again."),
        ),
    }),
  );
  api.use((req, res, next) => {
    const route = req.path.replace(/\/$/, "");
    const methods =
      route === "/bookings"
        ? ["POST", "GET"]
        : route === "/contact"
          ? ["POST"]
          : [
                "/health",
                "/status",
                "/services",
                "/works",
                "/testimonials",
              ].includes(route) || /^\/bookings\/[^/]+$/.test(route)
            ? ["GET"]
            : null;
    if (!methods)
      return next(
        new ApiError(404, "API_NOT_FOUND", "API endpoint not found."),
      );
    methodGuard(methods)(req, res, next);
  });
  api.use((req, _res, next) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      if (req.headers.origin && req.headers.origin !== config.PUBLIC_ORIGIN)
        return next(
          new ApiError(
            403,
            "ORIGIN_NOT_ALLOWED",
            "Please submit from the configured website.",
          ),
        );
      const charset = req.headers["content-type"]
        ?.match(/charset\s*=\s*"?([^;"\s]+)/i)?.[1]
        ?.toLowerCase();
      if (charset && !["utf8", "utf-8"].includes(charset))
        return next(
          new ApiError(
            415,
            "UNSUPPORTED_MEDIA_TYPE",
            "Please send UTF-8 application/json.",
          ),
        );
      if (!req.is("application/json"))
        return next(
          new ApiError(
            415,
            "UNSUPPORTED_MEDIA_TYPE",
            "Please send application/json.",
          ),
        );
    }
    next();
  });
  api.use((req, _res, next) => {
    if (Number(req.headers["content-length"]) > 16384)
      return next(
        new ApiError(413, "PAYLOAD_TOO_LARGE", "Please use a smaller request."),
      );
    next();
  });
  const parseJson = express.json({ limit: "16kb", strict: true });
  api.use((req, res, next) => {
    if (req.body === undefined) return parseJson(req, res, next);
    // Framework-parsed Vercel bodies must not be read from an exhausted stream.
    if (typeof req.body === "string") {
      if (Buffer.byteLength(req.body, "utf8") > 16384)
        return next(
          new ApiError(
            413,
            "PAYLOAD_TOO_LARGE",
            "Please use a smaller request.",
          ),
        );
      try {
        req.body = JSON.parse(req.body);
      } catch {
        return next(
          new ApiError(
            400,
            "INVALID_JSON",
            "Please provide a valid JSON request.",
          ),
        );
      }
    }
    next();
  });
  // Vercel may supply a parsed body. Enforce the same size limit before validation.
  api.use((req, _res, next) => {
    if (
      req.body !== undefined &&
      Buffer.byteLength(JSON.stringify(req.body), "utf8") > 16384
    )
      return next(
        new ApiError(413, "PAYLOAD_TOO_LARGE", "Please use a smaller request."),
      );
    next();
  });
  api.get("/health", (_req, res) =>
    res.json({
      status: "ok",
      service: "ElectroFix BD API",
      timestamp: new Date().toISOString(),
    }),
  );
  api.get(
    "/status",
    asyncRoute(async (_req, res) => {
      const ready = await store.ready();
      res.status(ready ? 200 : 503).json({
        database: ready ? "postgresql-connected" : "unavailable",
        ready,
        message: ready
          ? "Database is ready."
          : "Please try again later. Database is unavailable.",
      });
    }),
  );
  api.get(
    "/services",
    asyncRoute(async (req, res) => {
      const page = paginationSchema.parse(req.query);
      res.json({
        success: true,
        services: await store.listServices(page),
        pagination: page,
      });
    }),
  );
  api.get(
    "/works",
    asyncRoute(async (req, res) => {
      const query = worksQuerySchema.parse(req.query);
      res.json({
        success: true,
        works: await store.listWorks(query),
        pagination: { limit: query.limit, offset: query.offset },
      });
    }),
  );
  api.get(
    "/testimonials",
    asyncRoute(async (req, res) => {
      const page = paginationSchema.parse(req.query);
      res.json({
        success: true,
        testimonials: await store.listTestimonials(page),
        pagination: page,
      });
    }),
  );
  api.post(
    "/bookings",
    asyncRoute(async (req, res) => {
      const input = bookingSchema.parse(req.body);
      const booking = await store.createBooking(input);
      res.status(201).json({
        success: true,
        message: "Booking request has been submitted successfully.",
        booking,
      });
    }),
  );
  const lookup: RequestHandler = asyncRoute(async (req, res) => {
    const number =
      req.params.bookingNumber || req.query.bookingNumber || req.query.number;
    if (typeof number !== "string" || !/^EFB-\d{8}-\d{5}$/.test(number))
      throw new ApiError(
        400,
        "INVALID_BOOKING_NUMBER",
        "Please provide a valid booking number.",
      );
    const booking = await store.getBooking(number);
    if (!booking)
      throw new ApiError(
        404,
        "BOOKING_NOT_FOUND",
        "Booking not found with this booking number.",
      );
    // Allowlist public fields even if an injected repository returns extra fields.
    res.json({
      success: true,
      booking: {
        booking_number: booking.booking_number,
        service_name: booking.service_name,
        status: booking.status,
        created_at: booking.created_at,
      },
    });
  });
  api.get("/bookings", lookup);
  api.get("/bookings/:bookingNumber", lookup);
  api.post(
    "/contact",
    asyncRoute(async (req, res) => {
      await store.createContact(contactSchema.parse(req.body));
      res.json({
        success: true,
        message:
          "Thank you for contacting ElectroFix BD. We have received your message and will contact you shortly.",
      });
    }),
  );
  api.use((_req, _res, next) =>
    next(new ApiError(404, "API_NOT_FOUND", "API endpoint not found.")),
  );
  const adminRouter = createAdminRouter(config);
  app.use("/api/admin", adminRouter);
  const cleanup: Array<() => Promise<unknown>> = [() => adminRouter.close()];
  if (config.DATABASE_URL) {
    const contentPool = new pg.Pool({
      connectionString: config.DATABASE_URL,
      max: 2,
      connectionTimeoutMillis: config.DB_TIMEOUT_MS,
      statement_timeout: config.DB_TIMEOUT_MS,
      idleTimeoutMillis: 30000,
    });
    cleanup.push(() => contentPool.end());
    contentPool.on("error", () =>
      console.error("Site content idle database connection failed."),
    );
    app.use("/api", createPublicCmsRouter(contentPool));
    app.use("/api", createBrandingRouter(contentPool, config));
    app.use("/api", createCustomerReviewsRouter(contentPool, config));
    app.use("/api/site-content", createPublicSiteControlsRouter(contentPool));
  }
  app.use("/api", api);
  app.use(errorHandler);
  Object.assign(app.locals, {
    close: () => Promise.all(cleanup.map((close) => close())),
  });
  return app;
}
