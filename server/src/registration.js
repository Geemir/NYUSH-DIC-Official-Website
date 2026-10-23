/*
 * Registration: everyone registers for themselves, then creates a team, joins
 * one with its invite code, or goes ahead without a team for now (and finds
 * one on Team-up or at Kick-off Day). A team has 1 to TEAM_MAX members.
 *
 *   GET   /api/registration                  → my registration (see view())
 *   PUT   /api/registration/profile          { profile }               step 1
 *   POST  /api/registration/team             { action: create, name, track }
 *                                            { action: join, code }
 *                                            { action: none, track }   step 2
 *   PATCH /api/registration/team             { name, track, repoUrl, projectTitle, projectSummary }
 *   POST  /api/registration/team/leave
 *   POST  /api/registration/team/remove      { userId }   captain only
 *   POST  /api/registration/team/new-code                 captain only
 *   GET   /api/registration/lookup?code=     → the team behind a code
 *   POST  /api/registration/submit           { consent: true }         last step
 *   POST  /api/registration/withdraw         deletes my registration
 *
 * Every write returns the updated registration, so the page can redraw.
 */
import { PROFILE_FIELDS, TRACKS, TEAM_FIELDS } from "./form.js";
import { requireUser, isAdmin } from "./auth.js";
import { HttpError, fail, text, link, oneOf, newId, newTeamCode } from "./util.js";
import { limit, HOUR } from "./ratelimit.js";

const TRACK_IDS = TRACKS.map((t) => t.id);
const parse = (s, fallback) => {
  try { return JSON.parse(s); } catch { return fallback; }
};

/* ------------------------------------------------------------------ checks */
/* Checks every "About you" answer and reports all problems at once. */
export function checkProfile(input = {}) {
  const out = {};
  const problems = [];
  for (const f of PROFILE_FIELDS) {
    const value = input[f.key];
    const opts = { field: f.key, label: f.label };
    try {
      if (f.type === "tags") {
        const allowed = f.options.map((o) => o.value);
        const picked = [...new Set((Array.isArray(value) ? value : []).filter((v) => allowed.includes(v)))];
        if (picked.length > f.max) fail(400, "too_many", `${f.label.en}: choose up to ${f.max}.`, `${f.label.zh}：最多选择 ${f.max} 项。`, opts);
        if (f.required && !picked.length) fail(400, "required", `${f.label.en}: this is required.`, `${f.label.zh}：此项必填。`, opts);
        out[f.key] = picked;
      } else if (f.type === "select") {
        const v = text(value, { max: 40, min: f.required ? 1 : 0, ...opts });
        out[f.key] = v ? oneOf(v, f.options.map((o) => o.value), opts) : "";
      } else {
        const v = text(value, { max: f.max, min: f.required ? 1 : 0, ...opts });
        if (f.type === "tel" && v && !/^\+?[\d\s()-]{5,}$/.test(v)) {
          fail(400, "bad_phone", `${f.label.en}: digits only, e.g. +86 138 0000 0000.`, `${f.label.zh}：请只填写数字，例如 +86 138 0000 0000。`, opts);
        }
        out[f.key] = v;
      }
    } catch (err) {
      if (!(err instanceof HttpError)) throw err;
      problems.push({ field: f.key, code: err.code, message: { en: err.message, zh: err.zh } });
    }
  }
  if (problems.length) {
    fail(400, "check_fields", "Please check the highlighted answers.", "请检查标出的项目。", { fields: problems });
  }
  return out;
}

export const profileComplete = (profile) =>
  PROFILE_FIELDS.every((f) => !f.required || (Array.isArray(profile[f.key]) ? profile[f.key].length : profile[f.key]));

/* Throws once the deadline for this kind of change has passed (admins excepted). */
function checkOpen(ctx, user, which = "registration") {
  const { closesAt, projectClosesAt } = ctx.config.registration;
  const at = which === "project" ? projectClosesAt : closesAt;
  if (at && Date.now() > at && !isAdmin(ctx.config, user)) {
    if (which === "project") fail(403, "closed", "Project details are locked now.", "项目信息已锁定，无法修改。");
    fail(403, "closed", "Registration has closed, so this can't be changed any more.", "报名已截止，无法再修改。");
  }
}

const normCode = (code) => String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

