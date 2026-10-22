/*
 * Team-up (/DIC2026/team-up/): a board of cards, from teams looking for
 * members and from people looking for a team, each with a reply thread;
 * and discussion channels (a lobby and one per track).
 *
 * Anyone can read the cards; contact details, replies and the channels need
 * a sign-in. The channels poll for new messages every few seconds while the
 * page is open and visible.
 */
import { api, session, getForm, mode } from "./api.js";
import {
  h, t, text, bind, clear, field, chipsField, choiceField, readFields, missing, showErrors,
  setStatus, errorPair, busy, toast, dialog, confirmBox, ago, stamp, copyText,
} from "./ui.js";
import { requireSignIn, requireName, nameDialog, accountBar, previewBanner, soonPanel } from "./account.js";

const root = document.querySelector("[data-teamup]");
const POLL_MS = 4000;
const LONG = 320; // characters before a card's text folds

let form = null;
let posts = [];
const view = { kind: "", track: "", q: "", mine: false };

const KIND = {
  team: { en: "Team looking for members", zh: "队伍招募队员" },
  solo: { en: "Looking for a team", zh: "个人寻找队伍" },
};
const trackShort = (id) => (id === "any" ? "ANY" : `T${id.slice(-2)}`);
const trackName = (id) => (id === "any" ? { en: "Any track", zh: "任意赛道" } : form.tracks.find((tr) => tr.id === id) || { en: id });
const skillName = (v) => form.skills.find((s) => s.value === v) || { en: v };
const isAdmin = () => !!(session.user && session.user.admin);

/* ------------------------------------------------------------------ start */
async function start() {
  const banner = previewBanner();
  if (banner) root.before(banner);
  if (mode === "off") {
    root.append(soonPanel("d-soon", "TEAM_UP.EXE"));
    return;
  }
  root.append(h("p.d-loading", t({ en: "Loading…", zh: "加载中…" })));
  try {
    [form] = await Promise.all([getForm(), session.restore()]);
  } catch (err) {
    clear(root).append(h("p.d-status.d-status--error", t(errorPair(err))));
    return;
  }
  clear(root).append(layout(), accountBar());
  /* Redraw when someone signs in or out (not when they just rename themselves). */
  let who = session.user && session.user.id;
  session.onChange((user) => {
    if ((user && user.id) === who) return;
    who = user && user.id;
    drawToolbar();
    loadPosts();
    chat.reset();
  });
  loadPosts();
  chat.open("lobby");
}

/* Board and chat side by side; on phones, two tabs. */
let pane = "board";
let wrapEl, boardEl, chatEl, toolbarEl, cardsEl;
function layout() {
  toolbarEl = h("div.d-board__tools");
  cardsEl = h("div.d-cards", { "aria-live": "polite" });
  boardEl = h("section.d-tu__board#tu-board", { role: "tabpanel", "aria-labelledby": "tu-tab-board" }, toolbarEl, cardsEl);
  chatEl = h("section.d-tu__chat#tu-chat", { role: "tabpanel", "aria-labelledby": "tu-tab-chat" }, chat.build());
  const tab = (id, label) => h("button.d-tu__tab", {
    type: "button", role: "tab", id: `tu-tab-${id}`, "aria-controls": `tu-${id}`,
    on: { click: () => setPane(id) },
  }, t(label));
  const tabs = h("div.d-tu__tabs", { role: "tablist" },
    tab("board", { en: "Cards", zh: "卡片" }), tab("chat", { en: "Channels", zh: "频道" }));
  wrapEl = h("div.d-tu", tabs, boardEl, chatEl);
  drawToolbar();
  setPane("board");
  return wrapEl;
}

function setPane(id) {
  pane = id;
  for (const b of wrapEl.querySelectorAll(".d-tu__tab")) b.setAttribute("aria-selected", String(b.id === `tu-tab-${id}`));
  wrapEl.dataset.pane = id;
  if (id === "chat") chat.poll();
}

