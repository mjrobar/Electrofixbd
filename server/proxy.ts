import { isIP } from "node:net";
import type { Express } from "express";
import { ApiError } from "./errors";
export function validProxy(value: string) {
  if (value === "false" || value === "loopback") return true;
  return value.split(",").every((part) => {
    const [ip, bits, ...extra] = part.trim().split("/");
    const version = isIP(ip);
    return (
      !extra.length &&
      version > 0 &&
      (bits === undefined ||
        (/^\d+$/.test(bits) &&
          Number(bits) > 0 &&
          Number(bits) <= (version === 4 ? 32 : 128)))
    );
  });
}
export function configureProxy(app: Express, value: string) {
  app.set(
    "trust proxy",
    value === "false"
      ? false
      : value === "loopback"
        ? "loopback"
        : value.split(",").map((v) => v.trim()),
  );
  app.use((req, _res, next) => {
    const trusted = app.get("trust proxy fn")(
      req.socket.remoteAddress || "",
      0,
    );
    if (req.get("forwarded") || (req.get("x-forwarded-for") && !trusted))
      return next(
        new ApiError(
          400,
          "UNTRUSTED_PROXY",
          "Forwarding headers require an explicitly trusted reverse proxy.",
        ),
      );
    const chain = req.get("x-forwarded-for");
    if (
      chain &&
      (chain.split(",").length > 16 ||
        chain.split(",").some((ip) => !isIP(ip.trim())))
    )
      return next(
        new ApiError(
          400,
          "INVALID_PROXY_HEADER",
          "Use a valid IP forwarding chain.",
        ),
      );
    next();
  });
}
