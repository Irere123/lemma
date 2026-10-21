# Editor Phase C — Writing modes, and a premium workspace

Status: **Built and tested on branch `feat/phase-c`.** The specs are in [EDITOR-PHASE-C-SPECS.md](./EDITOR-PHASE-C-SPECS.md).
Date: 2026-10-21

## Decisions taken on the open questions

The specs left three questions open. Work went ahead with these choices; each can be revisited.

- **Books — export or serial first?** Both. A manuscript exports as EPUB 3 and as a Word file in standard manuscript format. Chapters also publish one at a time as posts, with a public book page.
- **Research — which styles, and Zotero?** APA 7, Chicago author-date, IEEE and Nature. Libraries come in as files (BibTeX, RIS, CSL-JSON), which covers Zotero, Mendeley and most other managers. There is no live Zotero connection.
- **Notes — same list as posts?** A separate space. Notes are private, have no cover, subtitle or publish button, and live under **Notes**. "Turn into a post" moves one across.

## The document model

Everything new is part of the shared schema in `@lemma/content`. `SCHEMA_VERSION` goes from 1 to 2; the migration is empty, because the new nodes are additions.

**New nodes**
- `figure` with `figcaption`, holding one image or one table.
- `citation`: reference ids, plus page or chapter, prefix, suffix and mode.
- `bibliography`.
- `crossReference`: holds the target's block id.
- `documentLink`: holds a document id, and optionally a block id.
- `blockMath` gains `numbered` and `tag`.

**Numbers are never stored.** "Figure 3", "Table 1", "Eq. (4)" and "note 2" are worked out from document order every time a document is rendered, in the editor and on the published page alike (`numberingOf` in `src/numbering.ts`). A move or deletion therefore can't leave a stale number. Figures without a block id are numbered too.

**Citations are formatted by the caller.** The renderers take a `RenderedCitations` option. The API fills it from the writer's library at save time; the editor and the exporters fill it with the same processor.

**Rendering in each format**
- **Published HTML:** citations link to their bibliography entry, cross-references to their target, and DOIs and URLs in the bibliography are links. Document links resolve only to published posts, so a private note's id never reaches a reader.
- **Email:** the same citations, numbers and bibliography as text.
- **Markdown (GFM):** what GFM can't carry is lowered and reported as a loss. A figure keeps its caption as a paragraph; a cross-reference becomes its label; a link becomes its title.
- **Pandoc/Quarto Markdown:** keeps everything — `[@key, p. 4]`, `@key [p. 4]`, `[-@key]`, `{#fig-…}`, `{#tbl-…}`, `{#eq-…}`, `@fig-…` and a `#refs` div.
- **DOCX and EPUB:** documents are lowered first (`lowerDocument`), so they get labelled figures and equations and formatted citations.

**Paste**
- A pasted `<figure>` holding one image or one table becomes a figure, with its caption.
- Sub-figure grids stay plain.
- LaTeXML's "Figure 1:" prefix is dropped, since the number is generated.
- arXiv equation numbers are kept as the equation's `tag`.

**New libraries in the package**
- `@lemma/content/citations`:
  - BibTeX, RIS and CSL-JSON parsers;
  - DOI, arXiv, ISBN and URL detection and lookup;
  - a formatter for the four styles, including same-author-year disambiguation, page locators, numeric order and range compression;
  - BibTeX export.
- `@lemma/content/export`: EPUB 3 (with a nav document, an NCX file, EPUB footnotes and MathML) and DOCX (in manuscript or document format), built with a small ZIP writer.

All of it is Worker-safe and has no dependencies.

## Server

- **Migration `0006_writing_modes`:**
  - new tables: `books`, `document_links` (backlinks), `reference_items` (the library, as CSL-JSON) and `document_references` (which posts cite which references);
  - new `documents` columns: `kind` (post, chapter, part or note), `book_id`, `position`, `word_target` and `journal_date`.

  It only adds things, and existing documents become `post`.
- **Each flush of a document's room:**
  - rebuilds its backlinks and citations;
  - renders citations in the document's style, which lives in the Yjs meta, so every tab agrees;
  - resolves links to other documents.

  Editing a reference re-renders every published post that cites it.
- **Search freshness:** short documents (under 5,000 words, which covers most notes) re-index within 3 seconds instead of 60.
- **New routers:**
  - `books`: outline, add, reorder, split, merge, move blocks, find, replace across the book and undo, export data, public page;
  - `notes`: backlinks with mentions, today's note;
  - `references`: list, import, look up by identifier, edit, delete, BibTeX.
- **Exports:** an image proxy (`GET /export/image`) lets browser-side exports embed images from Lemma's storage. It serves signed-in writers only, and only Lemma's own hosts.

## What each task got

**Books**
| # | Status |
|---|---|
| B1 | Create a book (it opens on chapter 1). Add chapters and parts in one action, rename in place, and reorder by drag or Alt+↑/↓. Reordering only changes positions. |
| B2 | A chapter opens beside the book's outline: chapters, plus the open chapter's headings. ⌘P goes to a heading, chapter or recent document. |
| B3 | Words per chapter and in total, a book target and per-chapter targets (with rings), and "Written today" with a daily goal in the word popover. |
| B4 | Find and replace across every chapter, with matches previewed in context. Replace-all changes every chapter at once; each changed chapter keeps a revision, so one Undo restores the book. ⌘F finds and replaces inside a single document. |
| B5 | Split a chapter at a block, merge with the next chapter, and move a block to another chapter. Footnotes follow their text. |
| B6 | Focus mode (⇧⌘F, or the bar button): the chrome fades, other paragraphs dim, and the line being written stays at a fixed height on screen. Esc leaves it. |
| B7 | EPUB and Word manuscript export, with title page, contents, footnotes and embedded images. |
| B8 | Chapters publish one at a time as posts, each with "Chapter n · Book" and previous/next links. A public book page lists the published chapters. Publishing never touches unpublished chapters. |

