import type {
  BookingInput,
  BookingRecord as ApiBookingRecord,
} from "../../shared/api";

export type BookingPayload = Omit<BookingInput, "notes"> & { notes?: string };
export type BookingRecord = ApiBookingRecord;

// Cache is a convenience copy of a server-confirmed record, never a submission fallback.
export function saveLocalBooking(record: BookingRecord) {
  try {
    const raw = localStorage.getItem("electrofix_confirmed_bookings") || "[]";
    const existing = JSON.parse(raw);
    const records = Array.isArray(existing) ? existing : [];
    records.unshift(record);
    localStorage.setItem(
      "electrofix_confirmed_bookings",
      JSON.stringify(records.slice(0, 50)),
    );
  } catch {
    /* Storage failure cannot change whether the server accepted a booking. */
  }
}
export function getLocalBooking(number: string): BookingRecord | null {
  try {
    const records: BookingRecord[] = JSON.parse(
      localStorage.getItem("electrofix_confirmed_bookings") || "[]",
    );
    return Array.isArray(records)
      ? (records.find((record) => record.booking_number === number) ?? null)
      : null;
  } catch {
    return null;
  }
}
async function submit(route: string, payload: unknown) {
  let res: Response;
  try {
    res = await fetch(route, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error(
      "Please try again later. Your request has not been confirmed.",
    );
  }
  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new Error(
      "Please try again later. The server did not confirm your request.",
    );
  }
  if (!res.ok || data?.success !== true)
    throw new Error(
      data?.error ||
        "Please try again later. Your request has not been confirmed.",
    );
  return data;
}
export async function submitBookingRequest(
  payload: BookingPayload,
): Promise<BookingRecord> {
  const data = await submit("/api/bookings", payload);
  if (!data.booking?.booking_number)
    throw new Error(
      "Please try again later. The server did not confirm your booking.",
    );
  saveLocalBooking(data.booking);
  return data.booking;
}
export async function submitContactMessage(payload: {
  name: string;
  phone: string;
  message: string;
}): Promise<void> {
  await submit("/api/contact", payload);
}
