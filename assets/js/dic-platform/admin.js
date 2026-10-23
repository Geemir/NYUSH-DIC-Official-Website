/*
 * The organisers' dashboard (/DIC2026/admin/): an overview, everyone who has
 * registered, every team, downloads for Excel / CSV / Google Sheets, and
 * Team-up moderation. Only accounts listed in the API's ADMIN_EMAILS get
 * any data.
 *
 * Tables and exports follow the language switch: English, Chinese, or both.
 */
import { api, session, getForm, mode } from "./api.js";
import { h, t, text, clear, win, setStatus, errorPair, busy, toast, confirmBox, stamp, copyText } from "./ui.js";
import { signInForm, accountBar, previewBanner, soonPanel } from "./account.js";
import { xlsx, csv, tsv, download } from "./xlsx.js";

const root = document.querySelector("[data-admin]");
let form = null;
let data = null; // { overview, participants, teams }
let tab = "overview";
const filter = { status: "", team: "", track: "", q: "" };

const TABS = [
  { id: "overview", en: "Overview", zh: "概览" },
  { id: "people", en: "Participants", zh: "参赛者" },
  { id: "teams", en: "Teams", zh: "队伍" },
  { id: "moderation", en: "Team-up", zh: "组队广场" },
];
const trackShort = (id) => (id === "any" ? "ANY" : `T${id.slice(-2)}`);
const trackPair = (id) => (id === "any" ? { en: "Any track", zh: "任意赛道" } : form.tracks.find((tr) => tr.id === id) || { en: id || "", zh: id || "" });

/* ------------------------------------------------------------------ start */
async function start() {
  const banner = previewBanner();
  if (banner) root.before(banner);
  if (mode === "off") {
    root.append(soonPanel("d-soon", "ADMIN.SYS"));
    return;
  }
  root.append(h("p.d-loading", t({ en: "Loading…", zh: "加载中…" })));
  try {
    [form] = await Promise.all([getForm(), session.restore()]);
  } catch (err) {
    clear(root).append(h("p.d-status.d-status--error", t(errorPair(err))));
    return;
  }
  session.onChange(() => gate());
  document.addEventListener("dic:lang", () => { if (data && (tab === "people" || tab === "teams")) draw(); });
  gate();
}

/* Signed out → sign in; signed in but not an organiser → say so. */
async function gate() {
  clear(root);
  const user = session.user;
  if (!user) {
    root.append(win("ADMIN.SYS",
      h("h2.d-step__title", t({ en: "Organisers, sign in", zh: "组委会登录" })),
      signInForm({ onDone: () => gate(), focus: false })));
    return;
  }
  if (!user.admin) {
    root.append(win("ADMIN.SYS",
      h("h2.d-step__title", t({ en: "This page is for DIC organisers", zh: "此页面仅供 DIC 组委会使用" })),
      h("div.d-pair", h("p", t({
        en: `You're signed in as ${user.email}, which isn't on the organisers' list. To add it, put it in ADMIN_EMAILS on the API server.`,
        zh: `你当前登录的邮箱 ${user.email} 不在组委会名单中。如需添加，请在 API 服务器的 ADMIN_EMAILS 中加入该邮箱。`,
      })))), accountBar());
    return;
  }
  root.append(h("p.d-loading", t({ en: "Loading registrations…", zh: "正在加载报名数据…" })));
  await reload();
}

async function reload() {
  try {
    const [overview, people, teams] = await Promise.all([
      api("GET", "/api/admin/overview"), api("GET", "/api/admin/participants"), api("GET", "/api/admin/teams"),
    ]);
    data = { overview, participants: people.participants, teams: teams.teams };
    draw();
  } catch (err) {
    clear(root).append(h("p.d-status.d-status--error", t(errorPair(err))), accountBar());
  }
}