**Research**
| # | Status |
|---|---|
| R1 | Cite with `[@`, or with Citation in the slash menu. Search the library, or paste a DOI, arXiv ID, ISBN or URL; it's looked up and added. |
| R2 | Import BibTeX, RIS or CSL-JSON. Duplicates (same DOI) aren't added twice. Edit a reference once and every citation of it updates. |
| R3 | A Bibliography block lists only what's cited. Switching style (in the ⋯ menu) restyles every citation and the list together. |
| R4 | Caption any image or table (from its toolbar). Numbers follow position. |
| R5 | Cross-references (from the slash menu) to figures, tables, numbered equations, sections and notes. They read as the target's current label, and link on the published page. |
| R6 | Number a display equation in the equation dialog; numbers pasted from arXiv are kept. |
| R7 | Citations link to their entry, and DOIs in the bibliography are links. On screens wider than 1280 px, footnotes sit in the margin beside the line they belong to. |
| R8 | Pandoc/Quarto export: a ZIP of Markdown plus `references.bib`, with front matter naming the CSL style. Word export resolves citations and numbers. |

**Notes**
| # | Status |
|---|---|
| N1 | Quick note (⌥⌘N / Ctrl+Alt+N) from anywhere in the workspace or the editor. It is ready to type in under a second and needs no title (the first line becomes it). Captures are saved on the device first, so they survive going offline. |
| N2 | `[[` lists your documents as you type, and can create a note from the typed title. Links hold the target's id and always show its current title. |
| N3 | "Linked from" under each note, with the sentence around every link, plus documents that mention the title without linking it. |
| N4 | Notes search filters as you type, and full-text search covers every note. A short note is searchable about 3 s after the last keystroke. |
| N5 | Copy link to block (Phase B). |
| N6 | Today's note: ⌥⌘D / Ctrl+Alt+D, or Today in the sidebar. Asking again opens the same note, even after it is renamed. |
| N7 | "Turn into a post" in the ⋯ menu. Same document, same id, and publishing appears. |

## The workspace

The workspace was a list of titles under a bare icon rail. Now:

- **Look:**
  - a warm off-white canvas, white surfaces, a near-black ink colour and one restrained blue accent;
  - soft layered shadows;
  - a self-hosted serif (Source Serif 4, with optical sizes) for everything long-form, in the editor and the reader alike;
  - light, dark and system themes, set from the account menu, with no flash on load.
- **Sidebar:**
  - Home, Posts, Books, Notes, Today and References, then Publishing (Newsletters, Subscribers);
  - a New menu, plus the books with their progress;
  - it still collapses to a rail.
- **Home:** a greeting, quick actions, "Continue writing" cards with excerpts, books with progress, and recent notes.
- **Pages:**
  - **Posts:** All, Drafts and Published tabs, filtering as you type, and per-row actions.
  - **Books:** a grid of covers. A book without an image gets a generated, typeset cover.
  - **Book:** cover, title, subtitle and target in place, a public page switch, export, and find and replace.
  - **Notes** and **References**.
- **Editor:**
  - the top bar knows what you're writing (a post, a chapter of a book, a private note);
  - a chapter has its book beside it;
  - a note has its backlinks under it.
- **Command palette:** creates posts, notes and books, opens today's note, and goes to any section.

## How it was checked

- **Content package:** 553 tests. Among them:
  - property tests: HTML, email, Yjs and Markdown round trips with every new node in the generator;
  - a numbering test under random moves;
  - paste snapshots, now with figures;
  - golden tests for the four citation styles;
  - strict-XML checks of every EPUB and DOCX part.
- **Browser (Playwright, production build, local stack):** 80 checks, all passing.
  - Existing suites: durability 11/11, foundations 14/14, editor UI 10/10, latency 6/6.
  - New suites: notes 11/11, books 16/16, research 12/12. All three run in CI.
- **Typing cost:** the editor's JS per keystroke at 100k words is 6.1 ms, within the budget; the new plugins do their work after a pause in typing.
- **Accessibility:** axe finds no serious or critical issues on any new page, in light or dark. One contrast issue (keyboard-shortcut chips) and two missing accessible names were found and fixed.

## Bugs found on the way (fixed)

- **Slash menu:** Enter typed right after the last letter ran the item for the previous letter (e.g. `/todo` gave a callout). Enter now waits for the menu to catch up.
- **Paste:** a `<figure>` without an image or table made ProseMirror invent an empty image, and a sub-figure grid's caption became a stray caption. Both now stay plain blocks.
- **Book target dialog:** it wiped what was typed when its opening animation ended.
- **Excerpts:** they began with a heading, and kept a space where a citation had been ("1990s , and").

## Not done, or not verifiable here

- **Real apps and live services:**
  - The exports pass strict XML and ZIP checks, but haven't been opened in Word, Google Docs, LibreOffice or Apple Books, which aren't available here.
  - DOI, arXiv, ISBN and URL lookups are tested against recorded responses, not live services.
- **Offline gaps:**
  - Reordering chapters needs a connection; only typing works offline.
  - Notes created by `[[` are created on the server straight away. Only quick capture works offline.
- **Writer study:** the five-writers-per-mode study needs writers.
- **Daily goals:** "today's session" counts words per document; there is no book-wide daily total.
- **Deliberately out of scope (per the specs):** corkboard, co-authors, comments and track changes, graph view, templates, a live Zotero connection.
