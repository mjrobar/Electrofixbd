import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomUUID,
} from "node:crypto";
import type pg from "pg";
import type { Config } from "./config";
import { transaction } from "./db/transaction";
export type DeliveryChannel = "email" | "whatsapp";
export type DeliveryJob = {
  id: string;
  dedupe_key: string;
  channel: DeliveryChannel;
  payload: string;
  attempts: number;
  expires_at: string;
};
export type DeliveryOutcome = {
  state: "sent" | "retry" | "failed" | "uncertain";
  code: string;
  provider_id?: string;
};
const context = (id: string, channel: DeliveryChannel) =>
  "electrofix-delivery-v1:" + channel + ":" + id;
export function sealDelivery(
  value: unknown,
  key: string,
  id: string,
  channel: DeliveryChannel,
) {
  if (!/^[a-fA-F0-9]{64}$/.test(key))
    throw Error("Delivery encryption is unavailable.");
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", Buffer.from(key, "hex"), iv);
  cipher.setAAD(Buffer.from(context(id, channel)));
  const payload = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    iv.toString("hex"),
    cipher.getAuthTag().toString("hex"),
    payload.toString("hex"),
  ].join(".");
}
export function openDelivery(
  value: string,
  key: string,
  id: string,
  channel: DeliveryChannel,
) {
  if (
    value.length > 128000 ||
    !/^v1\.[a-f0-9]{24}\.[a-f0-9]{32}\.[a-f0-9]+$/.test(value)
  )
    throw Error("Invalid sealed delivery.");
  const [, iv, tag, payload] = value.split("."),
    decipher = createDecipheriv(
      "aes-256-gcm",
      Buffer.from(key, "hex"),
      Buffer.from(iv, "hex"),
    );
  decipher.setAAD(Buffer.from(context(id, channel)));
  decipher.setAuthTag(Buffer.from(tag, "hex"));
  return JSON.parse(
    Buffer.concat([
      decipher.update(Buffer.from(payload, "hex")),
      decipher.final(),
    ]).toString("utf8"),
  );
}
export async function enqueueDelivery(
  db: Pick<pg.Pool, "query">,
  config: Config,
  channel: DeliveryChannel,
  dedupeKey: string,
  payload: unknown,
  expiresAt: string,
) {
  const id = randomUUID(),
    sealed = sealDelivery(
      payload,
      config.ADMIN_DELIVERY_ENCRYPTION_KEY || "",
      id,
      channel,
    );
  return db.query(
    "INSERT INTO public.admin_delivery_outbox(id,dedupe_key,channel,payload,expires_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT(dedupe_key) DO NOTHING RETURNING id",
    [id, dedupeKey, channel, sealed, expiresAt],
  );
}
export function bookingReceipt(
  booking: Record<string, any>,
  includeDetails = false,
) {
  const time = new Intl.DateTimeFormat("en-BD", {
    timeZone: "Asia/Dhaka",
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(booking.created_at));
  return [
    "ElectroFix BD · Booking receipt",
    "Booking: " + booking.booking_number,
    "Service: " + booking.service_name,
    "Received: " + time + " (Bangladesh time)",
    "Status: " + booking.status,
    ...(includeDetails
      ? [
          "Customer: " + booking.customer_name,
          "Phone: " + booking.phone,
          "Address: " + booking.address,
          ...(booking.notes ? ["Customer note: " + booking.notes] : []),
        ]
      : []),
    "This receipt records a service request. Appointment confirmation follows separately.",
  ].join("\n");
}
export function whatsappReceiptParameters(
  booking: Record<string, any>,
  includeDetails = false,
) {
  const text = (value: unknown, max: number) => {
    const chars = Array.from(
      String(value ?? "")
        .replace(/\s+/g, " ")
        .trim() || "Not provided",
    );
    return chars.length > max
      ? chars.slice(0, max - 1).join("") + "…"
      : chars.join("");
  };
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(booking.created_at));
  // Line breaks belong in the approved template, never text parameters. Bounds
  // leave room for the fixed template text within a 1024-character body.
  return [
    text(booking.booking_number, 30),
    text(booking.service_name, 80),
    text(time, 64),
    text(booking.status, 20),
    ...(includeDetails
      ? [
          text(booking.customer_name, 64),
          text(booking.phone, 25),
          text(booking.address, 180),
          text(booking.notes, 120),
        ]
      : Array(4).fill("View in secure Admin")),
  ];
}
export function emailReady(config: Config) {
  return (
    config.ADMIN_UPGRADE_ENABLED &&
    config.EMAIL_DELIVERY_ENABLED &&
    Boolean(
      config.RESEND_API_KEY &&
      config.EMAIL_FROM &&
      config.ADMIN_DELIVERY_ENCRYPTION_KEY,
    )
  );
}
export function whatsappReady(config: Config) {
  return (
    config.ADMIN_UPGRADE_ENABLED &&
    config.WHATSAPP_RECEIPTS_ENABLED &&
    Boolean(config.WHATSAPP_ACCESS_TOKEN && config.WHATSAPP_TEMPLATE_NAME)
  );
}
export async function deliverJob(
  job: DeliveryJob,
  config: Config,
  send: typeof fetch = fetch,
): Promise<DeliveryOutcome> {
  const enabled =
    job.channel === "email" ? emailReady(config) : whatsappReady(config);
  if (!enabled) return { state: "failed", code: "CHANNEL_DISABLED" };
  if (Date.parse(job.expires_at) <= Date.now())
    return { state: "failed", code: "EXPIRED" };
  let payload: any;
  try {
    payload = openDelivery(
      job.payload,
      config.ADMIN_DELIVERY_ENCRYPTION_KEY!,
      job.id,
      job.channel,
    );
  } catch {
    return { state: "failed", code: "ENVELOPE_INVALID" };
  }
  const email = job.channel === "email";
  if (
    !email &&
    (!Array.isArray(payload.parameters) ||
      payload.parameters.length !== 8 ||
      payload.parameters.some(
        (v: unknown) =>
          typeof v !== "string" ||
          !v.length ||
          v.length > 180 ||
          /[\r\n\t]/.test(v),
      ))
  )
    return { state: "failed", code: "TEMPLATE_PARAMETERS_INVALID" };
  try {
    const response = await send(
      email
        ? "https://api.resend.com/emails"
        : `https://graph.facebook.com/${config.WHATSAPP_GRAPH_VERSION}/${config.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(10000),
        headers: {
          Authorization:
            "Bearer " +
            (email ? config.RESEND_API_KEY : config.WHATSAPP_ACCESS_TOKEN),
          "Content-Type": "application/json",
          ...(email ? { "Idempotency-Key": job.id } : {}),
        },
        body: JSON.stringify(
          email
            ? {
                from: config.EMAIL_FROM,
                to: [payload.to],
                subject: payload.subject,
                text: payload.text,
              }
            : {
                messaging_product: "whatsapp",
                to: config.WHATSAPP_ADMIN_RECIPIENT,
                type: "template",
                template: {
                  name: config.WHATSAPP_TEMPLATE_NAME,
                  language: { code: config.WHATSAPP_TEMPLATE_LANGUAGE },
                  components: [
                    {
                      type: "body",
                      parameters: payload.parameters.map((text: string) => ({
                        type: "text",
                        text,
                      })),
                    },
                  ],
                },
              },
        ),
      },
    );
    // Never log provider response bodies: they may contain recipient PII.
    if (!response.ok) {
      await response.body?.cancel();
      return {
        state:
          response.status === 429
            ? "retry"
            : response.status === 408 || response.status >= 500
              ? email
                ? "retry"
                : "uncertain"
              : "failed",
        code: "HTTP_" + response.status,
      };
    }
    const body = (await response.json()) as any,
      id = email ? body.id : body.messages?.[0]?.id;
    if (typeof id !== "string" || !id.length || id.length > 250)
      return { state: "uncertain", code: "ACCEPTANCE_UNCONFIRMED" };
    return { state: "sent", code: "PROVIDER_ACCEPTED", provider_id: id };
  } catch {
    // WhatsApp offers no reliable exactly-once key. Never blindly retry an
    // ambiguous transport failure after it may have accepted the message.
    return {
      state: email ? "retry" : "uncertain",
      code: "TRANSPORT_UNCONFIRMED",
    };
  }
}
export async function queueBookingReceipts(pool: pg.Pool, config: Config) {
  if (!whatsappReady(config)) return 0;
  return transaction(pool, async (db) => {
    const rows = (
      await db.query(
        "SELECT b.booking_number,b.service_name,b.customer_name,b.phone,b.address,b.notes,b.status,b.created_at FROM public.bookings b WHERE b.created_at >= $1::timestamptz AND NOT EXISTS(SELECT 1 FROM public.admin_delivery_outbox o WHERE o.dedupe_key='whatsapp:booking:'||b.booking_number||':v1') ORDER BY b.created_at,b.booking_number LIMIT 100",
        [config.WHATSAPP_RECEIPTS_START_AT],
      )
    ).rows;
    let queued = 0;
    for (const b of rows) {
      const result = await enqueueDelivery(
        db,
        config,
        "whatsapp",
        "whatsapp:booking:" + b.booking_number + ":v1",
        {
          parameters: whatsappReceiptParameters(
            b,
            config.WHATSAPP_INCLUDE_CUSTOMER_DETAILS,
          ),
        },
        new Date(Date.now() + 24 * 3600000).toISOString(),
      );
      queued += result.rowCount || 0;
    }
    return queued;
  });
}
export async function processDeliveryOnce(
  pool: pg.Pool,
  config: Config,
  send: typeof fetch = fetch,
  adapter: typeof deliverJob = deliverJob,
) {
  if (!config.ADMIN_DELIVERY_WORKER_ENABLED || !config.ADMIN_UPGRADE_ENABLED)
    throw Error("Approved delivery worker is disabled.");
  // Crash recovery: a claimed job may already have reached its provider.
  await pool.query(
    "UPDATE public.admin_delivery_outbox SET state=CASE WHEN channel='email' AND attempts<5 THEN 'retry' ELSE 'uncertain' END,last_code='WORKER_INTERRUPTED',updated_at=now() WHERE state='processing' AND locked_at<now()-interval '2 minutes'",
  );
  await pool.query(
    "UPDATE public.admin_delivery_outbox SET state='failed',payload=NULL,last_code='EXPIRED',updated_at=now() WHERE expires_at<=now() AND state IN ('queued','retry')",
  );
  const job = (
    await pool.query(
      "UPDATE public.admin_delivery_outbox SET state='processing',attempts=attempts+1,locked_at=now(),updated_at=now() WHERE id=(SELECT id FROM public.admin_delivery_outbox WHERE state IN ('queued','retry') AND attempts<5 AND expires_at>now() AND available_at<=now() AND channel=ANY($1::text[]) ORDER BY available_at,created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING id,dedupe_key,channel,payload,attempts,expires_at",
      [
        [
          ...(emailReady(config) ? ["email"] : []),
          ...(whatsappReady(config) ? ["whatsapp"] : []),
        ],
      ],
    )
  ).rows[0] as DeliveryJob | undefined;
  if (!job) return null;
  let outcome: DeliveryOutcome;
  try {
    outcome = await adapter(job, config, send);
  } catch {
    outcome = {
      state: job.channel === "email" ? "retry" : "uncertain",
      code: "ADAPTER_UNCONFIRMED",
    };
  }
  if (outcome.state === "retry" && job.attempts >= 5)
    outcome = { state: "failed", code: "RETRY_LIMIT" };
  const delay = Math.min(3600, 30 * 2 ** Math.max(0, job.attempts - 1));
  await transaction(pool, async (db) => {
    await db.query(
      "UPDATE public.admin_delivery_outbox SET state=$1,last_code=$2,provider_id=$3,available_at=now()+($4::int*interval '1 second'),payload=CASE WHEN $1 IN ('sent','failed') THEN NULL ELSE payload END,updated_at=now() WHERE id=$5 AND state='processing'",
      [outcome.state, outcome.code, outcome.provider_id || null, delay, job.id],
    );
    await db.query(
      "INSERT INTO public.admin_audit(entity,record_id,action) VALUES('admin_delivery',$1,$2)",
      [job.id, outcome.state + ":" + outcome.code],
    );
  });
  return { id: job.id, channel: job.channel, ...outcome };
}
