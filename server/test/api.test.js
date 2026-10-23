/*
 * End-to-end tests of the API against an in-memory database.
 *   npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { createApp } from "../src/app.js";
import { configFromEnv } from "../src/config.js";
import { fromNodeSqlite } from "../src/db.js";

const SITE = "http://site.test";
const PROFILE = {
  name: "Lin Wei", school: "NYU Shanghai", program: "Computer Science", year: "y2",
  wechat: "linwei_dic", phone: "", skills: ["coding", "ai"], source: "wechat",
};

function setup(env = {}) {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
  const config = configFromEnv({
    DIC_ENV: "development", DEV_RETURN_CODE: "1", EMAIL_PROVIDER: "none",
    ADMIN_EMAILS: "admin@dic.test", ALLOWED_ORIGINS: SITE, ...env,
  });
  const app = createApp({ config, db: fromNodeSqlite(sqlite) });
  let ip = 0;

  async function call(method, path, body, token, { origin, raw } = {}) {
    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (origin) headers.Origin = origin;
    const res = await app.fetch(
      new Request("http://api.test" + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }),
      { ip: "10.0.0.1" },
    );
    if (raw) return res;
    const type = res.headers.get("Content-Type") || "";
    return { status: res.status, data: type.includes("json") ? await res.json() : await res.text(), headers: res.headers };
  }

  /* Each sign-in comes from its own address, to stay clear of the per-address limit. */
  async function signIn(email) {
    const res = await app.fetch(new Request("http://api.test/api/auth/code", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }),
    }), { ip: `10.1.0.${++ip}` });
    const { devCode } = await res.json();
    const r = await call("POST", "/api/auth/verify", { email, code: devCode });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    return r.data.token;
  }

  async function register(email, profile = PROFILE) {
    const token = await signIn(email);
    const r = await call("PUT", "/api/registration/profile", { profile: { ...profile, name: email.split("@")[0] } }, token);
    assert.equal(r.status, 200, JSON.stringify(r.data));
    return token;
  }

  return { call, signIn, register, config, sqlite };
}

/* Reads a server-sent event stream into a list of events. */
async function events(res) {
  const text = await res.text();
  return text.split("\n\n").filter(Boolean).map((chunk) => JSON.parse(chunk.replace(/^data: /, "")));
}

test("the form describes the questions", async () => {
  const { call } = setup();
  const r = await call("GET", "/api/form");
  assert.equal(r.status, 200);
  assert.equal(r.data.tracks.length, 4);
  assert.ok(r.data.profile.some((f) => f.key === "name" && f.required));
  assert.equal(r.data.teamMax, 3);
  assert.equal(r.data.bot.enabled, false);
});

test("sign in with an emailed code", async () => {
  const { call } = setup();
  assert.equal((await call("POST", "/api/auth/code", { email: "not-an-email" })).data.error.code, "bad_email");

  const sent = await call("POST", "/api/auth/code", { email: "Student@NYU.edu " });
  assert.equal(sent.status, 200);
  assert.equal(sent.data.email, "student@nyu.edu");
  assert.match(sent.data.devCode, /^\d{6}$/);

  const again = await call("POST", "/api/auth/code", { email: "student@nyu.edu" });
  assert.equal(again.status, 429, "one code a minute");
  assert.ok(Number(again.headers.get("Retry-After")) > 0);

  const wrong = sent.data.devCode === "000000" ? "111111" : "000000";
  assert.equal((await call("POST", "/api/auth/verify", { email: "student@nyu.edu", code: wrong })).data.error.code, "code_wrong");

  const ok = await call("POST", "/api/auth/verify", { email: "student@nyu.edu", code: sent.data.devCode });
  assert.equal(ok.status, 200);
  assert.ok(ok.data.token.length > 30);
  assert.equal(ok.data.user.admin, false);

  const reuse = await call("POST", "/api/auth/verify", { email: "student@nyu.edu", code: sent.data.devCode });
  assert.equal(reuse.data.error.code, "code_expired", "a code works once");

  const me = await call("GET", "/api/me", undefined, ok.data.token);
  assert.equal(me.data.user.email, "student@nyu.edu");
  assert.equal((await call("GET", "/api/me")).status, 401);

  await call("POST", "/api/auth/logout", {}, ok.data.token);
  assert.equal((await call("GET", "/api/me", undefined, ok.data.token)).status, 401, "signed out");
});

