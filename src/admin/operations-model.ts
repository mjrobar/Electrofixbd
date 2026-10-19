export const bookingNextStatuses: Record<string, string[]> = {
  pending: ["contacted", "confirmed", "cancelled"],
  contacted: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled"],
  completed: ["confirmed"],
  cancelled: ["pending"],
};
export const bdDate = (value: string) =>
  new Intl.DateTimeFormat("en-BD", {
    timeZone: "Asia/Dhaka",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
export const bdDay = (value: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
export const statusLabel = (value: unknown) =>
  String(value)
    .replaceAll("_", " ")
    .replace(/^./, (v) => v.toUpperCase());
export function contactPhone(value: unknown) {
  const phone = String(value);
  return /^\+?[0-9 ()-]{6,30}$/.test(phone) ? phone.replace(/[^+\d]/g, "") : "";
}