function draw() {
  const y = window.scrollY;
  clear(root).append(
    h("div.d-admin__top",
      h("div.d-seg.d-seg--tabs", { role: "tablist" }, TABS.map((tb) => h("button.d-seg__item", {
        type: "button", role: "tab", "aria-selected": String(tab === tb.id),
        on: { click: () => { tab = tb.id; draw(); } },
      }, t(tb))) ),
      h("div.d-admin__tools", exportMenu(), h("button.d-btn.d-btn--small.d-btn--ghost", {
        type: "button", on: { click: (e) => busy(e.currentTarget, reload) },
      }, "↻ ", t({ en: "Refresh", zh: "刷新" })))),
    { overview, people: peopleTab, teams: teamsTab, moderation: moderationTab }[tab](),
    accountBar());
  window.scrollTo(0, y);
}

/* --------------------------------------------------------------- overview */
function tile(n, label, note) {
  return h("div.d-tile", h("p.d-tile__n", String(n)), h("p.d-tile__label", t(label)), note ? h("p.d-tile__note", t(note)) : null);
}

function bars(rows, total) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return h("ul.d-bars", rows.map((r) => h("li.d-bars__row",
    h("span.d-bars__label", r.label),
    h("span.d-bars__track", h("span.d-bars__fill", { style: `width:${(r.n / max) * 100}%` })),
    h("span.d-bars__n", String(r.n), total ? h("span.d-bars__pct", ` ${Math.round((r.n / total) * 100)}%`) : null))));
}

function overview() {
  const o = data.overview;
  const byTrack = form.tracks.map((tr) => ({
    label: h("span", h("b", trackShort(tr.id)), " ", t(tr)),
    n: (o.teams.byTrack.find((x) => x.track === tr.id) || { n: 0 }).n,
  }));
  const sizes = [1, 2, 3].map((s) => ({
    label: t({ en: s === 1 ? "1 person" : `${s} people`, zh: `${s} 人` }),
    n: (o.teams.bySize.find((x) => x.size === s) || { n: 0 }).n,
  }));

  /* Submissions per day over the last 30 days (Shanghai dates). */
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() + 8 * 3600000 - i * 86400000).toISOString().slice(0, 10);
    days.push({ d, n: (o.daily.find((x) => x.day === d) || { count: 0 }).count });
  }
  const peak = Math.max(1, ...days.map((x) => x.n));
  const chart = h("div.d-spark", { role: "img", "aria-label": { en: "Registrations submitted per day, last 30 days", zh: "近 30 天每日提交的报名数" } },
    days.map((x) => h("span.d-spark__bar", { style: `height:${Math.max(2, (x.n / peak) * 100)}%`, title: `${x.d}: ${x.n}` })));

  return h("div.d-admin__overview",
    h("div.d-tiles",
      tile(o.people.submitted, { en: "Registered", zh: "已提交报名" }, { en: `${o.people.started - o.people.submitted} still drafting`, zh: `另有 ${o.people.started - o.people.submitted} 人未提交` }),
      tile(o.teams.total, { en: "Teams", zh: "队伍" }),
      tile(o.people.withoutTeam, { en: "Registered, no team", zh: "已报名未组队" }),
      tile(o.people.accounts, { en: "Accounts", zh: "账号" }, { en: "everyone who signed in", zh: "所有登录过的人" }),
      tile(o.teamUp.openPosts, { en: "Open Team-up cards", zh: "组队卡片" }),
      tile(o.teamUp.messagesToday, { en: "Messages, last 24 h", zh: "24 小时内消息" }),
      tile(o.teamUp.openReports, { en: "Open reports", zh: "待处理举报" })),
    h("div.d-admin__charts",
      win("TEAMS_BY_TRACK", bars(byTrack, o.teams.total)),
      win("TEAM_SIZES", bars(sizes, o.teams.total)),
      win("SUBMITTED_PER_DAY", chart, h("p.d-field__hint", t({ en: "Last 30 days, by the day each person submitted.", zh: "近 30 天，按每人提交报名的日期统计。" })))));
}

/* ----------------------------------------------------------------- tables */
const YES = { en: "Yes", zh: "是" };
const NO = { en: "No", zh: "否" };