test("five wrong codes lock the code", async () => {
  const { call } = setup();
  const sent = await call("POST", "/api/auth/code", { email: "a@b.test" });
  const wrong = sent.data.devCode === "000000" ? "111111" : "000000";
  for (let i = 0; i < 5; i++) await call("POST", "/api/auth/verify", { email: "a@b.test", code: wrong });
  const r = await call("POST", "/api/auth/verify", { email: "a@b.test", code: sent.data.devCode });
  assert.equal(r.data.error.code, "code_locked");
});

test("registration: about you, teams, submit", async () => {
  const { call, signIn, register } = setup();
  assert.equal((await call("GET", "/api/registration")).status, 401);

  const a = await signIn("captain@nyu.edu");
  const bad = await call("PUT", "/api/registration/profile", { profile: { ...PROFILE, name: "", year: "y9", phone: "abc" } }, a);
  assert.equal(bad.status, 400);
  assert.equal(bad.data.error.code, "check_fields");
  assert.deepEqual(bad.data.error.fields.map((f) => f.field).sort(), ["name", "phone", "year"]);
  assert.ok(bad.data.error.fields.every((f) => f.message.en && f.message.zh));

  let r = await call("PUT", "/api/registration/profile", { profile: { ...PROFILE, extra: "ignored" } }, a);
  assert.equal(r.data.registration.profileComplete, true);
  assert.equal(r.data.registration.profile.extra, undefined);
  assert.equal((await call("GET", "/api/me", undefined, a)).data.user.displayName, "Lin Wei");

  assert.equal((await call("POST", "/api/registration/submit", { consent: true }, a)).data.error.code, "team_choice");

  r = await call("POST", "/api/registration/team", { action: "create", name: "Solo Labs", track: "track-02" }, a);
  assert.equal(r.status, 200);
  const code = r.data.team.code;
  assert.match(code, /^[A-Z2-9]{6}$/);
  assert.equal(r.data.team.captain, true);

  const b = await register("b@nyu.edu");
  const look = await call("GET", `/api/registration/lookup?code=${code.toLowerCase()}`, undefined, b);
  assert.equal(look.data.team.name, "Solo Labs");
  assert.equal(look.data.team.captainName, "Lin Wei");
  r = await call("POST", "/api/registration/team", { action: "join", code: code.slice(0, 3) + "-" + code.slice(3) }, b);
  assert.equal(r.data.team.members.length, 2);

  const c = await register("c@nyu.edu");
  await call("POST", "/api/registration/team", { action: "join", code }, c);
  const d = await register("d@nyu.edu");
  assert.equal((await call("POST", "/api/registration/team", { action: "join", code }, d)).data.error.code, "team_full");

  r = await call("PATCH", "/api/registration/team", { repoUrl: "github.com/dic/solo-labs", projectTitle: "Honest Agent" }, b);
  assert.equal(r.data.team.repoUrl, "https://github.com/dic/solo-labs");
  assert.equal((await call("PATCH", "/api/registration/team", { repoUrl: "javascript:alert(1)" }, b)).data.error.code, "bad_link");
  assert.equal((await call("PATCH", "/api/registration/team", { name: "Renamed" }, b)).data.error.code, "captain_only");
  assert.equal((await call("POST", "/api/registration/team", { action: "none" }, b)).data.error.code, "in_team");

  /* The captain leaves: the longest-standing member takes over. */
  await call("POST", "/api/registration/team/leave", {}, a);
  r = await call("GET", "/api/registration", undefined, b);
  assert.equal(r.data.team.captain, true);
  assert.equal(r.data.team.members.length, 2);
  r = await call("POST", "/api/registration/team/remove", { userId: r.data.team.members.find((m) => !m.me).id }, b);
  assert.equal(r.data.team.members.length, 1);
  const oldCode = r.data.team.code;
  r = await call("POST", "/api/registration/team/new-code", {}, b);
  assert.notEqual(r.data.team.code, oldCode);

  assert.equal((await call("POST", "/api/registration/submit", {}, b)).data.error.code, "consent");
  r = await call("POST", "/api/registration/submit", { consent: true }, b);
  assert.equal(r.data.registration.status, "submitted");

  r = await call("POST", "/api/registration/team", { action: "none", track: "track-04" }, d);
  assert.equal(r.data.registration.teamChoice, "none");
  assert.equal(r.data.registration.trackPref, "track-04");

  r = await call("POST", "/api/registration/withdraw", {}, b);
  assert.equal(r.data.registration, null);
  assert.equal(r.data.team, null);
});

