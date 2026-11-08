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
 * Clean-up (spam sign-ups):
 *   POST /api/admin/users/delete           { ids }  accounts and everything they made
 *   POST /api/admin/participants/delete    { ids }  registrations only (accounts stay)
 *   POST /api/admin/teams/:id/delete       { members: keep | delete }
 *   POST /api/admin/teams/:id/remove-member { userId }
 *   POST /api/admin/reports/delete         { ids }
 *   GET  /api/admin/domains                accounts per email domain, blocked domains
 *   POST /api/admin/domains/block          { domain, reason?, deleteAccounts? }
 *   POST /api/admin/domains/unblock        { domain }
 *
 * The admin page turns participants and teams into tables, and those into
 * Excel / CSV files, in the browser.
 */
import { requireAdmin, isAdmin } from "./auth.js";
import { removeFromTeam } from "./registration.js";
import { COMMON } from "./guard.js";
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

/* ------------------------------------------------------------------ clean-up */
/* For spam sign-ups: remove registrations, whole accounts, teams, reports,
   and block an email domain (deleting its accounts in one go). Admin
   accounts are never deleted, and each action is written to admin_log. */
const MAX_BATCH = 1000;

function idList(value, field = "ids") {
  const ids = [...new Set((Array.isArray(value) ? value : []).map(String))].filter((s) => /^[\w-]{1,40}$/.test(s));
  if (!ids.length) fail(400, "invalid", "Nothing selected.", "未选择任何项。", { field });
  if (ids.length > MAX_BATCH) fail(400, "too_many", `At most ${MAX_BATCH} at a time.`, `一次最多 ${MAX_BATCH} 项。`, { field });
  return ids;
}

const marks = (n) => Array(n).fill("?").join(",");

/* Leave any team (handing captaincy on, or closing an empty team) and drop the registration. */
async function dropRegistration(ctx, userId) {
  const p = await ctx.db.get("SELECT team_id FROM participants WHERE user_id = ?", userId);
  if (!p) return false;
  if (p.team_id) {
    const team = await ctx.db.get("SELECT * FROM teams WHERE id = ?", p.team_id);
    if (team) await removeFromTeam(ctx, team, userId);
  }
  await ctx.db.run("DELETE FROM participants WHERE user_id = ?", userId);
  return true;
}

/* Deletes accounts and everything they made. Returns how many were deleted; admins are skipped. */
async function eraseUsers(ctx, admin, ids) {
  const users = await ctx.db.all(`SELECT id, email FROM users WHERE id IN (${marks(ids.length)})`, ...ids);
  const victims = users.filter((u) => u.id !== admin.id && !isAdmin(ctx.config, u));
  for (const u of victims) {
    await dropRegistration(ctx, u.id);
    const posts = (await ctx.db.all("SELECT id FROM posts WHERE user_id = ?", u.id)).map((r) => r.id);
    const ops = [];
    if (posts.length) {
      ops.push([`DELETE FROM replies WHERE post_id IN (${marks(posts.length)})`, ...posts]);
      ops.push([`DELETE FROM reports WHERE kind = 'post' AND target_id IN (${marks(posts.length)})`, ...posts]);
    }
    ops.push(
      ["DELETE FROM reports WHERE kind = 'reply' AND target_id IN (SELECT id FROM replies WHERE user_id = ?)", u.id],
      ["DELETE FROM reports WHERE kind = 'message' AND target_id IN (SELECT CAST(id AS TEXT) FROM messages WHERE user_id = ?)", u.id],
      ["DELETE FROM reports WHERE reporter_id = ?", u.id],
      ["DELETE FROM posts WHERE user_id = ?", u.id],
      ["DELETE FROM replies WHERE user_id = ?", u.id],
      ["DELETE FROM messages WHERE user_id = ?", u.id],
      ["DELETE FROM sessions WHERE user_id = ?", u.id],
      ["DELETE FROM login_codes WHERE email = ?", u.email],
      ["DELETE FROM users WHERE id = ?", u.id],
    );
    await ctx.db.batch(ops);
  }
  return { deleted: victims.length, skipped: users.length - victims.length };
}

