// Books mode (Phase C): chapters and parts, reordering by keyboard, word
// targets, ⌘P, split / merge / move a scene, find & replace across the book
// (with undo), focus mode, EPUB and DOCX export, serial publishing with a
// public book page. Each check ends on what the server holds.
import {
  APP,
  checks,
  launch,
  newSignedInContext,
  openEditor,
  paragraph,
  sleep,
  trpcMutation,
  trpcQuery,
  WRITER,
} from './lib.mjs'

const { check, finish } = checks('books')
const browser = await launch()
const context = await newSignedInContext(browser)
const page = await context.newPage()
await page.setViewportSize({ width: 1440, height: 900 })
const stamp = Date.now().toString(36)
const mod = process.platform === 'darwin' ? 'Meta' : 'Control'

const outline = async (bookId) => (await trpcQuery(context, 'books.get', { bookId })).entries
const chapterText = async (id) =>
  (await trpcQuery(context, 'documents.getMarkdown', { id })).markdown
const fill = (id, title, texts) =>
  trpcMutation(context, 'documents.upsertDocument', {
    id,
    title,
    content: { type: 'doc', content: texts.map((text) => paragraph(text)) },
  })

// B1: a book with chapters and a part.
const { book, firstChapter } = await trpcMutation(context, 'books.create', {
  title: `Novel ${stamp}`,
})
const one = firstChapter
const two = await trpcMutation(context, 'books.addEntry', {
  bookId: book.id,
  kind: 'chapter',
  title: 'Two',
})
const three = await trpcMutation(context, 'books.addEntry', {
  bookId: book.id,
  kind: 'chapter',
  title: 'Three',
})
await fill(one.id, 'One', [
  'The lighthouse keeper woke early.',
  'The storm had passed in the night.',
])
await fill(two.id, 'Two', ['Morning came grey over the harbour.', 'A boat was missing.'])
await fill(three.id, 'Three', ['Nobody saw the lighthouse go dark.'])

await page.goto(`${APP}/app/books/${book.id}`, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'Part', exact: true }).click()
await sleep(800)
let entries = await outline(book.id)
check(
  'a book has chapters, and a part in one action',
  entries.filter((e) => e.kind === 'chapter').length === 3 &&
    entries.some((e) => e.kind === 'part'),
  {
    entries: entries.map((e) => `${e.kind}:${e.title}`),
  }
)

// Reorder by keyboard: focus chapter Three, Alt+↑ twice → before One.
await page.reload({ waitUntil: 'networkidle' })
const row = page.getByRole('button', { name: /Move Three/ })
await row.focus()
await page.keyboard.press('Alt+ArrowUp')
await sleep(300)
await page.keyboard.press('Alt+ArrowUp')
await sleep(1200)
entries = await outline(book.id)
const chapterOrder = entries.filter((e) => e.kind === 'chapter').map((e) => e.title)
check(
  'reordering by keyboard reorders the book on the server',
  chapterOrder.join() === 'Three,One,Two',
  { chapterOrder }
)
check(
  '…and loses no text',
  (await chapterText(three.id)).includes('Nobody saw the lighthouse go dark.')
)

// B3: words per chapter and in total; a target with progress.
await page.reload({ waitUntil: 'networkidle' })
const totals = await page.getByText(/3 chapters · \d+ words/).textContent()
await page.getByRole('button', { name: 'Set a word target' }).click()
await page.getByRole('textbox', { name: 'Words' }).fill('100')
await page.getByRole('button', { name: 'Save' }).click()
await sleep(800)
const progress = await page
  .getByRole('progressbar', { name: /target/ })
  .getAttribute('aria-valuenow')
check(
  'the book shows words and progress to its target',
  /3 chapters · 2\d words/.test(totals ?? '') && Number(progress) > 0,
  {
    totals,
    progress,
  }
)

// B2: ⌘P jumps to any chapter.
await openEditor(page, one.id)
await sleep(800)
await page.locator('.ProseMirror').click()
await page.keyboard.press(`${mod}+KeyP`)
await page.getByPlaceholder('Go to a heading, chapter or document…').waitFor({ timeout: 5000 })
await page.keyboard.type('Two')
await page.keyboard.press('Enter')
await page.waitForURL(new RegExp(`/write/${two.id}`), { timeout: 5000 })
check('⌘P goes to another chapter by name', page.url().includes(two.id))

// The chapter sidebar lists the book and shows the current chapter.
const sidebar = page.getByRole('complementary', { name: 'Book' })
check(
  'a chapter opens beside its book’s outline',
  await sidebar.getByRole('link', { name: /Two/ }).isVisible()
)

// B5: split a chapter at a block.
await sleep(800)
const second = page.locator('.ProseMirror > p').nth(1)
const box = await second.boundingBox()
await page.mouse.move(box.x + 40, box.y + 8, { steps: 5 })
await sleep(300)
await page.getByRole('button', { name: 'Drag to move, click for block actions' }).click()
await page.getByRole('menuitem', { name: 'Split chapter here' }).click()
await sleep(2500)
entries = await outline(book.id)
const split = entries.find((e) => e.kind === 'chapter' && e.title === 'Two (continued)')
check(
  'split: the rest of the chapter becomes the next chapter, nothing lost or doubled',
  Boolean(split) &&
    (await chapterText(two.id)).trim() === 'Morning came grey over the harbour.' &&
    (await chapterText(split.id)).trim() === 'A boat was missing.',
  { entries: entries.map((e) => e.title) }
)

