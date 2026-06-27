# Lemma Editor Redesign — Notion-level editing, Substack-level publishing

Status: **Design / proposal**
Author: design pass, 2026-06-28
Scope: the writing editor, the reading render pipeline, and free newsletter rendering. **Payments/paid subscriptions are out of scope** (see §1, §5).
Foundation decision: **stay on Tiptap 3 / ProseMirror** and build up (no library swap).

---

## 1. Goals & non-goals

**Goals**

1. A block editor that *feels* like Notion: drag-to-reorder blocks, a "+" inserter, a block action menu (turn into / duplicate / delete / color / move), a grouped & searchable slash menu, nested blocks (toggles, columns), and rich media.
2. A reading experience that *publishes* like Substack: server-rendered HTML (fast, SEO-correct, shareable) and one-click post → newsletter to free subscribers.
3. An architecture that doesn't preclude the things we're **not** doing yet — paid subscriptions, AI assist, and real-time collaboration all fall out naturally once content is canonical JSON.

**Non-goals (for this design)**

- **Payments & paid subscriptions** — explicitly out of scope for now: no Stripe, no paywall, no membership tiers. Everything ships **free**. §5 describes the (deliberately simple) free-subscriber model and how paid could be added later *additively*, without undoing anything.
- AI writing assistant — deferred, but the JSON model makes it a drop-in later.
- Real-time multi-author collaboration (Yjs/Hocuspocus) — deferred, same reason.

---

## 2. Why the current editor caps out (grounded in the code)

The Tiptap foundation is good. The four limits are architectural choices *around* it.

### 2.1 Markdown is the source of truth — the root problem
`getAllContent()` (`packages/headless/src/utils/index.ts`) serializes the doc to markdown via `editor.storage.markdown.serializer`. `AdvancedEditor` saves `{ markdown, words }` on every `onUpdate` (`apps/web/src/components/editor/index.tsx:298`), the API stores `documents.markdown` (`apps/api/src/db/schema.ts:108`), and the reader re-parses it.

Markdown is **lossy**. It structurally cannot represent callouts, toggles, columns, captioned/aligned images, embeds-with-attributes, footnotes, a paywall boundary, or comments anchored to a text range. You've **already hit this wall**: `apps/web/src/lib/custom-blocks.ts` smuggles JSON through markdown as `:::lemma-block {"type":"button",...}` tokens because markdown can't hold structured blocks. That's the symptom, not a feature. Notion and Substack both store a structured document model.

### 2.2 The reader boots a whole editor read-only
`ArticleContent` (`apps/web/src/components/profile/article-content.tsx`) mounts `EditorRoot` / `EditorContent` with `editable={false}`. On a Vite SPA that means a **reader** downloads ProseMirror + every extension + lowlight + katex just to read text, the article isn't in the initial HTML (bad SEO, broken social cards, slow LCP), and there's no path to email HTML. For a Substack alternative, reading *is* half the product.

### 2.3 It's Novel, unextended
`defaultExtensions` (`apps/web/src/components/editor/extensions.ts`) is essentially the Novel starter set + global-drag-handle. The gap to Notion is the **block experience**; the gap to Substack is **publishing blocks**.

### 2.4 No durable autosave / versioning / gating / email story
Autosave reserializes markdown on every keystroke; there's no revision history, no content gating, and `sendNewsletter` is a stub (`apps/api/src/trpc/routers/documents.ts:177` — `TODO: Implement newsletter queue integration`).

**What's already in your favor:** the schema already has the full free-newsletter spine — `subscribers`, `newsletterSettings`, `campaigns`, `newsletterDeliveries` (idempotent delivery ledger), plus `react-tweet` and `react-moveable` already sit in `@lemma/headless`'s deps (tweet embeds and image resizing were intended). That free-newsletter spine is exactly what this simplified, payments-free scope needs.

---

## 3. Target architecture

### 3.1 Three representations, one canonical
```
            ┌─────────────────────────────────────────────────────┐
            │  Tiptap/ProseMirror JSON  ←─ CANONICAL (edit + store)│
            └─────────────────────────────────────────────────────┘
                 │                    │                     │
        renderToHTML            jsonToMarkdown        renderToEmail
                 ▼                    ▼                     ▼
         HTML (read/SEO)     Markdown (export/AI)   Email-safe HTML
         cached in DB        derived, portable      (React Email)
```

