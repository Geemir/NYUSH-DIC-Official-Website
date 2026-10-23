# DIC API

The server behind DIC 2026's **Registration**, **Team-up** and **organisers'**
pages, and the (optional) **assistant**. The website stays a static Jekyll site
on GitHub Pages; its pages call this API.

- Sign-in with an emailed 6-digit code (no passwords).
- Registration: everyone registers for themselves, then starts a team, joins
  one with an invite code, or goes ahead without a team. Teams of 1–3.
- Team-up: cards from teams and from people looking for a team, reply
  threads, and discussion channels (a lobby and one per track).
- Organisers: overview, every participant and team, Excel / CSV / Google
  Sheets export, moderation.
- Assistant: answers questions about DIC 2026 from the site's own text.
  Off until you switch it on.

It is one fetch handler (`src/app.js`) over SQLite, with no framework. The same
code runs:

| Where | Entry | Database |
|---|---|---|
| Node 22.13+ (your laptop, a cloud server, Docker) | `src/node.js` | a SQLite file |
| Cloudflare Workers | `src/worker.js` | Cloudflare D1 (SQLite) |
| The browser, in preview mode (`?preview=1`) | `assets/js/dic-platform/preview.js` | sql.js (SQLite in WebAssembly) |

## Run it locally

```bash
cd server
npm install
cp .env.example .env
npm run dev
```

For local development, put these in `.env`:

```
DIC_ENV=development
DEV_RETURN_CODE=1
EMAIL_PROVIDER=console
ALLOWED_ORIGINS=http://localhost:4000
ADMIN_EMAILS=you@example.com
BOT_PROVIDER=echo
DATABASE_PATH=../../dic-dev.sqlite
```

`DEV_RETURN_CODE=1` shows sign-in codes on the page, so no email is needed.
Keep `DATABASE_PATH` outside the website folder: `jekyll serve --livereload`
reloads the page whenever a file in the folder changes, database included.

Then run the site (`bundle exec jekyll serve` in the repository root), open it,
and point it at your API from the browser console:

```js
localStorage.setItem("dic-api", "http://localhost:8787")
```

(This only works on localhost. Remove it with `localStorage.removeItem("dic-api")`.)

Tests: `npm test`.

## Deploy

**The club's setup: an Alibaba Cloud server in Hong Kong.** The website and the
API run there together, deployed by GitHub Actions on every push to `main`.
The full guide, from renting the server to going live, is
[deploy/README.md](../deploy/README.md).

Other ways to run the API are below. Whichever you choose, the API needs **its
own domain** (for example `api.nyushdic.com`): free hosting addresses such as
`*.workers.dev` are blocked in mainland China.

### Option A: Cloudflare Workers + D1

Free for this size, nothing to maintain, and it scales by itself on Kick-off
Day. Needs a Cloudflare account and the domain added to it.

```bash
cd server
npx wrangler login
npx wrangler d1 create nyushdic                 # copy the database_id into wrangler.toml
npx wrangler d1 execute nyushdic --remote --file=schema.sql
npx wrangler secret put AUTH_SECRET             # a long random string
npx wrangler secret put RESEND_API_KEY
npx wrangler deploy
```

Before deploying, edit `wrangler.toml`: the `[vars]` (website address, admin
emails, email sender, deadlines), and uncomment the `routes` line with your
API's domain. Running the `d1 execute` line again later is safe; it only
creates what's missing.

### Option B: any server with Docker

For example, a Hong Kong cloud server: quick from the mainland, and no ICP
filing (备案) needed, which a server in mainland China would require.

```bash
cd server
docker build -t nyushdic-api .
docker run -d --restart unless-stopped --env-file .env \
  -v nyushdic-data:/app/data -p 127.0.0.1:8787:8787 nyushdic-api
```

