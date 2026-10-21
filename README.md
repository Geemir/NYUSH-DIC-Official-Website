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
| Top menu | `_data/navigation.yml` |
| Home page | `index.markdown` |
| Site-wide style additions | `_sass/dic/` |
| Site-wide script (tap-to-zoom images, home countdown) | `assets/js/dic-site.js` |

When the registration link is published, paste it into `register_url` in
`_data/dic2026.yml`; the DIC 2026 sign-up section turns into a button.

Keep everything loadable from mainland China: no Google Fonts, Google Docs or
Forms, or unpinned CDNs. Fonts and Font Awesome are self-hosted under
`assets/`.
