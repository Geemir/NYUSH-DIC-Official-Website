/*
 * Settings, read from environment variables (a .env file on Node, "vars" and
 * secrets on Cloudflare). Every variable is listed in .env.example.
 */

const list = (v) => String(v || "").split(",").map((s) => s.trim()).filter(Boolean);
const int = (v, fallback) => (v === undefined || v === "" ? fallback : parseInt(v, 10));

/* "2026-11-30T23:59:00+08:00" → milliseconds, or null when unset. */
function moment(name, v) {
  if (!v) return null;
  const t = Date.parse(v);
  if (Number.isNaN(t)) throw new Error(`${name} is not a date: ${v} (use e.g. 2026-11-30T23:59:00+08:00)`);
  return t;
}

export function configFromEnv(env = {}) {
  const dev = env.DIC_ENV === "development";
  const secret = env.AUTH_SECRET || (dev ? "development-only-secret" : "");
  if (!secret) throw new Error("AUTH_SECRET is not set. Use a long random string (see .env.example).");
  const origins = list(env.ALLOWED_ORIGINS);
  if (!dev && (!origins.length || origins.includes("*"))) {
    throw new Error("ALLOWED_ORIGINS must list the website's address, e.g. https://www.nyushdic.com");
  }

  return {
    dev,
    secret,
    origins,
    adminEmails: list(env.ADMIN_EMAILS).map((e) => e.toLowerCase()),
    /* Development only: the sign-in code comes back in the API response
       (and shows on the page), so no email is needed to test. */
    devReturnCode: dev && env.DEV_RETURN_CODE === "1",

    email: {
      provider: env.EMAIL_PROVIDER || (dev ? "console" : ""), // console | resend | webhook
      from: env.EMAIL_FROM || "NYUSH DIC <noreply@example.com>",
      replyTo: env.EMAIL_REPLY_TO || "shanghai.dic@nyu.edu",
      resendKey: env.RESEND_API_KEY || "",
      webhookUrl: env.EMAIL_WEBHOOK_URL || "",
      webhookSecret: env.EMAIL_WEBHOOK_SECRET || "",
    },

    /* Per-address limits are generous on purpose: students on campus Wi-Fi
       share one public address, and Kick-off Day means many sign-ins at once.
       Per-email and per-account limits stay tight. */
    limits: {
      codesPerAddressHour: int(env.CODE_LIMIT_PER_ADDRESS_HOUR, 300),
    },

    registration: {
      /* After this moment people can no longer register, change their
         details or change teams (admins still can). */
      closesAt: moment("REGISTRATION_CLOSES", env.REGISTRATION_CLOSES),
      /* After this moment the repository link and project details lock too. */
      projectClosesAt: moment("PROJECT_EDIT_CLOSES", env.PROJECT_EDIT_CLOSES),
      teamMax: int(env.TEAM_MAX, 3),
    },

    board: {
      /* Anyone may read Team-up posts (without contact details) unless this
         is "0". Replies, contacts and chat always need a sign-in. */
      publicRead: env.BOARD_PUBLIC_READ !== "0",
      maxOpenPosts: int(env.BOARD_MAX_OPEN_POSTS, 3),
    },

    bot: {
      /* "" = off; "anthropic" = Claude (needs ANTHROPIC_API_KEY); "echo" =
         a stand-in that repeats the question, for testing the page. */
      provider: env.BOT_PROVIDER || "",
      model: env.BOT_MODEL || "claude-opus-5-5",
      effort: env.BOT_EFFORT || "low", // low | medium | high: more thinking, slower and dearer
      apiKey: env.ANTHROPIC_API_KEY || "",
      name: env.BOT_NAME || "DIC Assistant",
      /* The facts the assistant answers from: the site publishes them at
         /assets/dic2026/knowledge.txt, built from _data/dic2026.yml. */
      knowledgeUrl: env.BOT_KNOWLEDGE_URL || "",
      requireLogin: env.BOT_REQUIRE_LOGIN === "1",
      maxTokens: int(env.BOT_MAX_TOKENS, 8000), // includes the model's thinking
      perHour: int(env.BOT_LIMIT_PER_HOUR, 30), // per person (or per address when signed out)
      perDay: int(env.BOT_LIMIT_PER_DAY, 2000), // everyone together: a ceiling on cost
    },
  };
}
