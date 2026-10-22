/*
 * The DIC API, from the browser: where it lives, who is signed in, and
 * preview mode.
 *
 * The API's address comes from _data/dic2026.yml (platform.api_url), which
 * the page prints into <script id="dic-platform">. Three modes:
 *   live     the address is set: everything talks to the real API
 *   preview  no address yet, but the link had ?preview=1 (remembered for the
 *            rest of the tab's visit): the real API code runs inside this
 *            browser with a throwaway database, see preview.js
 *   off      no address: the pages say "opening soon"
 */
const config = JSON.parse((document.getElementById("dic-platform") || {}).textContent || "{}");
export const base = config.base || "/";
export const chatbotOn = !!config.chatbot;

const read = (key, storage = localStorage) => {
  try { return storage.getItem(key); } catch { return null; }
};
const write = (key, value, storage = localStorage) => {
  try {
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, value);
  } catch { /* private mode: nothing is remembered */ }
};

/* Working on a local copy of the site? Point it at a local API with
   localStorage.setItem("dic-api", "http://localhost:8787") in the console. */
const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
const apiBase = ((local && read("dic-api")) || config.api || "").replace(/\/+$/, "");

const query = new URLSearchParams(location.search);
if (query.get("preview") === "1") write("dic-preview", "1", sessionStorage);
if (query.get("preview") === "0") write("dic-preview", null, sessionStorage);
export const mode = apiBase ? "live" : read("dic-preview", sessionStorage) === "1" ? "preview" : "off";

export function leavePreview() {
  write("dic-preview", null, sessionStorage);
  location.href = location.pathname;
}

/* ------------------------------------------------------------------ errors */
export class ApiError extends Error {
  constructor(status, code, message, details = {}) {
    super(message.en);
    this.status = status;
    this.code = code;
    this.pair = message; // { en, zh }
    this.details = details;
  }
}

const OFFLINE = { en: "Can't reach the server. Check your connection and try again.", zh: "无法连接服务器，请检查网络后重试。" };
const OFF = { en: "This isn't open yet.", zh: "尚未开放。" };

/* ---------------------------------------------------------------- requests */
let preview = null;
async function send(path, init) {
  if (mode === "preview") {
    preview ??= import("./preview.js").then((m) => m.startPreview(base));
    return (await preview)(path, init);
  }
  return fetch(apiBase + path, init);
}

const TOKEN_KEY = mode === "preview" ? "dic-preview-token" : "dic-token";
let token = read(TOKEN_KEY);
let user = null;
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn(user));

function forget() {
  token = null;
  write(TOKEN_KEY, null);
  if (user) {
    user = null;
    emit();
  }
}

function request(method, path, body) {
  const init = { method, headers: {} };
  if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  if (token) init.headers.Authorization = "Bearer " + token;
  return send(path, init);
}

async function failure(res) {
  let data = {};
  try { data = await res.json(); } catch { /* not JSON */ }
  if (res.status === 401 && token) forget(); // the session ran out
  const e = data.error || {};
  return new ApiError(res.status, e.code || "error", e.message || { en: `Error ${res.status}`, zh: `出错了（${res.status}）` }, e);
}

/* JSON in, JSON out. Throws ApiError, whose .pair is a message to show. */
export async function api(method, path, body) {
  if (mode === "off") throw new ApiError(0, "off", OFF);
  let res;
  try {
    res = await request(method, path, body);
  } catch (err) {
    console.error(err);
    throw new ApiError(0, "network", OFFLINE);
  }
  if (!res.ok) throw await failure(res);
  return res.json();
}

/* Server-sent events (the assistant's replies): onEvent gets each event. */
export async function stream(path, body, onEvent) {
  let res;
  try {
    res = await request("POST", path, body);
  } catch (err) {
    console.error(err);
    throw new ApiError(0, "network", OFFLINE);
  }
  if (!res.ok) throw await failure(res);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let end;
    while ((end = buffer.indexOf("\n\n")) >= 0) {
      const line = buffer.slice(0, end).split("\n").find((l) => l.startsWith("data: "));
      buffer = buffer.slice(end + 2);
      if (line) onEvent(JSON.parse(line.slice(6)));
    }
  }
}

/* ----------------------------------------------------------------- session */
export const session = {
  get user() { return user; },
  onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  /* Picks up a sign-in from an earlier visit. */
  async restore() {
    if (!token || mode === "off") return null;
    try {
      user = (await api("GET", "/api/me")).user;
    } catch (err) {
      if (err.status !== 401) throw err;
    }
    emit();
    return user;
  },
  sendCode: (email) => api("POST", "/api/auth/code", { email }),
  async verify(email, code) {
    const r = await api("POST", "/api/auth/verify", { email, code });
    token = r.token;
    write(TOKEN_KEY, token);
    user = r.user;
    emit();
    return user;
  },
  async signOut() {
    try { await api("POST", "/api/auth/logout", {}); } catch { /* signed out here anyway */ }
    forget();
  },
  update(next) {
    user = next;
    emit();
  },
};

/* The questions, tracks and channels (GET /api/form), fetched once. */
let form = null;
export function getForm() {
  form ??= api("GET", "/api/form").catch((err) => {
    form = null;
    throw err;
  });
  return form;
}