test("deadlines lock changes, except for admins", async () => {
  const { call, signIn } = setup({ REGISTRATION_CLOSES: "2020-01-01T00:00:00+08:00" });
  const s = await signIn("late@nyu.edu");
  assert.equal((await call("PUT", "/api/registration/profile", { profile: PROFILE }, s)).data.error.code, "closed");
  assert.equal((await call("GET", "/api/form")).data.registration.open, false);
  const admin = await signIn("admin@dic.test");
  assert.equal((await call("PUT", "/api/registration/profile", { profile: PROFILE }, admin)).status, 200);
});

test("team-up board: cards, contacts and replies", async () => {
  const { call, signIn, register } = setup();
  const a = await register("poster@nyu.edu");
  const card = { kind: "team", track: "track-03", title: "Need a hardware person", body: "We build a robot.\nJoin us!", skills: ["hardware", "nope"], contact: "wx: robo_team" };
  let r = await call("POST", "/api/board/posts", card, a);
  assert.equal(r.status, 200);
  const id = r.data.post.id;
  assert.deepEqual(r.data.post.skills, ["hardware"]);
  assert.equal(r.data.post.body, "We build a robot.\nJoin us!");

  let list = await call("GET", "/api/board/posts");
  assert.equal(list.data.posts.length, 1);
  assert.equal(list.data.posts[0].contact, null, "contacts hidden when signed out");
  assert.equal((await call("GET", "/api/board/posts?track=track-01")).data.posts.length, 0);

  const fresh = await signIn("fresh@nyu.edu");
  assert.equal((await call("POST", `/api/board/posts/${id}/replies`, { body: "Hi" }, fresh)).data.error.code, "need_name");
  assert.equal((await call("PATCH", "/api/me", { displayName: "me@x.com" }, fresh)).status, 400);
  await call("PATCH", "/api/me", { displayName: "Fresh" }, fresh);
  list = await call("GET", "/api/board/posts", undefined, fresh);
  assert.equal(list.data.posts[0].contact, "wx: robo_team");
  r = await call("POST", `/api/board/posts/${id}/replies`, { body: "I solder!" }, fresh);
  assert.equal(r.data.reply.author.name, "Fresh");
  assert.equal((await call("GET", `/api/board/posts/${id}/replies`)).status, 401);
  assert.equal((await call("GET", `/api/board/posts/${id}/replies`, undefined, a)).data.replies.length, 1);

  assert.equal((await call("DELETE", `/api/board/posts/${id}`, undefined, fresh)).status, 403);
  await call("PATCH", `/api/board/posts/${id}`, { status: "closed" }, a);
  assert.equal((await call("GET", "/api/board/posts")).data.posts.length, 0, "closed cards leave the board");
  assert.equal((await call("GET", "/api/board/posts?mine=1", undefined, a)).data.posts.length, 1);
  assert.equal((await call("POST", `/api/board/posts/${id}/replies`, { body: "?" }, fresh)).data.error.code, "post_closed");

  for (let i = 0; i < 3; i++) await call("POST", "/api/board/posts", { ...card, title: `Card ${i}` }, a);
  assert.equal((await call("POST", "/api/board/posts", card, a)).data.error.code, "too_many_posts");

  assert.equal((await call("POST", "/api/report", { kind: "post", id, reason: "spam" }, fresh)).status, 200);
});

test("chat: channels and polling", async () => {
  const { call, register, signIn } = setup();
  const a = await register("a@nyu.edu");
  const b = await register("b@nyu.edu");
  assert.equal((await call("GET", "/api/chat/messages?channel=lobby")).status, 401);
  assert.equal((await call("POST", "/api/chat/messages", { channel: "nope", body: "hi" }, a)).data.error.code, "invalid");

  const m1 = (await call("POST", "/api/chat/messages", { channel: "lobby", body: "hello" }, a)).data.message;
  await call("POST", "/api/chat/messages", { channel: "track-01", body: "elsewhere" }, a);
  const m2 = (await call("POST", "/api/chat/messages", { channel: "lobby", body: "hi back" }, b)).data.message;

  let r = await call("GET", "/api/chat/messages?channel=lobby", undefined, b);
  assert.deepEqual(r.data.messages.map((m) => m.body), ["hello", "hi back"]);
  assert.deepEqual(r.data.messages.map((m) => m.mine), [false, true]);
  r = await call("GET", `/api/chat/messages?channel=lobby&after=${m1.id}`, undefined, b);
  assert.deepEqual(r.data.messages.map((m) => m.id), [m2.id]);

  assert.equal((await call("DELETE", `/api/chat/messages/${m1.id}`, undefined, b)).status, 403);
  const admin = await signIn("admin@dic.test");
  assert.equal((await call("DELETE", `/api/chat/messages/${m1.id}`, undefined, admin)).status, 200);
  r = await call("GET", "/api/chat/messages?channel=lobby", undefined, b);
  assert.deepEqual(r.data.messages.map((m) => m.body), ["hi back"]);
});

