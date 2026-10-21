# Editor Phase C — Writing modes (specs for approval)

Status: **Built — see [EDITOR-PHASE-C-RESULTS.md](./EDITOR-PHASE-C-RESULTS.md) for what shipped and the decisions taken.**
Date: 2026-10-20

The plan says Phase C starts only after Phase B passes, and that each mode gets a short spec of the tasks it must make easy, approved before building. These are the three specs.

**Phase B gate:** passed, apart from items that need hardware or people (details in [EDITOR-PHASE-B-RESULTS.md](./EDITOR-PHASE-B-RESULTS.md)):

- **Typing at 100k words is above 16 ms.** It needs a structural fix; Books mode below makes each chapter its own document.
- **Real-device IME** (Android/Gboard, iOS Safari) and **screen readers** (VoiceOver, NVDA) need devices.
- **Visual diffs** of editor vs published vs email aren't built yet.
- **The five-writer study** needs writers; the tasks below are its script.

Each task has a target. The writer study checks the targets: 5 writers per mode do the tasks in Lemma and in the tool they use today, on the same content. A task passes when at least 4 of 5 writers finish it unaided, no slower than in their current tool.

All three modes build on Phase B:

- **Block IDs** let anything link to a paragraph, heading, figure or equation, and the link survives edits.
- **Revision history** keeps every mode's work recoverable.
- **Schema versioning** lets new block types (citations, figures, links) ship without older open tabs damaging them.

---

## 1. Books

**For:** a novel, a non-fiction book, a thesis or a serial. That's 50,000–200,000 words, written over months.

**Today:** a book is one document. It types at 17–26 ms per key at 100k words, or 78 ms on a slow device. There's no outline, nothing spans documents, there are no word targets, and the only export is Markdown.