- **JSON is canonical.** The editor loads and saves `editor.getJSON()`. Everything else is *derived*.
- **HTML** is computed **server-side** from JSON with `@tiptap/static-renderer` (`renderToHTMLString` — no DOM, runs in the Worker), cached on the row, and shipped to readers as static HTML. The reader never boots an editor.
- **Markdown** stays as a derived export (portability, AI, "copy as markdown") — not the store.
- **Email HTML** is a second server renderer that degrades blocks to email-safe markup.

### 3.2 The linchpin: a shared, framework-agnostic content package
Server-side rendering requires the ProseMirror **schema** (node/mark definitions) to exist outside React, in the Worker. So we extract a new package:

```
packages/content/   →  @lemma/content   (NO React; importable by web, api, email)
  schema.ts          the canonical extension/node list — SINGLE SOURCE OF TRUTH
  render-html.ts     renderToHTML(json)            → reader HTML (static-renderer)
  render-email.ts    renderToEmail(json)           → email-safe HTML
  markdown.ts        jsonToMarkdown / markdownToJson (@tiptap/markdown MarkdownManager)
  text.ts            extractPlainText, wordCount, readingTime, excerpt
  paywall.ts         splitAtPaywall(json) → { free, locked }
  types.ts           document/doc-node types
```

Dependency graph:
```
@lemma/content  ─────────────┬──────────────┬───────────────┐
   (schema + serializers)    │              │               │
                       @lemma/headless   apps/api      packages/email
                       (React editor:    (compute html/   (renderToEmail)
                        adds node views, excerpt on save;
                        slash, drag UI)  enforce paywall)
                              │
                           apps/web
                       write = headless editor
                       read  = static html from @lemma/content
```

Principle: **schema is shared; rendering is server-authoritative.** The editor in `@lemma/headless` extends the shared schema with *interactive-only* concerns (drag handle, slash menu, bubble menu, React node views). The API and email never import React.

### 3.3 Read path (new)
1. `getPublishedBySlug` returns the **cached `html`** (already gated — see §5), author byline, and meta.
2. The route renders that HTML directly (sanitized) — no editor, no katex/lowlight on the reader unless a block needs a tiny hydration island (e.g. a tweet embed, a poll).
3. Recompute `html` + `excerpt` + `readingTime` on every `upsertDocument` so the cache is always warm; bump a `contentVersion` for cache busting.

---

## 4. The editor experience (Notion-level)

### 4.1 Block controls
Replace `tiptap-extension-global-drag-handle@0.1.18` (basic) with a real block handle. Tiptap 3 ships an official `DragHandle` (`@tiptap/extension-drag-handle` / `-react`). The handle shows:

- **⋮⋮ drag** — reorder the block (and its nested children).
- **+ insert** — opens the slash menu at a new block below.
- **click ⋮⋮** — opens the **block action menu**: Turn into ▸, Duplicate, Delete, Copy link to block, Color/background, Move to, (later) Comment.

### 4.2 Slash menu redesign
Keep cmdk, but group + search + show recents. Groups:
- **Basic** — Text, H1–H3, Bullet/Numbered/Todo list, Quote, Divider.
- **Media** — Image, Gallery, Video, Audio, File.
- **Embeds** — Link/Bookmark card, X/Twitter, YouTube, generic oEmbed.
- **Publishing** (Lemma-specific) — Paywall divider, Subscribe CTA, Share CTA, Button, Poll.
- **Advanced** — Table, Columns, Toggle, Callout, Code, Math, Footnote.

### 4.3 Bubble (selection) menu
Keep node/link/color selectors; add: more marks (sup/sub), inline code, "turn into", and (later) "comment on selection".

### 4.4 Nesting & rich blocks
- **Toggle** list (collapsible) and **Columns** (a `columns` node with `column` children) — real nesting.
- **React node views** (`ReactNodeViewRenderer`) for: image-with-caption (+ alignment + resize via `react-moveable`, already a dep), embeds (tweet via `react-tweet`, already a dep), callout, toggle, paywall divider, button CTA, bookmark card, poll.
- **Tables** via `@tiptap/extension-table`.

