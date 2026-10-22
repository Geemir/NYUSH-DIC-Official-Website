/*
 * Fixed-window rate limits, counted in the database so they hold across
 * server restarts and across Cloudflare's many machines.
 */
import { fail } from "./util.js";

/* Counts one hit on `key`; throws 429 once more than `max` land in the window. */
export async function limit(db, key, max, windowMs) {
  const t = Date.now();
  const start = t - (t % windowMs);
  await db.run(
    `INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
     ON CONFLICT (key) DO UPDATE SET
       count = CASE WHEN window_start = excluded.window_start THEN count + 1 ELSE 1 END,
       window_start = excluded.window_start`,
    key, start,
  );
  const row = await db.get("SELECT count FROM rate_limits WHERE key = ?", key);
  if (row && row.count > max) {
    const wait = Math.ceil((start + windowMs - t) / 1000);
    fail(429, "slow_down",
      `Too many tries. Please wait ${wait > 90 ? Math.ceil(wait / 60) + " minutes" : wait + " seconds"}.`,
      `操作太频繁，请 ${wait > 90 ? Math.ceil(wait / 60) + " 分钟" : wait + " 秒"}后再试。`,
      { retryAfter: wait });
  }
  /* Now and then, clear out windows that ended long ago. */
  if (Math.random() < 0.02) await db.run("DELETE FROM rate_limits WHERE window_start < ?", t - 2 * 86400000);
}

export const MINUTE = 60000;
export const HOUR = 3600000;
export const DAY = 86400000;
