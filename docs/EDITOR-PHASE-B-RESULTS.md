# Editor Phase B — Results

Status: **Implemented on branch `feat/editor-durability`, not committed or deployed.** For review.
Date: 2026-10-20
Question (unchanged from Phase A): would someone trust this editor with a 100,000-word book, a cited research paper, or years of notes?
Short answer: **for books and notes, yes on durability; typing at book length is close to the frame budget, not under it.**

- Every Phase A data-loss scenario now keeps the work, and a chaos test in CI checks that on every change.
- The full novel saves.
- Typing at 100k words went from 1 s per key to roughly 34–40 ms median on this machine today (17–26 ms in the first pass, on a quieter day). That's still above the 16 ms target.

This document has two parts:

1. The first pass fixed the ten Phase A findings (sections below).
2. The second pass closed the remaining items of the Phase B plan: revision history, block IDs, a versioned schema, input fidelity and the CI proofs. It's in [Second pass: the rest of the Phase B plan](#second-pass-the-rest-of-the-phase-b-plan).

Phase C, the writing modes, is specified in [EDITOR-PHASE-C-SPECS.md](./EDITOR-PHASE-C-SPECS.md) and awaits approval.

Measured the same way as Phase A: production web build on :5173, `wrangler dev` API on :4000 (local D1, Durable Objects and R2), headless Chromium 156, the same corpus and the same scripts, re-run as `scripts/phase-b/*` in `lemma-editor-study/` (outside this repo). Raw results are in `results/phase-b/`.

---

## What changed

1. **Documents live in a Durable Object, as a Yjs document.** Each document has a `DocumentRoom` (`apps/api/src/realtime/document-room.ts`). It holds the title, subtitle and body. It stores every update in its own SQLite storage before confirming it. Concurrent edits from tabs and devices merge rather than overwrite. Storage is an update log plus a snapshot split into ≤1 MB parts, so no document size reaches a row limit.
2. **D1 holds a read model, not the body.** A few seconds after edits pause, the room refreshes the derived state:
   - `documents` metadata: title, slug, excerpt, word count
   - published HTML, in parts, in `document_html`
   - the search index, chunked, in `document_search` with FTS5

   The old `content`/`markdown`/`html` columns are archived to `document_legacy_bodies` the first time a room seeds from them. Migration `0005_document_rooms.sql` adds these tables, and a cron step moves old documents into rooms 25 at a time.
3. **The editor syncs through the room with a copy on the device.** `apps/web/src/lib/collab/` holds:
   - a Yjs doc
   - an IndexedDB copy, written within 50 ms of each edit
   - a y-websocket connection to `/realtime/documents/:id`, which checks cookie auth, ownership and Origin

   The room acknowledges each sync message after it is durable (`MESSAGE_SAVED`), so "Saved" means stored on the server. "Offline · saved on this device" means what it says. The page asks before you leave while anything is unconfirmed.
4. **One shared document model.** `@lemma/content/schema` is the single list of nodes, marks and attributes. The editor, the API's validation, the Yjs conversion and the parity tests all use it. The renderers (`renderToHTML`, `renderToEmail`, `renderToMarkdown`) and a new Markdown importer live in `@lemma/content`. Tests in `packages/content/test/` check that published HTML parses back into the identical document.
5. **Paste cleanup** (`@lemma/content/schema/paste.ts`) handles source-specific markup from Google Docs, Word, Notion, LaTeXML/arXiv and ChatGPT, and parses Markdown pasted as plain text.

---

## Phase A findings, re-measured