/* Participants as a table: { columns: [pair], rows: [[pair | string | number]] } */
function participantTable(list) {
  const profileCols = form.profile.map((def) => def);
  const columns = [
    { en: "Status", zh: "状态" },
    ...profileCols.map((d) => d.label),
    { en: "Email", zh: "邮箱" },
    { en: "Team", zh: "队伍" },
    { en: "Team code", zh: "队伍码" },
    { en: "Role", zh: "角色" },
    { en: "Track", zh: "赛道" },
    { en: "Started", zh: "开始填写" },
    { en: "Submitted", zh: "提交时间" },
  ];
  const rows = list.map((p) => [
    p.status === "submitted" ? { en: "Submitted", zh: "已提交" } : { en: "Draft", zh: "未提交" },
    ...profileCols.map((def) => {
      const v = p.profile[def.key];
      if (def.type === "select") return v ? def.options.find((o) => o.value === v) || v : "";
      if (def.type === "tags") return (v || []).map((s) => def.options.find((o) => o.value === s) || { en: s, zh: s });
      return v || "";
    }),
    p.email,
    p.team ? p.team.name : p.teamChoice === "none" ? { en: "(no team yet)", zh: "（暂未组队）" } : "",
    p.team ? p.team.code : "",
    p.team ? (p.team.captain ? { en: "Captain", zh: "队长" } : { en: "Member", zh: "队员" }) : "",
    p.team ? trackPair(p.team.track) : p.trackPref ? { en: `${trackPair(p.trackPref).en} (interest)`, zh: `${trackPair(p.trackPref).zh}（意向）` } : "",
    stamp(p.createdAt),
    stamp(p.submittedAt),
  ]);
  return { columns, rows };
}

function teamTable(list) {
  const columns = [
    { en: "Team", zh: "队伍" },
    { en: "Code", zh: "队伍码" },
    { en: "Track", zh: "赛道" },
    { en: "Members", zh: "人数" },
    { en: "Captain", zh: "队长" },
    { en: "Captain's email", zh: "队长邮箱" },
    { en: "Captain's WeChat", zh: "队长微信" },
    { en: "Member names", zh: "成员姓名" },
    { en: "Member emails", zh: "成员邮箱" },
    { en: "All submitted", zh: "全员已提交" },
    form.team.repo_url.label,
    form.team.project_title.label,
    form.team.project_summary.label,
    { en: "Created", zh: "创建时间" },
  ];
  const rows = list.map((tm) => {
    const cap = tm.members.find((m) => m.captain) || {};
    return [
      tm.name, tm.code, trackPair(tm.track), tm.members.length,
      cap.name || "", cap.email || "", cap.wechat || "",
      tm.members.map((m) => m.name).join("; "), tm.members.map((m) => m.email).join("; "),
      tm.members.every((m) => m.submitted) ? YES : NO,
      tm.repoUrl, tm.projectTitle, tm.projectSummary, stamp(tm.createdAt),
    ];
  });
  return { columns, rows };
}

/* A cell value as text in the current language. */
const cellText = (v) => (Array.isArray(v) ? v.map(cellText).join(", ") : v && typeof v === "object" ? text(v) : v ?? "");
const plain = (table, name) => ({ name, columns: table.columns.map(cellText), rows: table.rows.map((r) => r.map(cellText)) });

function filteredPeople() {
  const q = filter.q.trim().toLowerCase();
  return data.participants.filter((p) =>
    (!filter.status || p.status === filter.status)
    && (!filter.team || (filter.team === "yes" ? !!p.team : !p.team))
    && (!filter.track || (p.team ? p.team.track : p.trackPref) === filter.track)
    && (!q || JSON.stringify([p.email, p.profile, p.team && p.team.name, p.team && p.team.code]).toLowerCase().includes(q)));
}

