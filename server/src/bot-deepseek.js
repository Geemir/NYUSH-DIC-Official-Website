/*
 * DeepSeek as the chatbot's model, through its OpenAI-style chat API.
 * Loaded only when BOT_PROVIDER=deepseek (needs DEEPSEEK_API_KEY).
 * https://api-docs.deepseek.com/
 *
 * - Model BOT_MODEL (default deepseek-v4-pro), thinking off unless
 *   BOT_THINKING=1, so answers start straight away.
 * - The system prompt (instructions plus the site's facts) comes first and
 *   never changes between requests, so DeepSeek's automatic context cache
 *   reuses it. The date follows as a second system message.
 */
import { HttpError } from "./util.js";

const unavailable = () => new HttpError(502, "bot_failed",
  "The assistant couldn't answer just now. Please try again in a minute.", "智能助手暂时无法回答，请稍后再试。");

/* API errors → messages for the visitor (details go to the server log). */
async function failure(res) {
  const detail = await res.text().catch(() => "");
  if (res.status === 429 || res.status === 503) {
    return new HttpError(429, "bot_busy", "The assistant is busy right now. Please try again in a minute.", "智能助手当前繁忙，请稍后再试。");
  }
  if (res.status === 401) console.error("Chatbot: DeepSeek rejected the API key. Check DEEPSEEK_API_KEY.");
  else if (res.status === 402) console.error("Chatbot: the DeepSeek account is out of balance. Top it up at platform.deepseek.com.");
  else console.error(`Chatbot: DeepSeek error ${res.status}.`, detail.slice(0, 300));
  return unavailable();
}

export async function* streamReply({ config, system, turns, today }) {
  const { bot } = config;
  const res = await (bot.fetch || fetch)(`${bot.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${bot.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: bot.model,
      messages: [
        { role: "system", content: system },
        { role: "system", content: `Today's date in Shanghai: ${today}.` },
        ...turns.map((t) => ({ role: t.role, content: t.text })),
      ],
      thinking: { type: bot.thinking ? "enabled" : "disabled" },
      max_tokens: bot.maxTokens,
      stream: true,
    }),
  }).catch((err) => {
    console.error("Chatbot: could not reach DeepSeek.", err.message);
    throw unavailable();
  });
  if (!res.ok) throw await failure(res);

  /* Server-sent events: "data: {…}" lines, then "data: [DONE]". Only the
     answer (delta.content) is passed on, not the reasoning. */
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finish = null;
  let usage = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let end;
    while ((end = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, end).trim();
      buffer = buffer.slice(end + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") continue;
      let chunk;
      try { chunk = JSON.parse(data); } catch { continue; }
      const choice = chunk.choices && chunk.choices[0];
      if (choice && choice.delta && choice.delta.content) yield { type: "text", text: choice.delta.content };
      if (choice && choice.finish_reason) finish = choice.finish_reason;
      if (chunk.usage) usage = chunk.usage;
    }
  }
  if (usage) {
    console.log(`[bot] ${bot.model} finish=${finish} in=${usage.prompt_tokens} cached=${usage.prompt_cache_hit_tokens ?? 0} out=${usage.completion_tokens}`);
  }
  /* Declined by the content filter: the page replaces any partial text. */
  if (finish === "content_filter") yield { type: "refusal" };
}
