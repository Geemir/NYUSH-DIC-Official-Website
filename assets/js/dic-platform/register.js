/*
 * Registration (/DIC2026/register/): a step-by-step form, then a page to see
 * and change your registration.
 *
 *   01 Sign in → 02 About you → 03 Team → 04 Project → 05 Review → registered
 *
 * Each step saves to the API, so people can stop and come back later. The
 * questions come from the API (server/src/form.js). A link with ?join=CODE
 * (the captain's invite link) opens the "join a team" option with the code
 * filled in.
 */
import { api, session, getForm, mode, base } from "./api.js";
import {
  h, t, text, clear, win, facts, field, chipsField, choiceField, readFields, missing, showErrors, clearErrors,
  setStatus, errorPair, busy, toast, confirmBox, copyText, stamp, day,
} from "./ui.js";
import { signInForm, accountBar, previewBanner, soonPanel } from "./account.js";

const root = document.querySelector("[data-register]");
const STEPS = [
  { id: "signin", en: "Sign in", zh: "登录" },
  { id: "about", en: "About you", zh: "关于你" },
  { id: "team", en: "Team", zh: "组队" },
  { id: "project", en: "Project", zh: "项目" },
  { id: "review", en: "Review", zh: "确认" },
];
const joinCode = (new URLSearchParams(location.search).get("join") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);

let form = null; // the questions (GET /api/form)
let state = null; // my registration (GET /api/registration)
let editing = false; // changing one part of a submitted registration
let bar = null; // "signed in as …"

/* Extra input hints for the API's questions. */
const AUTOCOMPLETE = { name: "name", phone: "tel", school: "organization" };

const track = (id) => form.tracks.find((tr) => tr.id === id);
const trackLabel = (id) => (id === "any" ? { en: "Any track", zh: "任意赛道" } : track(id) || { en: id, zh: id });
const trackKicker = (id) => `TRACK ${id.slice(-2)}`;

/* ------------------------------------------------------------------ start */
async function start() {
  const banner = previewBanner();
  if (banner) root.before(banner);
  if (mode === "off") {
    root.append(soonPanel("d-soon", "REGISTER.EXE"));
    return;
  }
  root.append(h("p.d-loading", t({ en: "Loading…", zh: "加载中…" })));
  try {
    [form] = await Promise.all([getForm(), session.restore()]);
    bar = accountBar();
    session.onChange((user) => {
      if (!user) {
        state = null;
        show("signin");
      }
    });
    if (session.user) await load();
    else show("signin", false);
  } catch (err) {
    clear(root).append(win("REGISTER.EXE", h("p.d-status.d-status--error", t(errorPair(err)))));
  }
}

async function load(moveFocus = false) {
  state = await api("GET", "/api/registration");
  show(firstStep(), moveFocus);
}

function firstStep() {
  const r = state.registration;
  if (r && r.status === "submitted") return joinCode && !state.team ? edit("team") : "done";
  if (!r || !r.profileComplete) return "about";
  if (!r.teamChoice || (joinCode && !state.team)) return "team";
  return "review";
}

function edit(step) {
  editing = true;
  return step;
}

/* After saving a step: on to the next one, or back to the summary. */
function next(from) {
  if (editing) {
    editing = false;
    return show("done");
  }
  const order = ["about", "team", "project", "review"];
  show(order[order.indexOf(from) + 1] || "review");
}

/* ------------------------------------------------------------------ frame */
function show(step, moveFocus = true) {
  const body = {
    signin: signInStep, about: aboutStep, team: teamStep, project: projectStep, review: reviewStep, done: summary,
  }[step]();
  clear(root);
  if (step === "done") root.append(body);
  else root.append(win(editing ? "EDIT.EXE" : "REGISTER.EXE", editing ? null : stepper(step), body));
  root.append(bar);
  if (moveFocus) {
    const top = root.getBoundingClientRect().top;
    if (top < 0) window.scrollBy({ top: top - 24 });
    const heading = root.querySelector(".d-step__title, .d-done__title");
    if (heading) heading.focus({ preventScroll: true });
  }
}

