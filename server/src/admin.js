/*
 * The organisers' side. Only addresses listed in ADMIN_EMAILS get in.
 *
 *   GET  /api/admin/overview        counts for the dashboard
 *   GET  /api/admin/participants    everyone who started registering
 *   GET  /api/admin/teams           every team with its members
 *   GET  /api/admin/content?kind=post|reply|message   latest, removed ones too
 *   GET  /api/admin/reports         open reports
 *   POST /api/admin/moderate        { kind, id, action: hide | restore }
 *   POST /api/admin/reports/:id/resolve
 *   POST /api/admin/users/:id/ban   { banned: true | false }
 *
 * The admin page turns participants and teams into tables, and those into
 * Excel / CSV files, in the browser.
 */
import { requireAdmin } from "./auth.js";
import { fail, oneOf } from "./util.js";
import { HOUR, DAY } from "./ratelimit.js";

const parse = (s, fallback) => {
  try { return JSON.parse(s); } catch { return fallback; }
};

async function log(ctx, admin, action, target) {
  await ctx.db.run("INSERT INTO admin_log (admin_id, action, target, created_at) VALUES (?, ?, ?, ?)", admin.id, action, target, Date.now());
}

export async function overview(ctx) {
  await requireAdmin(ctx);
  const { db } = ctx;
  const n = async (sql, ...args) => (await db.get(sql, ...args)).n;
  const t = Date.now();

  /* Submissions per day (China time), last 30 days. */
  const since = t - 30 * DAY;
  const days = {};
  for (const row of await db.all("SELECT submitted_at FROM participants WHERE submitted_at >= ?", since)) {
    const d = new Date(row.submitted_at + 8 * HOUR).toISOString().slice(0, 10);
    days[d] = (days[d] || 0) + 1;
  }

  return {
    people: {
      accounts: await n("SELECT COUNT(*) AS n FROM users"),
      started: await n("SELECT COUNT(*) AS n FROM participants"),
      submitted: await n("SELECT COUNT(*) AS n FROM participants WHERE status = 'submitted'"),
      withoutTeam: await n("SELECT COUNT(*) AS n FROM participants WHERE status = 'submitted' AND team_id IS NULL"),
    },
    teams: {
      total: await n("SELECT COUNT(*) AS n FROM teams"),
      byTrack: await db.all("SELECT track, COUNT(*) AS n FROM teams GROUP BY track ORDER BY track"),
      bySize: await db.all(
        `SELECT size, COUNT(*) AS n FROM (SELECT COUNT(*) AS size FROM participants WHERE team_id IS NOT NULL GROUP BY team_id)
          GROUP BY size ORDER BY size`),
    },
    teamUp: {
      openPosts: await n("SELECT COUNT(*) AS n FROM posts WHERE status = 'open' AND removed IS NULL"),
      messagesToday: await n("SELECT COUNT(*) AS n FROM messages WHERE created_at > ?", t - DAY),
      openReports: await n("SELECT COUNT(*) AS n FROM reports WHERE resolved_at IS NULL"),
    },
    daily: Object.entries(days).sort().map(([day, count]) => ({ day, count })),
  };
}

export async function participants(ctx) {
  await requireAdmin(ctx);
  const rows = await ctx.db.all(
    `SELECT p.*, u.email, u.display_name, u.banned, u.last_seen_at,
            t.name AS team_name, t.code AS team_code, t.track AS team_track, t.captain_id
       FROM participants p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN teams t ON t.id = p.team_id
      ORDER BY p.created_at`);
  return {
    participants: rows.map((r) => ({
      userId: r.user_id,
      email: r.email,
      displayName: r.display_name,
      banned: !!r.banned,
      status: r.status,
      profile: parse(r.profile, {}),
      teamChoice: r.team_choice,
      trackPref: r.track_pref,
      team: r.team_id ? { id: r.team_id, name: r.team_name, code: r.team_code, track: r.team_track, captain: r.captain_id === r.user_id } : null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      submittedAt: r.submitted_at,
      lastSeenAt: r.last_seen_at,
    })),
  };
}