test("admin: overview, tables and moderation", async () => {
  const { call, signIn, register } = setup();
  const a = await register("a@nyu.edu");
  await call("POST", "/api/registration/team", { action: "create", name: "Alpha", track: "track-01" }, a);
  await call("POST", "/api/registration/submit", { consent: true }, a);
  const b = await register("b@nyu.edu");
  await call("POST", "/api/registration/team", { action: "none", track: "any" }, b);
  const post = (await call("POST", "/api/board/posts", { kind: "solo", track: "any", title: "Designer here", body: "Hi" }, b)).data.post;

  assert.equal((await call("GET", "/api/admin/overview", undefined, a)).status, 403);
  const admin = await signIn("admin@dic.test");
  assert.equal((await call("GET", "/api/me", undefined, admin)).data.user.admin, true);

  const o = (await call("GET", "/api/admin/overview", undefined, admin)).data;
  assert.equal(o.people.started, 2);
  assert.equal(o.people.submitted, 1);
  assert.equal(o.teams.total, 1);
  assert.deepEqual(o.teams.bySize, [{ size: 1, n: 1 }]);
  assert.equal(o.daily.length, 1);

  const p = (await call("GET", "/api/admin/participants", undefined, admin)).data.participants;
  assert.equal(p.length, 2);
  assert.equal(p[0].team.name, "Alpha");
  assert.equal(p[0].team.captain, true);
  assert.equal(p[1].teamChoice, "none");
  const t = (await call("GET", "/api/admin/teams", undefined, admin)).data.teams;
  assert.equal(t[0].members[0].email, "a@nyu.edu");

  await call("POST", "/api/admin/moderate", { kind: "post", id: post.id, action: "hide" }, admin);
  assert.equal((await call("GET", "/api/board/posts")).data.posts.length, 0);
  const content = (await call("GET", "/api/admin/content?kind=post", undefined, admin)).data.items;
  assert.equal(content[0].removed, "moderator");
  await call("POST", "/api/admin/moderate", { kind: "post", id: post.id, action: "restore" }, admin);
  assert.equal((await call("GET", "/api/board/posts")).data.posts.length, 1);

  await call("POST", "/api/report", { kind: "post", id: post.id, reason: "test" }, a);
  const reports = (await call("GET", "/api/admin/reports", undefined, admin)).data.reports;
  assert.equal(reports[0].target.body, "Hi");
  await call("POST", `/api/admin/reports/${reports[0].id}/resolve`, {}, admin);
  assert.equal((await call("GET", "/api/admin/reports", undefined, admin)).data.reports.length, 0);

  const bId = p[1].userId;
  await call("POST", `/api/admin/users/${bId}/ban`, { banned: true }, admin);
  assert.equal((await call("POST", "/api/chat/messages", { channel: "lobby", body: "x" }, b)).data.error.code, "banned");
});

test("only the website may call from a browser", async () => {
  const { call } = setup({ DIC_ENV: "production", AUTH_SECRET: "x".repeat(40), EMAIL_PROVIDER: "console" });
  assert.equal((await call("GET", "/api/form", undefined, null, { origin: "https://evil.test" })).status, 403);
  const ok = await call("GET", "/api/form", undefined, null, { origin: SITE });
  assert.equal(ok.headers.get("Access-Control-Allow-Origin"), SITE);
  const pre = await call("OPTIONS", "/api/registration", undefined, null, { origin: SITE, raw: true });
  assert.equal(pre.status, 204);
  assert.match(pre.headers.get("Access-Control-Allow-Headers"), /Authorization/);
  assert.throws(() => configFromEnv({ ALLOWED_ORIGINS: SITE }), /AUTH_SECRET/);
  assert.throws(() => configFromEnv({ AUTH_SECRET: "s", ALLOWED_ORIGINS: "*" }), /ALLOWED_ORIGINS/);
});

test("chatbot: off, echo", async () => {
  const off = setup();
  assert.equal((await off.call("POST", "/api/bot/chat", { messages: [{ role: "user", text: "hi" }] })).data.error.code, "bot_off");

  const { call } = setup({ BOT_PROVIDER: "echo" });
  assert.equal((await call("GET", "/api/bot")).data.enabled, true);
  const res = await call("POST", "/api/bot/chat", { messages: [{ role: "assistant", text: "Hello!" }, { role: "user", text: "When is kick-off?" }] }, null, { raw: true });
  assert.equal(res.headers.get("Content-Type"), "text/event-stream; charset=utf-8");
  const ev = await events(res);
  assert.equal(ev.at(-1).type, "done");
  assert.match(ev.filter((e) => e.type === "text").map((e) => e.text).join(""), /When is kick-off\?/);
  assert.equal((await call("POST", "/api/bot/chat", { messages: [] })).status, 400);
});