/* 01 ─ 02 ─ 03 … with finished steps ticked; finished steps can be revisited. */
function stepper(current) {
  const index = STEPS.findIndex((s) => s.id === current);
  const r = state && state.registration;
  const reachable = (id) => {
    if (!session.user) return id === "signin";
    if (id === "signin") return false;
    if (id === "about") return true;
    if (!r || !r.profileComplete) return false;
    return id === "team" || !!r.teamChoice;
  };
  return h("ol.d-steps", { "aria-label": { en: "Registration steps", zh: "报名步骤" } },
    STEPS.map((s, i) => {
      const phase = i < index ? "done" : i === index ? "now" : "next";
      const inner = [h("span.d-steps__num", `0${i + 1}`), h("span.d-steps__name", t(s))];
      return h(`li.d-steps__item.is-${phase}`, { "aria-current": i === index ? "step" : null },
        i !== index && reachable(s.id)
          ? h("button.d-steps__link", { type: "button", on: { click: () => show(s.id) } }, inner)
          : h("span.d-steps__link", inner));
    }));
}

function stepHead(title, lead) {
  return [
    h("h2.d-step__title", { tabindex: "-1" }, t(title)),
    lead ? h("div.d-pair.d-step__lead", h("p", t(lead))) : null,
  ];
}

function actions(...buttons) {
  return h("div.d-actions", buttons);
}

function backButton(to) {
  if (editing) return h("button.d-btn.d-btn--ghost", { type: "button", on: { click: () => { editing = false; show("done"); } } }, t({ en: "Cancel", zh: "取消" }));
  return to ? h("button.d-btn.d-btn--ghost", { type: "button", on: { click: () => show(to) } }, "← ", t({ en: "Back", zh: "上一步" })) : null;
}

const saveLabel = () => (editing ? { en: "Save", zh: "保存" } : { en: "Save and continue", zh: "保存并继续" });

/* ------------------------------------------------------------- 01 sign in */
function signInStep() {
  return h("div.d-step",
    stepHead({ en: "Sign in with your email", zh: "用邮箱登录" },
      { en: "Your email is your account: use it to come back to your registration at any time.", zh: "邮箱就是你的账号，之后随时可以用它回来查看或修改报名信息。" }),
    signInForm({ onDone: () => load(true), focus: false }));
}

/* ----------------------------------------------------------- 02 about you */
function aboutStep() {
  const values = (state.registration && state.registration.profile) || {};
  const fields = form.profile.map((def) => {
    const d = { ...def, autocomplete: AUTOCOMPLETE[def.key] };
    if (d.type === "tags") return chipsField(d, values[d.key]);
    return field(d, values[d.key] || "");
  });
  const status = h("p.d-status", { role: "alert" });
  const save = h("button.d-btn.d-btn--primary", { type: "submit" }, t(saveLabel()), editing ? null : " →");
  const f = h("form.d-form", { novalidate: true },
    stepHead({ en: "About you", zh: "关于你" }, { en: "Fields marked * are required.", zh: "带 * 的为必填项。" }),
    h("div.d-form__grid", fields), status, actions(backButton(null), save));
  f.addEventListener("submit", (e) => {
    e.preventDefault();
    const profile = readFields(f);
    if (showErrors(f, missing(form.profile, profile))) return;
    busy(save, async () => {
      setStatus(status, null);
      try {
        state = await api("PUT", "/api/registration/profile", { profile });
        if (editing) toast({ en: "Saved.", zh: "已保存。" });
        next("about");
      } catch (err) {
        if (err.code === "check_fields") showErrors(f, err.details.fields);
        else setStatus(status, errorPair(err));
      }
    });
  });
  return h("div.d-step", f);
}

/* ---------------------------------------------------------------- 03 team */
const trackOptions = (withAny) => [
  ...(withAny ? [{ value: "any", en: "Not sure yet", zh: "还没想好", kicker: "ANY" }] : []),
  ...form.tracks.map((tr) => ({ value: tr.id, en: tr.en, zh: tr.zh, kicker: trackKicker(tr.id) })),
];

