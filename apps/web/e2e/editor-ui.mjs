// The editor's interactive UI: block handle and menu, slash menu, links, block
// toolbars, title → body flow. Each check ends by reading what the server holds.
import {
  checks,
  createDoc,
  launch,
  newSignedInContext,
  openEditor,
  paragraph,
  sleep,
  trpcQuery,
  waitSaved,
} from './lib.mjs'

const { check, finish } = checks('editor-ui')
const editorJSON = (page) =>
  page.evaluate(() => document.querySelector('.ProseMirror').editor.getJSON())
const serverDoc = async (context, id) => {
  const revisions = await trpcQuery(context, 'documents.listRevisions', { id })
  return {
    markdown: (await trpcQuery(context, 'documents.getMarkdown', { id })).markdown,
    revisions,
  }
}
const blocks = (json) =>
  json.content.map(
    (node) => `${node.type}:${(node.content ?? []).map((c) => c.text ?? '').join('')}`
  )

async function hoverBlock(page, index) {
  const block = page.locator('.ProseMirror > *').nth(index)
  await block.scrollIntoViewIfNeeded()
  const box = await block.boundingBox()
  await page.mouse.move(box.x + 40, box.y + 8, { steps: 5 })
  await sleep(300)
}

const browser = await launch()
const context = await newSignedInContext(browser)
const page = await context.newPage()

// Block handle and menu.
{
  const doc = await createDoc(context, {
    title: 'Blocks',
    content: { type: 'doc', content: [paragraph('Alpha'), paragraph('Beta'), paragraph('Gamma')] },
  })
  await openEditor(page, doc.id)
  await sleep(800)
  await hoverBlock(page, 0)
  const grip = page.getByRole('button', { name: 'Drag to move, click for block actions' })
  check('hovering a block shows its handle', await grip.isVisible())

  await grip.click()
  await page.getByRole('menuitem', { name: 'Duplicate' }).click()
  await sleep(300)
  let json = await editorJSON(page)
  const ids = json.content.map((node) => node.attrs?.id)
  check(
    'Duplicate copies the block, with its own id',
    blocks(json).join() === 'paragraph:Alpha,paragraph:Alpha,paragraph:Beta,paragraph:Gamma' &&
      new Set(ids).size === ids.length,
    { blocks: blocks(json) }
  )

  await hoverBlock(page, 0)
  await grip.click()
  await page.getByRole('menuitem', { name: 'Move down' }).click()
  await sleep(200)
  await hoverBlock(page, 3)
  await grip.click()
  // Keyboard path into the submenu: the first item is Turn into; → opens it.
  await page.getByRole('menuitem', { name: 'Turn into' }).focus()
  await page.keyboard.press('ArrowRight')
  await page.getByRole('menuitem', { name: 'Heading 2' }).click()
  await sleep(200)
  await hoverBlock(page, 2)
  await grip.click()
  await page.getByRole('menuitem', { name: 'Delete' }).click()
  await sleep(300)
  json = await editorJSON(page)
  check(
    'Move down, Turn into and Delete',
    blocks(json).join() === 'paragraph:Alpha,paragraph:Alpha,heading:Gamma',
    { blocks: blocks(json) }
  )

  // + adds a block below and opens the slash menu.
  await hoverBlock(page, 0)
  await page.getByRole('button', { name: /Add a block below/ }).click()
  await page.locator('#slash-command').waitFor({ timeout: 5000 })
  const groups = await page.locator('[cmdk-group-heading]').allTextContents()
  check('+ opens the slash menu, grouped', groups.length >= 4, { groups })
  await page.keyboard.type('todo')
  await page.keyboard.press('Enter')
  await page.keyboard.type('A task')
  await waitSaved(page)
  const { markdown } = await serverDoc(context, doc.id)
  check(
    'the server has the result',
    markdown.includes('## Gamma') && markdown.includes('- [ ] A task'),
    { markdown }
  )
}

// Links: ⌘K, the link popover, unlink.
{
  const doc = await createDoc(context, {
    title: 'Links',
    content: { type: 'doc', content: [paragraph('Read the manual today.')] },
  })
  await openEditor(page, doc.id)
  await sleep(800)
  await page.evaluate(() => {
    const ed = document.querySelector('.ProseMirror').editor
    ed.commands.focus()
    ed.commands.setTextSelection({ from: 6, to: 16 })
  })
  await page.keyboard.press('Control+k')
  const field = page
    .getByPlaceholder(/paste a link/i)
    .or(page.locator('input[placeholder*="link" i]'))
  await field.first().waitFor({ timeout: 5000 })
  await page.keyboard.type('example.org/manual')
  await page.keyboard.press('Enter')
  await sleep(300)
  await page.locator('.ProseMirror a').click()
  const bubble = page.locator('.link-bubble')
  await bubble.waitFor({ timeout: 5000 })
  check(
    '⌘K links the selection; the popover shows where it goes',
    (await bubble.textContent())?.includes('example.org/manual')
  )
  await page.getByRole('button', { name: 'Remove link' }).click()
  await waitSaved(page)
  const { markdown } = await serverDoc(context, doc.id)
  check(
    'Unlink removes it on the server too',
    !markdown.includes('](') && markdown.includes('the manual'),
    { markdown }
  )
}