| # | Phase A | Phase B | Evidence |
|---|---|---|---|
| 1 | Full novel (121,673 words) failed to save; ~3 screenshots fill a 2 MB row | **Saves**; the server confirmed it in 451 ms and holds all 121,673 words. A 5 MB body saves and reads back intact. Images are uploaded or rehosted, never inline. | `bigdoc.json`, `server-checks.json` |
| 2 | 1k words 31 ms, 100k 1,000 ms per key | 1k **9.5 ms**, 100k **17–26 ms** (see below) | `bigdoc.json` |
| 3 | Two tabs: one tab's edit erased. Out-of-order save erased newer text. Both said "Saved". | All edits merge, and "Saving" shows until the server confirms. Opening a document writes nothing. | `durability.json` |
| 4 | Lost in 4 of 6 situations (offline+close, crash, close during slow save, one server error) | **Lost in 0 of 8 scenarios** | `durability.json` |
| 5 | Math 0/142 (arXiv), 0/4 (ChatGPT); citations and footnotes lost; LaTeX shown twice or raw | arXiv 138/142 equations as math, 5 real footnotes, citations keep their text, no dead links. ChatGPT 2/2 (Phase A counted each twice). Math renders once in the editor and as KaTeX on the published page. | `paste.json`, `render.json` |
| 6 | H4–6 → H3; email list restart; widths, YouTube start, link title dropped; published HTML not re-importable; Markdown export was HTML | Published HTML **re-imports with nothing lost**. Email keeps H4–6, list start, colours and inline task checkboxes. Markdown export contains no HTML blocks or classes. | `render.json`, unit tests |
| 7 | No image upload path | Paste and drop upload the file. Pasted `data:` and hotlinked images are copied into storage by the room. Images that can't be loaded (`file://`, Notion attachments) are dropped with a notice. | `image-paste.log` |
| 8 | Title edit after publishing broke the URL | The slug is frozen at first publish, and the old URL still resolves | `server-checks.json` |
| 9 | Docs code 0/1,552, highlights 0/207, Notion to-dos 0/1, Word highlights 0/197 | Docs code 1,536/1,552 (in code blocks), highlights 207/207, no stray blank lines. Notion to-dos kept. Word: 173 of the 179 highlighted characters outside review comments (Phase A 0 of 197), real footnotes; review comments are no longer pasted as text. | `paste.json`, `packages/content/test/PASTE-RESULTS.md` |
| 10 | Anonymous draft read; CSS injection via colour; SQL in errors | Draft read gives 401, and GraphQL `node` no longer leaks. Unknown nodes are rejected with 400, and colours are allowlisted. The document socket refuses anonymous users and foreign origins. | `server-checks.json` |

Correction to Phase A #10: the SQL text in error responses only appears with `ENV=local`. Production (`ENV=production`) already masks 5xx messages through the tRPC error formatter. Content errors are now 400s with a plain message either way.

### Typing latency

Keydown to next frame. 60 keys mid-document at 80 ms intervals, on the same 6-vCPU server as Phase A. Values are p50 / p95.

| Words | Phase A 1× | **Phase B 1×** | Phase A 4× | **Phase B 4×** | 60 keys, Phase A → B |
|---|---|---|---|---|---|
| 1k | 31 / 119 ms | **9.5 / 24 ms** | 56 / 209 ms | **37 / 74 ms** | 8.4 s → 6.0 s |
| 10k | 42 / 100 ms | **15 / 70 ms** | 102 / 183 ms | **54 / 99 ms** | 8.4 s → 7.1 s |
| 50k | 417 / 771 ms | **12 / 20 ms** | 867 / 1,756 ms | **62 / 102 ms** | 32.7 s → 6.1 s |
| 100k | 1,000 / 1,792 ms | **26 / 76 ms** | 3,427 / 6,377 ms | **78 / 136 ms** | 70.5 s → 7.3 s |
| full (122k) | could not save | **23 / 49 ms** | — | **94 / 143 ms** | — → 6.6 s |

An earlier run on the same build measured 17.1 ms p50 at 100k. Treat 17–26 ms as the range.

Where the time went, and what removed it:

- **No per-keystroke serialization.** Markdown, JSON and word counts are no longer computed per key. The word count runs after a pause.
- **No React render per key.** Any React commit makes React measure the selection across the whole contenteditable, which is linear in document length. The save indicator therefore writes to the DOM directly.
- **Off-screen blocks skip layout.** `content-visibility: auto` on top-level blocks takes 100k from 85 ms to 51 ms on its own.
- **Removed per-keystroke plugin walks:**
  - the Placeholder walk over the whole document, replaced by a caret-only placeholder
  - remote carets, whose position conversion is linear per key
- **IndexedDB writes batched** into one per 50 ms.

What remains at 100k is mostly browser-native work in a 3,000-block contenteditable, plus y-prosemirror's linear reconciliation (~1–2 ms). Getting under 16 ms at book length on slow devices needs structural work: chapter-sized documents or block virtualization.

### Durability scenarios (all against the server's copy)

| Scenario | Phase A | Phase B |
|---|---|---|
| Open without editing | rewrote the document | no write |
| Two tabs edit | B's edit erased | `BASE AAA BBB CCC` in the server and both tabs |
| Slow uplink (4 s) while another tab edits | newer text erased | both kept; slow tab shows "saving" until confirmed |
| Offline, then close the tab | lost | kept on device ("Offline · saved on this device"), synced on reopen |
| Tab crashes 0 ms / 120 ms after typing | lost | restored from device |
| Close during a slow save | lost | leave-page warning; restored and synced on reopen |
| An update lost in transit | lost (one 500, never retried) | stays "saving"; auto-reconnect resends; saved after 8.5 s |