function teamStep() {
  const r = state.registration;
  if (state.team) return h("div.d-step", inTeam());

  let choice = joinCode ? "join" : r && r.teamChoice === "none" ? "none" : "create";
  const panel = h("div.d-team__panel");
  const draw = () => clear(panel).append({ create: createPanel, join: joinPanel, none: nonePanel }[choice]());
  const options = choiceField({
    key: "choice",
    label: { en: "How are you taking part?", zh: "你打算怎样参赛？" },
    required: true,
    options: [
      { value: "create", en: "Start a team", zh: "创建队伍", note: { en: "You're the captain. Going solo? A team of one is fine.", zh: "你将成为队长。想一个人参赛？一人成队也可以。" } },
      { value: "join", en: "Join a team", zh: "加入队伍", note: { en: "Your captain gives you a 6-character code.", zh: "需要队长分享的 6 位队伍码。" } },
      { value: "none", en: "Not yet", zh: "暂不组队", note: { en: "Find teammates on Team-up, or at Kick-off Day.", zh: "可以在组队广场寻找队友，或在开幕式现场组队。" } },
    ],
    onChange: (v) => { choice = v; draw(); },
  }, choice);
  draw();
  return h("div.d-step",
    stepHead({ en: "Your team", zh: "组队" },
      { en: `Teams have 1 to ${form.teamMax} members, all working on one track. Everyone registers for themselves; teammates join with their captain's code.`,
        zh: `每队 1–${form.teamMax} 人，选择同一条赛道。每位成员都需要自己报名，队员凭队长的队伍码加入。` }),
    options, panel);
}

function createPanel() {
  const name = field({ key: "name", type: "text", label: form.team.name.label, required: true, max: form.team.name.max, wide: true });
  const trackChoice = choiceField({ key: "track", label: form.team.track.label, required: true, options: trackOptions(false) });
  const status = h("p.d-status", { role: "alert" });
  const go = h("button.d-btn.d-btn--primary", { type: "submit" }, t({ en: "Create the team", zh: "创建队伍" }), " →");
  const f = h("form.d-form", { novalidate: true }, name, trackChoice, status, actions(backButton("about"), go));
  f.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = readFields(f);
    const problems = [];
    if (!v.name) problems.push({ field: "name", message: { en: "Please give your team a name.", zh: "请填写队名。" } });
    if (!v.track) problems.push({ field: "track", message: { en: "Please choose a track.", zh: "请选择赛道。" } });
    if (showErrors(f, problems)) return;
    busy(go, async () => {
      try {
        state = await api("POST", "/api/registration/team", { action: "create", name: v.name, track: v.track });
        toast({ en: `Team created. Your invite code is ${state.team.code}.`, zh: `队伍已创建，邀请码是 ${state.team.code}。` });
        next("team");
      } catch (err) {
        if (err.details.field) showErrors(f, [{ field: err.details.field, message: err.pair }]);
        else setStatus(status, errorPair(err));
      }
    });
  });
  return f;
}

function joinPanel() {
  const code = field({ key: "code", type: "text", label: { en: "Team code", zh: "队伍码" }, required: true, max: 7, placeholder: "ABC234", wide: true }, joinCode);
  const input = code.querySelector("input");
  input.classList.add("d-input--code");
  input.setAttribute("autocapitalize", "characters");
  const found = h("div.d-team__found", { "aria-live": "polite" });
  const status = h("p.d-status", { role: "alert" });
  const look = h("button.d-btn.d-btn--ghost", { type: "submit" }, t({ en: "Find the team", zh: "查找队伍" }));
  const f = h("form.d-form", { novalidate: true }, code, found, status, actions(backButton("about"), look));

  const join = (team) => {
    const yes = h("button.d-btn.d-btn--primary", { type: "button" }, t({ en: `Join ${team.name}`, zh: `加入「${team.name}」` }), " →");
    const full = team.size >= team.max;
    clear(found).append(h("div.d-teamcard",
      h("p.d-teamcard__name", team.name),
      h("p.d-teamcard__meta", h("span.d-pill", trackKicker(team.track)), " ", t(trackLabel(team.track))),
      h("p.d-teamcard__meta", t({ en: `Captain: ${team.captainName || "—"}`, zh: `队长：${team.captainName || "—"}` }), "  ",
        t({ en: `${team.size} of ${team.max} members`, zh: `已有 ${team.size} / ${team.max} 人` })),
      full ? h("p.d-status.d-status--error", t({ en: "This team is full.", zh: "这个队伍已满。" })) : h("div.d-actions", yes)));
    yes.addEventListener("click", () => busy(yes, async () => {
      try {
        state = await api("POST", "/api/registration/team", { action: "join", code: input.value });
        toast({ en: `You joined ${team.name}.`, zh: `你已加入「${team.name}」。` });
        next("team");
      } catch (err) {
        setStatus(status, errorPair(err));
      }
    }));
  };

  const find = () => {
    clearErrors(f);
    setStatus(status, null);
    const value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    input.value = value;
    if (value.length !== 6) return showErrors(f, [{ field: "code", message: { en: "Team codes have 6 letters and digits.", zh: "队伍码由 6 位字母和数字组成。" } }]);
    return busy(look, async () => {
      try {
        join((await api("GET", `/api/registration/lookup?code=${value}`)).team);
      } catch (err) {
        clear(found);
        showErrors(f, [{ field: "code", message: err.pair }]);
      }
    });
  };
  f.addEventListener("submit", (e) => { e.preventDefault(); find(); });
  if (joinCode) setTimeout(find, 0);
  return f;
}

