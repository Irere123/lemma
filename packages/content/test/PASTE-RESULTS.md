# Paste fidelity: Phase A corpus, before and after

`normalizePastedHTML` / `PasteCleanup` (`src/schema/paste.ts`), measured on the Phase A clipboard corpus (`lemma-editor-study/corpus`). There are 17 clipboard captures plus the arXiv paper body; the Medium capture failed in Phase A and isn't in the corpus.

**Since then:** `paste-snapshots.test.ts` runs the same expectations in CI on scrubbed copies of these captures (`fixtures/paste/`, no third-party text; the Word fixtures are hand-written, not derived from the GPL CKEditor captures). It found five more bugs, now fixed in `paste.ts`:

- a Google Docs blank line beside an image kept a hard break
- Word's kept blank line held a no-break space
- a Word manual page break left a hard-break paragraph
- ChatGPT's code block, a `<pre>` inside a `<pre>`, pasted an extra empty code block and leaked hard breaks into later blocks

```
cd packages/content && bun test                       # unit tests + corpus targets (happy-dom)
cd packages/content && bun test/paste-chromium.ts     # same corpus in Chromium 1248, prints the tables below
```

## How the numbers were taken

| column | engine | pipeline |
|---|---|---|
| **source** | happy-dom (identical in Chromium) | `classify()` on the clipboard HTML, as in Phase A |
| **Phase A** | Chromium, Oct 19 | the web editor as it was (`results/paste.json`): old ad-hoc extensions, no shared schema |
| **schema only** | Chromium | today's content schema, no cleanup: `DOMParser.fromSchema(schema).parseSlice` |
| **after** | happy-dom (`bun test`) | `normalizePastedHTML` → `parseSlice` → `DOMSerializer` (math rendered with KaTeX, as the node view does) |
| **after, editor paste** | Chromium | a real Tiptap editor on `contentExtensions` + `PasteCleanup`, receiving a `paste` event. This is the full path: transformPastedHTML, normalizeSiblings, the footnotes plugin's transformPasted, paste rules, node views |

Most of the Phase A losses were fixed by the shared schema alone. Google Docs code and highlights, ChatGPT and arXiv math, and Notion inline code all come through in the "schema only" column. `normalizePastedHTML` adds what parse rules can't express: footnotes, dead links, Word comments, lists and shading, task lists, code-paragraph runs, unloadable images, blank-line runs.

**happy-dom vs Chromium.** The same harness was run in both engines. Every classifier metric matches for all 18 fixtures, sources included. The one difference is a single blank paragraph in `word/mac-word15-footnotes…`, where a VML text box nests tables inside a `<p>` and the two parsers split it differently. These are the happy-dom behaviours that differ from Chromium, and how this work handles each:

- **`<p><hr></p>`.** Chromium splits it into `<p></p><hr><p></p>`; happy-dom keeps it nested. This is why Phase A saw 14 empty paragraphs in `session-history-oopif`. The cleanup handles both shapes: empties beside a rule are dropped, and a text-less `<p>` holding only images or a rule is lifted.
- **Word's `<v:shape>`.** happy-dom's `localName` is `shape`; Chromium's is `v:shape`. The cleanup switches on `tagName`.
- **CSS colours.** `style.backgroundColor` reads back as written in happy-dom (`#fff2cc`, `yellow`) but as `rgb(…)` in Chromium. Both forms are handled: `safeCssColor`, `DEFAULT_PAPER`, and the cleanup's colour parser accept hex, names and `rgb()/rgba()`. The highlight and colour counts match across engines.
- **`:not(<complex selector>)`.** happy-dom doesn't support it. The classifier port does those checks with `closest()`.
- **Iframes in inert documents.** happy-dom loads them (it fetched the YouTube player in one probe); browsers never do. Tests avoid embeds.

**Classifier port.** `test/paste-harness.ts` follows `scripts/paste.mjs` with these deliberate changes:

- **Math** counts one per equation. Phase A's selector counted KaTeX's wrapper and its inner `<math>` separately, so ChatGPT's "0/4" is 2 equations.
- **Tasks** count a rendered task item once, not as `li` + checkbox.
- **ProseMirror's caret `<img class="ProseMirror-separator">`** isn't counted as an image.
- **`sup[data-footnote-ref]`** counts as a note marker, and `ol[data-footnotes] > li` as a footnote body.