export async function teams(ctx) {
  await requireAdmin(ctx);
  const teamRows = await ctx.db.all("SELECT * FROM teams ORDER BY created_at");
  const memberRows = await ctx.db.all(
    `SELECT p.user_id, p.team_id, p.profile, p.status, u.email
       FROM participants p JOIN users u ON u.id = p.user_id
      WHERE p.team_id IS NOT NULL ORDER BY p.joined_team_at`);
  const byTeam = {};
  for (const m of memberRows) (byTeam[m.team_id] = byTeam[m.team_id] || []).push(m);
  return {
    teams: teamRows.map((t) => ({
      id: t.id,
      name: t.name,
      code: t.code,
      track: t.track,
      repoUrl: t.repo_url,
      projectTitle: t.project_title,
      projectSummary: t.project_summary,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
      members: (byTeam[t.id] || []).map((m) => {
        const profile = parse(m.profile, {});
        return {
          userId: m.user_id,
          email: m.email,
          name: profile.name || "",
          wechat: profile.wechat || "",
          school: profile.school || "",
          submitted: m.status === "submitted",
          captain: m.user_id === t.captain_id,
        };
      }),
    })),
  };
}

/* ---------------------------------------------------------------- moderation */
const TABLES = { post: "posts", reply: "replies", message: "messages" };

export async function content(ctx) {
  await requireAdmin(ctx);
  const kind = oneOf(ctx.url.searchParams.get("kind") || "post", Object.keys(TABLES), { field: "kind" });
  const extra = kind === "post" ? "x.title, x.kind AS post_kind, x.status," : kind === "message" ? "x.channel," : "x.post_id,";
  const rows = await ctx.db.all(
    `SELECT x.id, x.body, x.removed, x.created_at, ${extra} x.user_id, u.email, u.display_name, u.banned
       FROM ${TABLES[kind]} x JOIN users u ON u.id = x.user_id
      ORDER BY x.created_at DESC LIMIT 200`);
  return {
    kind,
    items: rows.map((r) => ({
      id: r.id,
      title: r.title,
      postKind: r.post_kind,
      status: r.status,
      channel: r.channel,
      postId: r.post_id,
      body: r.body,
      removed: r.removed,
      createdAt: r.created_at,
      author: { id: r.user_id, email: r.email, name: r.display_name, banned: !!r.banned },
    })),
  };
}

export async function reports(ctx) {
  await requireAdmin(ctx);
  const rows = await ctx.db.all(
    `SELECT r.*, u.email AS reporter_email FROM reports r JOIN users u ON u.id = r.reporter_id
      WHERE r.resolved_at IS NULL ORDER BY r.created_at DESC LIMIT 200`);
  const out = [];
  for (const r of rows) {
    const target = await ctx.db.get(
      `SELECT x.body, x.removed, x.user_id, u.email, u.display_name FROM ${TABLES[r.kind]} x JOIN users u ON u.id = x.user_id WHERE x.id = ?`,
      r.kind === "message" ? Number(r.target_id) : r.target_id);
    out.push({
      id: r.id,
      kind: r.kind,
      targetId: r.target_id,
      reason: r.reason,
      createdAt: r.created_at,
      reporter: r.reporter_email,
      target: target && { body: target.body, removed: target.removed, author: { id: target.user_id, email: target.email, name: target.display_name } },
    });
  }
  return { reports: out };
}

export async function moderate(ctx) {
  const admin = await requireAdmin(ctx);
  const body = await ctx.body();
  const kind = oneOf(body.kind, Object.keys(TABLES), { field: "kind" });
  const action = oneOf(body.action, ["hide", "restore"], { field: "action" });
  const id = kind === "message" ? Number(body.id) : String(body.id || "");
  const r = await ctx.db.run(`UPDATE ${TABLES[kind]} SET removed = ? WHERE id = ?`, action === "hide" ? "moderator" : null, id);
  if (!r.changes) fail(404, "not_found", "Not found.", "未找到。");
  await log(ctx, admin, `${action} ${kind}`, String(id));
  return { ok: true };
}

export async function resolveReport(ctx) {
  const admin = await requireAdmin(ctx);
  await ctx.db.run("UPDATE reports SET resolved_at = ?, resolved_by = ? WHERE id = ?", Date.now(), admin.id, Number(ctx.params.id));
  await log(ctx, admin, "resolve report", ctx.params.id);
  return { ok: true };
}

export async function ban(ctx) {
  const admin = await requireAdmin(ctx);
  const banned = (await ctx.body()).banned === true;
  const r = await ctx.db.run("UPDATE users SET banned = ? WHERE id = ?", banned ? 1 : 0, ctx.params.id);
  if (!r.changes) fail(404, "not_found", "No such account.", "没有这个账号。");
  await log(ctx, admin, banned ? "ban" : "unban", ctx.params.id);
  return { ok: true };
}