function nonePanel() {
  const r = state.registration;
  const pref = choiceField({
    key: "track",
    label: { en: "Which track interests you most?", zh: "你最感兴趣的赛道是？" },
    options: trackOptions(true),
  }, (r && r.trackPref) || "any");
  const status = h("p.d-status", { role: "alert" });
  const go = h("button.d-btn.d-btn--primary", { type: "submit" }, t(saveLabel()), editing ? null : " →");
  const f = h("form.d-form", { novalidate: true },
    h("div.d-pair.d-note-box", h("p", t({
      en: "You can create or join a team later, until registration closes. Meanwhile, post a card on Team-up so teams can find you, or form a team on-site at Kick-off Day.",
      zh: "报名截止前，你随时可以回来创建或加入队伍。在此之前，可以在组队广场发布卡片让队伍找到你，也可以在开幕式现场组队。",
    }))),
    pref, status, actions(backButton("about"), go));
  f.addEventListener("submit", (e) => {
    e.preventDefault();
    busy(go, async () => {
      try {
        state = await api("POST", "/api/registration/team", { action: "none", track: readFields(f).track });
        next("team");
      } catch (err) {
        setStatus(status, errorPair(err));
      }
    });
  });
  return f;
}

/* Already in a team: who's in it, and (for the captain) its name and track. */
function inTeam() {
  const tm = state.team;
  const status = h("p.d-status", { role: "alert" });
  const parts = [
    stepHead({ en: "Your team", zh: "你的队伍" }),
    teamCard(),
  ];
  if (tm.captain && state.open.registration) {
    const name = field({ key: "name", type: "text", label: form.team.name.label, required: true, max: form.team.name.max, wide: true }, tm.name);
    const trackChoice = choiceField({ key: "track", label: form.team.track.label, required: true, options: trackOptions(false) }, tm.track);
    const save = h("button.d-btn.d-btn--ghost", { type: "submit" }, t({ en: "Save team details", zh: "保存队伍信息" }));
    const f = h("form.d-form.d-team__edit", { novalidate: true }, h("h3.d-sub", t({ en: "Team details", zh: "队伍信息" })), name, trackChoice, actions(save));
    f.addEventListener("submit", (e) => {
      e.preventDefault();
      const v = readFields(f);
      if (showErrors(f, v.name ? [] : [{ field: "name", message: { en: "Please give your team a name.", zh: "请填写队名。" } }])) return;
      busy(save, async () => {
        try {
          state = await api("PATCH", "/api/registration/team", { name: v.name, track: v.track });
          toast({ en: "Team details saved.", zh: "队伍信息已保存。" });
          show("team");
        } catch (err) {
          setStatus(status, errorPair(err));
        }
      });
    });
    parts.push(f);
  }
  const cont = h("button.d-btn.d-btn--primary", { type: "button", on: { click: () => next("team") } },
    t(editing ? { en: "Done", zh: "完成" } : { en: "Continue", zh: "继续" }), editing ? null : " →");
  parts.push(status, actions(editing ? null : backButton("about"), state.open.registration ? leaveButton(status) : null, cont));
  return parts;
}