| # | The writer can… | Target |
|---|---|---|
| B1 | Create a book, then add, rename and reorder chapters (and optional parts) from a sidebar, by drag or keyboard | New chapter in ≤ 2 actions; reorder never loses text, even offline |
| B2 | Jump to any chapter or heading from an outline, or with a quick switcher (⌘P) | ≤ 1 s, no scrolling |
| B3 | See words per chapter and in total, set a target (book, chapter or today's session) and see progress | Always visible, updates within 1 s of a pause |
| B4 | Search, and find & replace, across the whole book | Replace-all across 30 chapters, undoable, in one revision |
| B5 | Split a chapter at the caret, merge two chapters, and move a scene to another chapter | One command each; nothing lost or duplicated |
| B6 | Write in focus mode: hidden chrome, typewriter scrolling, other paragraphs dimmed | One shortcut on and off |
| B7 | Export the whole manuscript as DOCX (standard manuscript format) and EPUB, with title page, table of contents and footnotes | Opens cleanly in Word, Google Docs and Apple Books |
| B8 | Publish chapters one at a time as posts and newsletter issues, with previous/next links and a book page | Publishing chapter 4 never touches chapters 5+ |

**Design decision: each chapter is its own document.** At 2,000–10,000 words per chapter, typing stays fast even on slow devices. That fixes the one Phase B budget that a single 100k-word document can't meet. Whole-book features (B3, B4, B7) work across the chapter documents.

**Model changes:**

- a `books` table: owner, title, slug, cover
- on `documents`: `bookId`, a sortable `position` and `kind` (`post` | `chapter` | `note`)
- export renderers for EPUB (zipped XHTML from `renderToHTML`) and DOCX

**Out of scope:** corkboard/index cards, character and world databases, co-authors, print layout.

**Your call:** private manuscript first (B7 export) or serial publishing first (B8)?

---

## 2. Research

**For:** papers, essays, reports and technical writing with sources, by researchers, students and analysts.

**Today:** footnotes and math work. Pasting an arXiv paper keeps 138 of 142 equations and 5 footnotes. There are no citations, no bibliography, no figure captions, no cross-references and no equation numbers.

| # | The writer can… | Target |
|---|---|---|
| R1 | Cite by pasting a DOI, arXiv ID, ISBN or URL, or by searching their library | ≤ 10 s per citation; the metadata fills in by itself |
| R2 | Import their library from Zotero, Mendeley, BibTeX, RIS or CSL-JSON, and reuse it across documents | A 500-item `.bib` imports in ≤ 5 s; fixing a reference once updates every citation |
| R3 | Get a bibliography generated in the chosen style (APA, Chicago, IEEE, Nature, …) that lists only what's cited | Switching style restyles everything in one action |
| R4 | Give images and tables numbered captions | Numbers stay correct as figures move |
| R5 | Refer to a figure, table, equation, section or footnote ("see Figure 3", "Eq. (4)") | Numbers stay correct after any edit; links work on the published page |
| R6 | Number display equations and refer to them; equation numbers pasted from arXiv are kept | Today they're dropped |
| R7 | Publish with readable notes: footnotes as margin notes on wide screens, linked citations and DOIs | Reader reaches a source in 1 click |
| R8 | Export to Markdown with Pandoc citations (`[@key]`) plus a `.bib`, and to DOCX | Pandoc and Quarto build it without edits |

**Model changes:**

- new nodes:
  - `citation` (inline: reference keys, page locator, prefix and suffix)
  - `bibliography`
  - `figure` with `figcaption` (wrapping image, table or embed)
  - `crossReference` (inline: target block ID)
- a `numbered` attribute on block math
- a per-user `references` table (CSL-JSON)
- citation formatting with citeproc and CSL styles, done once on the server and on publish, not per keystroke

**Out of scope:** comments and track changes (later, anchored on block IDs), journal templates, writing back to Zotero.

**Your call:** which styles first, and whether a live Zotero connection is needed at launch or file import is enough.

---

## 3. Notes

**For:** years of notes: ideas, reading notes, meetings, journals. Private by default; some grow into posts.

**Today:** a note is a full post, with cover, subtitle, publish button and a server round trip to create. Documents can't link to each other, and new text takes up to 60 s to appear in search.

| # | The writer can… | Target |
|---|---|---|
| N1 | Capture a note from anywhere with one shortcut, online or offline | Typing within 1 s; no title required |
| N2 | Link to another note by typing `[[` and part of its title; linking to a title that doesn't exist creates it | ≤ 3 s per link; links survive renames |
| N3 | See "Linked from" on every note, with the sentence around each link, plus mentions not yet linked | Shown on open |
| N4 | Find any note by its words, including one written seconds ago | Results in ≤ 300 ms across 10,000 notes |
| N5 | Copy a link to any paragraph or heading; opening it jumps there and highlights it | Works after the paragraph is edited or moved |
| N6 | Open today's note with one shortcut (a daily journal) | One action |
| N7 | Turn a note into a post without copying it | Publish settings appear only when wanted |

**Model changes:**

- a `documentLink` inline node holding a document ID (and optional block ID) that displays the current title
- a `document_links` table maintained by the room on each flush, which drives backlinks
- notes created on the device with their own ID, so N1 works offline
- search over this device's copies, so N4 doesn't wait for the 60 s index

**Out of scope:** graph view, Notion-style databases, templates, sharing.

**Your call:** do notes live in the same list as posts, or in a separate space?

---

## Proposed order

1. **Books.** It removes the remaining typing-speed limit by design, and serial publishing reuses the newsletter pipeline. Without chapters, nothing else at book length is comfortable.
2. **Research.** It builds on the footnotes and math from Phase B. Citations are the largest single piece (library, formatting, export).
3. **Notes.** It changes the app's shape most: private space, quick capture, offline creation. That's best done after the other two have settled the document model.

Each mode ships behind its own schema version bump, with:

- property tests for its new nodes (render ↔ parse, Markdown loss reported)
- a numbering/linking test that applies random edits and moves, then checks every number and link
- the writer study above before it's called done
