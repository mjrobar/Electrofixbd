import { randomInt, randomUUID } from "node:crypto";
import pg from "pg";
import type {
  BookingInput,
  BookingRecord,
  ContactInput,
  PublicBooking,
} from "../shared/api";
import type { Config } from "./config";
import { ApiError } from "./errors";
import { createContentRepository, type ContentRepository } from "./content";

export interface Store extends ContentRepository {
  createBooking(input: BookingInput): Promise<BookingRecord>;
  getBooking(number: string): Promise<PublicBooking | null>;
  createContact(input: ContactInput): Promise<void>;
  ready(): Promise<boolean>;
  close(): Promise<void>;
}
function unavailable() {
  return new ApiError(
    503,
    "STORAGE_UNAVAILABLE",
    "Please try again later. Your request has not been confirmed.",
  );
}
export function createStore(config: Config): Store {
  if (!config.DATABASE_URL)
    return {
      createBooking: async () => {
        throw unavailable();
      },
      getBooking: async () => {
        throw unavailable();
      },
      createContact: async () => {
        throw unavailable();
      },
      listServices: async () => {
        throw unavailable();
      },
      listWorks: async () => {
        throw unavailable();
      },
      listTestimonials: async () => {
        throw unavailable();
      },
      ready: async () => false,
      close: async () => {},
    };
  const pool = new pg.Pool({
    connectionString: config.DATABASE_URL,
    max: config.DB_POOL_MAX,
    connectionTimeoutMillis: config.DB_TIMEOUT_MS,
    query_timeout: config.DB_TIMEOUT_MS,
    statement_timeout: config.DB_TIMEOUT_MS,
    idleTimeoutMillis: 30000,
  });
  pool.on("error", () => console.error("PostgreSQL idle connection failed."));
  return {
    ...createContentRepository(pool),
    async createBooking(input) {
      try {
        const service = await pool.query<{ name: string }>(
          "SELECT name FROM public.services WHERE id = $1 AND is_active = true",
          [input.service_id],
        );
        if (!service.rows[0])
          throw new ApiError(
            400,
            "INVALID_SERVICE",
            "Please select a valid service.",
          );
        for (let attempt = 0; attempt < 5; attempt++) {
          const date = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Dhaka",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          })
            .format(new Date())
            .replaceAll("-", "");
          const number = `EFB-${date}-${randomInt(10000, 100000)}`;
          const result = await pool.query<BookingRecord>(
            `INSERT INTO public.bookings (id, booking_number, service_id, service_name, customer_name, phone, address, notes, status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending') ON CONFLICT (booking_number) DO NOTHING
             RETURNING booking_number, service_name, customer_name, phone, address, status, created_at`,
            [
              randomUUID(),
              number,
              input.service_id,
              service.rows[0].name,
              input.customer_name,
              input.phone,
              input.address,
              input.notes,
            ],
          );
          if (result.rows[0])
            return {
              ...result.rows[0],
              created_at: new Date(result.rows[0].created_at).toISOString(),
            };
        }
        throw unavailable();
      } catch (err) {
        if (err instanceof ApiError) throw err;
        throw unavailable();
      }
    },
    async getBooking(number) {
      try {
        const result = await pool.query<PublicBooking>(
          "SELECT booking_number, service_name, status, created_at FROM public.bookings WHERE booking_number = $1",
          [number],
        );
        return result.rows[0]
          ? {
              ...result.rows[0],
              created_at: new Date(result.rows[0].created_at).toISOString(),
            }
          : null;
      } catch {
        throw unavailable();
      }
    },
    async createContact(input) {
      try {
        await pool.query(
          "INSERT INTO public.contact_messages (id,name,phone,message,status) VALUES ($1,$2,$3,$4,$5)",
          [randomUUID(), input.name, input.phone, input.message, "new"],
        );
      } catch {
        throw unavailable();
      }
    },
    async ready() {
      try {
        await pool.query(
          "SELECT booking_number, service_name, customer_name, phone, address, notes, status, created_at FROM public.bookings LIMIT 0",
        );
        await pool.query(
          "SELECT id, name, phone, message, status FROM public.contact_messages LIMIT 0",
        );
        await pool.query(
          "SELECT id, name, is_active FROM public.services LIMIT 0",
        );
        await pool.query(
          "SELECT id,title,slug,service_type,category,description,media_url,media_type,is_featured,is_published,created_at FROM public.works LIMIT 0",
        );
        await pool.query(
          "SELECT id,customer_name,review,service_type,rating,avatar_url,media_url,media_type,is_published,created_at FROM public.testimonials LIMIT 0",
        );
        const privileges = await pool.query<{ ready: boolean }>(`SELECT
          has_table_privilege(current_user, 'public.bookings', 'INSERT') AND
          has_table_privilege(current_user, 'public.bookings', 'SELECT') AND
          has_table_privilege(current_user, 'public.contact_messages', 'INSERT') AND
          has_table_privilege(current_user, 'public.services', 'SELECT') AND
          has_table_privilege(current_user, 'public.works', 'SELECT') AND
          has_table_privilege(current_user, 'public.testimonials', 'SELECT') AS ready`);
        return privileges.rows[0]?.ready === true;
      } catch {
        return false;
      }
    },
    close: () => pool.end(),
  };
}