**† Blank paragraphs.** Phase A counted only *empty* top-level paragraphs. A Google Docs blank line (`<br>` between blocks) became a paragraph holding a lone hard break, which that count missed: 94 of them in `material-design-downloads`. The "blank ¶" rows count both kinds. After cleanup, every blank line is one empty paragraph, and no two are adjacent (the brief: "at most one survives" per run, none at the edges, none beside a rule). Docs files still keep one blank paragraph wherever the author left a blank line.

## Targets (all asserted per fixture in `test/paste.test.ts`)

| target | result |
|---|---|
| Text (letters and digits) within 97–103% of source | 99–100% for every fixture. Word is measured without review comments and typed list markers (see Word below). |
| Math ≥ 95% of source equations; no "hth_{t}"-style duplicated TeX | arXiv 138/142 (97%: two aligned groups of 6 cells became 2 aligned blocks), ChatGPT 2/2 and 2/2. No source TeX annotation appears in the result text. |
| Footnotes present and not inlined | arXiv: 5 footnote nodes (3 author "thanks", 2 footnotes); note text no longer appears in the body, and no "thanks:" / "footnotemark:". Word: footnote nodes, with the note body moved out of the document flow. |
| Citations | All 63 arXiv citations keep their visible text, in order ("[13]", "[35, 2, 5]"); their `#bib…` links are gone. |
| Google Docs code ≥ 90%, highlights ≥ 90%, ≤ 1 consecutive empty paragraph | code 1560/1552, 250/250, 84/84 (now 10 code blocks plus inline code); highlights 207/207; longest blank run 1 |
| Word highlights ≥ 90%, footnotes as footnote nodes | 173/179 (97%; 173/197 against the raw source); footnotes ✓ |
| Notion task items preserved | public page 1/1 to-do; app clipboard "[ ]"/"[x]" items become 9 and 2 task items |
| No dead internal `#` links | 0 everywhere (Phase A: 93 arXiv, 12 Word) |

## Rules (what `normalizePastedHTML` does)

The rules run on one `DOMParser` document. A single walk buckets the elements, and each rule then works on its bucket.

- **Google Docs**
  - Unwraps `<b id="docs-internal-guid-…">`.
  - Runs of paragraphs set entirely in a monospace font become one `<pre><code>`. Line breaks and blank lines inside the run are kept. Not applied in lists or table cells, where the text stays inline code.
  - `#ftnt` ↔ `#ftnt_ref` footnotes, via the anchor-pair rule below.
- **Word**
  - `#_ftn` / `#_edn` footnotes and endnotes become canonical footnote markup. The "[1]" backlink and the separator rule go. A reference whose note wasn't copied keeps its number as plain superscript.
  - `mso-list` paragraphs become nested `ul`/`ol` by level. A typed "1."/"a)" means ordered (`start` kept); "·", "o", "§" mean a bullet. The typed marker is removed.
  - Review comments are removed: `a.msocomanchor` labels ("[AB1]") and the `mso-element:comment-list` bodies.
  - `mso-highlight` becomes `background-color`. `background:yellow` already reads as `backgroundColor` in both engines.
  - Near-white text takes the background of the shaded cell or block it sits on as a highlight. With no backdrop in the fragment, the colour is dropped, because white-on-white is unreadable. The Word fixture's 197 "highlight" characters are white text in a purple (#A100FF) table cell, not highlighter.
  - VML pictures and `file:` images are dropped and counted.
- **LaTeXML (arXiv)**
  - `span.ltx_note` (`footnote`, `thanks`, `endnote`) becomes a canonical footnote. The marks, the "thanks:" / "footnotemark:" label and the tag are removed. Math inside the note is kept.
  - A `\footnotemark` with no text of its own stays a superscript mark.
  - Citations keep their text. The bibliography stays as text.
  - In `math.ts`, an aligned `ltx_equationgroup` becomes `\begin{aligned}…&…\end{aligned}` instead of every cell on its own line.
- **Notion**
  - Public-page `div.notion-to_do-block` (checkbox + text) becomes a task list, and adjacent to-dos merge into one list.
  - App clipboard `[ ]` / `[x]` list items become task items; mixed lists are split.
  - `display:inline` `<div>`s, such as Notion's inline-code container, become spans so they don't split the paragraph.
  - `attachment:` images are dropped and counted.
