// Development bootstrap only. Production uses the separate server/node.ts entrypoint.
import { startServer } from "./server/node";
startServer({
  ...process.env,
  NODE_ENV: process.env.NODE_ENV ?? "development",
}).catch(() => {
  console.error(
    "Development server startup failed. Check configuration and port availability.",
  );
  process.exitCode = 1;
});