/* ---------------------------------------------------------------- toolbar */
function drawToolbar() {
  const kinds = [
    { value: "", label: { en: "All cards", zh: "全部" } },
    { value: "team", label: { en: "Teams", zh: "招募队员" } },
    { value: "solo", label: { en: "People", zh: "寻找队伍" } },
  ];
  if (session.user) kinds.push({ value: "mine", label: { en: "My cards", zh: "我的卡片" } });
  if (!session.user && view.mine) view.mine = false;

  const seg = h("div.d-seg", { role: "group", "aria-label": { en: "Show", zh: "显示" } }, kinds.map((k) => h("button.d-seg__item", {
    type: "button", "aria-pressed": String(k.value === "mine" ? view.mine : !view.mine && view.kind === k.value),
    on: {
      click: () => {
        const wasMine = view.mine;
        view.mine = k.value === "mine";
        if (!view.mine) view.kind = k.value;
        drawToolbar();
        if (wasMine !== view.mine) loadPosts();
        else drawCards();
      },
    },
  }, t(k.label))));

  const tracks = h("div.d-chips.d-chips--tight", { role: "group", "aria-label": { en: "Track", zh: "赛道" } },
    [{ id: "" }, ...form.tracks].map((tr) => h("button.d-chip.d-chip--small", {
      type: "button", "aria-pressed": String(view.track === tr.id),
      title: tr.id ? { en: tr.en, zh: tr.zh } : null,
      on: { click: () => { view.track = tr.id; drawToolbar(); drawCards(); } },
    }, tr.id ? trackShort(tr.id) : t({ en: "All tracks", zh: "全部赛道" }))));

  const search = h("input.d-input.d-input--search", {
    type: "search", value: view.q, placeholder: { en: "Search cards", zh: "搜索卡片" }, "aria-label": { en: "Search cards", zh: "搜索卡片" },
    on: { input: (e) => { view.q = e.target.value; drawCards(); } },
  });
  const post = h("button.d-btn.d-btn--primary", { type: "button", on: { click: () => compose() } }, "+ ", t({ en: "Post a card", zh: "发布卡片" }));
  clear(toolbarEl).append(h("div.d-board__row", seg, post), h("div.d-board__row", tracks, search));
}

/* ----------------------------------------------------------------- cards */
/* Only the latest load draws: an older answer that arrives late (say, from
   just before signing in) must not overwrite a newer one. */
let loading = Promise.resolve();
let latest = 0;
function loadPosts() {
  const n = ++latest;
  loading = (async () => {
    try {
      const r = await api("GET", `/api/board/posts${view.mine ? "?mine=1" : ""}`);
      if (n !== latest) return;
      posts = r.posts;
      drawCards();
    } catch (err) {
      if (n === latest) clear(cardsEl).append(h("p.d-status.d-status--error", t(errorPair(err))));
    }
  })();
  return loading;
}

function shown() {
  const q = view.q.trim().toLowerCase();
  return posts.filter((p) =>
    (!view.kind || view.mine || p.kind === view.kind)
    && (!view.track || p.track === view.track || p.track === "any")
    && (!q || `${p.title} ${p.body} ${p.author.name} ${p.skills.map((s) => text(skillName(s))).join(" ")}`.toLowerCase().includes(q)));
}

function drawCards() {
  const list = shown();
  clear(cardsEl);
  if (!list.length) {
    cardsEl.append(h("div.d-empty",
      h("p", t(posts.length
        ? { en: "No cards match. Try another filter.", zh: "没有符合条件的卡片，换个筛选条件试试。" }
        : view.mine
          ? { en: "You haven't posted a card yet.", zh: "你还没有发布卡片。" }
          : { en: "No cards yet. Be the first: post a card about your team, or about yourself.", zh: "还没有卡片。来发布第一张吧：介绍你的队伍，或者介绍你自己。" })),
      h("button.d-btn.d-btn--ghost", { type: "button", on: { click: () => compose() } }, "+ ", t({ en: "Post a card", zh: "发布卡片" }))));
    return;
  }
  for (const p of list) cardsEl.append(card(p));
}