---

## Second pass: the rest of the Phase B plan

The first pass was measured against the Phase A findings. Measured against the Phase B plan itself, several items were still missing; this pass closes them. Everything in the table runs in CI unless the Evidence column says otherwise.

| Plan item | Now | Evidence |
|---|---|---|
| **B.1 Revision history** | The room keeps a version every 10 minutes of writing, when a session ends (5 minutes idle), before any edit that deletes 1,000+ characters, at publish, and before a restore or migration. It keeps everything from the last day, the last version of each day for a month and of each week after that, and every published version. The **History** panel lists versions, previews one with changed blocks highlighted, and restores it. A restore is an ordinary edit that open tabs merge, and the text it replaced is kept as a version too. | `e2e/foundations.mjs`, `apps/api/test/revisions.test.ts` |
| **B.2 Stable block IDs** | Every paragraph, heading, list item, quote, code block, image, video, table, equation and callout has a 10-character ID. New, split and pasted blocks get fresh IDs, while dragged blocks keep theirs. A whole-document write through the API keeps the IDs of blocks that didn't change. Published pages carry them as anchors (`#id`). | `test/block-ids.test.ts`, `e2e/foundations.mjs` |
| **B.2 Versioned schema with migrations** | Each Yjs document records its `SCHEMA_VERSION`, and rooms migrate older documents on load after keeping a revision. An editor older than the document is turned away (close code 4426) and shows "Reload to keep editing", keeping its edits on the device. An editor newer than the server retries later. This matters because an older editor silently deletes nodes and attributes it doesn't know. A test fails if the schema changes without a version bump. | `test/schema-contract.test.ts`, `e2e/foundations.mjs` |
| **B.2 CI fails if a node has no renderer** | Tests now run in CI; before this, CI only built and typechecked. The kitchen-sink and property tests cover every node, mark and attribute. A web test fails if the editor's schema differs from the shared model in any node, mark, attribute or content rule. | `parity`, `roundtrip.property`, `apps/web/test/editor-schema.test.ts` |
| **B.3 p95 < 16 ms at 100k words** | **Not met** (see [Typing latency, second pass](#typing-latency-second-pass)). | `e2e/latency.mjs` gates regressions |
| **B.4 Paste normalization** | 5 more bugs fixed (Docs blank lines beside images, Word page breaks and no-break-space lines, ChatGPT's nested code blocks). Every source has snapshot tests from committed fixtures, so CI checks paste without the study folder. | `test/paste-snapshots.test.ts` (119 tests) |
| **B.4 IME** | 6 of 6 in Chromium through its IME API: Japanese, Chinese into an empty block, Korean, and Android-style word-by-word composition. That includes a remote edit landing in the same paragraph mid-composition, and one undo removing a composed word. **Real Android/Gboard and iOS Safari: not run** (no devices). | `results/phase-b/ime.json` |
| **B.4 Undo covers title and subtitle** | One undo history spans title, subtitle and body, and ⌘Z moves the caret to where the change was. | `e2e/foundations.mjs` |
| **B.4 Keyboard-only use** | 9 of 9 in a walkthrough with no mouse events:<br>• tab order<br>• headings, lists, bold, equations and footnotes typed from the keyboard<br>• **new:** ⌘⇧↑/↓ moves a block<br>• **new:** Enter on a selected equation edits it<br>• no keyboard trap<br>• dialogs return focus | `results/phase-b/a11y.json` |
| **B.4 Screen readers** | axe-core finds **0 violations** on the writing page, version history, equation dialog, published page and documents list; it found one critical issue, an unlabelled LaTeX field, now fixed. The body is a labelled multi-line textbox exposing headings, lists, MathML and footnote numbers. **VoiceOver and NVDA: not run.** | `results/phase-b/a11y.json` |
| **Proof: property-based round trips** | Random valid documents round-trip through HTML, through Yjs, and into email. Markdown export reports what it drops (`markdownLoss`, plus a notice on export), and everything it doesn't report survives the round trip. About 40 renderer and parser bugs were found and fixed. | `test/roundtrip.property.test.ts` |
| **Proof: three browsers** | The smoke test passes 13 of 13 in Chromium, Firefox and WebKit. **Not done:** visual diffs of editor vs published page vs email. | `results/phase-b/smoke-browsers.json` |
| **Proof: chaos test, zero lost characters** | Runs in CI against a fresh local stack (11 checks). | `apps/web/e2e/durability.mjs` |
| **Proof: latency benchmark in CI** | Fails if typing cost grows with length or passes a ceiling. Re-creating the Phase A bug (`INJECT_REGRESSION=1`) makes it fail. | `apps/web/e2e/latency.mjs` |
| **Proof: five real writers** | **Not done**; it needs people. The Phase C specs list the timed tasks for each mode. | — |

### Bugs this pass found and fixed

- **Fast typing in Chromium misplaced a character after a new block.** A key typed in the first frame after Enter or a Markdown shortcut left the caret before the character it inserted, so `## Section` became `ection` with an `S` trailing along the rest of the document. Measured rates:
  - 4–6 in 24 trials at machine speed
  - 1 in 24 with 20 ms between keys
  - 0 at 40 ms

  It isn't Yjs, Tiptap's plugins or ProseMirror itself: the cause was the first pass's own speed fix, `content-visibility: auto`, on a block that had just been created. The block being typed in is now exempt, and there have been 0 failures in 96 trials since. Firefox and WebKit never showed it.
- **Equations from the slash menu went in the wrong place, or threw at the end of the document** (all three browsers). The menu now opens the equation editor where the slash was, and a new display equation no longer stays selected, where the next keystroke would replace it.
- **Formatting on equations, footnote references and line breaks vanished on sync.** The Yjs layer stores marks on text only. The model now says these nodes carry no marks, and strips them as they're applied, so nothing is lost silently. Colour an equation in TeX (`\color`).
- **Offline, a crash within 50 ms of the last keystroke could lose it.** While the server isn't confirming edits, each one is now written to the device immediately (CI checks a crash 0 ms after typing).
- **Typing in the title re-rendered the whole editor on every keystroke.** A wrapper passed `content: undefined`, which Tiptap treats as changed options. That re-ran every plugin view and re-diffed the body each time, and it split title undo into single characters.
- Image alt or title text like `2024` came back as a number.

### Typing latency, second pass

Same method as the first pass (60 keys mid-document at 80 ms intervals, keydown to next frame), on the final build. Three runs; the table shows the median, and in brackets the range.

| Words | p50, 1× | p95, 1× | p50, 4× throttling | p95, 4× |
|---|---|---|---|---|
| 1k | 22 ms (15–24) | 55 ms | 56 ms | 172 ms |
| 10k | 22 ms (18–31) | 60 ms | 59 ms | 140 ms |
| 50k | 27 ms (26–34) | 79 ms | 75 ms | 149 ms |
| 100k | 39 ms (34–40) | 124 ms | 99 ms | 366 ms |
| full (122k) | 39 ms (39–43) | 121 ms | 123 ms | 286 ms |

These are higher than the first pass's numbers (100k: 17–26 ms p50), measured on the same machine on a quieter day. Two things say most of the difference is the machine rather than this pass's code:

- The same build varied by up to 70% between runs today (1k: 14.5, 22.2 and 24.4 ms).
- Timing every plugin hook at 100k words puts this pass's three new plugins at 0.6 ms per keystroke (block IDs 0.27, formatting cleanup 0.26, active-block marker 0.07). Removing them at runtime made no measurable difference.

The first-pass build no longer exists separately to re-measure, so a small regression can't be ruled out.

**Where a keystroke goes at 100k words:**

- 18 ms of editor JavaScript in total:
  - 11.5 ms of ProseMirror updating the view, including the Yjs binding's 6.5 ms (2.3 ms diffing the body into Yjs, 2.9 ms in the network provider's update handler)
  - most of the rest is ProseMirror reading the change from the DOM
- the remainder is the browser's own style, layout and paint

On the editor-only benchmark page (no network, no React), editor JavaScript is about 2.5 ms at 1k words and 8 ms at 100k. CI gates that number.

**The 16 ms p95 target at 100k words is not met.** The per-keystroke cost is ProseMirror and the browser working on a 3,000-block document. The fix is structural: Phase C's Books mode makes each chapter its own document of 2,000–10,000 words, and at those sizes p50 is about 22 ms here and was 9.5–15 ms in the first pass.

---

## Not done, and limits

- **Typing at book length is above 16 ms**, more so on slow devices (see above). Phase C's Books mode makes each chapter its own document, which keeps every editor small.
- **Search lags typing by up to 60 s.** Re-indexing a book on every pause would be the cost Phase A measured.
- **No collaboration with other people.** Rooms merge edits from one writer's tabs and devices. Sharing, permissions and presence don't exist; remote carets were removed for speed.
- **Not in the model:** figure captions, cross-references and citations (all in the Phase C Research spec). Bold, italic or links on inline code are dropped, because the code mark excludes other marks, as in the editor. Equations, footnote references and line breaks take no formatting. arXiv equation numbers "(1)" are dropped on paste.
- **Markdown export** reports what it can't hold (colour, highlight, underline, sizes, column widths, merged cells…) instead of dropping it silently. To round-trip exactly, it writes italics as `*x*`, uses HTML tags for the few constructs Markdown parsers can't read back, and writes leading spaces as entities.
- **Email math** is MathML. Apple Mail and Thunderbird render it; Gmail shows the symbols in order without layout. Not checked in real clients.
- **On sign-out**, device copies are deleted unless they hold unconfirmed edits.
- **Not run:**
  - real Android/Gboard and iOS Safari (no devices)
  - VoiceOver and NVDA
  - real email clients
  - visual diffs of editor vs published vs email
  - Medium paste (blocked in Phase A)
  - real production rows
  - the five-writer study
- **Old web clients** cached before deploy still send whole-document saves. The API applies them as merged edits, which works but is coarse until they reload.
- **CI's new `e2e` job hasn't run on GitHub yet.** It was rehearsed here step by step on a fresh database: all six migrations, a new API, the Turbo build and all three suites. Deploys now wait for it.

## Deploying

1. Apply D1 migration `0005_document_rooms.sql`. It adds tables, moves search to `document_search_fts`, copies published HTML into `document_html` and sets `first_published_at`.
2. Deploy the API. `wrangler.jsonc` adds the `DOCUMENT_ROOM` binding and Durable Object migration `v2`.
3. Deploy the web app. If the web app ships first, the editor keeps edits on the device and shows "Offline" until the API is live.
4. The 5-minute cron moves legacy documents into rooms, 25 per run. A room also seeds on first open or read.

The second pass adds no D1 migration. Revision tables live in each room's own storage and are created on first use. Documents start at `SCHEMA_VERSION` 1, and room documents written by pre-release builds are migrated (given block IDs) on load.

**Future schema changes** (every Phase C block type):

1. Bump `SCHEMA_VERSION`, add a migration, and record the new fingerprint in `test/schema-contract.test.ts`; the test fails otherwise.
2. Deploy the API before the web app. Open editors on the old version are then asked to reload instead of being allowed to delete what they don't understand.

**Rollback:** each document's pre-room body is kept in `document_legacy_bodies`. But edits made after the deploy exist only in rooms. Rolling back the API after users have written needs an export from the rooms first, for example `documents.getMarkdown` or REST `GET /v1/documents/:id`, which now return the room's content.

## Reproduce

In the study harness (`lemma-editor-study/`, kept outside this repo), with the API on :4000 and `vite preview` on :5173:

- `scripts/phase-b/run-all.sh` runs everything below; logs go to `results/phase-b/logs/`.
- `bigdoc.mjs`: book sizes, save confirmation, typing latency at 1× and 4×, CPU profile.
- `latency-experiments.mjs`, `plugin-costs.mjs`: the per-factor latency experiments.
- `durability.mjs`: the 8 scenarios, using `routeWebSocket` to simulate offline, slow and lost frames.
- `server-checks.mjs`, `render-b.mjs`, `image-paste.mjs`, `paste.mjs`, `smoke.mjs`, `sync-smoke.ts`.

Second pass, in the same folder:

- `run-all-b2.sh` runs everything; logs go to `results/phase-b/logs-b2/`.
- `foundations.mjs`: block IDs, the schema gate, undo across fields, revision history.
- `ime.mjs`, `a11y.mjs` (axe-core plus the keyboard walkthrough).
- `fast-typing.mjs`: the dropped-keystroke stress test; `fast-typing-pm.mjs` runs it against bare ProseMirror.
- `smoke-browsers.mjs`: Chromium, Firefox and WebKit.
- `keystroke-split.mjs`, `plugin-time.mjs`: where a keystroke's time goes.

In the repo, all run by CI:

- `bun run test` (Turbo). That covers:
  - content: 239 tests (parity, schema contract, block IDs, unmarked inline nodes, property-based round trips, Markdown, paste corpus and paste snapshots)
  - API: revision retention
  - web: editor = shared schema, block moving
- `apps/web/e2e/`: the chaos test, foundations and the latency benchmark against a real local stack. See its README to run them locally.
