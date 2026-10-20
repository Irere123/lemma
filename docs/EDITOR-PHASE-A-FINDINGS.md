# Editor Phase A — Findings

> Phase B re-measured every finding below after the fixes: see [EDITOR-PHASE-B-RESULTS.md](./EDITOR-PHASE-B-RESULTS.md).

Status: **Study complete, no product code changed.** For review before Phase B.
Date: 2026-10-19
Question: would someone trust this editor with a 100,000-word book, a cited research paper, or years of notes?
Short answer: **not yet.** A book stops saving at ~100k words; typing lags by about 1 s per key well before that; and two common situations silently erase work while the UI says "Saved".

Everything below was measured against the real app running locally: the production web build (`vite build`) on :5173, the API (`wrangler dev`, local D1) on :4000, and headless Chromium 156 driven by Playwright. Scripts, raw results and the corpus are in `lemma-editor-study/` (outside this repo) (outside the repo; see [Reproduce](#reproduce)).

---

## Ranked findings

Ranked by harm to writers, weighing how bad the outcome is against how likely it is for the three target uses (books, research, notes).

### 1. A book cannot be saved past ~100k words. Images shrink that ceiling sharply.

| Document | Words | Row size (content + markdown + html) | Save |
|---|---|---|---|
| Pride and Prejudice, first 50k words | 49,999 | 0.94 MB | ok |
| first 100k words | 99,758 | **1.85 MB** | ok, 92% of limit |
| full novel | 121,673 | > 2 MB | **500 `SQLITE_TOOBIG`, nothing stored** |

- Cloudflare D1's maximum row size is 2,000,000 bytes ([D1 limits](https://developers.cloudflare.com/d1/platform/limits/), updated 2026-04-21). Local D1 enforces the same limit.
- Each document row stores the text **three times**: `content` (JSON), `markdown`, and `html` (`apps/api/src/db/queries/documents.ts:37-50`, `:110-117`).
- Images can be stored inline as base64. `allowBase64: true` is set in `apps/web/src/components/editor/extensions.ts:51`. One pasted 900×600 image added 227 KB to `content`, and it is repeated in `markdown` and `html`.
  - **Three screenshots fill the whole row budget.**
  - Two of the four Google Docs captures arrived with base64 images and saved at ~300 KB of `content` each, from documents of only ~2–3k words.
- Once over the limit, every autosave fails.
  - The pill says "Save failed". There is no retry and no warning when leaving the page (see #4).
  - Everything typed after crossing the line exists only in that tab.
- An oversized **insert** (new document) fails differently. The API catches the error and returns `null` with HTTP 200 (`documents.ts:162-164`), and the client treats a non-throwing response as saved.
- Cost scales with size even below the limit. At 100k words:
  - every autosave uploads **1.25 MB**
  - every open downloads **1.85 MB**
  - the list endpoint returns full `markdown` for up to 100 documents (`documents.ts:213-224`)
  - every save makes the FTS trigger delete and re-index the full markdown (`migrations/0002_documents_fts.sql`)

### 2. Typing becomes unusable long before book length. Even 1,000 words misses the 16 ms budget.

The metric is keydown to next frame. 60 keys were typed mid-document at 80 ms intervals. The machine is a 6-vCPU AMD EPYC server, **faster than most writers' laptops**. "4×" applies Chrome CPU throttling, as a stand-in for a mid-range phone.

| Words | p50 / p95 (1×) | p50 / p95 (4×) | Time to type 60 keys (ideal 4.8 s) | Keys > 16 ms |
|---|---|---|---|---|
| 1k | 31 / 119 ms | 56 / 209 ms | 8.4 s | 59/60 |
| 10k | 42 / 100 ms | 102 / 183 ms | 8.4 s | 60/60 |
| 50k | 417 / 771 ms | 867 / 1,756 ms | 32.7 s | 60/60 |
| 100k | **1,000 / 1,792 ms** | **3,427 / 6,377 ms** | 70.5 s (4×: 212 s) | 60/60 |

**Cause.** On every keystroke, `onUpdate` (`apps/web/src/components/editor/index.tsx:300-307`) does all of the following:

- serializes the **entire document to Markdown**
- calls `getJSON()`
- counts every word
- sets React state in `AdvancedEditor` and in the `/write` route, which re-renders both

**Control experiment.** Same document, same browser, with the app's `update` listener detached:

| Words | With app handler (p50 / p95) | Handler detached (p50 / p95) | Markdown serialize, per call | `getJSON` | Word count |
|---|---|---|---|---|---|
| 10k | 37 / 107 ms | 24 / 52 ms | 7.4 ms | 0.1 ms | 1.6 ms |
| 50k | 359 / 861 ms | 41 / 88 ms | 351 ms | 0.6 ms | 6.1 ms |
| 100k | 947 / 1,846 ms | **61 / 130 ms** | **1,188 ms** | 5.4 ms | 33 ms |

What the control shows:

- **About 94% of book-length lag is one avoidable call.**
- That call grows faster than the document: 2× the words costs 3.4× the time. The CPU profile hot spots are in `tiptap-markdown` (`text`, `atBlank`, `normalizeInline`).
- With the handler detached, 100k words is still at 61 ms p50. So meeting the 16 ms budget will also need DOM/layout work, such as `content-visibility`, chapter splitting, or not re-rendering React per keystroke. That isn't just a refactor.

### 3. Silent overwrites: last write wins, and the UI says "Saved".

| Scenario | What happened |
|---|---|
| Two tabs on the same doc; A types `AAA`, then B types `BBB`, then A types `CCC` | Server ends at `BASE AAA CCC`. **B's edit is erased.** A never shows B's text, even after a focus refetch. Both tabs say "Saved". |
| An older save request lands after a newer one (first request delayed 4 s) | Server ends at `ONE`. **`TWO` is erased.** The editor still shows `ONE TWO` and says "Saved". |

Why it happens:

- Every save sends the whole document.
- The server overwrites the row with no version check (`documents.ts:80-129`).
- `contentVersion` exists in the schema but is never compared.

Two tabs is the same failure mode as laptop + phone. Out-of-order arrival needs a slow first request, which is plausible on mobile, and the loss sticks only if the writer stops typing before the stale save lands. That's typically at the end of a session.

A related cost: **opening a document rewrites it.** Merely opening a document with no edit sends one save, bumps `updatedAt`, recomputes the slug and re-derives the HTML. `onCreate` queues a save, and `Object.is` on a fresh JSON object is never equal (`$docId.tsx:154`).

### 4. Unsent edits live only in memory.

| Scenario | Lost? |
|---|---|
| Normal tab close within the 900 ms debounce (`beforeunload` flush) | **No** (3/3) |
| Offline, keep the tab open, reconnect | **No.** React Query pauses the mutation and resumes it. |
| Offline, then close the tab | **Yes.** The status said "Saving…" the whole time. Nothing was restored on reopen. |
| Tab killed / crashed / evicted (no `beforeunload`) within the debounce | **Yes** |
| Slow network, tab closed while the save is in flight (real delay via proxy) | **Yes, 3/3.** Chromium aborts the request. (Delaying with Playwright's request interception falsely showed "kept"; that was an artifact.) |
| Server returns 500 once, writer stops typing | **Yes.** One attempt, never retried. "Save failed" stays up. No leave-page warning. |

The document store persists only open tab IDs, not drafts (`stores/document-store.ts:219-221`, and the key is misspelled `opendocumentIds`). Nothing exists to restore from.

### 5. Research content doesn't survive: math, citations and footnotes.

- **Paste.**
  - 0 of 142 equations from an arXiv paper survive as math, and 0 of 4 from ChatGPT. They turn into duplicated text: `h_{t}` becomes "hth_{t}", and `h_{t-1}` becomes "ht−1h_{t-1}". Text comes out 104–105% of the source because of this duplication.
  - 0 of 87 citations and footnote markers survive.
  - Footnote bodies get inlined into the text: "Ashish Vaswani ††thanks: Equal contribution…".
  - 93 internal anchors become links to targets that don't exist.
- **Published page.** Math renders as raw LaTeX ("E = mc^2"). Nothing in `apps/web` runs KaTeX on the reader, despite the comment in `render-html.ts:246`.
- **Editor.** Math renders twice ("E = mc²E = mc2") because `katex.min.css` is never imported. `mathematics.ts:41` carries a note asking for it.
- **Email.** Raw LaTeX.
- **Schema.** There are no nodes or marks for footnotes, citations, superscript/subscript, figure captions or cross-references. Pasted Word footnotes become dead `#_ftn` links plus loose paragraphs at the end.

### 6. What you write isn't what's published.

The renderer is hand-written (`packages/content/src/render-html.ts`) and has drifted from the editor schema. Tested with a document using every node, mark and attribute the editor allows; screenshots are in `results/shots/`.

| Feature | Published page | Email |
|---|---|---|
| Heading 4–6 | **Becomes H3** (clamped, `render-html.ts:189`) | Becomes H3 |
| Ordered list starting at 3 | ok | **Renumbered 1, 2** (meaning changes) |
| Text colour / highlight | ok | **Dropped** |
| Task list | ok, disabled checkboxes | Checkbox on its own line above the text |
| Table column widths (resizable in the editor) | **Dropped** | Dropped |
| YouTube start time; image width/height; link title | Dropped | Dropped (video becomes a link button, which is fine) |
| Math | Raw LaTeX | Raw LaTeX |
| Code block | Boxed | Boxed. **In the editor it has no box**: see duplicate extensions below. |

Further drift:

- **Published HTML can't be re-imported.** Parsed back with the editor's own schema, the published HTML loses callouts, task lists, math and YouTube. Copying from your own published post into a new document loses them.
- **Markdown export isn't Markdown.** With `html: true`, callouts, tables, embeds and colours are emitted as raw HTML carrying Tailwind classes (`<div class="callout" …>`, `<ul class="my-4 ml-6 list-disc tight">`). That HTML is what the FTS index searches.
- **Duplicate extensions.** Tiptap warns: `Duplicate extension names found: ['link', 'codeBlock', 'underline']`. Tiptap 3's StarterKit already includes Link and Underline, and `CodeBlockLowlight` duplicates StarterKit's `codeBlock`. As a result the configured code-block classes don't apply in the editor.

### 7. Images have no upload path.

- **Files:** pasting or dropping an image file does nothing. `handleImagePaste` / `handleImageDrop` exist in `@lemma/headless` but are never wired into `editorProps`.
- **Slash command:** `/image` opens `window.prompt` for a URL.
- **Pasted images** are, depending on the source:
  - hotlinked to the source site (Wikipedia, arXiv, ChatGPT's CDN), which means link rot and readers' IPs going to third parties
  - stored as base64 (Google Docs), which feeds finding #1
  - broken (Word `file:///C:/…` paths; 3 of 4 Notion images used relative/attachment URLs)

### 8. Editing the title after publishing breaks every shared link.

The slug is recomputed whenever a save includes `title`, and autosave always does (`documents.ts:119-123`, `$docId.tsx:97`). Measured:

- `original-title` became `original-title-now-edited`.
- The old URL no longer shows the post. It returns HTTP 200 with a not-found page.
- Links already sent in newsletters break.

### 9. Paste: core structure is solid, with specific losses per source.

Results below are result/source, out of 18 captures. Text (letters and digits) is ~100% everywhere apart from the math duplication above.

**What holds:** headings at every level, list nesting up to 5 levels, tables (416/416 cells from arXiv), blockquotes, code blocks, bold, italic, strike and links. All of this comes through from Wikipedia, ChatGPT, Notion, Google Docs and Word.

**What's lost:**

| Source | Lost |
|---|---|
| Google Docs (live capture, 4 public docs) | **Monospace/code formatting**: 0/1,552, 0/250 and 0/84 characters (Docs "code" is a font, which the editor ignores). Highlights 0/207. Images as base64. Up to 14 empty paragraphs. |
| Word (open-source test fixtures) | Highlights 0/197. Footnotes become dead links. Images point at local `file://` paths. |
| Notion (live + fixtures) | To-do checkbox 0/1. Inline code 0/37 on the public-page capture. Some links (433/519 characters). Images with relative URLs. |
| ChatGPT (live) | Math 0/4. Everything else is intact. |
| arXiv HTML | Math 0/142, citations 0/87, footnotes inlined. |
| Wikipedia (live) | Nothing significant. Images are hotlinked; reference markers stay as links back to Wikipedia. |

### 10. Security and integrity, found along the way.

These aren't editor UX, but they matter for "trustworthy".

- **Drafts are readable by anyone who has the ID.** `documents.getDocumentById` is a `publicProcedure` with no owner or status check (`routers/documents.ts:37-41`, `queries/documents.ts:236`). An anonymous request returned a `DRAFT` document's full text.
- **Document JSON is never validated** (`content: z.any()`).
  - Arbitrary node types are stored.
  - A text colour of `red;position:fixed;inset:0;background:white;z-index:9999` is written verbatim into a `style` attribute on the published page. That's CSS injection on Lemma's domain, enough to overlay a fake page.
- **Error responses leak internals.** Failed saves return the full SQL statement text to the client.

---

## What works

These held up and are worth keeping:

- **Normal close:** closing the tab normally flushes the pending save (3/3).
- **Short offline gaps:** offline while the tab stays open resumes saving on reconnect.
- **List-to-editor race:** opening from the document list while the full document loads slowly didn't lose data, and Markdown with `html: true` round-tripped every rich node type tested. The editor does mount twice, though, which resets undo history and caret position.
- **Paste structure:** fidelity is high across all five sources captured (finding #9).
- **Renderer safety:** text is escaped and URL schemes are allowlisted.

---

## Not measured, and limits

- **Real `documents.content` rows: not sampled.** There are no Cloudflare credentials on this machine (`wrangler whoami`: not authenticated). `scripts/anonymize-rows.mjs` reads rows from `wrangler d1 execute … --json` and outputs sizes and node/mark histograms only (no text, titles or IDs). Running it would show how many real documents are already near the row limit or carry base64 images.
- **Medium: not captured.** medium.com blocked headless Chromium with a Cloudflare challenge (2 attempts plus a retry). web.archive.org was rate-limited and archive.today showed a CAPTCHA. The attempt log is in `corpus/clipboard/medium/FAILED.meta.json`. To fill the gap, run `scripts/corpus/capture-medium.mjs` from a network Cloudflare doesn't challenge, or pass it a web.archive.org snapshot URL once the archive stops rate-limiting.
- **Word fixtures** are open-source test captures (Apache-2.0, MIT, and GPL/LGPL/MPL from CKEditor 4 and 5), not live Word. None includes Word's own text/plain, so each `.txt` was derived from the HTML (flagged in its `meta.json`). GPL fixtures are for this local study only and must not be committed.
- **Notion:**
  - The public-page captures are the browser's default copy; public notion.site pages run no copy handler.
  - Notion's logged-in editor payload comes from two open-source fixtures (Apache-2.0 and MIT), because of the login wall.
  - The Google Docs, ChatGPT and Wikipedia captures are live.
  - The ChatGPT captures include math but no table.
- **Firefox, WebKit/iOS Safari, Android Chrome + Gboard (IME): not run.** The host lacks their system libraries and there are no devices. Chromium only.
- **Latency hardware:** measured on a server CPU, with 4× throttling standing in for phones. Real devices will be slower.
- **Email** was checked as rendered in a browser, not in Gmail, Outlook or Apple Mail.
- **Not in Phase A scope:** keyboard-only use, screen readers, and title/subtitle undo.

---

## What this means for Phase B ordering

This isn't a plan yet. These are the decisions the data forces:

1. **Storage model before anything else.** A single D1 row holding three copies of the document can't hold a book. Phase B.1 must decide where content lives: split into chapters/blocks, use R2, or compress. It must also decide whether `markdown` and `html` stay as per-row copies at all.
2. **Durability fix scope.** Even the cheap fix (a version column with compare-and-swap) fixes #3 but not #4. Fixing #4 needs a local copy (IndexedDB) and a retry queue. Yjs + IndexedDB covers both; this should be decided explicitly in B.1.
3. **Take Markdown serialization off the keystroke path.** It's the single biggest latency win, and it's cheap.
4. **Render and paste are two halves of one problem.** One shared schema with renderer and parser parity tests would have caught every finding in #6, and most of #5 and #9.
5. **The security items in #10 are independent and small.** They can go first.

---

## Reproduce

The harness is in `lemma-editor-study/`, kept outside this repo:

- `scripts/`: `durability*.mjs`, `bigdoc.mjs`, `control.mjs`, `render.mjs`, `paste.mjs`, `image-paste.mjs`, `server-checks.mjs`, `oversize.mjs`, `slow-proxy.mjs`
- `results/`: JSON output and screenshots
- `corpus/`: book, paper, clipboard captures, each with `meta.json` provenance

Running it locally needed four workarounds:

- Build `packages/headless` first (`bun run build`). The web app imports its `dist/`.
- The local `BETTER_AUTH_SECRET` is too short for better-auth, so sign-up fails. Start the API with `--var BETTER_AUTH_SECRET:<32+ chars>`.
- Build the web app with `VITE_PUBLIC_BACKEND_URL=http://localhost:4000` and serve it on :5173 (already in the API's CORS allowlist).
- Chromium needs libraries missing on this host. They were fetched with `apt-get download` into `.syslibs/` and loaded via `LD_LIBRARY_PATH`; no root needed.