Put HTTPS in front, e.g. [Caddy](https://caddyserver.com) with this Caddyfile,
and set `TRUST_PROXY=1`:

```
api.nyushdic.com {
  reverse_proxy 127.0.0.1:8787
}
```

Back up the database (the `nyushdic-data` volume) regularly.

### Then, on the website

1. Put the API's address in `_data/dic2026.yml` → `platform.api_url`, e.g.
   `"https://api.nyushdic.com"`. The Registration and Team-up pages go live,
   and the DIC 2026 page's sign-up section points to them.
2. Make sure `ALLOWED_ORIGINS` lists the website's address (and nothing else).
3. Sign in on `/DIC2026/admin/` with an address from `ADMIN_EMAILS`.

### Email

Sign-in codes go out by email. On Alibaba Cloud, use DirectMail (邮件推送,
`EMAIL_PROVIDER=aliyun`; set-up in [deploy/README.md](../deploy/README.md),
step 7). Elsewhere, [Resend](https://resend.com) (`EMAIL_PROVIDER=resend`):
add your domain there, put the DNS records it gives you in place, and set
`EMAIL_FROM` to an address on that domain. Send yourself a test code at a QQ
and a 163 address: Chinese mailboxes are strict, and a new sender can land in
spam at first. Any other service works through `EMAIL_PROVIDER=webhook`
(the API POSTs `{ to, subject, text, html }` to your URL).

## Settings

All settings are environment variables, listed with explanations in
[`.env.example`](.env.example). The ones that matter most:

| Variable | What it does |
|---|---|
| `AUTH_SECRET` | Required. A long random string. |
| `ALLOWED_ORIGINS` | Required. The website's address(es). |
| `ADMIN_EMAILS` | Who can open the organisers' page. |
| `EMAIL_PROVIDER`, `EMAIL_FROM`, `ALIYUN_ACCESS_KEY_ID` / `_SECRET` (or `RESEND_API_KEY`) | Sending sign-in codes. |
| `REGISTRATION_CLOSES`, `PROJECT_EDIT_CLOSES` | Deadlines, China time, e.g. `2026-11-30T23:59:00+08:00`. |
| `TEAM_MAX` | Team size limit (default 3). |
| `BOARD_PUBLIC_READ` | `0` hides Team-up cards from signed-out visitors. |
| `BOT_PROVIDER`, `ANTHROPIC_API_KEY`, `BOT_KNOWLEDGE_URL` | The assistant (below). |

To change **what the registration asks**, edit `src/form.js`: the website,
the checks, the admin table and the exports all follow it. Answers are stored
as JSON, so no database change is needed.

## The assistant

Off by default. To switch it on:

1. Set `BOT_PROVIDER=anthropic`, `ANTHROPIC_API_KEY`, and
   `BOT_KNOWLEDGE_URL=https://<the website>/assets/dic2026/knowledge.txt`
   (the site builds that file from `_data/dic2026.yml`, so the assistant
   always knows the current page content).
2. Set `platform.chatbot: true` in `_data/dic2026.yml` to show the button.

It uses Claude (`claude-opus-5-5` through Anthropic's SDK) at low effort,
so answers start quickly. The instructions and facts are cached between
questions, which makes repeat questions much cheaper. Server-side fallbacks
are on: if a safety check declines a question, Anthropic retries it on the
model it recommends for that case. Costs are bounded by `BOT_LIMIT_PER_HOUR`
(per person), `BOT_LIMIT_PER_DAY` (everyone together) and `BOT_MAX_TOKENS`.

**Check before switching on:** Anthropic's API is not offered in mainland
China. The API key has to belong to an account in a supported region, and the
server has to call from one. To use a different model provider, add a
`src/bot-<name>.js` that exports `streamReply` (see `src/bot-claude.js`) and
route to it in `providerFor()` in `src/bot.js`.

`BOT_PROVIDER=echo` is a stand-in that repeats the question, for testing the
page without a key.

## Data

What's stored: each person's email, the "About you" answers, team and project
details, Team-up posts and messages. Only hashes of sign-in codes and session
tokens are kept. Organisers see everything on the admin page; teammates see
each other's name and school; Team-up contact details are shown only to
signed-in people.

People can withdraw their registration themselves (it's deleted). To remove
someone entirely, delete their rows in `users`, `participants`, `sessions`,
`posts`, `replies` and `messages` (with `wrangler d1 execute … --command` on
Cloudflare, or `sqlite3` on a server).

## Code

| File | |
|---|---|
| `schema.sql` | The tables. |
| `src/app.js` | Routes, CORS, errors. Every endpoint is listed here. |
| `src/form.js` | The registration questions, tracks, skills, channels. |
| `src/auth.js` | Sign-in codes, sessions, display names. |
| `src/registration.js` | Registration and teams. |
| `src/board.js`, `src/chat.js` | Team-up cards, replies, reports, channels. |
| `src/admin.js` | Organisers' data and moderation. |
| `src/bot.js`, `src/bot-claude.js` | The assistant. |
| `src/config.js`, `src/db.js`, `src/email.js`, `src/ratelimit.js`, `src/util.js` | Settings, database adapters, email, limits, helpers. |
| `src/node.js`, `src/worker.js` | Node and Cloudflare entry points. |
| `test/api.test.js` | End-to-end tests against an in-memory database. |
