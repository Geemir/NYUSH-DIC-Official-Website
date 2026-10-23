/*
 * Team-up board: cards from teams looking for members ("team") and from
 * people looking for a team ("solo"), each with its own reply thread.
 *
 *   GET    /api/board/posts?kind=&track=&mine=1   newest first
 *   POST   /api/board/posts          { kind, track, title, body, skills, contact }
 *   PATCH  /api/board/posts/:id      any of those, or { status: open | closed }
 *   DELETE /api/board/posts/:id
 *   GET    /api/board/posts/:id/replies
 *   POST   /api/board/posts/:id/replies   { body }
 *   DELETE /api/board/replies/:id
 *   POST   /api/report               { kind: post | reply | message, id, reason }
 *
 * Cards can be read without signing in (unless BOARD_PUBLIC_READ=0), but
 * contact details and replies are for signed-in people only.
 */
import { TRACKS, SKILLS } from "./form.js";
import { currentUser, requireUser, isAdmin, canPost } from "./auth.js";
import { fail, text, oneOf, newId } from "./util.js";
import { limit, MINUTE, HOUR, DAY } from "./ratelimit.js";

const KINDS = ["team", "solo"];
const TRACK_CHOICES = [...TRACKS.map((t) => t.id), "any"];
const SKILL_VALUES = SKILLS.map((s) => s.value);
const L = {
  title: { en: "Title", zh: "标题" },
  body: { en: "Description", zh: "介绍" },
  contact: { en: "Contact", zh: "联系方式" },
  reply: { en: "Reply", zh: "回复" },
};

function parseSkills(s) {
  try { return JSON.parse(s); } catch { return []; }
}

function postView(row, viewer, config) {
  return {
    id: row.id,
    kind: row.kind,
    track: row.track,
    title: row.title,
    body: row.body,
    skills: parseSkills(row.skills),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    author: { id: row.user_id, name: row.author_name || "" },
    replies: row.reply_count || 0,
    /* null = hidden from this reader; "" = none given */
    contact: viewer ? row.contact : null,
    mine: !!viewer && viewer.id === row.user_id,
    removed: isAdmin(config, viewer) ? row.removed : undefined,
  };
}

const SELECT_POSTS = `
  SELECT p.*, u.display_name AS author_name,
         (SELECT COUNT(*) FROM replies r WHERE r.post_id = p.id AND r.removed IS NULL) AS reply_count
    FROM posts p JOIN users u ON u.id = p.user_id`;

async function findPost(ctx, id) {
  const row = await ctx.db.get(`${SELECT_POSTS} WHERE p.id = ?`, id);
  if (!row || (row.removed && !isAdmin(ctx.config, await currentUser(ctx)))) {
    fail(404, "no_post", "This card has been removed.", "这张卡片已被删除。");
  }
  return row;
}

function checkPost(body, partial) {
  const out = {};
  const has = (k) => !partial || k in body;
  if (has("kind")) out.kind = oneOf(body.kind, KINDS, { field: "kind" });
  if (has("track")) out.track = oneOf(body.track || "any", TRACK_CHOICES, { field: "track" });
  if (has("title")) out.title = text(body.title, { min: 1, max: 80, field: "title", label: L.title });
  if (has("body")) out.body = text(body.body, { min: 1, max: 1000, multiline: true, field: "body", label: L.body });
  if (has("skills")) {
    const skills = [...new Set((Array.isArray(body.skills) ? body.skills : []).filter((s) => SKILL_VALUES.includes(s)))];
    out.skills = JSON.stringify(skills.slice(0, 6));
  }
  if (has("contact")) out.contact = text(body.contact, { max: 80, field: "contact", label: L.contact });
  if (partial && "status" in body) out.status = oneOf(body.status, ["open", "closed"], { field: "status" });
  return out;
}

/* ------------------------------------------------------------------- posts */
export async function listPosts(ctx) {
  const viewer = await currentUser(ctx);
  if (!viewer && !ctx.config.board.publicRead) fail(401, "sign_in", "Please sign in to see Team-up.", "请登录后查看组队广场。");
  const q = ctx.url.searchParams;
  const where = ["p.removed IS NULL"];
  const args = [];
  if (q.get("mine") === "1" && viewer) {
    where.push("p.user_id = ?");
    args.push(viewer.id);
  } else {
    where.push("p.status = 'open'");
  }
  if (KINDS.includes(q.get("kind"))) {
    where.push("p.kind = ?");
    args.push(q.get("kind"));
  }
  if (TRACKS.some((t) => t.id === q.get("track"))) {
    where.push("(p.track = ? OR p.track = 'any')");
    args.push(q.get("track"));
  }
  const rows = await ctx.db.all(`${SELECT_POSTS} WHERE ${where.join(" AND ")} ORDER BY p.created_at DESC LIMIT 300`, ...args);
  return { posts: rows.map((r) => postView(r, viewer, ctx.config)) };
}

