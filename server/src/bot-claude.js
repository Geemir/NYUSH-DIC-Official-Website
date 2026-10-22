/*
 * Claude as the chatbot's model, through Anthropic's official SDK.
 * Loaded only when BOT_PROVIDER=anthropic (needs ANTHROPIC_API_KEY).
 *
 * - Model BOT_MODEL (default claude-opus-5-5) at effort BOT_EFFORT (default
 *   low): the model always thinks a little first; low keeps that short, so
 *   answers start quickly. Raise it only if answers fall short.
 * - The system prompt (instructions plus the site's facts) never changes
 *   between requests and is marked for prompt caching, so after the first
 *   question it is read from cache at a fraction of the price. The date is
 *   sent as a short system message at the end of the conversation instead.
 * - Server-side fallbacks are on: if a safety classifier declines a
 *   question, the API retries it on the model Anthropic recommends for that
 *   case rather than refusing outright.
 */
import Anthropic from "@anthropic-ai/sdk";
import { HttpError } from "./util.js";

/* One client per key (config.bot.fetch replaces the network in tests). */
let cached = { key: null, fetch: null, client: null };
function clientFor(config) {
  const { apiKey, fetch } = config.bot;
  if (cached.key !== apiKey || cached.fetch !== fetch) {
    cached = { key: apiKey, fetch, client: new Anthropic({ apiKey, ...(fetch ? { fetch } : {}) }) };
  }
  return cached.client;
}

const unavailable = () => new HttpError(502, "bot_failed",
  "The assistant couldn't answer just now. Please try again in a minute.", "智能助手暂时无法回答，请稍后再试。");

/* API errors → messages for the visitor (details go to the server log). */
function translate(err) {
  if (err instanceof Anthropic.RateLimitError) {
    return new HttpError(429, "bot_busy", "The assistant is busy right now. Please try again in a minute.", "智能助手当前繁忙，请稍后再试。");
  }
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    console.error("Chatbot: the Anthropic API key was rejected. Check ANTHROPIC_API_KEY.", err.message);
    return unavailable();
  }
  if (err instanceof Anthropic.BadRequestError) {
    console.error("Chatbot: the request was rejected.", err.message);
    return unavailable();
  }
  if (err instanceof Anthropic.APIError) {
    console.error(`Chatbot: API error ${err.status ?? "(no response)"}.`, err.message);
    return unavailable();
  }
  return err;
}

export async function* streamReply({ config, system, turns, today }) {
  const messages = turns.map((t) => ({ role: t.role, content: t.text }));
  messages.push({ role: "system", content: `Today's date in Shanghai: ${today}.` });

  try {
    const stream = clientFor(config).beta.messages.stream({
      model: config.bot.model,
      max_tokens: config.bot.maxTokens,
      output_config: { effort: config.bot.effort },
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield { type: "text", text: event.delta.text };
      }
    }

    const final = await stream.finalMessage();
    const u = final.usage;
    console.log(`[bot] ${final.model} stop=${final.stop_reason} in=${u.input_tokens} cached=${u.cache_read_input_tokens ?? 0}`
      + ` cache_write=${u.cache_creation_input_tokens ?? 0} out=${u.output_tokens}`);
    /* Declined even after the fallback: the page replaces any partial text. */
    if (final.stop_reason === "refusal") yield { type: "refusal" };
  } catch (err) {
    throw translate(err);
  }
}
