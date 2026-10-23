/*
 * Small helpers shared by the API modules. Web APIs only (crypto,
 * TextEncoder, Response), so the same code runs on Node, on Cloudflare
 * Workers and, in preview mode, in the browser.
 */

/* ------------------------------------------------------------------ errors */
/* Every error the API returns carries a code (for the page's logic) and a
   message in both languages (for people). */
export class HttpError extends Error {
  constructor(status, code, en, zh, extra) {
    super(en);
    this.status = status;
    this.code = code;
    this.zh = zh;
    this.extra = extra;
  }
}

export function fail(status, code, en, zh, extra) {
  throw new HttpError(status, code, en, zh, extra);
}

/* ------------------------------------------------------------------- random */
const ID_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I/L

/* A uniformly random integer in [0, max). */
function randomInt(max) {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / max) * max;
  do crypto.getRandomValues(buf);
  while (buf[0] >= limit);
  return buf[0] % max;
}

function randomString(length, alphabet) {
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[randomInt(alphabet.length)];
  return out;
}

export const newId = (prefix) => prefix + "_" + randomString(14, ID_ALPHABET);
export const newTeamCode = () => randomString(6, CODE_ALPHABET);
export const newLoginCode = () => String(randomInt(1000000)).padStart(6, "0");

export function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sha256(text) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

/* ---------------------------------------------------------------- responses */
export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers },
  });
}

/* ---------------------------------------------------------------- validation */
/* Validators take the field's key (sent back so the page can mark the right
   input) and, optionally, its { en, zh } label for the message. */
const named = (field, label) => label || { en: field, zh: field };

/* Trimmed text with a length limit. Control characters are dropped; line
   breaks survive only where `multiline` is set. */
export function text(value, { max, min = 0, multiline = false, field = "text", label } = {}) {
  const l = named(field, label);
  if (value === undefined || value === null) value = "";
  if (typeof value !== "string" && typeof value !== "number") {
    fail(400, "invalid", `${l.en}: please enter text.`, `${l.zh}：格式不正确。`, { field });
  }
  let s = String(value).replace(multiline ? /[^\S\n]+\n/g : /\s+/g, multiline ? "\n" : " ");
  s = s.replace(multiline ? /[\u0000-\u0009\u000b-\u001f\u007f]/g : /[\u0000-\u001f\u007f]/g, "");
  s = s.replace(/\n{3,}/g, "\n\n").trim();
  if (min && !s) fail(400, "required", `${l.en}: this is required.`, `${l.zh}：此项必填。`, { field });
  if (s.length < min) fail(400, "too_short", `${l.en}: too short.`, `${l.zh}：太短了。`, { field });
  if (max && s.length > max) fail(400, "too_long", `${l.en}: ${max} characters at most.`, `${l.zh}：最多 ${max} 个字符。`, { field });
  return s;
}

export function email(value) {
  const s = String(value || "").trim().toLowerCase();
  if (s.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)) {
    fail(400, "bad_email", "Please enter a valid email address.", "请输入有效的邮箱地址。", { field: "email" });
  }
  return s;
}

/* An http(s) link, or "" when left empty. */
export function link(value, { max = 300, field = "link", label } = {}) {
  const s = text(value, { max, field, label });
  if (!s) return "";
  let url;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(s) ? s : "https://" + s);
  } catch {
    url = null;
  }
  if (!url || !/^https?:$/.test(url.protocol) || !url.hostname.includes(".")) {
    fail(400, "bad_link", "Please enter a full web link, e.g. https://github.com/you/project", "请输入完整的网址，例如 https://github.com/you/project", { field });
  }
  return url.href;
}

export function oneOf(value, allowed, { field = "value", label } = {}) {
  const l = named(field, label);
  if (!allowed.includes(value)) fail(400, "invalid", `${l.en}: please choose one of the options.`, `${l.zh}：请从选项中选择。`, { field });
  return value;
}

export const lower = (s) => String(s || "").trim().toLowerCase();