- **Any source**
  - Every `href="#…"` link is unwrapped, keeping its text. The brief said "if the target isn't in the fragment", but the schema stores no element ids, so after the parse no in-page target exists either way.
  - Footnotes written as a pair of links (a reference to `#X`, and `#X` linking back) become canonical footnotes. This covers Word, Docs, Pandoc, markdown-it, and Lemma's own published HTML. A table of contents isn't mistaken for footnotes, because the marker text must look like a note marker.
  - Images are kept only if a reader could load them: `http(s)`, `//`, `/…`, `data:image/…`, or a same-origin `blob:`. Relative URLs resolve against a `<base>` if the clipboard has one. Everything else (`file:`, `cid:`, `attachment:`, `webkit-fake-url:`, `data:text/…`, relative without a base) is dropped and counted.
  - Blank lines: at most one empty paragraph per run, none at the edges or beside a rule. A paragraph holding only images or a rule is lifted, since both are blocks in the schema. A paste of nothing but blank lines pastes nothing.
  - Default link blue (blue-dominant colours) and underline on link text are not stored; a chosen link colour is.
  - VS Code / JetBrains monospace `white-space:pre` boxes become a code block.
- **Left alone**: HTML carrying `data-pm-slice` (Lemma or another ProseMirror editor). A copied cell range is wrapped and unwrapped the way prosemirror-view does, so it stays a cell range. If any rule throws, the paste goes through uncleaned.
- **Markdown in text/plain.** `clipboardTextParser` runs only when the clipboard has no HTML, and never on Shift+paste. It uses conservative detection: an ATX heading, a fence, a table divider, `$$…$$`, `**bold**`, `[text](url)`, a `[^n]:` definition, or two or more list lines. It parses with `markdownToContent` and validates block by block.

## Per fixture

### google-docs/android-child-process-priority

| metric | source | Phase A (old editor) | schema only | **after** (bun test) | after, Chromium editor paste |
|---|---:|---:|---:|---:|---:|
| text (alnum) | 7271 | 7271 (100%) | 7271 (100%) | **7271 (100%)** | 7271 (100%) |
| code chars | 84 | 0 | 84 | **84** | 84 |
| link chars | 192 | 246 | 192 | **192** | 246 |
| colour chars | 192 | 192 | 192 | **0** | 0 |
| bold chars | 14 | 14 | 14 | **14** | 14 |
| list items | 20 | 20 | 20 | **20** | 20 |
| blank ¶ top-level / longest run | | 0 empty† | 10 / 1 | **10 / 1** | 10 / 1 |

### google-docs/material-design-downloads

| metric | source | Phase A (old editor) | schema only | **after** (bun test) | after, Chromium editor paste |
|---|---:|---:|---:|---:|---:|
| text (alnum) | 14918 | 14918 (100%) | 14918 (100%) | **14918 (100%)** | 14918 (100%) |
| code chars | 1552 | 0 | 1552 | **1560** | 1560 |
| highlight chars | 207 | 0 | 207 | **207** | 207 |
| link chars | 1727 | 1750 | 1666 | **1666** | 1684 |
| colour chars | 2365 | 2365 | 2304 | **638** | 638 |
| bold chars | 99 | 99 | 99 | **99** | 99 |
| list items | 104 | 104 | 104 | **104** | 104 |
| images | 5 | 5 | 5 | **5** | 5 |
| blank ¶ top-level / longest run | | 3 empty† | 68 / 2 | **64 / 1** | 64 / 1 |

### google-docs/plugin-power-saver

| metric | source | Phase A (old editor) | schema only | **after** (bun test) | after, Chromium editor paste |
|---|---:|---:|---:|---:|---:|
| text (alnum) | 9040 | 9019 (100%) | 9040 (100%) | **9040 (100%)** | 9019 (100%) |
| code chars | 250 | 0 | 252 | **250** | 250 |
| link chars | 527 | 556 | 527 | **527** | 500 |
| colour chars | 653 | 626 | 653 | **126** | 126 |
| bold chars | 697 | 697 | 631 | **631** | 631 |
| list items | 30 | 30 | 30 | **30** | 30 |
| images | 6 | 6 | 6 | **6** | 6 |
| blank ¶ top-level / longest run | | 3 empty† | 39 / 2 | **36 / 1** | 36 / 1 |

