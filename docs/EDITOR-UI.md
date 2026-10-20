# Editor UI pass

Status: **On branch `feat/editor-durability`, not committed or deployed.**
Date: 2026-10-20

Before-and-after screenshots come from `scripts/ui/capture.mjs` in the study harness (`lemma-editor-study/`, kept outside this repo). That script takes the same document through the same states every time; the output is in `results/ui/before/` and `results/ui/after/`.

## What changed

**The page**
- The text is written on the page, not in a bordered card under a form. Title, subtitle and body share one column.
- The editor and the published post use the same measure (`--writer-measure`, about 70 characters of body text). Lines break in the same places in both.
  - Two causes had to be fixed: different widths, and Tiptap's injected `white-space: break-spaces`.
- One top bar replaces the two headers. It holds back, a Draft/Published badge, save state, word count, history, a ⋯ menu and Publish.
  - The word count opens a popover with characters and reading time.
  - The ⋯ menu holds the publishing date, Markdown export, keyboard shortcuts and Unpublish.
  - Published posts get a View post button.
- The bar fades while you type and comes back when the pointer moves or the bar takes focus.
- **Add cover** only appears on hover, or always on touch screens.
- Title and subtitle wrap. Enter and ↓ move from the title to the subtitle to the body, and ↑ and Backspace move back.

**Blocks**
- Hovering any block, including list items, shows `+` and `⋮⋮` in the gutter.
  - `+` adds a block below and opens the slash menu; ⌥-click adds it above.
  - `⋮⋮` drags the block, or on click opens: Turn into ▸, Duplicate (with a new block ID), Copy link to block, Move up/down, Delete.
  - Both are hidden while you type and on touch screens.
- Copy link to block gives the published anchor once the post is public. Before that it links to the editor, which scrolls to the block and highlights it.
- The slash menu is grouped (Basic, Lists, Media and data, Math and notes) and shows each block's Markdown shortcut. Its search terms now match; before, they were defined but never used.
- Code blocks:
  - a language picker and a copy button
  - syntax colours in the editor
  - the same colours on the published page, from server-side lowlight
- Selecting an image gives Small, Medium and Full width, editable alt text, and Delete.
- With the caret in a table, a toolbar adds and removes rows and columns, toggles the header row and deletes the table.
- Callouts: click the emoji to change it.
- To-dos have their checkbox on the text line. In the editor they were stacked above the text, because the CSS targeted an attribute only the published HTML has. The checkboxes are now drawn to match the theme.

**Text and links**
- Links are underlined. The CSS reset had made them look like plain text in the editor and on published posts.
- With the caret in a link, a popover shows where it goes, with Open, Copy, Edit and Unlink.
- ⌘K / Ctrl+K links the selection, or edits the link the caret is in.
- ⌘/ / Ctrl+/ lists every shortcut.

**Phones**
- A formatting bar sits on top of the keyboard while you write:
  - insert block, heading, bold, italic, link
  - bulleted list, to-do, image
  - undo, redo, hide keyboard
- The floating selection menu used to run off the screen; it is now desktop-only. Links are added from a dialog.

## Bugs found on the way (fixed)

- **Bubble menus overwrote each other's rules.** Every Tiptap bubble menu listens to the same `bubbleMenu` options update. Our selection menu re-sent its options on every render, so the link popover took over the selection menu's show rule and never appeared. All menus now pass stable options; see the comment in `packages/headless/src/components/editor-bubble.tsx`.
- **Two copies of `@tiptap/react` were installed.** Context hooks from the app's copy saw no editor. Editor hooks and node-view helpers now come through `@lemma/headless`.
- **Enter in the subtitle, then typing at once, lost the first letter.** Tiptap moves focus on the next frame. The body is now focused at once.

## How it was checked

- **Existing suites, all passing on the new UI:**
  - CI end-to-end: chaos test (11/11), foundations (14/14), latency (6/6)
  - study harness: keyboard walkthrough (9/9), IME (6/6), the three-browser smoke test (13/13 in each), fast typing (0 of 24 trials dropped a key)
- **New `apps/web/e2e/editor-ui.mjs` (10/10, in CI):** block handle and menu, the slash menu from `+`, ⌘K and the link popover, code language, image size and alt, table rows, callout icon, and the title → body flow. Each check ends on what the server holds.
- **axe-core:** 0 violations on the page, block menu, slash menu, link popover, code block tools, shortcuts dialog and the phone toolbar. One contrast issue, in the block menu's shortcut hints, was found and fixed.
  - The whole-page scan flags a `target-size` issue on a link that stands alone on its line in the test document. Links within sentences are exempt from that rule.
- **Typing cost:** the new plugins add under 1 ms per keystroke at 100k words (`plugin-time.mjs`), and the CI latency gate is unchanged.

## Not done

- **Theme choice:** dark styles exist and were checked, but the app has no light/dark/system switch.
- **Real devices:** the phone toolbar was checked in Chromium's phone emulation, not on an iPhone or Android keyboard.
- **Image captions, figure numbering and cross-references:** Phase C Research spec.
- **Image resizing:** presets instead of drag handles. Tiptap's resizable image hides images that fail to load, and ignores later `src` changes such as rehosting.
- **Focus mode and typewriter scrolling:** Phase C Books spec.
- **Comments, presence and sharing:** not started.