function card(p) {
  const el = h(`article.d-card.d-card--${p.kind}${p.status === "closed" ? ".is-closed" : ""}`, { dataset: { id: p.id } });
  const textEl = h("p.d-card__text", p.body.length > LONG ? `${p.body.slice(0, LONG).trimEnd()}…` : p.body);
  const more = p.body.length > LONG
    ? h("button.d-link", { type: "button", on: { click: () => { textEl.textContent = p.body; more.remove(); } } }, t({ en: "Read more", zh: "展开全文" }))
    : null;
  const thread = h("div.d-thread", { hidden: true });
  const repliesBtn = h("button.d-card__replies", { type: "button", "aria-expanded": "false" },
    t({ en: "Replies", zh: "回复" }), " ", h("span.d-card__count", String(p.replies)));
  repliesBtn.addEventListener("click", () => toggleThread(p.id));

  append(el,
    h("div.d-card__bar",
      h("span.d-card__kind", t(KIND[p.kind])),
      h("span.d-card__track", { title: { en: trackName(p.track).en, zh: trackName(p.track).zh || trackName(p.track).en } }, trackShort(p.track))),
    h("div.d-card__body",
      h("h3.d-card__title", p.title),
      h("p.d-card__meta", h("span", p.author.name), h("span", t(ago(p.createdAt))), h("span", t(trackName(p.track)))),
      textEl, more,
      p.skills.length ? h("ul.d-card__skills", p.skills.map((s) => h("li.d-pill", t(skillName(s))))) : null,
      contactLine(p),
      p.status === "closed" ? h("p.d-card__closed", t({ en: "Closed: they've found their match.", zh: "已关闭：已经找到队友了。" })) : null),
    h("div.d-card__foot", repliesBtn, h("span.d-card__spacer"), cardActions(p)),
    thread);
  return el;
}

function append(el, ...children) {
  for (const c of children) if (c) el.append(c);
  return el;
}

function contactLine(p) {
  if (p.contact === null) {
    return h("p.d-card__contact",
      h("button.d-link", { type: "button", on: { click: async () => { if (await requireSignIn()) loadPosts(); } } },
        t({ en: "Sign in to see contact details", zh: "登录后查看联系方式" })));
  }
  if (!p.contact) return null;
  return h("p.d-card__contact",
    h("span.d-card__label", t({ en: "Contact", zh: "联系方式" })), " ", h("span.d-card__value", p.contact), " ",
    h("button.d-link", { type: "button", on: { click: async () => toast((await copyText(p.contact)) ? { en: "Copied.", zh: "已复制。" } : { en: "Couldn't copy.", zh: "复制失败。" }) } },
      t({ en: "Copy", zh: "复制" })));
}

function cardActions(p) {
  if (p.mine) {
    return h("span.d-card__actions",
      h("button.d-link", { type: "button", on: { click: () => compose(p) } }, t({ en: "Edit", zh: "编辑" })),
      h("button.d-link", { type: "button", on: { click: () => setPostStatus(p, p.status === "open" ? "closed" : "open") } },
        t(p.status === "open" ? { en: "Found them", zh: "已找到" } : { en: "Reopen", zh: "重新开放" })),
      h("button.d-link.d-link--danger", { type: "button", on: { click: () => deletePost(p) } }, t({ en: "Delete", zh: "删除" })));
  }
  return h("span.d-card__actions",
    isAdmin() ? h("button.d-link.d-link--danger", { type: "button", on: { click: () => deletePost(p, true) } }, t({ en: "Remove", zh: "移除" })) : null,
    h("button.d-link.d-link--quiet", { type: "button", on: { click: () => report("post", p.id) } }, t({ en: "Report", zh: "举报" })));
}

async function setPostStatus(p, status) {
  try {
    const r = await api("PATCH", `/api/board/posts/${p.id}`, { status });
    Object.assign(p, r.post);
    toast(status === "closed"
      ? { en: "Card closed. Congratulations on finding your match!", zh: "卡片已关闭，恭喜找到队友！" }
      : { en: "Card reopened.", zh: "卡片已重新开放。" });
    if (!view.mine && status === "closed") posts = posts.filter((x) => x.id !== p.id);
    drawCards();
  } catch (err) {
    toast(errorPair(err), "error");
  }
}

async function deletePost(p, moderator = false) {
  const ok = await confirmBox({
    message: moderator
      ? { en: `Remove “${p.title}” from Team-up? You can restore it from the organiser dashboard.`, zh: `确定从组队广场移除「${p.title}」吗？之后可在组委会后台恢复。` }
      : { en: `Delete your card “${p.title}”?`, zh: `确定删除你的卡片「${p.title}」吗？` },
    yes: moderator ? { en: "Remove", zh: "移除" } : { en: "Delete", zh: "删除" },
    danger: true,
  });
  if (!ok) return;
  try {
    await api("DELETE", `/api/board/posts/${p.id}`);
    posts = posts.filter((x) => x.id !== p.id);
    drawCards();
  } catch (err) {
    toast(errorPair(err), "error");
  }
}

