/*
 * Runs the API on Node (22.13 or newer) with a local SQLite file.
 *
 *   npm run dev      reads settings from .env (copy .env.example)
 *   npm start        reads them from the environment (e.g. Docker)
 *
 * Extra settings here: PORT (8787), HOST (127.0.0.1; 0.0.0.0 in Docker),
 * DATABASE_PATH (./data/dic.sqlite) and TRUST_PROXY=1 when the server sits
 * behind a reverse proxy such as Caddy or Nginx (to see visitors' addresses).
 */
import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { configFromEnv } from "./config.js";
import { fromNodeSqlite } from "./db.js";

const env = process.env;
const here = dirname(fileURLToPath(import.meta.url));
const config = configFromEnv(env);

const dbPath = resolve(env.DATABASE_PATH || resolve(here, "../data/dic.sqlite"));
mkdirSync(dirname(dbPath), { recursive: true });
const sqlite = new DatabaseSync(dbPath);
sqlite.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
sqlite.exec(readFileSync(resolve(here, "../schema.sql"), "utf8"));
const app = createApp({ config, db: fromNodeSqlite(sqlite) });

const PASS_HEADERS = ["authorization", "content-type", "origin", "accept"];

function clientIp(req) {
  const forwarded = env.TRUST_PROXY === "1" && req.headers["x-forwarded-for"];
  return forwarded ? String(forwarded).split(",")[0].trim() : req.socket.remoteAddress || "";
}

const server = createServer(async (req, res) => {
  try {
    const headers = new Headers();
    for (const name of PASS_HEADERS) if (req.headers[name]) headers.set(name, String(req.headers[name]));
    let body;
    if (req.method !== "GET" && req.method !== "HEAD") {
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 128 * 1024) return res.writeHead(413).end();
        chunks.push(chunk);
      }
      body = Buffer.concat(chunks);
    }
    const request = new Request(`http://${req.headers.host || "localhost"}${req.url}`, { method: req.method, headers, body });
    const response = await app.fetch(request, { ip: clientIp(req) });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    if (response.body) for await (const chunk of response.body) res.write(chunk); // streams the chatbot as it goes
    res.end();
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.writeHead(500);
    res.end();
  }
});

const port = Number(env.PORT || 8787);
const host = env.HOST || "127.0.0.1";
server.listen(port, host, () => {
  console.log(`DIC API on http://${host}:${port}  (database: ${dbPath}${config.dev ? ", development mode" : ""})`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close();
    sqlite.close();
    process.exit(0);
  });
}