### google-docs/session-history-oopif

| metric | source | Phase A (old editor) | schema only | **after** (bun test) | after, Chromium editor paste |
|---|---:|---:|---:|---:|---:|
| text (alnum) | 16983 | 16983 (100%) | 16983 (100%) | **16983 (100%)** | 16983 (100%) |
| link chars | 599 | 651 | 599 | **599** | 651 |
| colour chars | 599 | 599 | 599 | **0** | 0 |
| bold chars | 681 | 681 | 681 | **681** | 681 |
| list items | 41 | 41 | 41 | **41** | 41 |
| blank ¶ top-level / longest run | | 14 empty† | 44 / 2 | **22 / 1** | 22 / 1 |

### word/mac-word15-footnotes-nested-lists-tables

| metric | source | Phase A (old editor) | schema only | **after** (bun test) | after, Chromium editor paste |
|---|---:|---:|---:|---:|---:|
| text (alnum) | 2031 | 2031 (100%) | 2031 (100%) | **1817 (89%)** | 1817 (89%) |
| highlight chars | 197 | 0 | 0 | **173** | 173 |
| link chars | 215 | 215 | 215 | **138** | 138 |
| colour chars | 2 | 4 | 4 | **0** | 0 |
| bold chars | 539 | 536 | 536 | **501** | 501 |
| list items | 42 | 42 | 42 | **45** | 46 |
| note/cite markers | 5 | 5 | 5 | **2** | 2 |
| footnote bodies | 0 | – | 0 | **1** | 2 |
| dead # links | 12 | 12 | 12 | **0** | 0 |
| blank ¶ top-level / longest run | | 2 empty† | 2 / 1 | **1 / 1** | 2 / 1 |
| images dropped (reported) | | 0 | – | **4** | 4 |

### word/mac-word15-headings-lists-table

| metric | source | Phase A (old editor) | schema only | **after** (bun test) | after, Chromium editor paste |
|---|---:|---:|---:|---:|---:|
| text (alnum) | 102 | 102 (100%) | 102 (100%) | **98 (96%)** | 98 (96%) |
| code chars | 2 | 0 | 4 | **0** | 0 |
| link chars | 4 | 4 | 4 | **4** | 4 |
| bold chars | 4 | 4 | 4 | **4** | 4 |
| list items | 0 | 0 | 0 | **6** | 6 |
| blank ¶ top-level / longest run | | 0 empty† | 0 / 0 | **0 / 0** | 0 / 0 |

### word/win-word2016-basic-styles-multiline

| metric | source | Phase A (old editor) | schema only | **after** (bun test) | after, Chromium editor paste |
|---|---:|---:|---:|---:|---:|
| text (alnum) | 54 | 54 (100%) | 54 (100%) | **54 (100%)** | 54 (100%) |
| bold chars | 29 | 28 | 28 | **28** | 28 |
| blank ¶ top-level / longest run | | 0 empty† | 0 / 0 | **0 / 0** | 0 / 0 |

### word/win-word2016-linked-image

| metric | source | Phase A (old editor) | schema only | **after** (bun test) | after, Chromium editor paste |
|---|---:|---:|---:|---:|---:|
| images | 1 | 1 | 1 | **0** | 0 |
| blank ¶ top-level / longest run | | 1 empty† | 1 / 1 | **0 / 0** | 1 / 1 |
| images dropped (reported) | | 0 | – | **1** | 1 |

### notion/app-demo-page-fixture-blok

| metric | source | Phase A (old editor) | schema only | **after** (bun test) | after, Chromium editor paste |
|---|---:|---:|---:|---:|---:|
| text (alnum) | 7959 | 7926 (100%) | 7959 (100%) | **7956 (100%)** | 7923 (100%) |
| code chars | 2051 | 1995 | 2051 | **2051** | 2051 |
| highlight chars | 0 | 10 | 0 | **0** | 10 |
| link chars | 519 | 433 | 476 | **476** | 433 |
| bold chars | 457 | 455 | 455 | **455** | 455 |
| list items | 67 | 67 | 67 | **67** | 67 |
| task items | 0 | 0 | 0 | **9** | 9 |
| images | 4 | 4 | 4 | **1** | 1 |
| blank ¶ top-level / longest run | | 5 empty† | 4 / 1 | **3 / 1** | 3 / 1 |
| images dropped (reported) | | 0 | – | **3** | 3 |

