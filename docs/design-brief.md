# DIC website — visual language redesign brief

Status: **approved and implemented** (2026-10-21). Decisions in §10 are resolved; deviations from the draft are noted inline.
Reference: `DIC公众号排版与素材包` (the 2026 WeChat article pack, "Neon Pixel × Retro Desktop").

---

## 1. The prompt

> Redesign the NYUSH DIC website around the 2026 campaign's visual language —
> deep navy, cyan and orchid, pixel details, retro-desktop windows — so that a
> visitor arriving from the WeChat article recognises the same campaign
> immediately. Treat the pack as a **source of vocabulary, not a template**:
> keep its palette and its restraint, but rebuild every component natively for
> the web and give the desktop metaphor a job to do. On a phone article, a
> window is decoration; on a website, a window can open, take focus, show
> state, and respond to the cursor. Every motif must earn its place by doing
> something — showing structure, showing state, or inviting an action.
>
> Readability wins every conflict. Pixel type, glitch offsets and window chrome
> live in labels, numbers, icons and edges; Chinese and long English body text
> stay in calm, highly legible system type. The site must still load fast from
> mainland China and work inside the WeChat in-app browser at 390 px.
>
> Mood: a premium retro-computing campaign with a cheerful, collegiate,
> intelligent tone. Not a hacker terminal, not vaporwave, not a game.

---

## 2. What the pack does, and what we take from it

| In the pack | On the website |
|---|---|
| Navy `#032344` field, cyan `#70D5E8`, orchid `#CA7DDD`, lavender `#D8CBFF` | **Adopted as the base palette** — campaign consistency matters more than novelty. Extended into full tonal ramps with defined jobs (§4). |
| Window cards with `TRACK_01.EXE` title bars, `− □ ×` | **Rebuilt as a real `Window` component** with focus state: the title bar turns cyan when the window is hovered or focused, like an active OS window. Our own naming scheme (`dic://tracks/01`), not `.EXE`. Used for tracks, phases, registration and the quote only — not every card. |
| Hard 5 px offset shadow, no blur | **Signature interaction.** Shadow grows on hover, collapses to zero on press, so buttons and windows physically "click". |
| Pixel icons, 48-grid, crisp edges | **Kept as a family.** Redrawn as inline SVG components so they recolour with tokens and stay sharp at any size. The pack's eight icons are the reference; we add the ones the site needs (people, mail, globe, external link). |
| Mono kicker under every Chinese heading (`TIMELINE UNVEILED`) | **Becomes a site-wide label system**: every section header pairs the heading (current language) with an English mono index label `02 / TRACKS`. Labels stay English in both locales, like system UI. |
| `FILE / 01` page header strip, three-square pixel divider | **Not reused.** Replaced by a menu bar (header) and a status bar (footer) that frame the whole page as one desktop — see §5. |
| Chromatic cyan/orchid offset on "OPC" | **Display-only**: the theme word and phase numerals; the hero year is a double cyan/orchid outline after the poster. Never on text people need to read. |
| Hex circuit network on the poster | **Translated into a live SVG circuit** in the hero connecting the DIC mark to the four track icons, with small data pulses travelling along it. Illustrates the theme — one person, four capabilities. |
| 2em first-line indent, zh/en paragraph pairs | **Dropped.** That's a WeChat convention. The site has a language toggle; paragraphs are blocks. |
| No emoji | **Adopted as a rule.** |

Assets reused as content, not as layout: the **kick-off poster** (as the kick-off event image) and the **OPC illustration** (in the theme section). Both are the club's own campaign art. Everything else is rebuilt.

---

## 3. What changes from the current site

| Now | After |
|---|---|
| Near-black violet `#0A0819`, white content sections | Navy throughout with tonal steps; lavender "inverse" panels give rhythm instead of white blocks |
| Indigo `#3119DC` gradient blobs, blurred glows | No blur anywhere. Indigo survives as the hard-shadow colour under primary buttons, tying the logo colour in |
| Nunito, rounded, pill buttons, 20 px corners | Montserrat headings, square corners (0–2 px), rectangular buttons |
| Caveat script tagline | Removed from UI; the tagline lives only inside the logo artwork |
| Fade-up scroll reveals | "Window open" reveal: short clip + scale, stepped timing on small elements |
| Last year's three tracks on the home page | **The 2026 edition**: OPC theme, four tracks, two phases, kick-off timeline |