/* Claude through the SDK, with the HTTP layer stubbed: checks the request we
   send and how replies, refusals and errors reach the page. */
function anthropicStub(reply) {
  const sent = [];
  const sse = (events) => events.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join("");
  const fetchStub = async (url, init) => {
    sent.push({ url: String(url), headers: new Headers(init.headers), body: JSON.parse(init.body) });
    if (reply === "unauthorized") {
      return new Response(JSON.stringify({ type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }),
        { status: 401, headers: { "content-type": "application/json" } });
    }
    const stop = reply === "refusal" ? "refusal" : "end_turn";
    return new Response(sse([
      { type: "message_start", message: { id: "msg_1", type: "message", role: "assistant", model: "claude-opus-5-5", content: [], stop_reason: null, stop_sequence: null,
        usage: { input_tokens: 12, output_tokens: 1, cache_read_input_tokens: 900, cache_creation_input_tokens: 0 } } },
      { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
      { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Kick-off is " } },
      { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "on 9 November." } },
      { type: "content_block_stop", index: 0 },
      { type: "message_delta", delta: { stop_reason: stop, stop_sequence: null }, usage: { output_tokens: 9 } },
      { type: "message_stop" },
    ]), { status: 200, headers: { "content-type": "text/event-stream" } });
  };
  return { sent, fetchStub };
}

test("chatbot: Claude request shape and streaming", async () => {
  const { call, config } = setup({ BOT_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "sk-test" });
  const stub = anthropicStub("ok");
  config.bot.fetch = stub.fetchStub;
  config.bot.knowledgeText = "Kick-off Day: 2026-11-09.";

  const res = await call("POST", "/api/bot/chat", { messages: [{ role: "user", text: "When is kick-off?" }] }, null, { raw: true });
  const ev = await events(res);
  assert.equal(ev.filter((e) => e.type === "text").map((e) => e.text).join(""), "Kick-off is on 9 November.");
  assert.equal(ev.at(-1).type, "done");

  const { url, headers, body } = stub.sent[0];
  assert.match(url, /^https:\/\/api\.anthropic\.com\/v1\/messages(\?|$)/);
  assert.match(headers.get("anthropic-beta"), /server-side-fallback-2026-07-01/);
  assert.equal(body.model, "claude-opus-5-5");
  assert.equal(body.fallbacks, "default");
  assert.equal(body.stream, true);
  assert.deepEqual(body.output_config, { effort: "low" });
  assert.equal(body.system[0].cache_control.type, "ephemeral");
  assert.match(body.system[0].text, /Kick-off Day: 2026-11-09\./);
  const today = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
  assert.ok(!body.system[0].text.includes(today), "today's date stays out of the cached prompt");
  assert.equal(body.messages.at(-1).role, "system");
  assert.match(body.messages.at(-1).content, /^Today's date in Shanghai: \d{4}-\d{2}-\d{2}\.$/);
  assert.equal(body.thinking, undefined);

  /* The same system prompt twice: byte-identical, so it can be cached. */
  await (await call("POST", "/api/bot/chat", { messages: [{ role: "user", text: "Tracks?" }] }, null, { raw: true })).text();
  assert.equal(stub.sent[1].body.system[0].text, body.system[0].text);
});

test("chatbot: refusals and API errors", async () => {
  const refused = setup({ BOT_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "sk-test" });
  refused.config.bot.fetch = anthropicStub("refusal").fetchStub;
  let ev = await events(await refused.call("POST", "/api/bot/chat", { messages: [{ role: "user", text: "?" }] }, null, { raw: true }));
  assert.ok(ev.some((e) => e.type === "refusal"));

  const broken = setup({ BOT_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "sk-wrong" });
  broken.config.bot.fetch = anthropicStub("unauthorized").fetchStub;
  const log = console.error;
  console.error = () => {};
  try {
    ev = await events(await broken.call("POST", "/api/bot/chat", { messages: [{ role: "user", text: "?" }] }, null, { raw: true }));
  } finally {
    console.error = log;
  }
  assert.equal(ev.at(-1).type, "error");
  assert.match(ev.at(-1).message.en, /couldn't answer/);
});