// Code language, image size, table rows, callout icon.
{
  const png =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=='
  const doc = await createDoc(context, {
    title: 'Blocks 2',
    content: {
      type: 'doc',
      content: [
        {
          type: 'codeBlock',
          attrs: { language: null },
          content: [{ type: 'text', text: 'x = 1' }],
        },
        { type: 'image', attrs: { src: png, alt: null } },
        {
          type: 'table',
          content: [
            { type: 'tableRow', content: [{ type: 'tableHeader', content: [paragraph('H')] }] },
            { type: 'tableRow', content: [{ type: 'tableCell', content: [paragraph('c')] }] },
          ],
        },
        { type: 'callout', attrs: { emoji: '💡' }, content: [paragraph('Note.')] },
        paragraph('End.'),
      ],
    },
  })
  await openEditor(page, doc.id)
  await sleep(800)
  await page.locator('.ProseMirror .code-block').hover()
  await page.getByLabel('Code language').selectOption('python')
  await sleep(200)

  await page.evaluate(() => {
    const ed = document.querySelector('.ProseMirror').editor
    let at = null
    ed.state.doc.descendants((node, pos) => {
      if (at === null && node.type.name === 'image') at = pos
    })
    ed.commands.focus()
    ed.commands.setNodeSelection(at)
  })
  await page.getByRole('button', { name: 'Medium' }).click()
  await page.getByRole('button', { name: 'Add alt text' }).click()
  await page.keyboard.type('A single pixel')
  await page.keyboard.press('Enter')
  await sleep(200)

  await page.evaluate(() => {
    const ed = document.querySelector('.ProseMirror').editor
    let at = null
    ed.state.doc.descendants((node, pos) => {
      if (at === null && node.isText && node.text === 'c') at = pos + 1
    })
    ed.commands.focus()
    ed.commands.setTextSelection(at)
  })
  await page.getByRole('button', { name: 'Insert row below' }).click()
  await sleep(200)

  await page.locator('.ProseMirror button.callout-icon').click()
  await page.getByRole('option', { name: '⚠️' }).click()
  await waitSaved(page)
  await sleep(300)
  const json = await editorJSON(page)
  const find = (type) => json.content.find((node) => node.type === type)
  check(
    'code language, image size and alt, a new table row, the callout icon',
    find('codeBlock')?.attrs.language === 'python' &&
      find('image')?.attrs.width === 440 &&
      find('image')?.attrs.alt === 'A single pixel' &&
      find('table')?.content.length === 3 &&
      find('callout')?.attrs.emoji === '⚠️',
    {
      code: find('codeBlock')?.attrs,
      image: { width: find('image')?.attrs.width, alt: find('image')?.attrs.alt },
      rows: find('table')?.content.length,
      emoji: find('callout')?.attrs.emoji,
    }
  )
  const { markdown } = await serverDoc(context, doc.id)
  check(
    '...and the server has them',
    markdown.includes('```python') && markdown.includes('A single pixel') && markdown.includes('⚠️'),
    { markdown: markdown.slice(0, 300) }
  )
}

// Title → subtitle → body with the keyboard.
{
  const doc = await createDoc(context, {
    title: '',
    content: { type: 'doc', content: [paragraph('')] },
  })
  await openEditor(page, doc.id)
  await sleep(800)
  await page.getByLabel('Document title').click()
  await page.keyboard.type('A title')
  await page.keyboard.press('Enter')
  await page.keyboard.type('A subtitle')
  await page.keyboard.press('Enter')
  await page.keyboard.type('The body.')
  await page.keyboard.press('ArrowUp')
  const focus = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))
  await waitSaved(page)
  // Title and subtitle reach the documents list when the room flushes (~2 s).
  let meta = null
  for (let i = 0; i < 20; i++) {
    meta = await trpcQuery(context, 'documents.getDocumentById', { id: doc.id })
    if (meta.title) break
    await sleep(500)
  }
  const { markdown } = await serverDoc(context, doc.id)
  check(
    'Enter moves title → subtitle → body; ↑ goes back',
    meta.title === 'A title' &&
      meta.subtitle === 'A subtitle' &&
      markdown.trim() === 'The body.' &&
      focus === 'Document subtitle',
    { title: meta.title, subtitle: meta.subtitle, markdown, focus }
  )
}

finish()
await browser.close()