function leaveButton(status) {
  const b = h("button.d-btn.d-btn--quiet", { type: "button" }, t({ en: "Leave team", zh: "退出队伍" }));
  b.addEventListener("click", async () => {
    const tm = state.team;
    const others = tm.members.length - 1;
    const ok = await confirmBox({
      message: tm.captain && others
        ? { en: `Leave ${tm.name}? The captain role passes to the member who joined first.`, zh: `确定退出「${tm.name}」吗？队长身份将移交给最早加入的队员。` }
        : others
          ? { en: `Leave ${tm.name}?`, zh: `确定退出「${tm.name}」吗？` }
          : { en: `You're the only member, so leaving closes ${tm.name}. Continue?`, zh: `你是队伍中唯一的成员，退出后「${tm.name}」将被解散。确定继续吗？` },
      yes: { en: "Leave team", zh: "退出队伍" },
      danger: true,
    });
    if (!ok) return;
    busy(b, async () => {
      try {
        state = await api("POST", "/api/registration/team/leave", {});
        toast({ en: "You left the team.", zh: "你已退出队伍。" });
        show("team");
      } catch (err) {
        setStatus(status, errorPair(err));
      }
    });
  });
  return b;
}

/* The team at a glance: name, track, invite code, members. */
function teamCard({ manage = false } = {}) {
  const tm = state.team;
  const status = h("p.d-status", { role: "alert" });
  const link = `${location.origin}${base}DIC2026/register/?join=${tm.code}`;
  const room = tm.members.length < tm.max;
  const copyButton = (value, label, done) => h("button.d-btn.d-btn--small.d-btn--quiet", {
    type: "button",
    on: { click: async () => toast((await copyText(value)) ? done : { en: "Couldn't copy. Please copy it by hand.", zh: "复制失败，请手动复制。" }) },
  }, t(label));

  const members = h("ul.d-members", tm.members.map((m) => h("li.d-members__item",
    h("span.d-members__name", m.name || "—", m.me ? h("span.d-members__me", " ", t({ en: "(you)", zh: "（你）" })) : null),
    h("span.d-members__school", m.school),
    h("span.d-members__tags",
      m.captain ? h("span.d-pill.d-pill--lav", t({ en: "Captain", zh: "队长" })) : null,
      m.submitted ? h("span.d-pill.d-pill--ok", "✓ ", t({ en: "Registered", zh: "已提交" })) : h("span.d-pill.d-pill--wait", t({ en: "Not submitted yet", zh: "尚未提交" }))),
    manage && tm.captain && !m.me && state.open.registration ? removeButton(m, status) : null)));

  return h("div.d-teamcard",
    h("p.d-teamcard__name", tm.name),
    h("p.d-teamcard__meta", h("span.d-pill", trackKicker(tm.track)), " ", t(trackLabel(tm.track))),
    h("div.d-code",
      h("p.d-code__label", t({ en: "Invite code", zh: "队伍邀请码" })),
      h("p.d-code__value", tm.code),
      room
        ? h("p.d-code__hint", t({ en: `Share it with up to ${tm.max - tm.members.length} more teammate(s). They join under “Join a team”.`, zh: `还可以邀请 ${tm.max - tm.members.length} 位队员，他们在“加入队伍”中输入此码即可。` }))
        : h("p.d-code__hint", t({ en: "Your team is full.", zh: "队伍已满员。" })),
      room ? h("div.d-code__actions",
        copyButton(tm.code, { en: "Copy code", zh: "复制邀请码" }, { en: "Code copied.", zh: "邀请码已复制。" }),
        copyButton(link, { en: "Copy invite link", zh: "复制邀请链接" }, { en: "Invite link copied.", zh: "邀请链接已复制。" }),
        manage && tm.captain && state.open.registration ? newCodeButton(status) : null) : null),
    h("h3.d-sub", t({ en: "Members", zh: "成员" }), " ", h("span.d-mono", `${tm.members.length} / ${tm.max}`)),
    members,
    tm.members.some((m) => !m.submitted)
      ? h("p.d-field__hint", t({ en: "Everyone needs to submit their own registration: “Not submitted yet” means they haven't finished.", zh: "每位成员都需要提交自己的报名；“尚未提交”表示该成员还没有完成报名。" }))
      : null,
    status);
}