/* ------------------------------------------------------------------ reads */
async function participantOf(ctx, user) {
  const t = Date.now();
  await ctx.db.run("INSERT INTO participants (user_id, created_at, updated_at) VALUES (?, ?, ?) ON CONFLICT (user_id) DO NOTHING",
    user.id, t, t);
  return ctx.db.get("SELECT * FROM participants WHERE user_id = ?", user.id);
}

async function teamOf(ctx, participant) {
  if (!participant.team_id) return null;
  return ctx.db.get("SELECT * FROM teams WHERE id = ?", participant.team_id);
}

/* Everything the form needs to show where someone stands. */
async function view(ctx, user) {
  const { config } = ctx;
  const p = await ctx.db.get("SELECT * FROM participants WHERE user_id = ?", user.id);
  const profile = p ? parse(p.profile, {}) : {};
  const team = p && (await teamOf(ctx, p));
  let teamView = null;
  if (team) {
    const members = await ctx.db.all(
      `SELECT user_id, profile, status FROM participants WHERE team_id = ? ORDER BY joined_team_at, created_at`, team.id);
    teamView = {
      name: team.name,
      code: team.code,
      track: team.track,
      repoUrl: team.repo_url,
      projectTitle: team.project_title,
      projectSummary: team.project_summary,
      captain: team.captain_id === user.id,
      max: config.registration.teamMax,
      members: members.map((m) => {
        const mp = parse(m.profile, {});
        return {
          id: m.user_id,
          name: mp.name || "",
          school: mp.school || "",
          captain: m.user_id === team.captain_id,
          me: m.user_id === user.id,
          submitted: m.status === "submitted",
        };
      }),
    };
  }
  const t = Date.now();
  const { closesAt, projectClosesAt } = config.registration;
  return {
    registration: p
      ? {
          status: p.status,
          profile,
          profileComplete: profileComplete(profile),
          teamChoice: p.team_choice,
          trackPref: p.track_pref,
          submittedAt: p.submitted_at,
          updatedAt: p.updated_at,
        }
      : null,
    team: teamView,
    open: {
      registration: !closesAt || t <= closesAt || isAdmin(config, user),
      project: !projectClosesAt || t <= projectClosesAt || isAdmin(config, user),
      closesAt,
      projectClosesAt,
    },
  };
}

export async function getRegistration(ctx) {
  return view(ctx, await requireUser(ctx));
}

export async function lookupTeam(ctx) {
  const user = await requireUser(ctx);
  await limit(ctx.db, `lookup:${user.id}`, 30, HOUR);
  const team = await ctx.db.get("SELECT * FROM teams WHERE code = ?", normCode(ctx.url.searchParams.get("code")));
  if (!team) fail(404, "no_team", "No team has this code. Please check it with your captain.", "没有找到这个队伍码，请和队长核对。");
  const members = await ctx.db.all("SELECT user_id, profile FROM participants WHERE team_id = ? ORDER BY joined_team_at", team.id);
  const captain = members.find((m) => m.user_id === team.captain_id);
  return {
    team: {
      name: team.name,
      track: team.track,
      size: members.length,
      max: ctx.config.registration.teamMax,
      captainName: captain ? parse(captain.profile, {}).name || "" : "",
    },
  };
}

/* ------------------------------------------------------------------ writes */
export async function saveProfile(ctx) {
  const user = await requireUser(ctx);
  checkOpen(ctx, user);
  const profile = checkProfile((await ctx.body()).profile);
  await participantOf(ctx, user);
  await ctx.db.run("UPDATE participants SET profile = ?, updated_at = ? WHERE user_id = ?", JSON.stringify(profile), Date.now(), user.id);
  /* Team-up and chat show a display name; start from the person's name. */
  if (!user.display_name && profile.name) {
    await ctx.db.run("UPDATE users SET display_name = ? WHERE id = ?", profile.name.slice(0, 24), user.id);
  }
  return view(ctx, user);
}

