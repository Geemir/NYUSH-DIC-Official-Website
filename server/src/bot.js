/*
 * The chatbot's plumbing: off until BOT_PROVIDER is set.
 *
 *   GET  /api/bot         → { enabled, name, requireLogin }
 *   POST /api/bot/chat    { messages: [{ role: user | assistant, text }] }
 *                         → a stream of server-sent events:
 *                           data: {"type":"text","text":"…"}      (repeated)
 *                           data: {"type":"done"}  or  {"type":"refusal"}  or  {"type":"error","message":{en,zh}}
 *
 * The assistant answers from the site's own facts (BOT_KNOWLEDGE_URL, which
 * the site builds from _data/dic2026.yml), so updating the page content
 * updates what it knows. Providers live in their own files and load only
 * when used: bot-claude.js (Claude, through Anthropic's SDK) and an "echo"
 * stand-in for testing the page without a key.
 */
import { currentUser } from "./auth.js";
import { HttpError, fail, text } from "./util.js";
import { limit, HOUR, DAY } from "./ratelimit.js";

const MAX_TURNS = 12;
const MAX_CHARS = 2000;

export const botEnabled = (config) =>
  config.bot.provider === "echo" || (config.bot.provider === "anthropic" && !!config.bot.apiKey);

export async function botInfo(ctx) {
  const { bot } = ctx.config;
  return { enabled: botEnabled(ctx.config), name: bot.name, requireLogin: bot.requireLogin };
}

/* ------------------------------------------------------------- knowledge */
/* Fetched from the site and kept for 15 minutes. If the site can't be
   reached, the last good copy is used. */
let knowledge = { text: "", at: 0 };

async function loadKnowledge(config) {
  if (config.bot.knowledgeText) return config.bot.knowledgeText; // tests, preview
  const url = config.bot.knowledgeUrl;
  if (!url || Date.now() - knowledge.at < 15 * 60000) return knowledge.text;
  try {
    const res = await fetch(url, { headers: { Accept: "text/plain" } });
    if (res.ok) knowledge = { text: (await res.text()).slice(0, 60000), at: Date.now() };
  } catch (err) {
    console.error(`Could not load the chatbot's knowledge from ${url}:`, err.message);
  }
  return knowledge.text;
}

/* Kept byte-for-byte the same between requests, so the provider can cache it. */
export function systemPrompt(name, facts) {
  return `You are ${name}, the assistant on the website of the NYU Shanghai Digital Innovation Challenge 2026 (DIC 2026), which the student organisation NYUSH Digital Innovation Community runs. Visitors ask you about the challenge: the theme and the four tracks, the timeline, who can take part and how teams work, how registration and the Team-up page work on this website, and how to reach the organisers.

Answer from the reference material below. When it doesn't cover a question, say you don't know and suggest writing to shanghai.dic@nyu.edu or following the NYUSH DIC WeChat account; don't fill gaps with guesses about dates, prizes, rules or judging. The timeline can change, so when a date matters, mention that the organisers' announcements are final.

Reply in the language the visitor writes in, Chinese or English. Keep replies short and plain: a few sentences, or a short list for steps and dates. The chat window shows plain text, so write without Markdown: no asterisks, headings or tables; start list items with "- ". If someone asks for project ideas for a track, you can brainstorm with them; say that these are your suggestions, not official guidance.

You can't see or change anyone's registration, team or account. For problems with those, point people to the Registration page or to the organisers.

<reference>
${facts || "(The reference material could not be loaded. Apologise, and point visitors to the DIC 2026 page and to shanghai.dic@nyu.edu.)"}
</reference>`;
}

/* ------------------------------------------------------------------ chat */
function checkMessages(input) {
  if (!Array.isArray(input) || !input.length) fail(400, "invalid", "Send at least one message.", "请至少发送一条消息。");
  const turns = input.slice(-MAX_TURNS).map((m) => ({
    role: m && m.role === "assistant" ? "assistant" : "user",
    text: text(m && m.text, { min: 1, max: MAX_CHARS, multiline: true, field: "message", label: { en: "Message", zh: "消息" } }),
  }));
  while (turns.length && turns[0].role !== "user") turns.shift(); // a conversation starts with the visitor
  if (!turns.length || turns[turns.length - 1].role !== "user") fail(400, "invalid", "The last message must be yours.", "最后一条消息应来自你。");
  return turns;
}

async function providerFor(config) {
  if (config.bot.provider === "anthropic") return (await import("./bot-claude.js")).streamReply;
  if (config.bot.provider === "echo") return echoReply;
  fail(404, "bot_off", "The assistant isn't switched on.", "智能助手尚未开启。");
}

/* Stand-in provider: no model, no key. Streams the question back. */
async function* echoReply({ turns }) {
  const question = turns[turns.length - 1].text;
  const words = `(Test assistant: no AI model is connected yet.) You asked: “${question}”`.split(/(\s+)/);
  for (const w of words) {
    await new Promise((r) => setTimeout(r, 12));
    yield { type: "text", text: w };
  }
}

export async function chat(ctx) {
  const { config } = ctx;
  if (!botEnabled(config)) fail(404, "bot_off", "The assistant isn't switched on.", "智能助手尚未开启。");
  const user = await currentUser(ctx);
  if (config.bot.requireLogin && !user) fail(401, "sign_in", "Please sign in to use the assistant.", "请登录后使用智能助手。");

  const turns = checkMessages((await ctx.body()).messages);
  /* Signed-out visitors are counted by address, which a whole campus can
     share, so that allowance is larger; the daily ceiling covers everyone. */
  if (user) await limit(ctx.db, `bot:u:${user.id}`, config.bot.perHour, HOUR);
  else await limit(ctx.db, `bot:ip:${ctx.ip}`, config.bot.perHour * 5, HOUR);
  await limit(ctx.db, "bot:all", config.bot.perDay, DAY);

  const reply = await providerFor(config);
  const system = systemPrompt(config.bot.name, await loadKnowledge(config));
  /* Today's date, for "how long until…" questions. It goes with the
     conversation, not in the system prompt, so the prompt stays cacheable. */
  const today = new Date(Date.now() + 8 * HOUR).toISOString().slice(0, 10);

  const enc = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      const send = (event) => controller.enqueue(enc.encode(`data: ${JSON.stringify(event)}\n\n`));
      try {
        for await (const event of reply({ config, system, turns, today })) send(event);
        send({ type: "done" });
      } catch (err) {
        const known = err instanceof HttpError;
        if (!known) console.error("Chatbot error:", err);
        send({
          type: "error",
          message: known
            ? { en: err.message, zh: err.zh }
            : { en: "The assistant couldn't answer just now. Please try again in a minute.", zh: "智能助手暂时无法回答，请稍后再试。" },
        });
      }
      controller.close();
    },
  });
  return new Response(body, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}