function tableView(table, { link } = {}) {
  return h("div.d-tablewrap", { tabindex: "0", role: "region", "aria-label": { en: "Table", zh: "表格" } },
    h("table.d-table",
      h("thead", h("tr", table.columns.map((c) => h("th", { scope: "col" }, t(c))))),
      h("tbody", table.rows.map((row) => h("tr", row.map((v, i) => {
        if (link === i && v) return h("td", h("a.d-link", { href: v, target: "_blank", rel: "noopener noreferrer" }, v));
        if (Array.isArray(v)) return h("td", v.map((x, j) => [j ? ", " : null, typeof x === "object" ? t(x) : x]));
        return h("td", v && typeof v === "object" ? t(v) : String(v ?? ""));
      }))))));
}

function select(label, value, options, onChange) {
  return h("label.d-filter", h("span.d-filter__label", t(label)),
    h("select.d-select.d-select--small", { on: { change: (e) => onChange(e.target.value) } },
      options.map((o) => {
        const opt = h("option", { value: o.value, selected: o.value === value });
        opt.append(text(o));
        return opt;
      })));
}

function peopleTab() {
  const list = filteredPeople();
  const all = { value: "", en: "All", zh: "全部" };
  const redraw = () => draw();
  return h("div.d-admin__table",
    h("div.d-filters",
      select({ en: "Status", zh: "状态" }, filter.status, [all, { value: "submitted", en: "Submitted", zh: "已提交" }, { value: "draft", en: "Draft", zh: "未提交" }],
        (v) => { filter.status = v; redraw(); }),
      select({ en: "Team", zh: "队伍" }, filter.team, [all, { value: "yes", en: "In a team", zh: "已组队" }, { value: "no", en: "No team", zh: "未组队" }],
        (v) => { filter.team = v; redraw(); }),
      select({ en: "Track", zh: "赛道" }, filter.track, [all, ...form.tracks.map((tr) => ({ value: tr.id, en: `${trackShort(tr.id)} ${tr.en}`, zh: `${trackShort(tr.id)} ${tr.zh}` })), { value: "any", en: "Any track", zh: "任意赛道" }],
        (v) => { filter.track = v; redraw(); }),
      h("label.d-filter.d-filter--grow", h("span.d-filter__label", t({ en: "Search", zh: "搜索" })),
        h("input.d-input.d-input--small", {
          type: "search", value: filter.q, placeholder: { en: "Name, email, school, team…", zh: "姓名、邮箱、学校、队伍…" },
          on: { change: (e) => { filter.q = e.target.value; redraw(); } },
        }))),
    h("p.d-admin__count", t({ en: `Showing ${list.length} of ${data.participants.length}`, zh: `显示 ${list.length} / ${data.participants.length} 人` })),
    list.length ? tableView(participantTable(list)) : h("p.d-empty", t({ en: "Nobody here yet.", zh: "暂无数据。" })));
}

function teamsTab() {
  const table = teamTable(data.teams);
  return h("div.d-admin__table",
    h("p.d-admin__count", t({ en: `${data.teams.length} teams`, zh: `共 ${data.teams.length} 支队伍` })),
    data.teams.length ? tableView(table, { link: 10 }) : h("p.d-empty", t({ en: "No teams yet.", zh: "暂无队伍。" })));
}

/* ---------------------------------------------------------------- exports */
function stampForFile() {
  return new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 16).replace(/[-:]/g, "").replace("T", "-");
}

