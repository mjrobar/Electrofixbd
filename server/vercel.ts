import { randomUUID } from "node:crypto";
import type { Express } from "express";
import type { IncomingMessage, ServerResponse } from "node:http";

// Transport-only adapter: file-based Vercel routing retains the original API URL.
// No business routes, listener, dev middleware or migrations live here.
export function createVercelHandler(getApp: () => Express) {
  return (req: IncomingMessage, res: ServerResponse) => {
    try {
      getApp()(req, res);
    } catch {
      if (res.headersSent) {
        res.end();
        return;
      }
      const id = randomUUID();
      res.statusCode = 503;
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Request-ID", id);
      res.end(
        JSON.stringify({
          error: "Please try again later. The API is unavailable.",
          code: "CONFIGURATION_UNAVAILABLE",
          request_id: id,
        }),
      );
    }
  };
}