/* POST /api/admin/users/delete { ids } → deletes the accounts and all they made */
export async function deleteUsers(ctx) {
  const admin = await requireAdmin(ctx);
  const ids = idList((await ctx.body()).ids);
  const r = await eraseUsers(ctx, admin, ids);
  await log(ctx, admin, "delete accounts", `${r.deleted}: ${ids.slice(0, 20).join(" ")}`);
  return { ok: true, ...r };
}

/* POST /api/admin/participants/delete { ids } → removes registrations (the accounts stay) */
export async function deleteRegistrations(ctx) {
  const admin = await requireAdmin(ctx);
  const ids = idList((await ctx.body()).ids);
  let deleted = 0;
  for (const id of ids) if (await dropRegistration(ctx, id)) deleted++;
  await log(ctx, admin, "delete registrations", `${deleted}: ${ids.slice(0, 20).join(" ")}`);
  return { ok: true, deleted };
}

/* POST /api/admin/teams/:id/delete { members: "keep" | "delete" }
   keep: the team closes, its members stay registered without a team;
   delete: the members' accounts go too (for spam teams). */
export async function deleteTeam(ctx) {
  const admin = await requireAdmin(ctx);
  const members = oneOf((await ctx.body()).members || "keep", ["keep", "delete"], { field: "members" });
  const team = await ctx.db.get("SELECT * FROM teams WHERE id = ?", ctx.params.id);
  if (!team) fail(404, "not_found", "No such team.", "没有这个队伍。");
  const ids = (await ctx.db.all("SELECT user_id FROM participants WHERE team_id = ?", team.id)).map((r) => r.user_id);
  let accounts = 0;
  if (members === "delete" && ids.length) accounts = (await eraseUsers(ctx, admin, ids)).deleted;
  const t = Date.now();
  await ctx.db.batch([
    ["UPDATE participants SET team_id = NULL, team_choice = 'none', joined_team_at = NULL, updated_at = ? WHERE team_id = ?", t, team.id],
    ["DELETE FROM teams WHERE id = ?", team.id],
  ]);
  await log(ctx, admin, members === "delete" ? "delete team and members" : "disband team", `${team.name} (${team.code})`);
  return { ok: true, accounts };
}

/* POST /api/admin/teams/:id/remove-member { userId } */
export async function removeTeamMember(ctx) {
  const admin = await requireAdmin(ctx);
  const userId = String((await ctx.body()).userId || "");
  const team = await ctx.db.get("SELECT * FROM teams WHERE id = ?", ctx.params.id);
  const member = team && (await ctx.db.get("SELECT user_id FROM participants WHERE user_id = ? AND team_id = ?", userId, team.id));
  if (!member) fail(404, "not_member", "That person isn't in this team.", "此人不在该队伍中。");
  await removeFromTeam(ctx, team, userId);
  await log(ctx, admin, "remove from team", `${userId} ← ${team.name} (${team.code})`);
  return { ok: true };
}

/* POST /api/admin/reports/delete { ids } → deletes reports (e.g. spam reports) */
export async function deleteReports(ctx) {
  const admin = await requireAdmin(ctx);
  const ids = idList((await ctx.body()).ids).map(Number).filter(Number.isInteger);
  const r = await ctx.db.run(`DELETE FROM reports WHERE id IN (${marks(ids.length)})`, ...ids);
  await log(ctx, admin, "delete reports", ids.join(" "));
  return { ok: true, deleted: r.changes };
}