function removeButton(member, status) {
  const b = h("button.d-link.d-link--danger", { type: "button" }, t({ en: "Remove", zh: "移除" }));
  b.addEventListener("click", async () => {
    const ok = await confirmBox({
      message: { en: `Remove ${member.name} from the team? They stay registered, without a team.`, zh: `确定将 ${member.name} 移出队伍吗？对方的报名仍然有效，但不再属于任何队伍。` },
      yes: { en: "Remove", zh: "移除" },
      danger: true,
    });
    if (!ok) return;
    busy(b, async () => {
      try {
        state = await api("POST", "/api/registration/team/remove", { userId: member.id });
        show("done");
      } catch (err) {
        setStatus(status, errorPair(err));
      }
    });
  });
  return b;
}

function newCodeButton(status) {
  const b = h("button.d-btn.d-btn--small.d-btn--quiet", { type: "button" }, t({ en: "New code", zh: "更换邀请码" }));
  b.addEventListener("click", async () => {
    const ok = await confirmBox({
      message: { en: "Make a new invite code? The old code and link stop working; current members stay in the team.", zh: "确定更换邀请码吗？旧的邀请码和链接将失效，现有成员不受影响。" },
      yes: { en: "New code", zh: "更换" },
    });
    if (!ok) return;
    busy(b, async () => {
      try {
        state = await api("POST", "/api/registration/team/new-code", {});
        toast({ en: `New code: ${state.team.code}`, zh: `新的邀请码：${state.team.code}` });
        show("done");
      } catch (err) {
        setStatus(status, errorPair(err));
      }
    });
  });
  return b;
}

/* ------------------------------------------------------------- 04 project */
function projectStep() {
  const tm = state.team;
  const head = stepHead({ en: "Your project", zh: "项目信息" },
    { en: "All optional for now: add them when you have them. Everyone in the team can update them later.", zh: "目前均为选填，有了再补充即可。队伍中的每位成员之后都可以修改。" });
  if (!tm) {
    return h("div.d-step", head,
      h("div.d-pair.d-note-box", h("p", t({ en: "Project details belong to a team. Once you've started or joined one, add them here.", zh: "项目信息属于队伍。创建或加入队伍后，可以在这里填写。" }))),
      actions(backButton("team"), h("button.d-btn.d-btn--primary", { type: "button", on: { click: () => next("project") } }, t({ en: "Continue", zh: "继续" }), " →")));
  }
  const F = form.team;
  const fields = [
    field({ key: "repoUrl", type: "url", label: F.repo_url.label, max: F.repo_url.max, placeholder: "https://github.com/…", inputmode: "url", wide: true,
      hint: { en: "GitHub, Gitee, GitLab… Make sure the organisers will be able to open it.", zh: "GitHub、Gitee、GitLab 等均可，请确保组委会可以访问。" } }, tm.repoUrl),
    field({ key: "projectTitle", type: "text", label: F.project_title.label, max: F.project_title.max, wide: true }, tm.projectTitle),
    field({ key: "projectSummary", type: "textarea", label: F.project_summary.label, max: F.project_summary.max, rows: 3, wide: true }, tm.projectSummary),
  ];
  const locked = !state.open.project;
  const status = h("p.d-status", { role: "alert" });
  const save = h("button.d-btn.d-btn--primary", { type: "submit", disabled: locked }, t(saveLabel()), editing ? null : " →");
  const f = h("form.d-form", { novalidate: true }, head, h("div.d-form__grid", fields),
    locked ? h("p.d-status.d-status--error", t({ en: "Project details are locked now.", zh: "项目信息已锁定。" })) : null,
    status, actions(backButton("team"), save));
  f.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = readFields(f);
    busy(save, async () => {
      try {
        state = await api("PATCH", "/api/registration/team", { repoUrl: v.repoUrl, projectTitle: v.projectTitle, projectSummary: v.projectSummary });
        if (editing) toast({ en: "Saved.", zh: "已保存。" });
        next("project");
      } catch (err) {
        if (err.details.field) showErrors(f, [{ field: err.details.field, message: err.pair }]);
        else setStatus(status, errorPair(err));
      }
    });
  });
  return h("div.d-step", f);
}

