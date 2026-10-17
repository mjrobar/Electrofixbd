import path from "node:path";
import { fileURLToPath } from "node:url";
import { access } from "node:fs/promises";
import express from "express";
import dotenv from "dotenv";
import { createApp } from "./app";
import { loadConfig } from "./config";
import { createStore } from "./store";
import { errorHandler } from "./errors";

const root = path.resolve(import.meta.dirname, "..");
export async function startServer(env: NodeJS.ProcessEnv = process.env) {
  dotenv.config({
    path: path.join(root, ".env"),
    quiet: true,
    processEnv: env,
  });
  const config = loadConfig({ ...env, NODE_ENV: env.NODE_ENV ?? "production" });
  const store = createStore(config);
  const app = createApp({ config, store });
  let vite: { close(): Promise<void> } | undefined;
  let server: ReturnType<typeof app.listen>;
  try {
    if (config.NODE_ENV === "development") {
      const { createServer } = await import("vite");
      vite = await createServer({
        root,
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use((vite as Awaited<ReturnType<typeof createServer>>).middlewares);
    } else {
      const dist = path.join(root, "dist", "client");
      await access(path.join(dist, "index.html"));
      app.use(express.static(dist, { index: false, dotfiles: "deny" }));
      app.get("*", (req, res, next) => {
        // API 404s are handled by the shared app; missing assets are not SPA routes.
        if (path.extname(req.path) || !req.accepts("html")) return next();
        res.sendFile(path.join(dist, "index.html"));
      });
    }
    app.use((_req, res) =>
      res.status(404).type("text/plain").send("Not found."),
    );
    app.use(errorHandler);
    server = app.listen(config.PORT, config.HOST);
    await new Promise<void>((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });
  } catch (err) {
    await vite?.close();
    await store.close();
    await app.locals.close();
    throw err;
  }
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  console.log(
    `ElectroFix BD server listening on ${config.HOST}:${config.PORT} (${config.NODE_ENV}).`,
  );
  let closing: Promise<void> | undefined;
  function close() {
    return (closing ??= (async () => {
      const forceClose = setTimeout(() => server.closeAllConnections(), 10000);
      forceClose.unref();
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      );
      clearTimeout(forceClose);
      await vite?.close();
      await store.close();
      await app.locals.close();
    })());
  }
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.once(signal, () => {
      void close().then(
        () => {
          process.exitCode = 0;
        },
        () => {
          process.exitCode = 1;
        },
      );
    });
  return { app, server, store, close };
}
if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  startServer().catch(() => {
    console.error(
      "Server startup failed. Check configuration, build artifacts and port availability.",
    );
    process.exitCode = 1;
  });
}