### notion/app-page-fixture-pasteinto

| metric | source | Phase A (old editor) | schema only | **after** (bun test) | after, Chromium editor paste |
|---|---:|---:|---:|---:|---:|
| text (alnum) | 167 | 167 (100%) | 167 (100%) | **166 (99%)** | 166 (99%) |
| code chars | 16 | 16 | 16 | **16** | 16 |
| link chars | 11 | 11 | 11 | **11** | 11 |
| bold chars | 8 | 8 | 8 | **8** | 8 |
| list items | 7 | 7 | 7 | **7** | 7 |
| task items | 0 | 0 | 0 | **2** | 2 |
| blank ¶ top-level / longest run | | 0 empty† | 0 / 0 | **0 / 0** | 0 / 0 |

### notion/notion-guide

| metric | source | Phase A (old editor) | schema only | **after** (bun test) | after, Chromium editor paste |
|---|---:|---:|---:|---:|---:|
| text (alnum) | 614 | 614 (100%) | 614 (100%) | **614 (100%)** | 614 (100%) |
| code chars | 37 | 0 | 37 | **37** | 37 |
| colour chars | 37 | 37 | 0 | **0** | 0 |
| bold chars | 9 | 9 | 9 | **9** | 9 |
| blank ¶ top-level / longest run | | 1 empty† | 0 / 0 | **0 / 0** | 0 / 0 |

### notion/notion-tools-blocks-demo

| metric | source | Phase A (old editor) | schema only | **after** (bun test) | after, Chromium editor paste |
|---|---:|---:|---:|---:|---:|
| text (alnum) | 466 | 466 (100%) | 466 (100%) | **466 (100%)** | 466 (100%) |
| list items | 0 | 0 | 0 | **1** | 1 |
| task items | 1 | 0 | 0 | **1** | 1 |
| images | 1 | 1 | 1 | **1** | 1 |
| blank ¶ top-level / longest run | | 0 empty† | 0 / 0 | **0 / 0** | 0 / 0 |

### chatgpt/energy-comparison-math-copy-button

| metric | source | Phase A (old editor) | schema only | **after** (bun test) | after, Chromium editor paste |
|---|---:|---:|---:|---:|---:|
| text (alnum) | 2649 | 2779 (105%) | 2649 (100%) | **2649 (100%)** | 2649 (100%) |
| link chars | 216 | 216 | 216 | **216** | 216 |
| bold chars | 680 | 680 | 680 | **680** | 680 |
| list items | 18 | 18 | 18 | **18** | 18 |
| math | 2 | 0 | 2 | **2** | 2 |
| blank ¶ top-level / longest run | | 1 empty† | 0 / 0 | **0 / 0** | 0 / 0 |

### chatgpt/energy-comparison-math-selection

| metric | source | Phase A (old editor) | schema only | **after** (bun test) | after, Chromium editor paste |
|---|---:|---:|---:|---:|---:|
| text (alnum) | 2640 | 2770 (105%) | 2640 (100%) | **2640 (100%)** | 2640 (100%) |
| link chars | 202 | 202 | 202 | **202** | 202 |
| bold chars | 680 | 680 | 680 | **680** | 680 |
| list items | 16 | 16 | 16 | **16** | 16 |
| images | 6 | 6 | 6 | **6** | 6 |
| math | 2 | 0 | 2 | **2** | 2 |
| blank ¶ top-level / longest run | | 0 empty† | 0 / 0 | **0 / 0** | 0 / 0 |

### chatgpt/inline-images-console-code-selection

| metric | source | Phase A (old editor) | schema only | **after** (bun test) | after, Chromium editor paste |
|---|---:|---:|---:|---:|---:|
| text (alnum) | 1594 | 1594 (100%) | 1594 (100%) | **1594 (100%)** | 1594 (100%) |
| code chars | 190 | 192 | 192 | **192** | 192 |
| bold chars | 308 | 308 | 308 | **308** | 308 |
| list items | 15 | 15 | 15 | **15** | 15 |
| blank ¶ top-level / longest run | | 0 empty† | 0 / 0 | **0 / 0** | 0 / 0 |

