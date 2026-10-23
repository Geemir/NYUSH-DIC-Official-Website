# This is the official website for NYUSH DIC!!!

## By Josiah 2024

---

## Editing the site

A Jekyll site on the Minimal Mistakes theme, deployed to GitHub Pages by
`.github/workflows/jekyll.yml` on every push to `main`.

```bash
bundle install
bundle exec jekyll serve --livereload   # http://localhost:4000
```

| What | Where |
|---|---|
| **DIC 2026 page** text, tracks, timeline, sign-up link | `_data/dic2026.yml` (official 公众号 copy, word for word) |
| DIC 2026 page layout / styles / behaviour | `_layouts/dic2026.html`, `assets/css/dic2026.scss`, `assets/js/dic2026.js` |
| DIC 2026 opening animation (when arriving from the rest of the site, or on a first visit) | `assets/js/dic2026-intro.js`; uses anime.js 3.2.2 in `assets/js/lib/` |
| Top menu | `_data/navigation.yml` |
| Home page | `index.markdown` |
| Site-wide style additions | `_sass/dic/` |
| Site-wide script (tap-to-zoom images, home countdown, home mouse trail) | `assets/js/dic-site.js` |
| **Registration, Team-up, organisers' page** (`/DIC2026/register/`, `/DIC2026/team-up/`, `/DIC2026/admin/`) | pages `DIC2026-*.html`, text in `_data/dic2026.yml`, scripts in `assets/js/dic-platform/`, styles in `_sass/dic/_dic2026-app.scss` |
| The API behind them (sign-in, registrations, Team-up, export, chatbot) | `server/`: see [server/README.md](server/README.md) |
| Going live on the club's Alibaba Cloud server (www.nyushdic.com) | `deploy/`: step-by-step guide in [deploy/README.md](deploy/README.md) |

Registration and Team-up need the API in `server/`. Until it is deployed and its
address is in `platform.api_url` in `_data/dic2026.yml`, those pages say
"opening soon". Add `?preview=1` to their address to try them anyway: the API
then runs inside your browser with sample data, and nothing is sent anywhere.
Once `api_url` is set, the DIC 2026 sign-up section points to them.

(An external sign-up form also still works: paste its link into `register_url`.)

Keep everything loadable from mainland China: no Google Fonts, Google Docs or
Forms, or unpinned CDNs. Fonts and Font Awesome are self-hosted under
`assets/`.