export async function chooseTeam(ctx) {
  const user = await requireUser(ctx);
  checkOpen(ctx, user);
  const body = await ctx.body();
  const action = oneOf(body.action, ["create", "join", "none"], { field: "action" });
  const p = await participantOf(ctx, user);
  if (p.team_id) {
    fail(409, "in_team", "You're already in a team. Leave it first to start or join another one.",
      "你已经在一个队伍里了。如需创建或加入其他队伍，请先退出当前队伍。");
  }
  const t = Date.now();
  const { teamMax } = ctx.config.registration;

  if (action === "create") {
    const name = text(body.name, { min: 1, max: TEAM_FIELDS.name.max, field: "name", label: TEAM_FIELDS.name.label });
    const track = oneOf(body.track, TRACK_IDS, { field: "track", label: TEAM_FIELDS.track.label });
    await limit(ctx.db, `team:create:${user.id}`, 10, HOUR);
    for (let attempt = 0; ; attempt++) {
      const id = newId("t");
      try {
        await ctx.db.batch([
          ["INSERT INTO teams (id, code, name, track, captain_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            id, newTeamCode(), name, track, user.id, t, t],
          ["UPDATE participants SET team_id = ?, team_choice = 'team', track_pref = '', joined_team_at = ?, updated_at = ? WHERE user_id = ?",
            id, t, t, user.id],
        ]);
        break;
      } catch (err) {
        if (attempt > 3 || !/unique/i.test(String(err && err.message))) throw err; // code clash: draw again
      }
    }
  } else if (action === "join") {
    await limit(ctx.db, `team:join:${user.id}`, 20, HOUR);
    await limit(ctx.db, `team:join:ip:${ctx.ip}`, ctx.config.limits.codesPerAddressHour, HOUR);
    const team = await ctx.db.get("SELECT * FROM teams WHERE code = ?", normCode(body.code));
    if (!team) fail(404, "no_team", "No team has this code. Please check it with your captain.", "没有找到这个队伍码，请和队长核对。", { field: "code" });
    const { n } = await ctx.db.get("SELECT COUNT(*) AS n FROM participants WHERE team_id = ?", team.id);
    if (n >= teamMax) fail(409, "team_full", `This team is full (${teamMax} members at most).`, `这个队伍已满（最多 ${teamMax} 人）。`, { field: "code" });
    await ctx.db.run("UPDATE participants SET team_id = ?, team_choice = 'team', track_pref = '', joined_team_at = ?, updated_at = ? WHERE user_id = ?",
      team.id, t, t, user.id);
  } else {
    const track = body.track ? oneOf(body.track, [...TRACK_IDS, "any"], { field: "track", label: TEAM_FIELDS.track.label }) : "";
    await ctx.db.run("UPDATE participants SET team_choice = 'none', track_pref = ?, updated_at = ? WHERE user_id = ?", track, t, user.id);
  }
  return view(ctx, user);
}

export async function updateTeam(ctx) {
  const user = await requireUser(ctx);
  const body = await ctx.body();
  const p = await participantOf(ctx, user);
  const team = await teamOf(ctx, p);
  if (!team) fail(404, "no_team_yet", "You're not in a team yet.", "你还没有加入队伍。");
  const sets = [];
  const args = [];
  const F = TEAM_FIELDS;

  if ("name" in body || "track" in body) {
    checkOpen(ctx, user);
    if (team.captain_id !== user.id && !isAdmin(ctx.config, user)) {
      fail(403, "captain_only", "Only the captain can change the team name or track.", "只有队长可以修改队名或赛道。");
    }
    if ("name" in body) { sets.push("name = ?"); args.push(text(body.name, { min: 1, max: F.name.max, field: "name", label: F.name.label })); }
    if ("track" in body) { sets.push("track = ?"); args.push(oneOf(body.track, TRACK_IDS, { field: "track", label: F.track.label })); }
  }
  if ("repoUrl" in body || "projectTitle" in body || "projectSummary" in body) {
    checkOpen(ctx, user, "project");
    if ("repoUrl" in body) { sets.push("repo_url = ?"); args.push(link(body.repoUrl, { max: F.repo_url.max, field: "repoUrl", label: F.repo_url.label })); }
    if ("projectTitle" in body) { sets.push("project_title = ?"); args.push(text(body.projectTitle, { max: F.project_title.max, field: "projectTitle", label: F.project_title.label })); }
    if ("projectSummary" in body) { sets.push("project_summary = ?"); args.push(text(body.projectSummary, { max: F.project_summary.max, field: "projectSummary", label: F.project_summary.label })); }
  }
  if (sets.length) {
    await ctx.db.run(`UPDATE teams SET ${sets.join(", ")}, updated_at = ? WHERE id = ?`, ...args, Date.now(), team.id);
  }
  return view(ctx, user);
}

/* Leaving: a captain hands over to the longest-standing member; the last
   person out closes the team. */
async function removeFromTeam(ctx, team, userId) {
  const t = Date.now();
  const ops = [["UPDATE participants SET team_id = NULL, team_choice = 'none', joined_team_at = NULL, updated_at = ? WHERE user_id = ?", t, userId]];
  if (team.captain_id === userId) {
    const next = await ctx.db.get(
      "SELECT user_id FROM participants WHERE team_id = ? AND user_id != ? ORDER BY joined_team_at LIMIT 1", team.id, userId);
    ops.push(next
      ? ["UPDATE teams SET captain_id = ?, updated_at = ? WHERE id = ?", next.user_id, t, team.id]
      : ["DELETE FROM teams WHERE id = ?", team.id]);
  }
  await ctx.db.batch(ops);
}

export async function leaveTeam(ctx) {
  const user = await requireUser(ctx);
  checkOpen(ctx, user);
  const team = await teamOf(ctx, await participantOf(ctx, user));
  if (!team) fail(404, "no_team_yet", "You're not in a team yet.", "你还没有加入队伍。");
  await removeFromTeam(ctx, team, user.id);
  return view(ctx, user);
}

export async function removeMember(ctx) {
  const user = await requireUser(ctx);
  checkOpen(ctx, user);
  const memberId = text((await ctx.body()).userId, { max: 40, field: "userId" });
  const team = await teamOf(ctx, await participantOf(ctx, user));
  if (!team) fail(404, "no_team_yet", "You're not in a team yet.", "你还没有加入队伍。");
  if (team.captain_id !== user.id) fail(403, "captain_only", "Only the captain can remove members.", "只有队长可以移除队员。");
  if (memberId === user.id) fail(400, "use_leave", "To leave the team yourself, use “Leave team”.", "如需自己退出队伍，请使用“退出队伍”。");
  const member = await ctx.db.get("SELECT user_id FROM participants WHERE user_id = ? AND team_id = ?", memberId, team.id);
  if (!member) fail(404, "not_member", "That person isn't in your team.", "此人不在你的队伍中。");
  await removeFromTeam(ctx, team, memberId);
  return view(ctx, user);
}

/* A fresh invite code, e.g. after the old one was shared too widely. */
export async function newCode(ctx) {
  const user = await requireUser(ctx);
  checkOpen(ctx, user);
  const team = await teamOf(ctx, await participantOf(ctx, user));
  if (!team) fail(404, "no_team_yet", "You're not in a team yet.", "你还没有加入队伍。");
  if (team.captain_id !== user.id) fail(403, "captain_only", "Only the captain can change the invite code.", "只有队长可以更换邀请码。");
  await limit(ctx.db, `team:code:${user.id}`, 10, HOUR);
  await ctx.db.run("UPDATE teams SET code = ?, updated_at = ? WHERE id = ?", newTeamCode(), Date.now(), team.id);
  return view(ctx, user);
}

export async function submit(ctx) {
  const user = await requireUser(ctx);
  checkOpen(ctx, user);
  const body = await ctx.body();
  const p = await participantOf(ctx, user);
  if (!profileComplete(parse(p.profile, {}))) {
    fail(400, "profile_incomplete", "Please finish “About you” first.", "请先填写“关于你”。", { step: "about" });
  }
  if (!p.team_choice) fail(400, "team_choice", "Please choose a team option first.", "请先选择组队方式。", { step: "team" });
  if (body.consent !== true) fail(400, "consent", "Please tick the box to agree before submitting.", "提交前请勾选同意。", { field: "consent" });
  const t = Date.now();
  await ctx.db.run(
    `UPDATE participants SET status = 'submitted', consent_at = COALESCE(consent_at, ?), submitted_at = COALESCE(submitted_at, ?), updated_at = ?
      WHERE user_id = ?`, t, t, t, user.id);
  return view(ctx, user);
}

/* Withdraw: leave any team and delete the registration. The sign-in account
   (and anything posted on Team-up) stays. */
export async function withdraw(ctx) {
  const user = await requireUser(ctx);
  checkOpen(ctx, user);
  const p = await participantOf(ctx, user);
  const team = await teamOf(ctx, p);
  if (team) await removeFromTeam(ctx, team, user.id);
  await ctx.db.run("DELETE FROM participants WHERE user_id = ?", user.id);
  return view(ctx, user);
}
