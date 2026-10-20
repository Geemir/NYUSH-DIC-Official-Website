# NYU Shanghai Digital Innovation Community — website

The official site of NYUSH DIC and the Digital Innovation Challenge.
Bilingual (English / 中文), statically exported, and built to load properly
from mainland China.

**To change what the site says, read [CONTENT.md](CONTENT.md).** You almost
never need to touch the code.

## Running it

```bash
npm install
npm run dev
```

Then open http://localhost:3000 — it redirects to `/en/` or `/zh/` based on your
browser language.

```bash
npm run build     # static export into ./out
npm run lint
```

## Deployment

Every push to `main` builds the static export and deploys it to GitHub Pages
via [.github/workflows/deploy.yml](.github/workflows/deploy.yml). Pull requests
run the same lint and build as a check, without deploying.

The site is served from a sub-path (`/NYUSH-DIC-Official-Website/`). The
workflow passes that to the build as `NEXT_PUBLIC_BASE_PATH`; locally it is
empty. If a custom domain is added in Settings → Pages, the workflow picks that
up automatically and the base path becomes empty.

> Building the static export on **Windows** writes the router's prefetch files
> into nested folders instead of dotted file names (a Next.js path-separator
> bug), so a local Windows `out/` shows harmless 404s for `__next.*.txt` files.
> The Linux build in CI is correct, and the workflow checks for it.

## How it is put together

- **Next.js 16 (App Router), React 19, TypeScript, Tailwind v4**
- `output: "export"` — plain HTML/CSS/JS in `out/`, hostable anywhere. No Node
  process in production.
- Locale is a real URL segment (`/en/…`, `/zh/…`) via `app/[locale]/`, which is
  the root layout, so `<html lang>` is right per locale.
- `public/index.html` is a hand-written redirect for `/` (a static export has no
  server to redirect with). Its paths are relative so it works under a sub-path.
- Fonts are self-hosted from npm. Chinese text deliberately uses system fonts.

```
src/
  app/[locale]/          routes; layout.tsx is the root layout
  components/
    ui/                  Window, PixelIcon, SectionHeader, Reveal, Rich (TBD chips)
    layout/              menu bar (with Shanghai clock) and status-bar footer
    edition/             countdown, hero circuit, tracks, stages, timeline, registration
    home/                stats readout, event list, partner grid
  content/               all copy and data — the part you edit
  lib/                   i18n helpers, base-path helpers, browser stores
public/brand/            logo variants, OG card, favicons
public/campaign/         2026 kick-off poster and OPC illustration
docs/design-brief.md     the visual language and the reasoning behind it
```

## Status

Built: Home and Challenge pages in both languages, with the DIC 2026 campaign
design (see [docs/design-brief.md](docs/design-brief.md)).

Placeholders (routes exist, content pending): Events, Archive, Partners, About,
Join.
