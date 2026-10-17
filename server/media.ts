import { isIP } from "node:net";
import { z } from "zod";
export function safeMediaUrl(value: string) {
  if (!value) return true;
  if (/[\s\\\u0000-\u001f]/.test(value)) return false;
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try {
    const url = new URL(value),
      host = url.hostname.toLowerCase();
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      (url.port && url.port !== "443")
    )
      return false;
    if (
      !host.includes(".") ||
      isIP(host) ||
      host.startsWith("[") ||
      /(^|\.)(localhost|local|internal|test|invalid)$/.test(host)
    )
      return false;
    return true;
  } catch {
    return false;
  }
}
export const mediaUrl = z
  .string()
  .trim()
  .max(1500)
  .refine(
    safeMediaUrl,
    "Use an HTTPS public media URL or an application-relative path, without credentials.",
  );