### arxiv/paper-body

| metric | source | Phase A (old editor) | schema only | **after** (bun test) | after, Chromium editor paste |
|---|---:|---:|---:|---:|---:|
| text (alnum) | 30600 | 31783 (104%) | 30576 (100%) | **30454 (100%)** | 30454 (100%) |
| link chars | 345 | 345 | 345 | **192** | 192 |
| list items | 43 | 43 | 43 | **48** | 48 |
| images | 8 | 8 | 8 | **8** | 8 |
| math | 142 | 0 | 138 | **138** | 138 |
| note/cite markers | 87 | 0 | 0 | **5** | 5 |
| footnote bodies | 0 | – | 0 | **5** | 5 |
| dead # links | 93 | 93 | 93 | **0** | 0 |
| blank ¶ top-level / longest run | | 0 empty† | 0 / 1 | **0 / 1** | 0 / 1 |

### wikipedia/markdown-variants-to-references

| metric | source | Phase A (old editor) | schema only | **after** (bun test) | after, Chromium editor paste |
|---|---:|---:|---:|---:|---:|
| text (alnum) | 10834 | 10834 (100%) | 10834 (100%) | **10834 (100%)** | 10834 (100%) |
| code chars | 1489 | 1509 | 1534 | **1534** | 1534 |
| link chars | 3546 | 3753 | 3546 | **3546** | 3753 |
| colour chars | 3546 | 0 | 0 | **0** | 0 |
| bold chars | 4 | 4 | 4 | **4** | 4 |
| list items | 74 | 74 | 74 | **74** | 74 |
| images | 1 | 1 | 1 | **1** | 1 |
| note/cite markers | 27 | 27 | 27 | **27** | 27 |
| blank ¶ top-level / longest run | | 1 empty† | 0 / 1 | **0 / 0** | 0 / 0 |

### wikipedia/pride-and-prejudice-lead-plot-characters

| metric | source | Phase A (old editor) | schema only | **after** (bun test) | after, Chromium editor paste |
|---|---:|---:|---:|---:|---:|
| text (alnum) | 13108 | 13111 (100%) | 13111 (100%) | **13111 (100%)** | 13111 (100%) |
| highlight chars | 35 | 0 | 39 | **39** | 39 |
| link chars | 850 | 852 | 852 | **852** | 852 |
| colour chars | 850 | 0 | 0 | **0** | 0 |
| bold chars | 411 | 416 | 416 | **416** | 416 |
| list items | 17 | 17 | 17 | **17** | 17 |
| images | 7 | 7 | 7 | **7** | 7 |
| note/cite markers | 9 | 9 | 9 | **9** | 9 |
| blank ¶ top-level / longest run | | 5 empty† | 5 / 1 | **5 / 1** | 5 / 1 |


**Reading the less obvious rows**

- **Google Docs colour chars.** These drop because the default link blue (`#1155cc`) is no longer stored as a text colour; the link mark still styles the text. Author colours remain (green code comments, grey subtitles, blue headings).
- **Google Docs bold 697 → 631, and link chars 1727 → 1666.** This comes from the schema, not the cleanup. Tiptap's `code` mark excludes every other mark, so bold or linked monospace text keeps only `code`. Notion's red inline code loses its colour for the same reason.
- **Word text 1817/2031.** The difference is the 211 characters of review comments ("[Incididunt1]" anchors and the comment body), which are deliberately not pasted. Against the source without comments it's 1817/1820. Word link chars drop for the same reason, plus the dead `#_ftn` / `#_msocom` links.
- **Word list items +3/+4.** Two `mso-list` paragraphs became list items, plus the footnote list. In headings-lists-table, 6 paragraphs that started with a typed "·", "o" or "1." are now 6 list items. Its source "code chars 2" were the "o" bullets set in Courier New.
- **Word, editor paste: footnote bodies 2.** This is a bug in `footnotes.ts` (see below). The schema harness has the correct 1.
- **arXiv note/cite markers 5 of 87.** The 87 are 24 LaTeXML note marks (2 per note) plus 63 citations. Now there are 5 footnote references, 7 `\footnotemark` superscripts and 63 citations as text, the last verified in order by the test. The list items +5 are the footnote bodies. Tables 10 → 5 is the 5 equation tables that are now math.
- **Notion app link chars 476/519** (both "schema only" and "after"). The 43 missing characters are an `attachment:` link to a PDF, which the link mark rejects.
- **The editor-paste column differs from "after" only through other extensions.**
  - YouTube's paste rule turns a pasted YouTube link into an embed and drops its text: `plugin-power-saver` 9019 vs 9040, Notion app 7923.
  - Link autolink adds links in pasted text (246 vs 192).
  - Both match Phase A and are unrelated to the cleanup.