---

## 5. Subscriber model — free only (no payments)

**Scope decision:** Lemma ships with **no payments, no paywall, no paid tiers**. Every published post is free and public; the only states are `DRAFT` and `PUBLISHED` (as today). The audience is the existing free **email subscriber** list.

- Reuse the existing `subscribers` / `newsletterSettings` tables as-is — no new tables, no `audience` column, no `memberships`, no Stripe.
- The read path returns the full `html` to everyone; there is no entitlement check and no preview/locked split.
- "Subscribe" is a **free email opt-in** (a Subscribe CTA block + the existing confirm/unsubscribe flow), not a purchase.

### 5.1 Designed so paid can be added later without rework
The JSON-canonical + server-render architecture means paid subscriptions are a clean, **additive** extension whenever you want them — nothing here has to be undone. If/when paid returns, it adds: (1) a `paywallDivider` node + a `documents.audience` column, (2) `membershipTiers` + `memberships` tables and an `isEntitled(reader, writer)` check, (3) server-side gating in the read resolver (split the doc, return full `html` or `preview + CTA` — locked HTML must never reach a non-entitled client), and (4) a Stripe Connect billing workstream. Until then, none of that exists, which keeps the build small.

---

## 6. Newsletter / email rendering (free)

### 6.1 Renderer
`renderToEmail(json)` in `@lemma/content`, with email block components in `packages/email` (React Email + Resend already present). Email is hostile to modern CSS, so blocks **degrade**:

| Block | Email rendering |
|---|---|
| Headings / text / lists / quote | inline-styled, table-based layout |
| Image | full-width `<img>` + caption row |
| Code block | `<pre>` with safe monospace, no JS highlighting |
| Callout / toggle | bordered table; toggle is expanded (no JS in email) |
| Columns | stack vertically (single column) |
| Embeds (tweet/yt/bookmark) | thumbnail + title + link card (no iframes) |
| Math | pre-rendered KaTeX → image or MathML fallback |
| Button / Subscribe / Share CTA | real `<a>` buttons |

### 6.2 Wiring the stubbed send
Replace the `TODO` in `documents.sendNewsletter`:
1. Render email HTML **once** per send (`renderToEmail`).
2. Enqueue per-subscriber jobs on the existing Durable Object jobs queue; each claim writes `newsletterDeliveries` (the unique `(campaignId, subscriberId)` constraint already guarantees exactly-once).
3. Track opens/clicks via the existing `openEvents` / `clickEvents` / `campaignLinks` tables.

---

## 7. Data model changes (Drizzle)

