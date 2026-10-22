/*
 * Discussion channels on the Team-up page: a lobby and one per track.
 * The page polls for new messages every few seconds while it is open, which
 * works everywhere (including WeChat's browser) without a socket server.
 *
 *   GET    /api/chat/messages?channel=lobby&after=123  → newer than #123 (or the latest 50)
 *   POST   /api/chat/messages        { channel, body }
 *   DELETE /api/chat/messages/:id
 */
import { CHANNELS } from "./form.js";
import { requireUser, isAdmin, canPost } from "./auth.js";
import { fail, text, oneOf } from "./util.js";
import { limit, MINUTE, DAY } from "./ratelimit.js";

const CHANNEL_IDS = CHANNELS.map((c) => c.id);

function messageView(row, viewer) {
  return {
    id: row.id,
    channel: row.channel,
    body: row.body,
    createdAt: row.created_at,
    author: { id: row.user_id, name: row.author_name || "" },
    mine: viewer.id === row.user_id,
  };
}

export async function listMessages(ctx) {
  const user = await requireUser(ctx);
  const q = ctx.url.searchParams;
  const channel = oneOf(q.get("channel") || "lobby", CHANNEL_IDS, { field: "channel" });
  const after = parseInt(q.get("after") || "0", 10) || 0;
  const select = `SELECT m.*, u.display_name AS author_name FROM messages m JOIN users u ON u.id = m.user_id`;
  const rows = after
    ? await ctx.db.all(`${select} WHERE m.channel = ? AND m.id > ? AND m.removed IS NULL ORDER BY m.id LIMIT 100`, channel, after)
    : (await ctx.db.all(`${select} WHERE m.channel = ? AND m.removed IS NULL ORDER BY m.id DESC LIMIT 50`, channel)).reverse();
  return { channel, messages: rows.map((r) => messageView(r, user)) };
}

export async function postMessage(ctx) {
  const user = await requireUser(ctx);
  canPost(user);
  const body = await ctx.body();
  const channel = oneOf(body.channel, CHANNEL_IDS, { field: "channel" });
  const message = text(body.body, { min: 1, max: 1000, multiline: true, field: "body", label: { en: "Message", zh: "消息" } });
  await limit(ctx.db, `chat:${user.id}`, 15, MINUTE);
  await limit(ctx.db, `chat:day:${user.id}`, 300, DAY);
  const { lastId } = await ctx.db.run("INSERT INTO messages (channel, user_id, body, created_at) VALUES (?, ?, ?, ?)",
    channel, user.id, message, Date.now());
  const row = await ctx.db.get("SELECT m.*, u.display_name AS author_name FROM messages m JOIN users u ON u.id = m.user_id WHERE m.id = ?", lastId);
  return { message: messageView(row, user) };
}

export async function deleteMessage(ctx) {
  const user = await requireUser(ctx);
  const row = await ctx.db.get("SELECT * FROM messages WHERE id = ? AND removed IS NULL", parseInt(ctx.params.id, 10) || 0);
  if (!row) fail(404, "no_message", "This message has been removed.", "这条消息已被删除。");
  const mine = row.user_id === user.id;
  if (!mine && !isAdmin(ctx.config, user)) fail(403, "not_yours", "You can only delete your own messages.", "你只能删除自己的消息。");
  await ctx.db.run("UPDATE messages SET removed = ? WHERE id = ?", mine ? "author" : "moderator", row.id);
  return { ok: true };
}