function exportMenu() {
  const people = () => plain(participantTable(data.participants), text({ en: "Participants", zh: "参赛者" }));
  const teams = () => plain(teamTable(data.teams), text({ en: "Teams", zh: "队伍" }));
  const file = (what, ext) => `dic2026-${what}-${stampForFile()}.${ext}`;
  const item = (label, run) => h("button.d-menu__item", { type: "button", role: "menuitem", on: { click: () => { menu.hidden = true; run(); } } }, t(label));

  const menu = h("div.d-menu__list", { role: "menu", hidden: true },
    item({ en: "Excel (.xlsx): participants and teams", zh: "Excel（.xlsx）：参赛者和队伍" },
      () => download(xlsx([people(), teams()]), file("registrations", "xlsx"))),
    item({ en: "CSV: participants", zh: "CSV：参赛者" },
      () => download(new Blob([csv(people())], { type: "text/csv;charset=utf-8" }), file("participants", "csv"))),
    item({ en: "CSV: teams", zh: "CSV：队伍" },
      () => download(new Blob([csv(teams())], { type: "text/csv;charset=utf-8" }), file("teams", "csv"))),
    item({ en: "Copy participants for Google Sheets", zh: "复制参赛者（粘贴到 Google 表格）" }, async () => {
      const tbl = people();
      toast((await copyText(tsv(tbl)))
        ? { en: `Copied ${tbl.rows.length} rows. In Google Sheets, click cell A1 and paste.`, zh: `已复制 ${tbl.rows.length} 行。请在 Google 表格中点击 A1 单元格后粘贴。` }
        : { en: "Couldn't copy. Download the Excel file and import it instead.", zh: "复制失败，请下载 Excel 文件后导入。" });
    }),
    item({ en: "Copy teams for Google Sheets", zh: "复制队伍（粘贴到 Google 表格）" }, async () => {
      const tbl = teams();
      toast((await copyText(tsv(tbl)))
        ? { en: `Copied ${tbl.rows.length} rows. In Google Sheets, click cell A1 and paste.`, zh: `已复制 ${tbl.rows.length} 行。请在 Google 表格中点击 A1 单元格后粘贴。` }
        : { en: "Couldn't copy. Download the Excel file and import it instead.", zh: "复制失败，请下载 Excel 文件后导入。" });
    }),
    h("p.d-menu__note", t({ en: "Exports include everyone, in the language shown on the page. Google Sheets can also open the .xlsx (File → Import).", zh: "导出包含全部数据，语言与页面当前语言一致。Google 表格也可以直接导入 .xlsx 文件（文件 → 导入）。" })));
  const button = h("button.d-btn.d-btn--small.d-btn--primary", { type: "button", "aria-haspopup": "menu", "aria-expanded": "false" }, "⤓ ", t({ en: "Export", zh: "导出" }));
  button.addEventListener("click", () => {
    menu.hidden = !menu.hidden;
    button.setAttribute("aria-expanded", String(!menu.hidden));
  });
  return h("div.d-menu", button, menu);
}

/* A click anywhere else closes the export menu. */
document.addEventListener("click", (e) => {
  for (const list of root.querySelectorAll(".d-menu__list:not([hidden])")) {
    if (!list.parentElement.contains(e.target)) {
      list.hidden = true;
      list.parentElement.querySelector("[aria-expanded]").setAttribute("aria-expanded", "false");
    }
  }
});

/* ------------------------------------------------------------- moderation */
let modKind = "reports";

function moderationTab() {
  const body = h("div.d-mod__list", h("p.d-loading", t({ en: "Loading…", zh: "加载中…" })));
  const kinds = [
    { id: "reports", en: "Reports", zh: "举报" },
    { id: "post", en: "Cards", zh: "卡片" },
    { id: "reply", en: "Replies", zh: "回复" },
    { id: "message", en: "Messages", zh: "消息" },
  ];
  const view = h("div.d-mod",
    h("div.d-seg", { role: "group" }, kinds.map((k) => h("button.d-seg__item", {
      type: "button", "aria-pressed": String(modKind === k.id),
      on: { click: () => { modKind = k.id; draw(); } },
    }, t(k)))),
    body);
  loadModeration(body);
  return view;
}

async function loadModeration(body) {
  try {
    if (modKind === "reports") {
      const { reports } = await api("GET", "/api/admin/reports");
      clear(body).append(...(reports.length ? reports.map(reportItem) : [h("p.d-empty", t({ en: "No open reports.", zh: "暂无待处理的举报。" }))]));
    } else {
      const { items } = await api("GET", `/api/admin/content?kind=${modKind}`);
      clear(body).append(...(items.length ? items.map((it) => contentItem(modKind, it)) : [h("p.d-empty", t({ en: "Nothing here yet.", zh: "暂无内容。" }))]));
    }
  } catch (err) {
    clear(body).append(h("p.d-status.d-status--error", t(errorPair(err))));
  }
}

