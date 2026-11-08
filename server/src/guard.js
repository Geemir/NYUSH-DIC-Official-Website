/*
 * Keeping bots out of sign-in, without third-party CAPTCHAs (Google's is
 * blocked in mainland China; the others are slow or need accounts there).
 *
 *   GET /api/auth/challenge → { challenge, bits }
 *
 * 1. Proof of work. Before asking for a code, the page must find a number n
 *    such that SHA-256("<salt>:<n>") starts with `bits` zero bits. A phone
 *    takes about half a second (assets/js/dic-platform/pow.js); a bot
 *    sending thousands of requests pays that every time. Challenges are
 *    signed (no storage until used), expire after 5 minutes and work once.
 *    The difficulty rises for a network address that keeps asking.
 * 2. A honeypot: a form field people never see. Bots that fill every field
 *    get a normal-looking answer and no email.
 * 3. Email domains: organisers can block a domain on the admin page (and in
 *    BLOCKED_EMAIL_DOMAINS); a short built-in list covers throwaway inboxes.
 *    Codes to any one domain are capped per hour, except the big providers
 *    and schools in TRUSTED_EMAIL_DOMAINS, and all code emails together are
 *    capped too, so the server can't be used to flood inboxes.
 */
import { fail, sha256 } from "./util.js";
import { limit, hits, HOUR } from "./ratelimit.js";

const CHALLENGE_TTL = 5 * 60 * 1000;

/* Throwaway-inbox services: nobody registers for a competition with these. */
export const DISPOSABLE = [
  "mailinator.com", "guerrillamail.com", "guerrillamail.info", "sharklasers.com", "grr.la", "10minutemail.com",
  "10minutemail.net", "temp-mail.org", "tempmail.com", "tempmail.net", "yopmail.com", "yopmail.net", "trashmail.com",
  "getnada.com", "nada.email", "maildrop.cc", "dispostable.com", "throwawaymail.com", "mintemail.com", "fakeinbox.com",
  "mohmal.com", "emailondeck.com", "tempail.com", "mail.tm", "tmpmail.org", "spamgourmet.com", "mailnesia.com",
  "burnermail.io", "linshiyouxiang.net", "bccto.me", "chacuo.net", "027168.com", "zhorachu.com",
];

/* Where most students' mail lives: no per-domain cap for these (and their subdomains). */
export const COMMON = [
  "nyu.edu", "qq.com", "foxmail.com", "163.com", "126.com", "yeah.net", "sina.com", "sina.cn", "sohu.com", "aliyun.com",
  "139.com", "gmail.com", "outlook.com", "hotmail.com", "live.com", "msn.com", "icloud.com", "me.com", "yahoo.com",
  "proton.me", "protonmail.com", "edu.cn", "edu", "edu.hk", "ac.uk", "edu.au", "edu.sg",
];

/* "a@mail.example.com" → "mail.example.com" */
export const domainOf = (address) => String(address).split("@").pop().toLowerCase();

/* Does `domain` equal or sit under any entry of `list`? */
const under = (domain, list) => list.some((d) => domain === d || domain.endsWith("." + d));

/* --------------------------------------------------------------- challenges */
const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function sign(secret, payload) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(`${secret}:pow`), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)))).slice(0, 22);
}

/* The difficulty for this address: a little harder for each burst of requests. */
async function bitsFor(ctx) {
  const base = ctx.config.guard.powBits;
  if (!base) return 0;
  const recent = await hits(ctx.db, `code:ip:${ctx.ip}`, HOUR);
  return Math.min(26, base + (recent > 20 ? 2 : 0) + (recent > 60 ? 2 : 0) + (recent > 150 ? 2 : 0));
}

export async function challenge(ctx) {
  const bits = await bitsFor(ctx);
  if (!bits) return { challenge: "", bits: 0 };
  const salt = b64url(crypto.getRandomValues(new Uint8Array(12)));
  const payload = `${salt}.${Date.now() + CHALLENGE_TTL}.${bits}`;
  return { challenge: `${payload}.${await sign(ctx.config.secret, payload)}`, bits };
}

/* Leading zero bits of a hex SHA-256. */
function zeroBits(hex) {
  let n = 0;
  for (const c of hex) {
    const v = parseInt(c, 16);
    if (v === 0) { n += 4; continue; }
    return n + Math.clz32(v) - 28;
  }
  return n;
}

const retry = () => fail(400, "challenge", "Please try again: the page needs a moment to check your browser.", "请重试：页面需要片刻来验证你的浏览器。");

/* Checks the solved challenge sent with a code request; each works once. */
export async function checkChallenge(ctx, body) {
  if (!ctx.config.guard.powBits) return;
  const parts = String(body.challenge || "").split(".");
  if (parts.length !== 4) retry();
  const [salt, exp, bits, sig] = parts;
  const payload = `${salt}.${exp}.${bits}`;
  if (sig !== (await sign(ctx.config.secret, payload))) retry();
  if (Number(exp) < Date.now()) retry();
  const nonce = String(body.nonce ?? "");
  if (!/^\d{1,12}$/.test(nonce) || zeroBits(await sha256(`${salt}:${nonce}`)) < Number(bits)) retry();
  const t = Date.now();
  try {
    await ctx.db.run("INSERT INTO used_challenges (salt, expires_at) VALUES (?, ?)", salt, Number(exp));
  } catch {
    retry(); // already used
  }
  if (Math.random() < 0.05) await ctx.db.run("DELETE FROM used_challenges WHERE expires_at < ?", t);
}

/* ------------------------------------------------------------------ domains */
export async function isBlocked(ctx, address) {
  const domain = domainOf(address);
  const { blockedDomains } = ctx.config.guard;
  if (under(domain, DISPOSABLE) || under(domain, blockedDomains)) return true;
  const parts = domain.split(".");
  const candidates = parts.map((_, i) => parts.slice(i).join(".")).filter((d) => d.includes("."));
  const row = await ctx.db.get(`SELECT domain FROM blocked_domains WHERE domain IN (${candidates.map(() => "?").join(",")})`, ...candidates);
  return !!row;
}

export const failBlocked = () => fail(403, "email_blocked",
  "This email address can't be used to register. Please use your school email or a personal address you check.",
  "该邮箱无法用于报名，请使用学校邮箱或常用的个人邮箱。");

/* The caps a code request must pass before an email goes out (after isBlocked). */
export async function checkCodeRequest(ctx, address) {
  const { db, config } = ctx;
  const g = config.guard;
  const domain = domainOf(address);
  if (!under(domain, [...COMMON, ...g.trustedDomains])) {
    await limit(db, `code:domain:${domain}`, g.codesPerDomainHour, HOUR);
  }
  await limit(db, "code:all", g.codesTotalHour, HOUR);
}