/* -------------------------------------------------------------- 05 review */
function profileFacts() {
  const p = (state.registration && state.registration.profile) || {};
  return facts(form.profile.map((def) => {
    const v = p[def.key];
    let shown = v;
    if (def.type === "select") shown = v ? t(def.options.find((o) => o.value === v) || { en: v }) : "";
    if (def.type === "tags") shown = v && v.length ? h("span.d-tags", v.map((s) => h("span.d-pill", t(def.options.find((o) => o.value === s) || { en: s })))) : "";
    return [def.label, shown];
  }));
}

function teamFacts() {
  const r = state.registration;
  const tm = state.team;
  if (!tm) {
    return facts([
      [{ en: "Team", zh: "队伍" }, t({ en: "Not in a team yet", zh: "暂未组队" })],
      [{ en: "Track of interest", zh: "感兴趣的赛道" }, r && r.trackPref ? t(trackLabel(r.trackPref)) : ""],
    ]);
  }
  return facts([
    [{ en: "Team", zh: "队伍" }, tm.name],
    [{ en: "Track", zh: "赛道" }, t(trackLabel(tm.track))],
    [{ en: "Role", zh: "角色" }, t(tm.captain ? { en: "Captain", zh: "队长" } : { en: "Member", zh: "队员" })],
    [{ en: "Members", zh: "成员" }, tm.members.map((m) => m.name).join(", ")],
  ]);
}

function projectFacts() {
  const tm = state.team;
  if (!tm) return h("p.d-field__hint", t({ en: "Added once you're in a team.", zh: "加入队伍后填写。" }));
  return facts([
    [form.team.repo_url.label, tm.repoUrl ? h("a.d-link", { href: tm.repoUrl, target: "_blank", rel: "noopener noreferrer" }, tm.repoUrl) : ""],
    [form.team.project_title.label, tm.projectTitle],
    [form.team.project_summary.label, tm.projectSummary],
  ]);
}

function reviewBlock(title, step, body) {
  return h("div.d-review__block",
    h("div.d-review__head", h("h3.d-sub", t(title)),
      h("button.d-link", { type: "button", on: { click: () => show(step) } }, t({ en: "Edit", zh: "修改" }))),
    body);
}

function reviewStep() {
  const consent = h("input#consent", { type: "checkbox", name: "consent" });
  const consentText = document.getElementById("d-consent");
  const privacy = document.getElementById("d-privacy");
  const status = h("p.d-status", { role: "alert" });
  const send = h("button.d-btn.d-btn--primary", { type: "submit" }, t({ en: "Submit registration", zh: "提交报名" }));
  const f = h("form.d-form", { novalidate: true },
    stepHead({ en: "Check and submit", zh: "确认并提交" }, { en: "Make sure everything is right. You can still change it after submitting, until registration closes.", zh: "请核对以下信息。提交后，在报名截止前仍可修改。" }),
    reviewBlock({ en: "About you", zh: "关于你" }, "about", profileFacts()),
    reviewBlock({ en: "Team", zh: "组队" }, "team", teamFacts()),
    reviewBlock({ en: "Project", zh: "项目" }, "project", projectFacts()),
    h("div.d-field.d-consent", { dataset: { field: "consent" } },
      h("label.d-check", { for: "consent" }, consent, h("span", consentText ? consentText.content.cloneNode(true) : "")),
      privacy ? h("p.d-field__hint", privacy.content.cloneNode(true)) : null,
      h("p.d-field__error")),
    status,
    actions(backButton("project"), send));
  f.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!consent.checked) return showErrors(f, [{ field: "consent", message: { en: "Please tick the box to agree before submitting.", zh: "提交前请勾选同意。" } }]);
    busy(send, async () => {
      try {
        state = await api("POST", "/api/registration/submit", { consent: true });
        show("done");
        toast({ en: "You're registered for DIC 2026!", zh: "报名成功！" });
      } catch (err) {
        if (err.details.step) show(err.details.step);
        else setStatus(status, errorPair(err));
      }
    });
  });
  return h("div.d-step", f);
}

