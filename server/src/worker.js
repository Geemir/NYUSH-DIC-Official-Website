/*
 * Runs the API on Cloudflare Workers, with Cloudflare D1 as the database
 * (binding "DB" in wrangler.toml). Settings come from the Worker's variables
 * and secrets; see README.md for the deployment steps.
 */
import { createApp } from "./app.js";
import { configFromEnv } from "./config.js";
import { fromD1 } from "./db.js";

let app = null;

export default {
  async fetch(request, env) {
    app ??= createApp({ config: configFromEnv(env), db: fromD1(env.DB) });
    return app.fetch(request, { ip: request.headers.get("CF-Connecting-IP") || "" });
  },
};