/* ---------------------------------------------------------------- threads */
/* The card for a post as it is now on the page (cards are redrawn when
   someone signs in), with its post. */
function cardFor(id) {
  const el = [...cardsEl.querySelectorAll(".d-card")].find((c) => c.dataset.id === id);
  const p = posts.find((x) => x.id === id);
  return el && p ? { p, thread: el.querySelector(".d-thread"), button: el.querySelector(".d-card__replies") } : null;
}

async function toggleThread(id) {
  let c = cardFor(id);
  if (c && !c.thread.hidden) {
    c.thread.hidden = true;
    c.button.setAttribute("aria-expanded", "false");
    return;
  }
  if (!session.user) {
    if (!(await requireSignIn())) return;
    await new Promise((r) => setTimeout(r)); // let the sign-in start reloading the board…
    let pending;
    do { pending = loading; await pending; } while (pending !== loading); // …and wait for the last load
    c = cardFor(id);
  }
  if (!c) return;
  const { p, thread, button } = c;
  thread.hidden = false;
  button.setAttribute("aria-expanded", "true");
  clear(thread).append(h("p.d-loading", t({ en: "Loading replies…", zh: "正在加载回复…" })));
  try {
    const { replies } = await api("GET", `/api/board/posts/${p.id}/replies`);
    drawThread(p, thread, replies, button);
  } catch (err) {
    clear(thread).append(h("p.d-status.d-status--error", t(errorPair(err))));
  }
}

function drawThread(p, thread, replies, button) {
  const list = h("ol.d-thread__list", replies.map((r) => reply(p, r, thread, replies, button)));
  const count = button.querySelector(".d-card__count");
  count.textContent = String(replies.length);
  p.replies = replies.length;
  clear(thread).append(replies.length ? list : h("p.d-thread__empty", t({ en: "No replies yet.", zh: "还没有回复。" })));
  if (p.status !== "open") {
    thread.append(h("p.d-field__hint", t({ en: "This card is closed, so replies are off.", zh: "卡片已关闭，无法回复。" })));
    return;
  }
  const box = h("textarea.d-input.d-textarea", { name: "body", rows: 2, maxlength: 1000, placeholder: { en: "Write a reply…", zh: "写下你的回复…" }, "aria-label": { en: "Reply", zh: "回复" } });
  const status = h("p.d-status", { role: "alert" });
  const send = h("button.d-btn.d-btn--small.d-btn--primary", { type: "submit" }, t({ en: "Reply", zh: "回复" }));
  const f = h("form.d-thread__form", { novalidate: true }, box, h("div.d-thread__send", status, send));
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!box.value.trim()) return box.focus();
    if (!(await requireName())) return;
    busy(send, async () => {
      try {
        const r = await api("POST", `/api/board/posts/${p.id}/replies`, { body: box.value });
        replies.push(r.reply);
        drawThread(p, thread, replies, button);
        thread.querySelector("textarea").focus();
      } catch (err) {
        setStatus(status, errorPair(err));
      }
    });
  });
  thread.append(f);
}

function reply(p, r, thread, replies, button) {
  const remove = async (moderator) => {
    const ok = await confirmBox({
      message: moderator ? { en: "Remove this reply?", zh: "确定移除这条回复吗？" } : { en: "Delete your reply?", zh: "确定删除你的回复吗？" },
      yes: moderator ? { en: "Remove", zh: "移除" } : { en: "Delete", zh: "删除" },
      danger: true,
    });
    if (!ok) return;
    try {
      await api("DELETE", `/api/board/replies/${r.id}`);
      replies.splice(replies.indexOf(r), 1);
      drawThread(p, thread, replies, button);
    } catch (err) {
      toast(errorPair(err), "error");
    }
  };
  return h(`li.d-reply${r.mine ? ".is-mine" : ""}`,
    h("p.d-reply__head", h("b", r.author.name), " ", h("time", { datetime: new Date(r.createdAt).toISOString(), title: stamp(r.createdAt) }, t(ago(r.createdAt)))),
    h("p.d-reply__body", r.body),
    h("p.d-reply__actions",
      r.mine ? h("button.d-link.d-link--quiet", { type: "button", on: { click: () => remove(false) } }, t({ en: "Delete", zh: "删除" })) : null,
      !r.mine && isAdmin() ? h("button.d-link.d-link--danger", { type: "button", on: { click: () => remove(true) } }, t({ en: "Remove", zh: "移除" })) : null,
      !r.mine ? h("button.d-link.d-link--quiet", { type: "button", on: { click: () => report("reply", r.id) } }, t({ en: "Report", zh: "举报" })) : null));
}