## Markdown in text/plain (no HTML on the clipboard)

Every corpus capture carries HTML, and HTML wins, so the Markdown parser never runs on the corpus as captured. The rows below are the same captures' text/plain pasted alone into the editor in Chromium. Without the parser, each line becomes a paragraph.

| text/plain of | detected | result |
|---|---|---|
| ChatGPT copy button (Markdown) | yes | 4 headings, 8 lists / 18 items, 2 display equations, 1 blockquote |
| Notion app demo page (Markdown) | yes | 40 headings, 6 tables, 11 code blocks, 10 task items, 3 + 2 equations, 2 footnotes |
| Notion app (pasteinto) | yes | heading, lists, 2 task items, code block, blockquote |
| ChatGPT selection (rendered text with `$$…$$`) | yes | 2 display equations; the "1. Energy per…" section titles become an ordered list |
| ChatGPT code answer, Notion public pages (plain text) | no | plain paragraphs |

Before this, `markdownToContent` output for the Notion page failed validation, on an empty blockquote and on `code` combined with `bold`. The lenient validator then flattened the entire paste to paragraphs. `markdownSlice` now validates block by block, so only the offending block is flattened.

## Speed (Chromium 1248, median of 15 runs)

| input | size | `normalizePastedHTML` | of which DOMParser + serialise alone |
|---|---:|---:|---:|
| `book/book-full.html` (Pride and Prejudice, plain HTML) | 685 KB | 30 ms | 23 ms |
| Google Docs ×4 + arXiv paper concatenated (inline-style heavy) | 1061 KB | 65 ms | 39 ms |
| largest single capture (`material-design-downloads`, 400 KB) | | 27 ms | |

ProseMirror then parses the cleaned HTML once more, as it would have anyway.

## Not fixed, and why

- **Equation numbers "(1)"** from LaTeXML are dropped. KaTeX's `\tag` only works in display mode, and the web editor's math node view renders without `displayMode`, so a tag would show as an error. Worth revisiting once block math renders in display mode everywhere.
- **Bold, link or colour on inline code** are lost (see above). That's the schema's `code` mark (`excludes: '_'`), not paste.
- **Links inside Google Docs code paragraphs** are lost: a code block holds plain text.
- **Repeated references to one footnote, in the editor.** The cleanup emits canonical markup (both references share an id), but `footnotes.ts` `transformPasted` renames the second reference. The first reference is left with an empty note and the second gets the body. Pinned by a `test.failing` in `paste.test.ts`; the fix belongs in `footnotes.ts`.
- **`markdownToContent` emits invalid JSON** for a bare `>` (an empty blockquote) and for `**`code`**` (`code` + `bold`). Worked around per block here; the fix belongs in `markdown-parse.ts`.
- **Wikipedia references** stay links back to Wikipedia. Chromium writes them as absolute URLs (`…/wiki/Markdown#cite_note-1`), and the page URL isn't on the clipboard, so they can't be matched to the pasted reference list. The brief accepts this. Fragment-only `#cite_note` links would convert through the anchor-pair rule.
- **LaTeXML `\footnotemark`** marks which note they repeat only by number, and here that number collides with a different note. They stay superscript marks rather than guess.
- **Word lists.** Numbering formats (a., i.) collapse to the schema's single ordered style. Two different Word lists pasted back to back merge, because the `lfo` list id is ignored.
- **Images** that can't be loaded are dropped and reported through `onDroppedImages`, not uploaded. There is no upload path yet (Phase A finding #7). Google Docs `data:` images are still stored inline (finding #1).
- **Word VML text boxes** (tables nested in a paragraph) keep their text, but how the paragraph splits differs between engines (one extra blank paragraph in Chromium).