```ts
// documents — additive; markdown stays but becomes DERIVED
content:        text('content', { mode: 'json' }).$type<JSONContent>(),  // CANONICAL
html:           text('html'),            // cached reader render
excerpt:        text('excerpt'),         // derived plain-text summary
contentVersion: integer('content_version').default(1),  // cache-bust + schema migrations
// markdown: keep column, now written as a derived export, not read as the source

// new — version history (cheap, high-value; also the autosave snapshot target)
documentRevisions { id, documentId→documents, content(json), authorId→user, createdAt }

// no membership/paywall/audience tables or columns — payments are out of scope (§5)
```
`readingTime` / `wordCount` keep existing columns but are computed by `@lemma/content` on save (they're currently `text`; fine).

---

## 8. API changes (tRPC)

- **`upsertDocument`** input changes `markdown` → `content` (JSON). On the server, compute and persist `html`, `markdown` (derived), `excerpt`, `wordCount`, `readingTime`, and append a `documentRevisions` row (debounced/throttled, not every keystroke).
- **`getPublishedBySlug`** returns the full cached `html` to everyone — no gating, no entitlement check.
- **New `documents.getRevisions` / `restoreRevision`** for version history.
- **`sendNewsletter`** — implement per §6.2.

---

## 9. Migration plan (markdown → JSON)

1. Ship `@lemma/content` with `markdownToJson` (Tiptap 3 `MarkdownManager.parse`).
2. Add the new columns (additive migration; nothing dropped).
3. **Backfill**: for each `documents` row, `content = markdownToJson(markdown)`, then compute `html`/`excerpt`. Map any `:::lemma-block` tokens to real nodes via a custom parse rule (in practice these are the "future" defs in `custom-blocks.ts` and likely unused in real data — handle gracefully, log misses).
4. Flip the editor to load/save `content`; flip the reader to render cached `html`.
5. Keep writing `markdown` (derived) for one release as a safety net, then it's purely an export.

Low risk: current content is, by definition, only markdown-representable, so JSON conversion is lossless.

---

## 10. Phased roadmap

Each phase is independently shippable and ordered by dependency. Effort: **S** ≈ days, **M** ≈ 1–2 weeks, **L** ≈ 2–4 weeks (solo).

### Phase 0 — Storage + render split *(foundation; unblocks all)* — **M**
- Create `@lemma/content` (shared schema, `renderToHTML`, `jsonToMarkdown`/`markdownToJson`, text/excerpt/readingTime).
- Add `content` / `html` / `excerpt` / `contentVersion` columns; migration + backfill.
- Editor saves `getJSON()`; API computes derived fields on `upsertDocument`.
- Reader renders cached `html` (sanitized) — **no editor on the read page**.
- *Outcome:* identical features, correct architecture, real SEO HTML, faster reads. No new user-facing blocks yet.

### Phase 1 — Notion block UX — **L**
- Official `DragHandle` + block action menu (turn into / duplicate / delete / color / move / copy-link).
- Slash menu redesign (grouped, searchable, recents).
- New baseline blocks: callout, toggle, columns, captioned/resizable/aligned image, tables, divider styles.
- Replace the `:::lemma-block` hack with real ProseMirror nodes; delete `custom-blocks.ts`.
- *Outcome:* the editor feels like Notion.

### Phase 2 — Rich media & embeds — **M**
- Worker oEmbed/link-unfurl endpoint → bookmark cards, X (wire `react-tweet`), YouTube, generic embeds.
- Video / audio / file attachments / gallery.
- *Outcome:* rich content; embeds degrade correctly in the read + email renderers.

### Phase 3 — Newsletter / email rendering *(priority)* — **M**
- `renderToEmail` + email block components in `packages/email`.
- Subscribe CTA block wired to the existing **free** opt-in (confirm/unsubscribe) flow.
- Implement `sendNewsletter`: render once, enqueue per-subscriber via jobs DO + `newsletterDeliveries`, track opens/clicks.
- *Outcome:* post → free newsletter, end-to-end.

### Phase 4 — Polish & durability *(ongoing)* — **M**
- Version history UI (`documentRevisions`) + restore.
- Footnotes/sidenotes, code-block language picker + copy, math UX, TOC + reading progress.
- *Future, not now (architecture already supports, all additive):* paid subscriptions/paywall (§5.1), AI assist (continue/rewrite/SEO), and real-time collab (Yjs) — each is a clean add once content is canonical JSON.

---

## 11. Risks & decisions

| Risk / decision | Mitigation |
|---|---|
| **XSS from rendered HTML** | Content is authored (semi-trusted), but embeds/raw-HTML aren't. Sanitize on the server render boundary; allowlist embed sources. |
| **`html` cache staleness** | Recompute on every `upsertDocument`; bust with `contentVersion`. |
| **Worker bundle size** (static-renderer + schema) | Small; schema is plain node specs. Measure in Phase 0. |
| **Markdown backfill edge cases** | Keep `markdown` column one release as a safety net; log conversion misses. |

---

## 12. Summary of the four key moves
1. **Make JSON canonical**, markdown derived — kills the `:::lemma-block` class of hacks and unblocks every rich block.
2. **Render on the server** (`@tiptap/static-renderer` in the Worker), ship readers static HTML — fixes SEO/perf and gives the email pipeline for free.
3. **Extract `@lemma/content`** as the shared schema + serializers so web, api, and email agree on one model.
4. **Build the block UX and the publishing blocks deliberately** — drag handle, slash menu, Subscribe/Share CTAs, email rendering — on top of that solid base.