The logo stays untouched. On navy it appears in its white or lavender variant, exactly as the poster does.

---

## 4. Tokens

### Colour — every colour has a job

| Token | Value | Job |
|---|---|---|
| `navy-950` | `#021A33` | Page edges, menu bar, footer |
| `navy-900` | `#032344` | Main field (pack value) |
| `navy-800` | `#0B2C4D` | Window bodies (pack value) |
| `navy-700` | `#143758` | Inset panels — example cases, code-like readouts |
| `navy-600` | `#395672` | Hairlines, window borders |
| `cyan-400` | `#70D5E8` | **Structure & interaction**: links, focus rings, lines, nodes, numbers, active title bar |
| `orchid-400` | `#CA7DDD` | **Emphasis**: highlights, current step, the one thing to notice |
| `lavender-200` | `#D8CBFF` | **Headings & chrome**: title bars, primary button fill, inverse panels |
| `paper-50` | `#F4F5FF` | Body text on navy (pack value) |
| `mist-300` | `#B9C9DC` | Secondary text on navy (pack value) |
| `indigo-600` | `#3119DC` | Logo colour; hard shadow under primary buttons |
| `amber-200` | `#FFE1A4` | **Unconfirmed data only** — TBD dates and figures |

Contrast targets: body ≥ 7:1, secondary ≥ 4.5:1. `paper-50` on `navy-900` is ~14:1, `mist-300` ~9:1, `cyan-400` ~9:1. Orchid (~5:1) is for emphasis at ≥ 16 px, never small text.

### Type

| Role | Face | Notes |
|---|---|---|
| Display & headings (Latin) | **Montserrat** 700/800 | The logo wordmark appears to be Montserrat — this makes headings match the logo. Replaces the Nunito stand-in. |
| Body (Latin + CJK) | System stack: PingFang SC → Microsoft YaHei → system-ui | Fast, native, harmonious with Chinese. No CJK webfont. |
| Labels, numbers, kickers | **JetBrains Mono** 500/700 | The "computer" voice. Uppercase, tracked, small. |

No pixel font (decided in review): the pixel voice lives in the icons, the outlined year and the mono labels. All self-hosted from npm, Latin subsets only, about 120 KB of woff2.

Scale (mobile → desktop): hero 44→80, h2 28→40, h3 20→24, body 16 (zh line-height 1.85, en 1.65), label 11–12 mono, tracked 0.14em.

### Shape, depth, motion

- Radius: `0` for windows, buttons, inputs. `2px` only for chips.
- Border: 1 px `navy-600`; 1 px `cyan-400` when focused.
- Shadow: hard offset only — `6px 6px 0` (4 px on mobile). Hover `+3px`, press `0`.
- Background: a faint 1 px dot grid on navy, 24 px pitch, ~6 % opacity — reads as a desktop surface.
- Motion: `steps()` easing for blinking cursors and icon frames; `cubic-bezier(.2,.8,.2,1)` 180–260 ms for UI. Everything collapses under `prefers-reduced-motion`.
- Explicitly **excluded**: CRT scanlines, blur glows, neon bloom, glitch on body text, custom mouse cursors, sound.

---

## 5. Components

1. **Menu bar (header).** Left: DIC mark + `DIC 2026`. Centre: nav. Right: segmented `EN | 中` toggle and a live **Shanghai clock** (`CST 23:41`) — on-theme and genuinely useful, since every deadline is in China time and a third of entrants aren't. On mobile the nav opens as a dropdown window.
2. **Window.** Title bar (label, controls), body, optional status line. Focus/hover state switches title bar lavender → cyan. Controls are decorative and hidden from screen readers.
3. **Section header.** `02 / TRACKS` mono label, heading, optional right-aligned status chip (`● ENTRIES OPEN`, `TBD`).
4. **Buttons.** Primary: lavender fill, navy text, indigo hard shadow. Secondary: navy fill, cyan border and text. Both press in.
5. **Pixel icon set.** Inline SVG, `crispEdges`, token colours.
6. **Hero circuit.** SVG: DIC mark centre, four track icons at the corners, right-angle traces, pulses every few seconds. Static under reduced motion. Stacks into a compact 2×2 under the copy on mobile.
7. **Countdown readout.** Mono, `T−19d 04:12:33 → KICK-OFF`, blinking block cursor. Switches to the next milestone automatically when one passes.
8. **Readout panel (stats).** Pixel numerals with count-up, labelled `LAST RUN · 2025`.
9. **Track window.** Icon, name (zh + en), mission line with cyan rule, description, and an expandable **Example direction** (native `<details>`) holding the case study.
10. **Timeline.** Vertical on mobile, horizontal track on desktop. Square nodes; the current step blinks orchid. **TBD dates render as an amber dashed chip, not as 【】 brackets** — unconfirmed information is designed for, not hidden.
11. **File list (events).** Rows like a file explorer: date · type · title, cyan row highlight on hover. Replaces event cards.
12. **Inverse panel.** Lavender body, navy text. Used for the Dean's quote and the recruitment call.
13. **Status bar (footer).** Contact, socials, and a one-line system strip: `NYUSH DIC · 2026 EDITION · SHANGHAI`.

