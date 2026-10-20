# Paste fixtures

Clipboard HTML for `test/paste-snapshots.test.ts`, one file per source and capture that the
Phase A corpus tests use. The corpus itself (`lemma-editor-study/corpus`) stays outside the
repo, because its captures carry third-party text. These fixtures keep the captures' markup and
replace their text, so the paste tests also run in CI.

- **Scrubbed captures** (every directory except `word/`) are built by `scrub.ts` from the
  corpus. Don't edit them by hand.
- **Word fixtures** (`word/`) are hand-written. See [Word](#word) below.

```sh
cd packages/content
bun test/fixtures/paste/scrub.ts                  # rebuild every scrubbed fixture (needs the corpus)
bun test/fixtures/paste/scrub.ts --check          # rebuild in memory; exit 1 if a committed file differs
bun test/fixtures/paste/scrub.ts --outline <out> [selector] [nth]   # list a capture's blocks, to pick prune ranges
LEMMA_PASTE_CORPUS=/elsewhere/corpus bun test/fixtures/paste/scrub.ts
```

`scrub.ts` checks each capture's sha256, so a changed corpus can't silently produce different
fixtures. The output is deterministic: a rebuild is byte-identical. After changing a fixture, run
`bun test test/paste-snapshots.test.ts --update-snapshots` and review the snapshot diff.

## Fixtures

All corpus captures were taken on 2026-10-19 in Chromium 156, except the two Notion app
fixtures, which are open-source test fixtures. The full provenance (URLs, capture method,
licence) is in each capture's `meta.json` in the corpus.

| fixture | origin | bytes (source → fixture) | what it exercises |
|---|---|---|---|
| `google-docs/android-child-process-priority.html` | Publicly viewable Chromium design doc ("Android child process priority"), anonymous viewer, Ctrl+A, Ctrl+C | 67 k → 30 k, blocks 0–12, 35–51 | `docs-internal-guid` wrapper, `<br>` blank lines, inline monospace → inline code, a table, h2–h4, link blue |
| `google-docs/material-design-downloads.html` | Chromium design doc ("Material Design Downloads"), as above | 410 k → 41 k, 11 block ranges | monospace paragraph runs → code blocks (one or several lines), highlights, author colours, `data:` images, lists nested 4 deep, a table, blank lines next to images |
| `google-docs/plugin-power-saver.html` | Chromium design doc ("Chrome: Plugin Power Saver"), as above | 346 k → 35 k, 7 block ranges | code runs, nested ordered lists, images in tables, `mailto:` and `youtu.be` links |
| `google-docs/session-history-oopif.html` | Chromium design doc ("Session History for Out-of-Process iframes"), as above | 103 k → 36 k, 4 block ranges; the strike-through list cut to its first item and sub-list | `<p></p><hr>` rules, strike-through, nested lists, soft line breaks |
| `word/win-desktop-review.html` | Hand-written: Word for Windows (desktop) clipboard HTML | 26 k | see [Word](#word) |
| `word/mac-m365-notes.html` | Hand-written: Word for Mac (Microsoft 365) clipboard HTML | 9 k | see [Word](#word) |
| `arxiv/paper-body.html` | arXiv 1706.03762v7 HTML (LaTeXML), the article body | 161 k → 42 k: front matter, §1, §3 opening + §3.2.1–3.2.2, §7, first 5 references | MathML with TeX annotations → inline/block math, an aligned equation group, author "thanks" notes, a footnote with math inside, bare `\footnotemark`s, citations into the bibliography, figures, `<base href>` |
| `notion/notion-guide.html` | Public notion.site page (third party), DOM-range selection, Ctrl+C | 43 k → 37 k, blocks 0–8, 11–12 | inline-code containers (`display:inline` `<div>`), callout, headings, Notion's block `<div>`s and inline styles |
| `notion/notion-tools-blocks-demo.html` | Public notion.site page (third party), as above | 59 k → 38 k, blocks 1–6, 8, 11–12, 14, 16–17, 19 | to-do block → task item, image, quote, divider, callout, toggle, table, h2–h4 |
| `notion/app-demo-page-fixture-blok.html` | Notion app clipboard (logged-in editor), OSS test fixture from the `blok` project (Apache-2.0), `test/fixtures/notion/demo-page.clipboard.html` @ 176ebff | 20 k → 11 k, 18 block ranges | `[ ]`/`[x]` items → task items (mixed lists split), `attachment:` images and link, code blocks with languages, tables, rules, nested quotes, literal `<aside>` callouts, `$$…$$` TeX in text, Cyrillic text, YouTube links |
| `notion/app-page-fixture-pasteinto.html` | Notion app clipboard (macOS, with the `<meta charset>` prefix), OSS test fixture from the `pasteinto` project (MIT), `tests/fixtures/notion/page.html` @ c276ed5 | 589 → 589, whole | `[x]`/`[ ]` items, nested list, ordered list, quote, code block with language, inline code |
| `chatgpt/energy-comparison-math-copy-button.html` | Public ChatGPT share, the reply's own "Copy response" button | 8.7 k → 8.7 k, whole | MathML display equations with TeX annotations, nested lists, quote, links |
| `chatgpt/energy-comparison-math-selection.html` | Same reply, DOM-range selection, Ctrl+C | 15 k → 15 k, whole | KaTeX (MathML display mode, no `.katex-display`), source-favicon images, ChatGPT's `data-start`/`data-end` markup |
| `chatgpt/inline-images-console-code-selection.html` | Public ChatGPT share, DOM-range selection, Ctrl+C | 7.2 k → 7.3 k, whole | a code block (CodeMirror `<pre>` nested in the UI's `<pre>`), inline code, ordered lists with `start` |
| `wikipedia/markdown-variants-to-references.html` | Wikipedia, "Markdown", sections Variants to References, browser copy | 253 k → 41 k: Variants (3 blocks), Examples table (header + 2 rows), See also, Explanatory notes, References (first 3) | `<pre>` samples → code blocks, a table with header cells, image (`srcset`), reference markers (`sup.reference` → absolute `#cite_note` links), reference lists, Parsoid `data-mw`/`about`/`typeof` |
| `wikipedia/pride-and-prejudice-lead-plot-characters.html` | Wikipedia, "Pride and Prejudice", lead + Plot summary + Characters, browser copy | 78 k → 32 k: infobox (first 7 rows), figures, lists | infobox table with image, figures with captions, reference markers, bold and italic |

The Medium capture failed in Phase A, so it has no fixture. The four Word captures in the
corpus are not used at all: see below.

**Pruning.** Long captures are cut at block boundaries. Each `prune` rule in `scrub.ts` keeps
ranges of a container's element children, and each container is checked against happy-dom's
parse of the capture before cutting. The ranges keep every feature the tests assert on. They
also never make two blocks adjacent if that would change what the cleanup does (for example,
two monospace runs that would merge into one code block). Images, references and footnotes that
the tests count are kept together with whatever they need.

## How a capture is scrubbed

`scrub.ts` tokenizes the HTML itself and rewrites only text and selected attribute values in
place. Every other byte is copied: doctype, comments, tags, attribute order and quoting,
`style` and `class` values, entities, and whitespace layout. A verifier then parses the source
(after pruning) and the fixture with happy-dom and fails the build unless both have:

- the same tree: node types, tag names and attribute names, in the same order;
- the same text shape: identical whitespace, and the same character class at every position
  (upper-case letter, lower-case letter, other letter, digit, or the same punctuation or symbol);
- the same answers to what `paste.ts` reads from text: whether each `<a>` and `<sup>` looks
  like a note marker (`NOTE_MARKER`), and whether each `<li>` starts with a task marker
  (`[ ]` / `[x]`).

**Text** is replaced character by character from a PRNG seeded with the fixture's name, in
document order:

- a letter becomes a random letter of the same script and case (ASCII stays ASCII; accented
  Latin, Cyrillic, Greek, CJK, kana, Hangul, Arabic, Hebrew, Devanagari and Thai map within
  their script);
- a digit becomes a random digit;
- everything else (punctuation, symbols, emoji, spaces, no-break and zero-width spaces) stays.

The filler depends only on position, not on the word it replaces, so it can't be reversed with
a dictionary. A text node that would come out looking like a note marker, task item or Word
list number (`1.`, `a)`) when the source didn't is redrawn.

**Kept verbatim**, because it's markup-like, not prose:

- math: everything inside `<math>`, `<annotation>`, KaTeX (`.katex*`), `.ltx_Math`,
  `.mwe-math-*`, `[data-latex]`, and `alttext` / math-image `alt`;
- TeX in text (`$$…$$`, `$…$` with TeX characters, `\(…\)`, `\[…\]`) and code blocks
  classed `language-latex`/`tex`/`math`;
- LaTeXML's generated labels and marks (`.ltx_tag*`, `.ltx_note_type`, `.ltx_note_mark`);
- short note markers inside `<a>` or `<sup>` (`[1]`, `a`, `†`);
- Notion's leading `[ ]` / `[x]` task markers and literal `<aside>` / `</aside>` callout markers;
- Markdown footnote markers (`[^1]`).

**Code** is scrubbed like text. Line structure, indentation and punctuation stay, and the
identifiers become filler.

**Attributes**:

- `alt`, `title`, `aria-label`, `placeholder`, `data-mw` and friends are scrubbed as text.
- `id`, `name`, `for`, `aria-labelledby`, `data-block-id` and similar are mapped token by token,
  consistently across the fixture, so `href="#x"` still finds `id="x"`. Numbers, tokens of one or
  two letters, and structural words stay: `ftn`, `ftnref`, `cite`, `note`, `bib`, `footnote`,
  `msocom`, `docs`, `internal`, `guid`, and others listed in `KEEP_TOKENS`.
- UUIDs and hex ids become other hex of the same shape.
- `style`, `class` and everything else stay, except URLs inside `url(…)`.

**URLs** keep whatever the cleanup and the schema can see:

- the scheme, and whether the URL is protocol-relative (`//…`), root-relative (`/…`), relative,
  or a bare `#fragment`;
- `file://` vs `https://`;
- Notion's `attachment:<uuid>:<name>.png` shape;
- the file extension;
- query keys and nesting (a URL inside a query value is scrubbed as a URL).

Hosts map to `example.com`, `example.org`, `example.net`, `www.example.*`, … in order of first
appearance. YouTube hosts stay (the editor's YouTube paste rule keys off them), with scrubbed video
ids. Path segments, query values and fragments go through the same token map as ids, so a URL
used twice stays equal. `mailto:` becomes `<filler>@example.*`. URLs and e-mail addresses in
text are rewritten the same way.

**`data:` URIs** become a 1×1 transparent PNG (any raster image type), a 1×1 GIF (`image/gif`)
or an empty 1×1 SVG. Non-image `data:` URIs keep their MIME type with a stub payload.

**Comments**: `StartFragment`/`EndFragment` and conditional comments stay. Ids in Notion's
`notionvc:` comment are mapped. Any other comment is scrubbed as text.

### Evidence that no source prose remains

Every run prints a leak report. For each fixture it shows the source's prose words (3+
letters), the *survivors* (source words still at the same place in the aligned text node or
attribute), and the *trigrams* (three consecutive source prose words found anywhere in the
fixture, in text or any attribute value). The current report:

- **Survivors:** 0 in every fixture except `notion/app-demo-page-fixture-blok.html`. There
  they are the deliberately kept `<aside>`, `</aside>`, `\frac{-b` and `\sqrt{b^2` (TeX in text).
- **Trigrams:** the only ones are kept math (`minutes of netflix` in a ChatGPT `\text{}`), kept
  TeX (Notion), kept YouTube host structure (`youtube com watch`, `youtu be`), and URL path
  tokens (`edit tab t`).

A separate check against the full, unpruned captures took the 5+-letter words that appear in
the original's text but nowhere in its markup: 4,219 words over the 14 captures. 17 of them occur
anywhere in the fixture files, markup included, and every one is accounted for:

- `minutes`, `minute` and `netflix` are inside kept KaTeX `\text{}`;
- `example` comes from the example hosts the scrubber writes;
- `aside` and the TeX command names (`aligned`, `begin`, `nabla`, `mathbf`, `varepsilon`,
  `times`, `partial`) are kept Notion markers and a `language-latex` code block.

## Word

The corpus's Word captures come from CKEditor's GPL-licensed test fixtures. They must not enter
this repo in any form, so nothing here was read from or derived from them. Both Word fixtures
were written from general knowledge of Word's HTML clipboard format, with original text.

`word/win-desktop-review.html` models Word for Windows desktop (Word 2016 and later, `Generator`
"Microsoft Word 15"), as `getData('text/html')` returns it in Chromium: the whole document with
the `<!--StartFragment-->` / `<!--EndFragment-->` markers. It contains:

- the `<html xmlns:v xmlns:o xmlns:w xmlns:m>` root, `ProgId`/`Generator` metas, and
  `file:///C:/Users/user/AppData/Local/Temp/msohtmlclip1/01/` links;
- `<!--[if gte mso 9]><xml>` settings and latent styles;
- a `<style><!-- … -->` block with `@font-face`, `Mso*` styles, `@page` and `@list l0`/`l1`
  definitions, and the `MsoTableGrid` style in an `<!--[if gte mso 10]>` block;
- `MsoTitle`, and `<h1>`/`<h2>` with `_Toc` bookmark anchors;
- `MsoListParagraphCxSpFirst/Middle/Last` items with `mso-list:l0 level1 lfo1` and
  `<![if !supportLists]>` markers: Symbol `·` and Courier New `o` bullets, typed `1.`/`a.`/`2.`
  numbers;
- highlights: `background:yellow;mso-highlight:yellow`, and `mso-highlight:lime` alone;
- colours: `#C00000`, `#00B050`, and a hyperlink relying on `MsoHyperlink` blue;
- `<s>`, `<sub>`, `<sup>`, and a `lang=FR` span;
- `<o:p>&nbsp;</o:p>` blank lines, once and twice in a row;
- a footnote (`#_ftn1` / `_ftnref1`, `mso-footnote-id`, `mso-element:footnote-list`) and an
  endnote (`#_edn1`, `mso-element:endnote-list`);
- a review comment: `mso-comment-reference` range, `MsoCommentReference` / `msocomanchor`
  `[RV1]` anchor, and the `mso-element:comment-list` block with `msocomtxt`;
- a manual page break (`<br clear=all style='mso-special-character:line-break;page-break-before:always'>`);
- an `MsoTableGrid` table whose header cells are shaded `#4472C4` with white bold text;
- a picture as VML (`<v:shapetype>`/`<v:shape>`/`<v:imagedata>` inside `<!--[if gte vml 1]>`) with
  its `<![if !vml]><img src="file:///C:/…/clip_image002.png" v:shapes=…>` fallback.

`word/mac-m365-notes.html` is a smaller Word for Mac (Microsoft 365) variant. Its differences:

- Aptos / Aptos Display theme fonts;
- `file:////Users/user/Library/Group%20Containers/UBF8T346G9.Office/TemporaryItems/msohtmlclip/…`
  paths (four slashes);
- `lang=EN-GB` and `bgcolor=white` on `<body>`;
- no `StartFragment`/`EndFragment` comments (the macOS pasteboard has no CF_HTML fragment
  header);
- a numbered list starting at 3 (`mso-level-start-at:3`);
- `mso-highlight:cyan` with no `background` restated.

Both are approximations written from memory, not captures. If a real capture ever disagrees
(for example, on whether Mac Word writes the fragment markers), the capture wins: update the
fixture and its snapshot.
