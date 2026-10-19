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
  // Optional Issue 29 storage. Enable only after owner-approved additive SQL/grants.
  ADMIN_UPGRADE_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  ADMIN_DELIVERY_WORKER_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  ADMIN_DELIVERY_APPROVAL: z.string().optional(),
  ADMIN_DELIVERY_ENCRYPTION_KEY: z.string().optional(),
  EMAIL_DELIVERY_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  WHATSAPP_RECEIPTS_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_ADMIN_RECIPIENT: z.string().optional(),
  WHATSAPP_RECIPIENT_OPT_IN_AT: z.string().optional(),
  WHATSAPP_RECEIPTS_START_AT: z.string().optional(),
  WHATSAPP_TEMPLATE_NAME: z.string().optional(),
  WHATSAPP_TEMPLATE_LANGUAGE: z.string().default("en"),
  WHATSAPP_GRAPH_VERSION: z.string().optional(),
  WHATSAPP_INCLUDE_CUSTOMER_DETAILS: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
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
  if (
    config.ADMIN_DELIVERY_WORKER_ENABLED ||
    config.EMAIL_DELIVERY_ENABLED ||
    config.WHATSAPP_RECEIPTS_ENABLED
  ) {
    if (
      !config.ADMIN_UPGRADE_ENABLED ||
      config.ADMIN_DELIVERY_APPROVAL !== "OWNER APPROVED DELIVERY" ||
      !/^[a-fA-F0-9]{64}$/.test(config.ADMIN_DELIVERY_ENCRYPTION_KEY || "")
    )
      throw Error(
        "Delivery requires approved Admin upgrade storage, explicit owner delivery approval and a 32-byte encryption key.",
      );
  }
  if (
    config.EMAIL_DELIVERY_ENABLED &&
    (!config.RESEND_API_KEY ||
      !z.string().email().safeParse(config.EMAIL_FROM).success ||
      !config.PUBLIC_ORIGIN)
  )
    throw Error(
      "Email delivery requires RESEND_API_KEY, verified EMAIL_FROM and PUBLIC_ORIGIN.",
    );
  if (
    config.WHATSAPP_RECEIPTS_ENABLED &&
    (!config.WHATSAPP_ACCESS_TOKEN ||
      !/^\d{5,30}$/.test(config.WHATSAPP_PHONE_NUMBER_ID || "") ||
      !/^[1-9]\d{7,14}$/.test(config.WHATSAPP_ADMIN_RECIPIENT || "") ||
      !/^[a-z0-9_]{1,100}$/.test(config.WHATSAPP_TEMPLATE_NAME || "") ||
      !/^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(config.WHATSAPP_TEMPLATE_LANGUAGE) ||
      !/^v\d+\.0$/.test(config.WHATSAPP_GRAPH_VERSION || "") ||
      !z.iso
        .datetime({ offset: true })
        .safeParse(config.WHATSAPP_RECEIPTS_START_AT).success ||
      !z.iso
        .datetime({ offset: true })
        .safeParse(config.WHATSAPP_RECIPIENT_OPT_IN_AT).success ||
      Date.parse(config.WHATSAPP_RECIPIENT_OPT_IN_AT!) > Date.now() ||
      Date.parse(config.WHATSAPP_RECEIPTS_START_AT!) <
        Date.parse(config.WHATSAPP_RECIPIENT_OPT_IN_AT!))
  )
    throw Error(
      "WhatsApp requires approved Cloud API/template configuration, recipient opt-in and an explicit start time no earlier than opt-in.",
    );
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
