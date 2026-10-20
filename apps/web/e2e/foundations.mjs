// Phase B foundations: block ids, the schema-version gate, one undo history
// for title/subtitle/body, and revision history (capture, preview, restore,
// publish, owner-only). Truth is the server.
import {
  API,
  APP,
  checks,
  createDoc,
  launch,
  newSignedInContext,
  openEditor,
  paragraph,
  serverText,
  sleep,
  trpcMutation,
  trpcQuery,
  waitSaved,
} from './lib.mjs'

const { check, finish } = checks('foundations')
const blockIds = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('.ProseMirror [data-id]')].map((el) => el.getAttribute('data-id'))
  )
const para = paragraph
const sentence = (i) =>
  `Paragraph ${i} has enough words in it to make deleting the lot a large edit for history purposes.`

const browser = await launch()
const ctx = await newSignedInContext(browser)

// 1. Block ids ------------------------------------------------------------
{
  const doc = await createDoc(ctx, {
    title: 'ids',
    content: { type: 'doc', content: [para('one'), para('two')] },
  })
  const page = await ctx.newPage()
  await openEditor(page, doc.id)
  await sleep(800)
  let ids = await blockIds(page)
  check(
    'every block has an id on open',
    ids.length === 2 && ids.every((id) => /^[a-z][a-z0-9]{9}$/.test(id)),
    { ids }
  )
  const before = ids
  // Split a paragraph in the middle, and add a new one at the end.
  await page.evaluate(() => document.querySelector('.ProseMirror').editor.commands.focus(3))
  await page.keyboard.press('Enter')
  await page.evaluate(() => document.querySelector('.ProseMirror').editor.commands.focus('end'))
  await page.keyboard.press('Enter')
  await page.keyboard.type('three')
  await waitSaved(page)
  ids = await blockIds(page)
  check(
    'split and new blocks get new, unique ids; the others keep theirs',
    ids.length === 4 && new Set(ids).size === 4 && ids.includes(before[1]),
    { before, ids }
  )
  // Copy a block and paste it: the copy must not share the original's id.
  await page.evaluate(() => {
    const ed = document.querySelector('.ProseMirror').editor
    ed.commands.setTextSelection({ from: 1, to: ed.state.doc.firstChild.nodeSize - 1 })
  })
  await page.keyboard.press('Control+c')
  await page.evaluate(() => document.querySelector('.ProseMirror').editor.commands.focus('end'))
  await page.keyboard.press('Enter')
  await page.keyboard.press('Control+v')
  await waitSaved(page)
  ids = await blockIds(page)
  check('pasted blocks get fresh ids', new Set(ids).size === ids.length, { ids })
  await page.close()
}

// 2. Schema-version gate -------------------------------------------------------
{
  const doc = await createDoc(ctx, {
    title: 'gate',
    content: { type: 'doc', content: [para('gate')] },
  })
  const page = await ctx.newPage()
  await page.goto(`${APP}/app`)
  const codes = await page.evaluate(
    async ({ api, id }) => {
      const url = (v) => `${api.replace('http', 'ws')}/realtime/documents/${id}?schema=${v}`
      const closeCode = (v) =>
        new Promise((resolve) => {
          const ws = new WebSocket(url(v))
          ws.binaryType = 'arraybuffer'
          let opened = false
          ws.onopen = () => {
            opened = true
          }
          ws.onclose = (e) => resolve({ v, code: e.code, opened })
          setTimeout(() => {
            resolve({ v, code: 'still open', opened })
            ws.close()
          }, 3000)
        })
      return Promise.all([closeCode(0), closeCode(1), closeCode(99)])
    },
    { api: API, id: doc.id }
  )
  check('an editor older than the document is turned away (4426)', codes[0].code === 4426, {
    codes,
  })
  check('a current editor connects', codes[1].code === 'still open', { codes })
  check('an editor newer than the server is told to retry (4503)', codes[2].code === 4503, {
    codes,
  })

  // The UI: a page told it's outdated shows the banner and stops editing.
  // (a) Never opened on this device: banner, no editor.
  await page.routeWebSocket(/\/realtime\/documents\//, (ws) =>
    ws.close({ code: 4426, reason: 'outdated' })
  )
  await page.goto(`${APP}/write/${doc.id}`)
  await sleep(2500)
  let banner = await page.getByRole('alert').filter({ hasText: 'Reload to keep editing' }).count()
  const editor = await page.locator('.ProseMirror').count()
  check(
    'outdated page with no local copy: reload banner, no editor',
    banner === 1 && editor === 0,
    { banner, editor }
  )
  await page.close()
  // (b) Opened here before: the local copy shows, read-only, with the banner.
  const fresh = await ctx.newPage()
  await openEditor(fresh, doc.id)
  await sleep(1000)
  await fresh.routeWebSocket(/\/realtime\/documents\//, (ws) =>
    ws.close({ code: 4426, reason: 'outdated' })
  )
  await fresh.reload()
  await fresh.locator('.ProseMirror').waitFor({ timeout: 15_000 })
  await sleep(1000)
  banner = await fresh.getByRole('alert').filter({ hasText: 'Reload to keep editing' }).count()
  const editable = await fresh.evaluate(() =>
    document.querySelector('.ProseMirror')?.getAttribute('contenteditable')
  )
  const text = await fresh.evaluate(() => document.querySelector('.ProseMirror')?.textContent)
  check(
    'outdated page with a local copy: shown read-only with the banner',
    banner === 1 && editable === 'false' && text === 'gate',
    { banner, editable, text }
  )
  await fresh.close()
}

