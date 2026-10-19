import { createAdminMediaRouter } from "./media-storage";
import { createCmsRouter } from "./cms";
import { createFullImportRouter } from "./full-content-import";
import { databaseSecurityReady } from "./security";
import { route } from "./admin-utils";
import pg from "pg";
import type { Config } from "./config";
import { createAdminAuth } from "./admin-auth";
import { createContentImportRouter } from "./content-import";
import { createAdminContentRouter } from "./admin-content";
import { createAdminSiteControlsRouter } from "./site-controls";
import { createHistoryRouter } from "./admin-history";
import { createOperationsRouter } from "./admin-operations";
import { createObservationRouter } from "./admin-observation";

export function createAdminRouter(config: Config, database?: pg.Pool) {
  const enabled = Boolean(
    config.ADMIN_SESSION_SECRET &&
    (config.ADMIN_UPGRADE_ENABLED ||
      (config.ADMIN_USERNAME && config.ADMIN_PASSWORD_HASH)) &&
    config.DATABASE_URL,
  );
  const pool = enabled
    ? (database ??
      new pg.Pool({
        connectionString: config.DATABASE_URL,
        max: 3,
        connectionTimeoutMillis: config.DB_TIMEOUT_MS,
        statement_timeout: 15000,
        idleTimeoutMillis: 10000,
      }))
    : null;
  pool?.on("error", () =>
    console.error("Admin database connection unavailable."),
  );
  const router = createAdminAuth(config, pool);
  if (pool) {
    router.get(
      "/security/readiness",
      route(async (_req, res) =>
        res.json({
          database_hardened: await databaseSecurityReady(pool),
          session_policy: "30 minutes idle / 8 hours absolute",
          account_model: "single trusted owner",
        }),
      ),
    );
    router.use(createCmsRouter(pool));
    router.use(
      createFullImportRouter(pool, config.ADMIN_SESSION_SECRET!, {
        enabled: config.CONTENT_IMPORT_ENABLED,
        label: config.CONTENT_IMPORT_TARGET_LABEL || "Not approved",
      }),
    );
    router.use(createContentImportRouter(pool, config.ADMIN_SESSION_SECRET!));
    router.use(createAdminMediaRouter(pool, config));
    router.use(createAdminContentRouter(pool));
    router.use(createAdminSiteControlsRouter(pool));
    router.use(createHistoryRouter(pool));
    router.use(createOperationsRouter(pool));
    router.use(createObservationRouter(pool, config));
  }
  return Object.assign(router, {
    close: () =>
      database ? Promise.resolve() : (pool?.end() ?? Promise.resolve()),
  });
}