// B5: merge it back.
await page.getByRole('button', { name: 'More actions' }).click()
await page.getByRole('menuitem', { name: 'Merge with next chapter' }).click()
await sleep(2500)
const merged = await chapterText(two.id)
entries = await outline(book.id)
check(
  'merge: the next chapter joins this one and goes away',
  merged.includes('Morning came grey') &&
    merged.includes('A boat was missing.') &&
    !entries.some((e) => e.id === split.id),
  { merged }
)

// B5: move a scene (a block) to another chapter.
await page.reload({ waitUntil: 'networkidle' })
await sleep(1200)
const first = page.locator('.ProseMirror > p').first()
const firstBox = await first.boundingBox()
await page.mouse.move(firstBox.x + 40, firstBox.y + 8, { steps: 5 })
await sleep(300)
await page.getByRole('button', { name: 'Drag to move, click for block actions' }).click()
await page.getByRole('menuitem', { name: 'Move to chapter' }).focus()
await page.keyboard.press('ArrowRight')
await page.getByRole('menuitem', { name: 'Three' }).click()
await sleep(2500)
check(
  'move a scene: the block leaves this chapter and ends the other',
  !(await chapterText(two.id)).includes('Morning came grey') &&
    (await chapterText(three.id)).trim().endsWith('Morning came grey over the harbour.')
)

// B4: find & replace across the whole book, in one action, undoable.
await page.goto(`${APP}/app/books/${book.id}`, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'Find and replace' }).click()
await page.getByRole('textbox', { name: 'Find', exact: true }).fill('lighthouse')
await page.getByRole('textbox', { name: 'Replace with' }).fill('beacon')
await page.getByText(/2 matches in 2 chapters/).waitFor({ timeout: 8000 })
await page.getByRole('button', { name: 'Replace all' }).click()
await page.getByText(/Replaced 2 matches in 2 chapters/).waitFor({ timeout: 8000 })
const replaced = (await chapterText(one.id)) + (await chapterText(three.id))
check(
  'replace all changes every chapter',
  !replaced.includes('lighthouse') && (replaced.match(/beacon/g) ?? []).length === 2
)
await page.getByRole('button', { name: 'Undo' }).click()
await page.getByText(/Restored 2 chapters/).waitFor({ timeout: 8000 })
const restored = (await chapterText(one.id)) + (await chapterText(three.id))
check(
  '…and Undo puts the whole book back',
  !restored.includes('beacon') && (restored.match(/lighthouse/g) ?? []).length === 2
)
await page.keyboard.press('Escape')

// B6: focus mode on and off with one shortcut.
await openEditor(page, one.id)
await sleep(800)
await page.locator('.ProseMirror').click()
await page.keyboard.press(`${mod}+Shift+KeyF`)
const focusOn = await page.locator('.writer-editor.is-focus-mode').count()
// The bar fades out over 0.3 s.
await page
  .waitForFunction(
    () => Number(getComputedStyle(document.querySelector('.editor-top-bar')).opacity) < 0.5,
    null,
    { timeout: 3000 }
  )
  .catch(() => {})
const barOpacity = await page
  .locator('.editor-top-bar')
  .evaluate((el) => getComputedStyle(el).opacity)
await page.keyboard.press(`${mod}+Shift+KeyF`)
const focusOff = await page.locator('.writer-editor.is-focus-mode').count()
check(
  'focus mode: one shortcut hides the chrome, the same one brings it back',
  focusOn === 1 && Number(barOpacity) < 0.5 && focusOff === 0,
  {
    focusOn,
    barOpacity,
  }
)

// B7: export the manuscript.
await page.goto(`${APP}/app/books/${book.id}`, { waitUntil: 'networkidle' })
const exportAs = async (item) => {
  await page.getByRole('button', { name: 'Export' }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: item }).click()
  const file = await download
  const path = await file.path()
  const { readFileSync } = await import('node:fs')
  return { name: file.suggestedFilename(), bytes: readFileSync(path) }
}
const epub = await exportAs(/EPUB/)
const docx = await exportAs(/Word manuscript/)
check(
  'EPUB and Word exports download as valid packages',
  epub.name.endsWith('.epub') &&
    epub.bytes.subarray(30, 58).toString() === 'mimetypeapplication/epub+zip' &&
    docx.name.endsWith('.docx') &&
    docx.bytes.includes(Buffer.from('word/document.xml')),
  { epub: epub.name, docx: docx.name }
)

// B8: publish chapters one at a time; a public book page; previous/next.
for (const id of [three.id, one.id]) {
  await trpcMutation(context, 'documents.upsertDocument', { id, status: 'PUBLISHED' })
}
await trpcMutation(context, 'books.update', { bookId: book.id, status: 'PUBLISHED' })
const bookInfo = (await trpcQuery(context, 'books.get', { bookId: book.id })).book
const username = WRITER.username
const publicBook = await trpcQuery(context, 'books.getPublished', { username, slug: bookInfo.slug })
check(
  'the public book page lists only published chapters, in order',
  publicBook?.entries
    .filter((e) => e.kind === 'chapter')
    .map((e) => e.title)
    .join() === 'Three,One',
  { entries: publicBook?.entries.map((e) => e.title) }
)
const twoAfter = await trpcQuery(context, 'documents.getDocumentById', { id: two.id })
check('publishing chapters never touches the unpublished ones', twoAfter.status === 'DRAFT')
await page.goto(`${APP}/u/${username}/b/${bookInfo.slug}`, { waitUntil: 'networkidle' })
await page.getByRole('link', { name: 'Start reading' }).click()
await page.getByText(/Chapter 1 ·/).waitFor({ timeout: 8000 })
const next = await page
  .getByRole('navigation', { name: 'Chapters' })
  .getByText('Next chapter →')
  .isVisible()
check('a published chapter reads as part of its book, with a link to the next', next)

finish()
await browser.close()