/* ---------------------------------------------------------------- posting */
async function compose(existing) {
  const user = await requireName();
  if (!user) return;
  let preset = {};
  if (!existing) {
    /* Start from the registration: a team's track, or the person's skills. */
    try {
      const reg = await api("GET", "/api/registration");
      if (reg.team) preset = { kind: "team", track: reg.team.track };
      else if (reg.registration) preset = { kind: "solo", track: reg.registration.trackPref || "any", skills: reg.registration.profile.skills || [] };
    } catch { /* not registered: start blank */ }
  }
  const p = existing || { kind: preset.kind || "solo", track: preset.track || "any", title: "", body: "", skills: preset.skills || [], contact: "" };

  const kind = choiceField({
    key: "kind", label: { en: "This card is for", zh: "卡片类型" }, required: true,
    options: [
      { value: "team", en: "A team looking for members", zh: "队伍招募队员", note: { en: "Say what you're building and who you need.", zh: "介绍你们的方向，以及需要什么样的队友。" } },
      { value: "solo", en: "Me, looking for a team", zh: "我在寻找队伍", note: { en: "Say what you bring and what interests you.", zh: "介绍你擅长什么、对什么感兴趣。" } },
    ],
  }, p.kind);
  const track = choiceField({
    key: "track", label: { en: "Track", zh: "赛道" }, required: true,
    options: [{ value: "any", en: "Any track", zh: "任意赛道", kicker: "ANY" }, ...form.tracks.map((tr) => ({ value: tr.id, en: tr.en, zh: tr.zh, kicker: trackShort(tr.id) }))],
  }, p.track);
  const fields = [
    kind,
    track,
    field({ key: "title", type: "text", label: { en: "Title", zh: "标题" }, required: true, max: 80, wide: true,
      placeholder: { en: "e.g. Health-tech team needs a designer", zh: "例如：医疗健康方向队伍招募设计师" } }, p.title),
    field({ key: "body", type: "textarea", label: { en: "Description", zh: "介绍" }, required: true, max: 1000, rows: 5, wide: true }, p.body),
    chipsField({ key: "skills", label: { en: "Skills", zh: "技能" }, options: form.skills, max: 6,
      hint: { en: "For a team: the skills you're looking for. For yourself: what you bring.", zh: "队伍卡片：你们需要的技能；个人卡片：你能贡献的技能。" } }, p.skills),
    field({ key: "contact", type: "text", label: { en: "Contact", zh: "联系方式" }, max: 80, wide: true,
      hint: { en: "Only signed-in participants see this. For example, your WeChat ID.", zh: "仅登录的参赛者可见，例如你的微信号。" } }, p.contact),
  ];
  const status = h("p.d-status", { role: "alert" });
  const save = h("button.d-btn.d-btn--primary", { type: "submit" }, t(existing ? { en: "Save card", zh: "保存卡片" } : { en: "Post card", zh: "发布卡片" }));
  const who = h("span.d-posting__name", user.displayName);
  const posting = h("p.d-posting", t({ en: "Posting as", zh: "发布身份：" }), " ", who, " ",
    h("button.d-link", { type: "button", on: { click: async () => { const u = await nameDialog(); if (u) who.textContent = u.displayName; } } }, t({ en: "Change", zh: "修改" })));
  const f = h("form.d-form", { novalidate: true }, h("div.d-form__grid", fields), posting, status, h("div.d-actions", save));
  const d = dialog({ title: existing ? "EDIT_CARD.EXE" : "NEW_CARD.EXE", body: f, wide: true });
  f.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = readFields(f);
    const problems = missing([
      { key: "title", required: true, label: { en: "Title", zh: "标题" } },
      { key: "body", required: true, label: { en: "Description", zh: "介绍" } },
    ], v);
    if (showErrors(f, problems)) return;
    busy(save, async () => {
      try {
        const r = existing
          ? await api("PATCH", `/api/board/posts/${existing.id}`, v)
          : await api("POST", "/api/board/posts", v);
        if (existing) Object.assign(existing, r.post);
        else posts.unshift(r.post);
        d.close();
        drawCards();
        toast(existing ? { en: "Card saved.", zh: "卡片已保存。" } : { en: "Card posted.", zh: "卡片已发布。" });
      } catch (err) {
        if (err.details.field) showErrors(f, [{ field: err.details.field, message: err.pair }]);
        else setStatus(status, errorPair(err));
      }
    });
  });
}

