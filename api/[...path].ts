import { createApp } from "../server/app";
import { loadConfig } from "../server/config";
import { createStore } from "../server/store";
import { createVercelHandler } from "../server/vercel";

let app: ReturnType<typeof createApp> | undefined;
export default createVercelHandler(() => {
  if (!app) {
    const config = loadConfig();
    app = createApp({ config, store: createStore(config) });
  }
  return app;
});
