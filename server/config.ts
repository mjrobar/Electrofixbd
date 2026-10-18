import { validProxy } from "./proxy";
import { isAbsolute } from "node:path";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  HOST: z.string().min(1).default("127.0.0.1"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  PUBLIC_ORIGIN: z.string().url().optional(),
  DATABASE_URL: z.string().optional(),
  CONTENT_IMPORT_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  CONTENT_IMPORT_TARGET_LABEL: z.string().max(200).optional(),
  MEDIA_ROOT: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z
      .string()
      .refine(
        (value) => isAbsolute(value),
        "MEDIA_ROOT must be an absolute path.",
      )
      .optional(),
  ),
  MEDIA_STORAGE_DURABLE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  REVIEW_ABUSE_SECRET: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().min(32).optional(),
  ),
  ADMIN_USERNAME: z.string().optional(),
  ADMIN_PASSWORD_HASH: z.string().optional(),
  ADMIN_SESSION_SECRET: z.string().optional(),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(20).default(5),
  DB_TIMEOUT_MS: z.coerce.number().int().min(100).max(30000).default(5000),
  TRUST_PROXY: z
    .string()
    .refine(
      validProxy,
      "Use false, loopback or explicit IP/CIDR addresses; never trust all proxies.",
    )
    .default("false"),
  API_RATE_LIMIT: z.coerce.number().int().min(1).max(10000).default(100),
});
export type Config = ReturnType<typeof loadConfig>;
export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const result = schema.safeParse(env);
  if (!result.success)
    throw new Error(
      `Invalid environment configuration: ${result.error.issues.map((issue) => issue.path.join(".")).join(", ")}`,
    );
  const config = result.data;
  if (env.VERCEL && config.MEDIA_ROOT)
    throw new Error(
      "Local media uploads are unavailable on ephemeral Vercel storage.",
    );
  if (config.PUBLIC_ORIGIN) {
    const url = new URL(config.PUBLIC_ORIGIN);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      throw new Error(
        "PUBLIC_ORIGIN must be an HTTP(S) origin without credentials or a path.",
      );
    config.PUBLIC_ORIGIN = url.origin;
  }
  if (config.DATABASE_URL) {
    let url: URL;
    try {
      url = new URL(config.DATABASE_URL);
    } catch {
      throw new Error("Invalid DATABASE_URL.");
    }
    if (
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      url.searchParams.get("sslmode") === "no-verify"
    )
      throw new Error(
        "DATABASE_URL must use PostgreSQL with certificate verification enabled when TLS is used.",
      );
  }
  if (
    config.NODE_ENV === "production" &&
    (!config.DATABASE_URL || !config.PUBLIC_ORIGIN?.startsWith("https://"))
  )
    throw new Error(
      "Production requires DATABASE_URL and an HTTPS PUBLIC_ORIGIN.",
    );
  return config;
}