/* ---------------------------------------------------------------- reports */
async function report(kind, id) {
  if (!(await requireSignIn())) return;
  const reason = h("textarea.d-input.d-textarea#report-reason", { rows: 3, maxlength: 300 });
  const status = h("p.d-status", { role: "alert" });
  const send = h("button.d-btn.d-btn--primary", { type: "submit" }, t({ en: "Send report", zh: "提交举报" }));
  const f = h("form.d-form", { novalidate: true },
    h("div.d-field",
      h("label.d-field__label", { for: "report-reason" }, t({ en: "What's wrong? (optional)", zh: "请说明原因（选填）" })),
      reason),
    h("p.d-field__hint", t({ en: "Only the organisers see reports.", zh: "举报内容仅组委会可见。" })),
    status, h("div.d-actions", send));
  const d = dialog({ title: "REPORT.EXE", body: f });
  f.addEventListener("submit", (e) => {
    e.preventDefault();
    busy(send, async () => {
      try {
        await api("POST", "/api/report", { kind, id, reason: reason.value });
        d.close();
        toast({ en: "Thanks. The organisers will take a look.", zh: "感谢反馈，组委会会尽快处理。" });
      } catch (err) {
        setStatus(status, errorPair(err));
      }
    });
  });
}

/* --------------------------------------------------------------- channels */
const chat = (() => {
  let channel = "lobby";
  let last = 0;
  let timer = null;
  let loading = false;
  const shownIds = new Set();
  let tabs, log, gate, composer, input, status, sendBtn;

  const channelLabel = (c) => (c.id === "lobby" ? { en: "Lobby", zh: "大厅" } : { en: `${trackShort(c.id)} ${c.en}`, zh: `${trackShort(c.id)} ${c.zh}` });

  function build() {
    tabs = h("div.d-chat__tabs", { role: "tablist", "aria-label": { en: "Channels", zh: "频道" } });
    log = h("div.d-chat__log", { role: "log", "aria-live": "polite", tabindex: "0", "aria-label": { en: "Messages", zh: "消息" } });
    gate = h("div.d-chat__gate", { hidden: true },
      h("p", t({ en: "Sign in to read and join the conversation.", zh: "登录后即可查看和参与讨论。" })),
      h("button.d-btn.d-btn--primary", { type: "button", on: { click: async () => { if (await requireSignIn()) open(channel); } } }, t({ en: "Sign in", zh: "登录" })));
    input = h("textarea.d-input.d-chat__input", { rows: 1, maxlength: 1000, "aria-label": { en: "Message", zh: "消息" } });
    status = h("p.d-status", { role: "alert" });
    sendBtn = h("button.d-btn.d-btn--small.d-btn--primary", { type: "submit" }, t({ en: "Send", zh: "发送" }));
    composer = h("form.d-chat__form", { novalidate: true }, input, sendBtn);
    composer.addEventListener("submit", (e) => { e.preventDefault(); send(); });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        send();
      }
    });
    input.addEventListener("input", () => {
      input.style.height = "auto";
      input.style.height = `${Math.min(input.scrollHeight, 140)}px`;
    });
    drawTabs();
    return h("div.d-win.d-chat",
      h("div.d-win__bar", h("span", "CHANNELS.EXE"), h("span.d-win__ctl", { "aria-hidden": "true" }, h("i"), h("i"), h("i"))),
      tabs, h("div.d-chat__screen", log, gate), status, composer);
  }

  function drawTabs() {
    clear(tabs).append(...form.channels.map((c) => h("button.d-chat__tab", {
      type: "button", role: "tab", "aria-selected": String(c.id === channel),
      title: { en: c.en, zh: c.zh },
      on: { click: () => open(c.id) },
    }, "# ", c.id === "lobby" ? t(channelLabel(c)) : trackShort(c.id))));
    bind(input, "placeholder", {
      en: `Message #${channel === "lobby" ? "lobby" : trackShort(channel)}  (Enter to send)`,
      zh: `发送到 #${channel === "lobby" ? "大厅" : trackShort(channel)}（回车发送）`,
    });
  }

  function message(m) {
    const remove = async (moderator) => {
      const ok = await confirmBox({
        message: moderator ? { en: "Remove this message?", zh: "确定移除这条消息吗？" } : { en: "Delete your message?", zh: "确定删除你的消息吗？" },
        yes: moderator ? { en: "Remove", zh: "移除" } : { en: "Delete", zh: "删除" },
        danger: true,
      });
      if (!ok) return;
      try {
        await api("DELETE", `/api/chat/messages/${m.id}`);
        el.remove();
      } catch (err) {
        toast(errorPair(err), "error");
      }
    };
    const el = h(`div.d-msg${m.mine ? ".is-mine" : ""}`,
      h("p.d-msg__head", h("b", m.author.name), " ", h("time", { datetime: new Date(m.createdAt).toISOString(), title: stamp(m.createdAt) }, stamp(m.createdAt).slice(5))),
      h("p.d-msg__body", m.body),
      h("p.d-msg__actions",
        m.mine ? h("button.d-link.d-link--quiet", { type: "button", on: { click: () => remove(false) } }, t({ en: "Delete", zh: "删除" })) : null,
        !m.mine && isAdmin() ? h("button.d-link.d-link--danger", { type: "button", on: { click: () => remove(true) } }, t({ en: "Remove", zh: "移除" })) : null,
        !m.mine ? h("button.d-link.d-link--quiet", { type: "button", on: { click: () => report("message", m.id) } }, t({ en: "Report", zh: "举报" })) : null));
    return el;
  }

  function add(messages) {
    const nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
    for (const m of messages) {
      if (shownIds.has(m.id)) continue;
      shownIds.add(m.id);
      log.append(message(m));
      last = Math.max(last, m.id);
    }
    if (nearBottom || messages.some((m) => m.mine)) log.scrollTop = log.scrollHeight;
  }

  async function open(id) {
    channel = id;
    last = 0;
    shownIds.clear();
    drawTabs();
    clear(log);
    setStatus(status, null);
    const signedIn = !!session.user;
    gate.hidden = signedIn;
    composer.hidden = !signedIn;
    log.hidden = !signedIn;
    if (!signedIn) return;
    loading = true;
    try {
      const r = await api("GET", `/api/chat/messages?channel=${encodeURIComponent(id)}`);
      if (channel !== id) return;
      if (!r.messages.length) log.append(h("p.d-chat__empty", t({ en: "No messages yet. Say hello!", zh: "还没有消息，来打个招呼吧！" })));
      add(r.messages);
    } catch (err) {
      setStatus(status, errorPair(err));
    } finally {
      loading = false;
    }
    schedule();
  }

  async function poll() {
    if (!session.user || loading || document.hidden) return;
    if (pane !== "chat" && window.matchMedia("(max-width: 959px)").matches) return; // hidden on phones
    try {
      const id = channel;
      const r = await api("GET", `/api/chat/messages?channel=${encodeURIComponent(id)}&after=${last}`);
      if (channel === id && r.messages.length) {
        const empty = log.querySelector(".d-chat__empty");
        if (empty) empty.remove();
        add(r.messages);
      }
    } catch { /* try again next time */ }
  }

  function schedule() {
    clearInterval(timer);
    timer = setInterval(poll, POLL_MS);
  }

  async function send() {
    const body = input.value.trim();
    if (!body) return;
    if (!(await requireName())) return;
    busy(sendBtn, async () => {
      setStatus(status, null);
      try {
        const r = await api("POST", "/api/chat/messages", { channel, body });
        input.value = "";
        input.style.height = "auto";
        const empty = log.querySelector(".d-chat__empty");
        if (empty) empty.remove();
        add([r.message]);
      } catch (err) {
        setStatus(status, errorPair(err));
      }
    });
  }

  document.addEventListener("visibilitychange", () => { if (!document.hidden) poll(); });

  return { build, open, poll, reset: () => open(channel) };
})();

start();