/* -------------------------------------------------- the registration page */
function summary() {
  const r = state.registration;
  const tm = state.team;
  const open = state.open;
  const editLink = (step, label = { en: "Edit", zh: "修改" }) =>
    h("button.d-link", { type: "button", on: { click: () => { editing = true; show(step); } } }, t(label));

  /* What happens next: the page's own list (register_page.next_steps). */
  const nextSteps = document.getElementById("d-next");
  const status = h("section.d-win.d-done",
    h("div.d-win__bar", h("span", "STATUS.SYS"), h("span.d-win__ctl", { "aria-hidden": "true" }, h("i"), h("i"), h("i"))),
    h("div.d-win__body",
      h("p.d-done__tag.d-mono", h("i", { "aria-hidden": "true" }), "REGISTERED"),
      h("h2.d-done__title", { tabindex: "-1" }, t({ en: "You're registered for DIC 2026", zh: "你已成功报名 DIC 2026" })),
      h("p.d-done__date", t({ en: "Submitted", zh: "提交时间" }), " ", stamp(r.submittedAt)),
      h("ul.d-list", nextSteps ? nextSteps.content.cloneNode(true) : null,
        tm ? null : h("li", t({ en: "Still looking for teammates? Try Team-up.", zh: "还在找队友？去组队广场看看。" }))),
      h("p.d-done__links",
        h("a.d-btn.d-btn--ghost", { href: `${base}DIC2026/team-up/` }, t({ en: "Go to Team-up", zh: "前往组队广场" }), " →"),
        h("a.d-btn.d-btn--quiet", { href: `${base}DIC2026/` }, t({ en: "DIC 2026 details", zh: "大赛详情" }))),
      open.registration ? null : h("p.d-status.d-status--error", t({ en: "Registration has closed; your details can no longer be changed.", zh: "报名已截止，信息无法再修改。" }))));

  const teamStatus = h("p.d-status", { role: "alert" });
  const teamBox = tm
    ? win("TEAM.SYS", teamCard({ manage: true }),
      open.registration ? h("div.d-actions", leaveButton(teamStatus), editLink("team", { en: "Team details", zh: "队伍信息" })) : null, teamStatus)
    : win("TEAM.SYS",
      h("p.d-teamcard__name", t({ en: "No team yet", zh: "暂未组队" })),
      h("div.d-pair", h("p", t({ en: "Start a team or join one with a code, until registration closes.", zh: "报名截止前，你可以随时创建队伍，或用队伍码加入队伍。" }))),
      open.registration ? h("div.d-actions", editLink("team", { en: "Start or join a team", zh: "创建或加入队伍" })) : null);

  const projectBox = win("PROJECT.SYS", projectFacts(), tm && open.project ? h("div.d-actions", editLink("project")) : null);
  const profileBox = win("PROFILE.SYS", profileFacts(), open.registration ? h("div.d-actions", editLink("about")) : null);

  const withdraw = h("button.d-link.d-link--danger", { type: "button" }, t({ en: "Withdraw my registration", zh: "撤回报名" }));
  withdraw.addEventListener("click", async () => {
    const ok = await confirmBox({
      title: "WITHDRAW.EXE",
      message: { en: "Withdraw from DIC 2026? This deletes your registration and takes you out of your team. You can register again until registration closes.", zh: "确定撤回 DIC 2026 报名吗？你的报名信息将被删除，并退出所在队伍。报名截止前可以重新报名。" },
      yes: { en: "Withdraw", zh: "撤回报名" },
      danger: true,
    });
    if (!ok) return;
    busy(withdraw, async () => {
      try {
        state = await api("POST", "/api/registration/withdraw", {});
        toast({ en: "Your registration was withdrawn.", zh: "你的报名已撤回。" });
        show("about");
      } catch (err) {
        toast(errorPair(err), "error");
      }
    });
  });

  return h("div.d-dash", status, h("div.d-dash__grid", teamBox, projectBox), profileBox,
    open.registration ? h("p.d-dash__withdraw", withdraw) : null);
}

start();
