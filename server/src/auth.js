/*
 * Signing in with an emailed code: no passwords to store or forget.
 *
 *   POST /api/auth/code    { email }        → emails a 6-digit code (10 minutes)
 *   POST /api/auth/verify  { email, code }  → { token, user }
 *   POST /api/auth/logout
 *   GET  /api/me                            → { user }
 *   PATCH /api/me          { displayName }  → { user }
 *
 * The page keeps the token and sends it as "Authorization: Bearer <token>".
 * Only hashes of codes and tokens are stored.
 */
import { fail, email as checkEmail, text, newId, newLoginCode, newToken, sha256 } from "./util.js";
import { limit, MINUTE, HOUR, DAY } from "./ratelimit.js";
import { sendEmail, codeEmail } from "./email.js";

const CODE_TTL = 10 * MINUTE;
const SESSION_TTL = 30 * DAY;
const MAX_ATTEMPTS = 5;

const hashCode = (config, address, code) => sha256(`${config.secret}:code:${address}:${code}`);
const hashToken = (token) => sha256(`session:${token}`);

export const isAdmin = (config, user) => !!user && (config.everyoneAdmin || config.adminEmails.includes(user.email));

export function publicUser(config, user) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name || "",
    admin: isAdmin(config, user),
    banned: !!user.banned,
  };
}

/* ---------------------------------------------------------------- sessions */
/* The signed-in user for this request, or null. */
export async function currentUser(ctx) {
  if (ctx.user !== undefined) return ctx.user;
  ctx.user = null;
  const m = /^Bearer\s+([A-Za-z0-9_-]{20,100})$/.exec(ctx.request.headers.get("Authorization") || "");
  if (!m) return null;
  const row = await ctx.db.get(
    `SELECT u.*, s.token_hash, s.expires_at AS session_expires
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ?`,
    await hashToken(m[1]),
  );
  const t = Date.now();
  if (!row || row.session_expires < t) return null;
  /* Sessions in use stay alive; refreshed at most once an hour. */
  if (!row.last_seen_at || t - row.last_seen_at > HOUR) {
    await ctx.db.batch([
      ["UPDATE users SET last_seen_at = ? WHERE id = ?", t, row.id],
      ["UPDATE sessions SET expires_at = ? WHERE token_hash = ?", t + SESSION_TTL, row.token_hash],
    ]);
  }
  ctx.user = row;
  return row;
}

export async function requireUser(ctx) {
  const user = await currentUser(ctx);
  if (!user) fail(401, "sign_in", "Please sign in first.", "请先登录。");
  return user;
}

export async function requireAdmin(ctx) {
  const user = await requireUser(ctx);
  if (!isAdmin(ctx.config, user)) fail(403, "not_admin", "This page is for DIC organisers only.", "此页面仅限 DIC 组委会使用。");
  return user;
}

/* Posting on Team-up and in chat needs a display name and an account in good standing. */
export function canPost(user) {
  if (user.banned) {
    fail(403, "banned", "Your account can't post right now. If this is a mistake, write to shanghai.dic@nyu.edu.",
      "你的账号暂时无法发言。如有疑问，请联系 shanghai.dic@nyu.edu。");
  }
  if (!user.display_name) fail(400, "need_name", "Choose a display name first.", "请先设置显示名称。");
}

/* ------------------------------------------------------------------ routes */
export async function requestCode(ctx) {
  const { db, config } = ctx;
  const address = checkEmail((await ctx.body()).email);
  await limit(db, `code:ip:${ctx.ip}`, config.limits.codesPerAddressHour, HOUR);
  await limit(db, `code:min:${address}`, 1, MINUTE);
  await limit(db, `code:hour:${address}`, 6, HOUR);

  const code = newLoginCode();
  const t = Date.now();
  await db.run(
    `INSERT INTO login_codes (email, code_hash, expires_at, attempts, created_at) VALUES (?, ?, ?, 0, ?)
     ON CONFLICT (email) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at,
       attempts = 0, created_at = excluded.created_at`,
    address, await hashCode(config, address, code), t + CODE_TTL, t,
  );
  await sendEmail(config, codeEmail(address, code));
  return { ok: true, email: address, ...(config.devReturnCode ? { devCode: code } : {}) };
}

export async function verifyCode(ctx) {
  const { db, config } = ctx;
  const body = await ctx.body();
  const address = checkEmail(body.email);
  const code = String(body.code || "").replace(/\D/g, "");
  await limit(db, `verify:ip:${ctx.ip}`, config.limits.codesPerAddressHour * 3, HOUR);

  const row = await db.get("SELECT * FROM login_codes WHERE email = ?", address);
  if (!row || row.expires_at < Date.now()) {
    fail(400, "code_expired", "This code has expired. Please ask for a new one.", "验证码已过期，请重新获取。");
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    fail(400, "code_locked", "Too many wrong tries. Please ask for a new code.", "错误次数过多，请重新获取验证码。");
  }
  if (code.length !== 6 || row.code_hash !== (await hashCode(config, address, code))) {
    await db.run("UPDATE login_codes SET attempts = attempts + 1 WHERE email = ?", address);
    fail(400, "code_wrong", "That code isn't right. Check the email and try again.", "验证码不正确，请检查邮件后重试。");
  }
  await db.run("DELETE FROM login_codes WHERE email = ?", address);

  const t = Date.now();
  await db.run("INSERT INTO users (id, email, created_at, last_seen_at) VALUES (?, ?, ?, ?) ON CONFLICT (email) DO NOTHING",
    newId("u"), address, t, t);
  const user = await db.get("SELECT * FROM users WHERE email = ?", address);
  const token = newToken();
  await db.run("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
    await hashToken(token), user.id, t, t + SESSION_TTL);
  /* Tidy up: sessions that ran out a while ago. */
  if (Math.random() < 0.05) await db.run("DELETE FROM sessions WHERE expires_at < ?", t);
  return { token, user: publicUser(config, user) };
}

export async function logout(ctx) {
  const m = /^Bearer\s+(\S+)$/.exec(ctx.request.headers.get("Authorization") || "");
  if (m) await ctx.db.run("DELETE FROM sessions WHERE token_hash = ?", await hashToken(m[1]));
  return { ok: true };
}

export async function me(ctx) {
  const user = await requireUser(ctx);
  return { user: publicUser(ctx.config, user) };
}

export async function updateMe(ctx) {
  const user = await requireUser(ctx);
  const body = await ctx.body();
  if ("displayName" in body) {
    const label = { en: "Display name", zh: "显示名称" };
    const name = text(body.displayName, { min: 2, max: 24, field: "displayName", label });
    if (name.includes("@")) fail(400, "invalid", "Please don't use an email address as your name.", "显示名称中请不要包含邮箱地址。", { field: "displayName" });
    await ctx.db.run("UPDATE users SET display_name = ? WHERE id = ?", name, user.id);
    user.display_name = name;
  }
  return { user: publicUser(ctx.config, user) };
}