// 3. One undo history ------------------------------------------------------------
{
  const doc = await createDoc(ctx, {
    title: '',
    content: { type: 'doc', content: [para('Body.')] },
  })
  const page = await ctx.newPage()
  await openEditor(page, doc.id)
  await sleep(800)
  const title = page.getByLabel('Document title')
  await title.click()
  await page.keyboard.type('Hello', { delay: 20 })
  await sleep(700) // separate undo steps
  await page.evaluate(() => document.querySelector('.ProseMirror').editor.commands.focus('end'))
  await page.keyboard.type(' World', { delay: 20 })
  await sleep(700)
  const body = () => page.evaluate(() => document.querySelector('.ProseMirror').textContent)
  const afterTyping = { title: await title.inputValue(), body: await body() }
  await page.keyboard.press('Control+z')
  const afterUndo1 = { title: await title.inputValue(), body: await body() }
  await page.keyboard.press('Control+z')
  await sleep(100)
  const afterUndo2 = {
    title: await title.inputValue(),
    body: await body(),
    focus: await page.evaluate(() => document.activeElement?.getAttribute('aria-label')),
  }
  await page.keyboard.press('Control+Shift+z')
  const afterRedo = { title: await title.inputValue(), body: await body() }
  check(
    'undo steps back through body then title, moving the caret; redo from the title works',
    afterTyping.title === 'Hello' &&
      afterUndo1.body === 'Body.' &&
      afterUndo1.title === 'Hello' &&
      afterUndo2.title === '' &&
      afterUndo2.focus === 'Document title' &&
      afterRedo.title === 'Hello',
    { afterTyping, afterUndo1, afterUndo2, afterRedo }
  )
  await page.close()
}

// 4. Revision history ------------------------------------------------------------
{
  const content = {
    type: 'doc',
    content: Array.from({ length: 30 }, (_, i) => para(sentence(i + 1))),
  }
  const doc = await createDoc(ctx, { title: 'history', content })
  const page = await ctx.newPage()
  await openEditor(page, doc.id)
  await sleep(800)
  const original = await serverText(ctx, doc.id)

  // Select everything in the body and delete it, then type a line.
  await page.evaluate(() => document.querySelector('.ProseMirror').editor.commands.focus())
  await page.keyboard.press('Control+a')
  await page.keyboard.press('Delete')
  await page.keyboard.type('Oops.')
  await waitSaved(page)
  await sleep(500)
  let revisions = await trpcQuery(ctx, 'documents.listRevisions', { id: doc.id })
  const before = revisions.find((r) => r.reason === 'before-large-edit')
  check('a large deletion keeps the version before it', Boolean(before) && before.words > 400, {
    revisions,
  })

  if (before) {
    const preview = await trpcQuery(ctx, 'documents.getRevision', {
      id: doc.id,
      revisionId: before.id,
    })
    check(
      'the preview renders that version, with block ids, and counts what changed since',
      preview.html.includes('Paragraph 30') &&
        preview.changes.removed.length >= 29 &&
        /<p id="[a-z][a-z0-9]{9}"/.test(preview.html),
      {
        changes: {
          added: preview.changes.added.length,
          removed: preview.changes.removed.length,
          changed: preview.changes.changed.length,
        },
        htmlHasIds: /<p id="[a-z][a-z0-9]{9}"/.test(preview.html),
      }
    )
    // Restore through the UI.
    await page.getByRole('button', { name: 'Version history' }).click()
    await page
      .getByRole('navigation', { name: 'Versions' })
      .getByText('Before a large deletion')
      .first()
      .click()
    await page.getByText('Paragraph 30').first().waitFor({ timeout: 10_000 })
    await page.getByRole('button', { name: 'Restore this version' }).click()
    await page.waitForFunction(
      () => document.querySelector('.ProseMirror')?.textContent.includes('Paragraph 30'),
      null,
      { timeout: 15_000 }
    )
    await waitSaved(page)
    const restored = await serverText(ctx, doc.id)
    revisions = await trpcQuery(ctx, 'documents.listRevisions', { id: doc.id })
    check(
      'restore brings it back in the open editor and on the server, keeping what it replaced',
      restored === original && revisions.some((r) => r.reason === 'before-restore'),
      {
        same: restored === original,
        reasons: revisions.map((r) => r.reason),
      }
    )
  }

  // Publishing keeps that version.
  await trpcMutation(ctx, 'documents.upsertDocument', { id: doc.id, status: 'PUBLISHED' })
  revisions = await trpcQuery(ctx, 'documents.listRevisions', { id: doc.id })
  check('publishing keeps the published version', revisions[0]?.reason === 'publish', {
    reasons: revisions.map((r) => r.reason),
  })

  // Someone else can't read another writer's history.
  const other = await browser.newContext()
  const res = await other.request.get(
    `${API}/trpc/documents.listRevisions?input=${encodeURIComponent(JSON.stringify({ id: doc.id }))}`
  )
  check('history needs the owner', res.status() === 401 || res.status() === 404, {
    status: res.status(),
  })
  await other.close()
  await page.close()
}

finish()
await browser.close()