---

## 6. Page structure

**Home** — a summary that pushes toward the Challenge page:

1. Hero: `2026` (pixel, chromatic offset) · *Digital Innovation Challenge* · theme line *OPC: Redefining the Individual Business* · CTAs · countdown · circuit
2. Theme: the guiding question, the OPC statement, the illustration
3. Four tracks: compact windows in a 2×2 grid, each linking to its detail
4. How it works: two phases + kick-off timeline
5. Readout: last edition's numbers
6. About DIC + Dean's quote
7. Events (file list) · Partners
8. Core team recruitment (inverse panel)

**Challenge** — built out in this PR, since the content now exists: full track windows with example directions, phase details with submission requirements, full timeline, registration panel.

**Other pages** — get the new chrome and header; content stays placeholder until assets arrive.

---

## 7. Content riding along with the redesign

The pack contains the 2026 edition copy, so the site moves to it:

- Theme: **OPC: Redefining the Individual Business**
- Tracks: AI-Native Business · AI Safety & Alignment · Embodied AI · AI × Healthcare, each with mission, description and example case
- Phases: Stage 1 (teams ≤ 3, proposal + 3–5 min video + resumes) and Stage 2 (top teams per track, mentors, closing ceremony)
- Timeline: Kick-off · Phase I deadline · Advancement announcement · Closing ceremony

Handled carefully:

- Kick-off is **Nov 9 (Mon)** on the poster but `2026.11.XX` in the article body. I'll use **Nov 9** for the countdown and mark it as to-be-confirmed until you say otherwise.
- Every other date, the one-month deadline, team size, video length and "other requirements" are marked **TBD** in the amber style, exactly as uncertain as the pack says they are.
- Not carried over: the internal collaborator note and names/emails at the end of the copy, and anything the pack itself says not to publish.
- Last year's tracks move to the Archive page.

---

## 8. Mobile, WeChat, performance

- Designed at **390 px first** (the pack's verified width), then 768 and 1280.
- Every window stacks to a single column; title-bar labels shorten; shadows drop to 4 px.
- Tap targets ≥ 44 px. No hover-only information — everything hover shows is also visible or in a `<details>`.
- Images: the 1.4 MB illustration and 320 KB poster get re-encoded (target < 250 KB each) with explicit width/height.
- No new third-party requests. Fonts and icons stay local.
- Checked at 390 px in both locales before the PR.

---

## 9. Delivery

The repository turned out to be the live Jekyll site, deployed from `main` by GitHub Actions to `geemir.github.io/NYUSH-DIC-Official-Website/`. So nothing is committed to `main` directly:

1. Branch `redesign/campaign-2026` from `main`; replace the Jekyll site with the Next.js site in reviewable commits.
2. Replace the Jekyll workflow with a Next.js static-export workflow that understands the Pages sub-path. Pull requests get a build check; only `main` deploys.
3. Verify at 390 / 768 / 1280 in both languages against a sub-path build, then open the PR with before/after screenshots.

---

## 10. Decisions (resolved)

| Question | Decision |
|---|---|
| Palette | **Permanent** — navy / cyan / orchid is the site's base, not a 2026 season skin |
| Pixel display font | **Not used** |
| Live Shanghai clock | **Kept** |
| Kick-off countdown | **Counts down to Nov 9** (start of day, China time — the start time is not announced yet) |
| Repository | `Geemir/NYUSH-DIC-Official-Website`, the existing live site, replaced via pull request |
