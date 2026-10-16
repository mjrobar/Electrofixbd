import { z } from "zod";

const phone = z
  .string()
  .max(40)
  .transform((value) => value.replace(/[\s\-()+]/g, ""))
  .pipe(
    z.string().regex(/^\d{10,15}$/, "Please provide a valid phone number."),
  );
export const bookingSchema = z
  .object({
    customer_name: z.string().trim().min(2).max(120),
    phone,
    address: z.string().trim().min(3).max(1000),
    notes: z.string().trim().max(2000).optional().default(""),
    service_id: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .optional()
      .default("srv-general"),
    service_name: z.string().trim().min(1).max(200).optional(),
  })
  .strict();
export const contactSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    phone,
    message: z.string().trim().min(5).max(4000),
  })
  .strict();
export type BookingInput = z.infer<typeof bookingSchema>;
export type ContactInput = z.infer<typeof contactSchema>;
export interface BookingRecord {
  booking_number: string;
  customer_name: string;
  service_name: string;
  phone: string;
  address: string;
  status: string;
  created_at: string;
}
export type PublicBooking = Pick<
  BookingRecord,
  "booking_number" | "service_name" | "status" | "created_at"
>;
export interface ApiErrorBody {
  error: string;
  code: string;
  request_id: string;
}
