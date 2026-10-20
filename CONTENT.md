# Editing the DIC website

Everything on the site comes from a handful of files under `src/content/`.
You do **not** need to touch the layout or components to change what the site
says. Every file has English and Chinese side by side — if you add one, add
both, or the other language will show a blank.

You can edit these directly on GitHub in the browser: open the file, click the
pencil icon, commit to `main`. GitHub Actions rebuilds and redeploys the site
on its own, usually within two minutes.

---

## The files, and what each one controls

| File | What it controls |
|---|---|
| `src/content/site.ts` | Club email and socials, **the kick-off date, registration and recruitment links**, last edition's headline numbers, the nav |
| `src/content/data/edition2026.ts` | **This year's challenge**: theme text, the four tracks and their example cases, the two stages, the timeline |
| `src/content/dictionaries.ts` | All other copy: hero, section headings, buttons, footer |
| `src/content/data/events.ts` | Workshops, talks, company visits |
| `src/content/data/partners.ts` | Partners, judges and mentors |
| `src/content/data/editions.ts` | Past editions (for the Archive page) |
| `src/content/placeholders.ts` | Copy for pages that are still being built |

---

## Marking something as not confirmed yet

Anything that isn't final goes in **double square brackets**:

```ts
when: { en: "Dec [[TBD]]", zh: "12 月 [[待定]]" },
body: { en: "Form a team of up to [[3]] members…", zh: "…每队最多 [[3]] 名成员…" },
```

On the site, bracketed text shows as an amber dashed chip that reads as
"to be confirmed". When the value is final, **delete the brackets** — that is
the whole edit. Do this instead of writing 【待定】 or "XX" into the text.

---

## The things you will change most often

### Registration opens

`src/content/site.ts` → `currentEdition`:

```ts
kickoff: "2026-11-09T00:00:00+08:00",  // drives the countdown
registerUrl: "",   // paste the sign-up link here when it exists
recruitUrl: "",    // core-team application link
```

While `registerUrl` is empty, every "Enter the Challenge" button leads to the
registration panel on the Challenge page, which says sign-up opens at kick-off.
Paste the link and the panel becomes a real "Open the registration form"
button.

**Use a form that works in mainland China** — 腾讯问卷, 飞书问卷 or 问卷星.
Google Forms and Google Docs are blocked there.

Dates are ISO 8601 in China Standard Time (`+08:00`).

### Confirming timeline dates

`src/content/data/edition2026.ts` → `milestones`. Replace `[[TBD]]` with the
date, and add a `date: "2026-12-20T00:00:00+08:00"` field so the timeline knows
which step is next.

### The headline numbers

`src/content/site.ts` → `headlineStats`. Update them the week an edition
closes, while the numbers are fresh.

### Adding an event

Add to the top of the array in `src/content/data/events.ts` (newest first):

```ts
{
  id: "spring-2027-tencent-visit",   // unique; lowercase, hyphens
  kind: "visit",                     // "workshop" | "talk" | "visit" | "competition"
  title: { en: "…", zh: "…" },
  summary: { en: "…", zh: "…" },
  date: "2027-03-14T14:00:00+08:00", // optional
  location: { en: "…", zh: "…" },    // optional
}
```

---

## Images

Drop files into `public/`, then reference them by the path **after** `public`.
A file at `public/events/innovation-day-2025.jpg` is written as
`/events/innovation-day-2025.jpg`.

In code, wrap that path in `asset()` — `asset("/events/innovation-day-2025.jpg")`.
The live site is served from a sub-path on GitHub Pages, and `asset()` adds it.

Before adding a photo, resize it to at most 1600 px on the long edge and export
as JPEG or WebP at about 80 % quality. A 6 MB phone photo makes the page slow,
especially on mobile data.

Brand assets live in `public/brand/`:

| File | Use |
|---|---|
| `dic-mark.png` | The mark in its original colours — on light backgrounds |
| `dic-mark-light.png` | The mark recoloured lavender→white for navy backgrounds |
| `dic-logo-full.png` | The original full lockup |
| `dic-logo.png` | Trimmed full lockup, for light backgrounds |
| `dic-logo-light.png` | Full lockup for navy backgrounds |
| `og-default.png` | The preview card shown when a link is shared |
| `icon-32/180/512.png` | Browser tab and phone home-screen icons |

The light variants were generated from the colour originals (the ribbon's
shading is preserved). If a designer makes official reversed versions, swap
them in under the same file names.

Campaign art lives in `public/campaign/` (kick-off poster, OPC illustration),
each as WebP with a JPEG fallback.

---

## The visual system, in one paragraph

Navy field, cyan for structure and anything you can interact with, orchid for
the one thing to notice, lavender for headings and window chrome, amber only
for unconfirmed information. Headings in Montserrat, labels and numbers in
JetBrains Mono, body text in the system font. Square corners, hard offset
shadows, no blur. The full reasoning is in [docs/design-brief.md](docs/design-brief.md).

---

## Rules that keep the site working in mainland China

These are not style preferences. Breaking one makes the site slow or broken for
a large share of your audience.

1. **No Google Fonts.** Fonts are installed from npm (`@fontsource/*`) and
   served from our own domain. Never add a `fonts.googleapis.com` link.
2. **No Google Analytics, Google Forms/Docs, Firebase or YouTube embeds.** Use
   Bilibili or Tencent Video for video, 腾讯问卷/飞书 for forms, and
   Plausible/Umami or 百度统计 for analytics.
3. **Chinese text uses system fonts on purpose.** A CJK webfont is several
   megabytes. The stack falls back to PingFang SC on Apple devices and
   Microsoft YaHei on Windows, which people already have.
4. **Test in the WeChat in-app browser** before promoting a link in a 推文.
   That is where most of your traffic will open the site, and it is not Chrome.

---

## Adding a whole new page

1. Create `src/app/[locale]/your-page/page.tsx`.
2. Add its copy to `src/content/` rather than hard-coding strings in the file.
3. If it belongs in the nav, add it to `navLinks` in `src/content/site.ts`.

Copy an existing page as a starting point — the placeholder pages under
`src/app/[locale]/` are the simplest examples.

---

## Handover checklist

When the core team changes, pass on:

- [ ] GitHub repository access (and who the owner is)
- [ ] GitHub Pages settings (Settings → Pages; source is "GitHub Actions")
- [ ] The domain registrar login and renewal date, if a custom domain is added
- [ ] Whoever owns the registration form and its inbox
- [ ] This file
