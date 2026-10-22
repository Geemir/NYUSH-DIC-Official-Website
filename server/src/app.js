/*
 * The whole API as one fetch handler: a Request in, a Response out. The same
 * object serves Node (src/node.js), Cloudflare Workers (src/worker.js) and
 * the website's preview mode, which runs it inside the browser.
 *
 * Errors come back as { error: { code, message: { en, zh }, ...details } }.
 */
import { HttpError, fail, json } from "./util.js";
import { PROFILE_FIELDS, TRACKS, SKILLS, TEAM_FIELDS, CHANNELS } from "./form.js";
import * as auth from "./auth.js";
import * as reg from "./registration.js";
import * as board from "./board.js";
import * as chat from "./chat.js";
import * as admin from "./admin.js";
import * as bot from "./bot.js";

const MAX_BODY = 64 * 1024;

/* Everything the pages need to draw the forms. */
async function form(ctx) {
  const { registration: r, board: b } = ctx.config;
  const t = Date.now();
  return {
    tracks: TRACKS,
    skills: SKILLS,
    profile: PROFILE_FIELDS,
    team: TEAM_FIELDS,
    channels: CHANNELS,
    teamMax: r.teamMax,
    registration: { open: !r.closesAt || t <= r.closesAt, closesAt: r.closesAt, projectClosesAt: r.projectClosesAt },
    board: { publicRead: b.publicRead },
    bot: await bot.botInfo(ctx),
  };
}

const routes = [
  ["GET", "/api/health", async () => ({ ok: true, time: Date.now() })],
  ["GET", "/api/form", form],

  ["POST", "/api/auth/code", auth.requestCode],
  ["POST", "/api/auth/verify", auth.verifyCode],
  ["POST", "/api/auth/logout", auth.logout],
  ["GET", "/api/me", auth.me],
  ["PATCH", "/api/me", auth.updateMe],

  ["GET", "/api/registration", reg.getRegistration],
  ["PUT", "/api/registration/profile", reg.saveProfile],
  ["POST", "/api/registration/team", reg.chooseTeam],
  ["PATCH", "/api/registration/team", reg.updateTeam],
  ["POST", "/api/registration/team/leave", reg.leaveTeam],
  ["POST", "/api/registration/team/remove", reg.removeMember],
  ["POST", "/api/registration/team/new-code", reg.newCode],
  ["GET", "/api/registration/lookup", reg.lookupTeam],
  ["POST", "/api/registration/submit", reg.submit],
  ["POST", "/api/registration/withdraw", reg.withdraw],

  ["GET", "/api/board/posts", board.listPosts],
  ["POST", "/api/board/posts", board.createPost],
  ["PATCH", "/api/board/posts/:id", board.updatePost],
  ["DELETE", "/api/board/posts/:id", board.deletePost],
  ["GET", "/api/board/posts/:id/replies", board.listReplies],
  ["POST", "/api/board/posts/:id/replies", board.createReply],
  ["DELETE", "/api/board/replies/:id", board.deleteReply],
  ["POST", "/api/report", board.report],

  ["GET", "/api/chat/messages", chat.listMessages],
  ["POST", "/api/chat/messages", chat.postMessage],
  ["DELETE", "/api/chat/messages/:id", chat.deleteMessage],

  ["GET", "/api/admin/overview", admin.overview],
  ["GET", "/api/admin/participants", admin.participants],
  ["GET", "/api/admin/teams", admin.teams],
  ["GET", "/api/admin/content", admin.content],
  ["GET", "/api/admin/reports", admin.reports],
  ["POST", "/api/admin/moderate", admin.moderate],
  ["POST", "/api/admin/reports/:id/resolve", admin.resolveReport],
  ["POST", "/api/admin/users/:id/ban", admin.ban],

  ["GET", "/api/bot", bot.botInfo],
  ["POST", "/api/bot/chat", bot.chat],
].map(([method, path, handler]) => {
  const keys = [];
  const pattern = new RegExp("^" + path.replace(/:(\w+)/g, (_, k) => (keys.push(k), "([^/]+)")) + "$");
  return { method, pattern, keys, handler };
});

function match(method, pathname) {
  let pathFound = false;
  for (const r of routes) {
    const m = r.pattern.exec(pathname);
    if (!m) continue;
    pathFound = true;
    if (r.method === method) {
      const params = {};
      r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
      return { handler: r.handler, params };
    }
  }
  if (pathFound) fail(405, "method", "Method not allowed.", "不支持该请求方法。");
  fail(404, "not_found", "Not found.", "未找到。");
}

/* CORS: only the website's own address may call the API from a browser. */
function allowedOrigin(config, origin) {
  return config.origins.includes(origin) || (config.dev && (!config.origins.length || config.origins.includes("*")));
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

async function readBody(request) {
  if (Number(request.headers.get("Content-Length") || 0) > MAX_BODY) fail(413, "too_big", "That's too much text in one go.", "内容太长了。");
  const raw = await request.text();
  if (raw.length > MAX_BODY) fail(413, "too_big", "That's too much text in one go.", "内容太长了。");
  if (!raw) return {};
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    fail(400, "bad_json", "The request wasn't valid JSON.", "请求格式不正确。");
  }
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

/*
 * createApp({ config, db }) → { fetch(request, { ip }) }
 *   config: from configFromEnv() (src/config.js)
 *   db:     an adapter from src/db.js
 */
export function createApp({ config, db }) {
  return {
    async fetch(request, { ip = "" } = {}) {
      const url = new URL(request.url);
      const origin = request.headers.get("Origin");
      let cors = {};
      if (origin) {
        if (!allowedOrigin(config, origin)) return json({ error: { code: "origin", message: { en: "Not allowed.", zh: "不允许的来源。" } } }, 403, { Vary: "Origin" });
        cors = corsHeaders(origin);
      }
      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

      try {
        const { handler, params } = match(request.method, url.pathname);
        let body;
        const ctx = {
          request, url, params, config, db, ip,
          user: undefined,
          body: () => (body ??= readBody(request)),
        };
        const result = await handler(ctx);
        if (result instanceof Response) {
          for (const [k, v] of Object.entries(cors)) result.headers.set(k, v);
          return result;
        }
        return json(result, 200, cors);
      } catch (err) {
        if (err instanceof HttpError) {
          const headers = { ...cors };
          if (err.status === 429 && err.extra && err.extra.retryAfter) headers["Retry-After"] = String(err.extra.retryAfter);
          return json({ error: { code: err.code, message: { en: err.message, zh: err.zh }, ...(err.extra || {}) } }, err.status, headers);
        }
        console.error(`${request.method} ${url.pathname} failed:`, err);
        return json({ error: { code: "server_error", message: { en: "Something went wrong on our side. Please try again.", zh: "服务器出错了，请稍后再试。" } } }, 500, cors);
      }
    },
  };
}