const KIND_LABEL = { post: { en: "Card", zh: "卡片" }, reply: { en: "Reply", zh: "回复" }, message: { en: "Message", zh: "消息" } };

function modButtons(kind, id, removed, author) {
  const status = h("span.d-status", { role: "alert" });
  const act = (label, run, danger) => h(`button.d-link${danger ? ".d-link--danger" : ""}`, {
    type: "button",
    on: { click: (e) => busy(e.currentTarget, async () => { try { await run(); draw(); } catch (err) { setStatus(status, errorPair(err)); } }) },
  }, t(label));
  return h("p.d-mod__actions",
    removed
      ? act({ en: "Restore", zh: "恢复" }, () => api("POST", "/api/admin/moderate", { kind, id, action: "restore" }))
      : act({ en: "Hide", zh: "隐藏" }, () => api("POST", "/api/admin/moderate", { kind, id, action: "hide" }), true),
    author && author.id
      ? act(author.banned ? { en: "Let them post again", zh: "恢复发言权限" } : { en: "Stop them posting", zh: "禁止发言" }, async () => {
        if (!author.banned) {
          const ok = await confirmBox({
            message: { en: `Stop ${author.email} from posting on Team-up and in the channels? Their registration isn't affected.`, zh: `确定禁止 ${author.email} 在组队广场和频道中发言吗？其报名不受影响。` },
            yes: { en: "Stop posting", zh: "禁止发言" }, danger: true,
          });
          if (!ok) return;
        }
        await api("POST", `/api/admin/users/${author.id}/ban`, { banned: !author.banned });
      }, !author.banned)
      : null,
    status);
}

function contentItem(kind, it) {
  return h(`article.d-mod__item${it.removed ? ".is-removed" : ""}`,
    h("p.d-mod__meta",
      h("span.d-pill", t(KIND_LABEL[kind])),
      it.channel ? h("span.d-pill", `#${it.channel === "lobby" ? "lobby" : trackShort(it.channel)}`) : null,
      h("b", it.author.name || "—"), h("span", it.author.email), h("time", stamp(it.createdAt)),
      it.removed ? h("span.d-pill.d-pill--wait", t(it.removed === "author" ? { en: "Deleted by author", zh: "作者已删除" } : { en: "Hidden", zh: "已隐藏" })) : null,
      it.author.banned ? h("span.d-pill.d-pill--wait", t({ en: "Can't post", zh: "已禁言" })) : null),
    it.title ? h("p.d-mod__title", it.title) : null,
    h("p.d-mod__body", it.body),
    modButtons(kind, it.id, it.removed, it.author));
}

function reportItem(r) {
  const resolve = h("button.d-link", {
    type: "button",
    on: { click: (e) => busy(e.currentTarget, async () => { await api("POST", `/api/admin/reports/${r.id}/resolve`, {}); draw(); }) },
  }, t({ en: "Mark as handled", zh: "标记为已处理" }));
  return h("article.d-mod__item",
    h("p.d-mod__meta", h("span.d-pill", t(KIND_LABEL[r.kind])), h("span", t({ en: "Reported by", zh: "举报人：" }), " ", r.reporter), h("time", stamp(r.createdAt))),
    r.reason ? h("p.d-mod__reason", t({ en: "Reason:", zh: "原因：" }), " ", r.reason) : null,
    r.target
      ? [h("p.d-mod__body", r.target.body), h("p.d-mod__meta", h("b", r.target.author.name || "—"), h("span", r.target.author.email),
          r.target.removed ? h("span.d-pill.d-pill--wait", t({ en: "Already hidden", zh: "已隐藏" })) : null),
        modButtons(r.kind, r.kind === "message" ? Number(r.targetId) : r.targetId, r.target.removed, r.target.author)]
      : h("p.d-field__hint", t({ en: "The reported item no longer exists.", zh: "被举报的内容已不存在。" })),
    h("p.d-mod__actions", resolve));
}

start();
