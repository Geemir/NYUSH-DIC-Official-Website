/*
 * The assistant: a chat button on the DIC 2026 pages that answers questions
 * about the challenge, through the API's /api/bot/chat (server/src/bot.js,
 * which answers from the site's own facts).
 *
 * Shown only when platform.chatbot is true in _data/dic2026.yml and the API
 * says the assistant is switched on. In preview mode it appears with the
 * API's stand-in, which just repeats the question.
 */
import { api, stream, mode, chatbotOn, session } from "./api.js";
import { h, t, clear, errorPair, page } from "./ui.js";
import { requireSignIn } from "./account.js";

const KEY = "dic-bot-history";
const MAX_KEEP = 20;

let history = [];
try { history = JSON.parse(sessionStorage.getItem(KEY) || "[]"); } catch { history = []; }
const remember = () => {
  try { sessionStorage.setItem(KEY, JSON.stringify(history.slice(-MAX_KEEP))); } catch { /* private mode */ }
};

async function start() {
  if (mode === "off" || (mode === "live" && !chatbotOn) || !page()) return;
  let info;
  try {
    info = await api("GET", "/api/bot");
  } catch {
    return;
  }
  if (info.enabled) build(info);
}

function build(info) {
  const log = h("div.d-bot__log", { role: "log", "aria-live": "polite", tabindex: "0" });
  const input = h("textarea.d-input.d-bot__input", { rows: 1, maxlength: 2000, "aria-label": { en: "Your question", zh: "你的问题" }, placeholder: { en: "Ask about DIC 2026…", zh: "关于 DIC 2026 的问题…" } });
  const send = h("button.d-btn.d-btn--small.d-btn--primary", { type: "submit" }, t({ en: "Ask", zh: "提问" }));
  const form = h("form.d-bot__form", { novalidate: true }, input, send);
  const close = h("button.d-dialog__close", { type: "button", "aria-label": { en: "Close", zh: "关闭" } }, "×");
  const panel = h("section.d-win.d-bot__panel#d-bot-panel", { hidden: true, "aria-label": info.name },
    h("div.d-win__bar", h("span", "ASSISTANT.EXE"), close),
    log,
    form,
    h("p.d-bot__note", t(mode === "preview"
      ? { en: "Preview: a stand-in that repeats your question. No AI model is connected.", zh: "预览：此助手只会重复你的问题，尚未接入 AI 模型。" }
      : { en: "AI answers can be wrong. The organisers' announcements are what count.", zh: "AI 的回答可能有误，请以组委会公告为准。" })));
  const open = h("button.d-bot__open", { type: "button", "aria-expanded": "false", "aria-controls": "d-bot-panel", "aria-label": { en: "Ask DIC", zh: "问问 DIC" } },
    h("span.d-bot__icon", { "aria-hidden": "true" }, "?"), h("span", t({ en: "Ask DIC", zh: "问问 DIC" })));
  const root = h("div.d-bot", panel, open);
  page().append(root);

  const bubble = (role, content) => {
    const el = h(`div.d-bot__msg.d-bot__msg--${role}`, content);
    log.append(el);
    log.scrollTop = log.scrollHeight;
    return el;
  };
  const greet = () => bubble("assistant", t({
    en: `Hi! I'm ${info.name}. Ask me about the tracks, the timeline, teams or registration.`,
    zh: `你好！我是 ${info.name}。可以问我赛道、时间线、组队或报名相关的问题。`,
  }));
  greet();
  for (const m of history) bubble(m.role, m.text);

  // On phones the bottom tab bar's "Ask" (_includes/dic2026/tabbar.html)
  // opens the panel, and the floating button stays out of the way (CSS).
  const openers = [open, ...document.querySelectorAll("[data-bot-open]")];
  let opener = open;
  const toggle = (show) => {
    panel.hidden = !show;
    for (const b of openers) b.setAttribute("aria-expanded", String(show));
    root.classList.toggle("is-open", show);
    if (show) input.focus();
    else opener.focus();
  };
  for (const b of openers) {
    b.hidden = false;
    b.setAttribute("aria-controls", "d-bot-panel");
    b.setAttribute("aria-expanded", "false");
    b.addEventListener("click", () => { opener = b; toggle(panel.hidden); });
  }
  close.addEventListener("click", () => toggle(false));
  panel.addEventListener("keydown", (e) => { if (e.key === "Escape") toggle(false); });

  async function ask() {
    const question = input.value.trim();
    if (!question || send.disabled) return;
    if (info.requireLogin && !session.user && !(await requireSignIn())) return;
    input.value = "";
    send.disabled = true;
    bubble("user", question);
    history.push({ role: "user", text: question });
    const reply = bubble("assistant", h("span.d-bot__typing", { "aria-label": { en: "Thinking", zh: "思考中" } }, h("i"), h("i"), h("i")));
    let answer = "";
    let ok = false;
    try {
      await stream("/api/bot/chat", { messages: history.slice(-12) }, (ev) => {
        if (ev.type === "text") {
          answer += ev.text;
          reply.textContent = answer;
          log.scrollTop = log.scrollHeight;
        } else if (ev.type === "refusal") {
          answer = "";
          clear(reply).append(t({ en: "Sorry, I can't help with that. For questions about DIC, write to shanghai.dic@nyu.edu.", zh: "抱歉，这个问题我无法回答。有关 DIC 的问题，请发邮件至 shanghai.dic@nyu.edu。" }));
        } else if (ev.type === "error") {
          clear(reply).append(t(ev.message));
        } else if (ev.type === "done") {
          ok = !!answer;
        }
      });
    } catch (err) {
      clear(reply).append(t(errorPair(err)));
    }
    if (ok) history.push({ role: "assistant", text: answer });
    else history.pop(); // keep the conversation to answered questions
    remember();
    send.disabled = false;
    input.focus();
  }
  form.addEventListener("submit", (e) => { e.preventDefault(); ask(); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      ask();
    }
  });
}

start();