export async function createPost(ctx) {
  const user = await requireUser(ctx);
  canPost(user);
  await limit(ctx.db, `post:${user.id}`, 10, HOUR);
  const p = checkPost(await ctx.body(), false);
  const { n } = await ctx.db.get("SELECT COUNT(*) AS n FROM posts WHERE user_id = ? AND status = 'open' AND removed IS NULL", user.id);
  const max = ctx.config.board.maxOpenPosts;
  if (n >= max) {
    fail(409, "too_many_posts", `You already have ${max} open cards. Close one before posting another.`,
      `你已有 ${max} 张开放中的卡片，请先关闭一张再发布。`);
  }
  const id = newId("p");
  const t = Date.now();
  await ctx.db.run(
    `INSERT INTO posts (id, user_id, kind, track, title, body, skills, contact, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, user.id, p.kind, p.track, p.title, p.body, p.skills, p.contact, t, t);
  return { post: postView(await findPost(ctx, id), user, ctx.config) };
}

export async function updatePost(ctx) {
  const user = await requireUser(ctx);
  const row = await findPost(ctx, ctx.params.id);
  if (row.user_id !== user.id) fail(403, "not_yours", "Only the person who posted this card can change it.", "只有发布者可以修改这张卡片。");
  canPost(user);
  const p = checkPost(await ctx.body(), true);
  const keys = Object.keys(p);
  if (keys.length) {
    await ctx.db.run(`UPDATE posts SET ${keys.map((k) => `${k} = ?`).join(", ")}, updated_at = ? WHERE id = ?`,
      ...keys.map((k) => p[k]), Date.now(), row.id);
  }
  return { post: postView(await findPost(ctx, row.id), user, ctx.config) };
}

export async function deletePost(ctx) {
  const user = await requireUser(ctx);
  const row = await findPost(ctx, ctx.params.id);
  const mine = row.user_id === user.id;
  if (!mine && !isAdmin(ctx.config, user)) fail(403, "not_yours", "Only the person who posted this card can delete it.", "只有发布者可以删除这张卡片。");
  await ctx.db.run("UPDATE posts SET removed = ?, updated_at = ? WHERE id = ?", mine ? "author" : "moderator", Date.now(), row.id);
  return { ok: true };
}

/* ----------------------------------------------------------------- replies */
function replyView(row, viewer) {
  return {
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
    author: { id: row.user_id, name: row.author_name || "" },
    mine: viewer.id === row.user_id,
  };
}

export async function listReplies(ctx) {
  const user = await requireUser(ctx);
  const post = await findPost(ctx, ctx.params.id);
  const rows = await ctx.db.all(
    `SELECT r.*, u.display_name AS author_name FROM replies r JOIN users u ON u.id = r.user_id
      WHERE r.post_id = ? AND r.removed IS NULL ORDER BY r.created_at LIMIT 500`, post.id);
  return { replies: rows.map((r) => replyView(r, user)) };
}

export async function createReply(ctx) {
  const user = await requireUser(ctx);
  canPost(user);
  const post = await findPost(ctx, ctx.params.id);
  if (post.status !== "open") fail(409, "post_closed", "This card is closed: they've found their match.", "这张卡片已关闭：发布者已经找到队友了。");
  await limit(ctx.db, `reply:${user.id}`, 20, 10 * MINUTE);
  const body = text((await ctx.body()).body, { min: 1, max: 1000, multiline: true, field: "body", label: L.reply });
  const id = newId("r");
  await ctx.db.run("INSERT INTO replies (id, post_id, user_id, body, created_at) VALUES (?, ?, ?, ?, ?)", id, post.id, user.id, body, Date.now());
  const row = await ctx.db.get("SELECT r.*, u.display_name AS author_name FROM replies r JOIN users u ON u.id = r.user_id WHERE r.id = ?", id);
  return { reply: replyView(row, user) };
}

export async function deleteReply(ctx) {
  const user = await requireUser(ctx);
  const row = await ctx.db.get("SELECT * FROM replies WHERE id = ? AND removed IS NULL", ctx.params.id);
  if (!row) fail(404, "no_reply", "This reply has been removed.", "这条回复已被删除。");
  const mine = row.user_id === user.id;
  if (!mine && !isAdmin(ctx.config, user)) fail(403, "not_yours", "You can only delete your own replies.", "你只能删除自己的回复。");
  await ctx.db.run("UPDATE replies SET removed = ? WHERE id = ?", mine ? "author" : "moderator", row.id);
  return { ok: true };
}

/* ----------------------------------------------------------------- reports */
export async function report(ctx) {
  const user = await requireUser(ctx);
  await limit(ctx.db, `report:${user.id}`, 20, DAY);
  const body = await ctx.body();
  const kind = oneOf(body.kind, ["post", "reply", "message"], { field: "kind" });
  const id = text(String(body.id ?? ""), { min: 1, max: 40, field: "id" });
  const reason = text(body.reason, { max: 300, multiline: true, field: "reason" });
  await ctx.db.run("INSERT INTO reports (reporter_id, kind, target_id, reason, created_at) VALUES (?, ?, ?, ?, ?)",
    user.id, kind, id, reason, Date.now());
  return { ok: true };
}