/* GET /api/admin/domains → accounts per email domain, and the blocked list */
export async function domains(ctx) {
  await requireAdmin(ctx);
  const rows = await ctx.db.all(
    `SELECT lower(substr(u.email, instr(u.email, '@') + 1)) AS domain,
            COUNT(*) AS accounts,
            SUM(CASE WHEN p.user_id IS NOT NULL THEN 1 ELSE 0 END) AS registrations,
            SUM(CASE WHEN p.status = 'submitted' THEN 1 ELSE 0 END) AS submitted,
            SUM(CASE WHEN u.created_at > ? THEN 1 ELSE 0 END) AS lastDay,
            MAX(u.created_at) AS newest
       FROM users u LEFT JOIN participants p ON p.user_id = u.id
      GROUP BY domain ORDER BY accounts DESC, newest DESC LIMIT 100`, Date.now() - DAY);
  const blocked = [
    ...(await ctx.db.all("SELECT domain, reason, created_by AS createdBy, created_at AS createdAt FROM blocked_domains ORDER BY created_at DESC"))
      .map((b) => ({ ...b, source: "admin" })),
    ...ctx.config.guard.blockedDomains.map((domain) => ({ domain, source: "settings" })),
  ];
  const under = (domain, list) => list.some((d) => domain === d || domain.endsWith("." + d));
  return {
    domains: rows.map((r) => ({
      ...r,
      common: under(r.domain, COMMON),
      blocked: under(r.domain, blocked.map((b) => b.domain)),
      organisers: ctx.config.adminEmails.some((e) => under(e.split("@").pop(), [r.domain])),
    })),
    blocked,
  };
}

const domainArg = (value) => {
  const d = String(value || "").trim().toLowerCase().replace(/^@/, "");
  if (!/^(?=.{3,253}$)([a-z0-9-]+\.)+[a-z]{2,}$/.test(d)) fail(400, "invalid", "Please enter a domain like example.com.", "请输入域名，例如 example.com。", { field: "domain" });
  return d;
};

/* POST /api/admin/domains/block { domain, reason?, deleteAccounts? } */
export async function blockDomain(ctx) {
  const admin = await requireAdmin(ctx);
  const body = await ctx.body();
  const domain = domainArg(body.domain);
  if (ctx.config.adminEmails.some((e) => e.endsWith("@" + domain) || e.endsWith("." + domain))) {
    fail(400, "admin_domain", "An organiser's email is on this domain, so it can't be blocked.", "组委会成员的邮箱属于该域名，无法屏蔽。");
  }
  if (COMMON.includes(domain)) {
    fail(400, "common_domain", "This is a common provider or school domain; block single accounts instead.", "这是常用邮箱或学校域名，请改为删除单个账号。");
  }
  const reason = String(body.reason || "").slice(0, 200);
  await ctx.db.run("INSERT INTO blocked_domains (domain, reason, created_by, created_at) VALUES (?, ?, ?, ?) ON CONFLICT (domain) DO UPDATE SET reason = excluded.reason",
    domain, reason, admin.email, Date.now());
  let deleted = 0;
  if (body.deleteAccounts === true) {
    const ids = (await ctx.db.all("SELECT id FROM users WHERE email LIKE ? OR email LIKE ?", `%@${domain}`, `%.${domain}`)).map((r) => r.id);
    for (let i = 0; i < ids.length; i += MAX_BATCH) deleted += (await eraseUsers(ctx, admin, ids.slice(i, i + MAX_BATCH))).deleted;
  }
  await log(ctx, admin, body.deleteAccounts === true ? "block domain and delete accounts" : "block domain", `${domain}${deleted ? ` (${deleted} accounts)` : ""}`);
  return { ok: true, domain, deleted };
}

/* POST /api/admin/domains/unblock { domain } */
export async function unblockDomain(ctx) {
  const admin = await requireAdmin(ctx);
  const domain = domainArg((await ctx.body()).domain);
  const r = await ctx.db.run("DELETE FROM blocked_domains WHERE domain = ?", domain);
  if (!r.changes) fail(404, "not_found", "That domain isn't on the list (domains in BLOCKED_EMAIL_DOMAINS are changed on the server).", "该域名不在屏蔽列表中（BLOCKED_EMAIL_DOMAINS 中的域名需在服务器上修改）。");
  await log(ctx, admin, "unblock domain", domain);
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
