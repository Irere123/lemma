// Notes mode (Phase C): quick capture (also offline), [[ links that survive a
// rename, backlinks with context, today's note, note → post, search.
// Each check ends on what the server holds.
import {
  API,
  APP,
  checks,
  launch,
  newSignedInContext,
  openEditor,
  sleep,
  trpcMutation,
  trpcQuery,
  waitSaved,
} from './lib.mjs'

const { check, finish } = checks('notes')
const browser = await launch()
const context = await newSignedInContext(browser)
const page = await context.newPage()
const stamp = Date.now().toString(36)
const mod = process.platform === 'darwin' ? 'Meta' : 'Control'

const notes = async () =>
  (await trpcQuery(context, 'documents.getUserDocuments', { kinds: ['note'], limit: 100 }))
    .documents
const byTitle = async (title) => (await notes()).find((note) => note.title === title)

// N1: quick capture from anywhere, typing at once, no title needed.
await page.goto(`${APP}/app`, { waitUntil: 'networkidle' })
const opened = Date.now()
await page.keyboard.press(`${mod}+Alt+KeyN`)
const field = page.getByRole('textbox', { name: 'Note' })
await field.waitFor({ timeout: 5000 })
// Ready to type: the field is there and has the focus.
await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Note')
const typedWithin = Date.now() - opened
await page.keyboard.type(`Capture ${stamp}\nAn idea worth keeping.`)
await page.keyboard.press(`${mod}+Enter`)
let captured = null
for (let i = 0; i < 20 && !captured; i++) {
  captured = await byTitle(`Capture ${stamp}`)
  if (!captured) await sleep(250)
}
check(
  'quick capture: typing within a second, saved as a note with its first line as title',
  Boolean(captured) && typedWithin < 1000,
  {
    typedWithin,
    captured: captured?.id,
  }
)
if (captured) {
  const md = await trpcQuery(context, 'documents.getMarkdown', { id: captured.id })
  check('…and its body on the server', md.markdown.includes('An idea worth keeping.'), {
    markdown: md.markdown,
  })
}

// N1 offline: captured while offline, it reaches the server once back online.
await context.setOffline(true)
await page.keyboard.press(`${mod}+Alt+KeyN`)
await field.waitFor({ timeout: 5000 })
await page.keyboard.type(`Offline ${stamp}`)
await page.keyboard.press(`${mod}+Enter`)
await page
  .getByText('Saved on this device')
  .waitFor({ timeout: 5000 })
  .catch(() => {})
await sleep(500)
await context.setOffline(false)
await page.evaluate(() => window.dispatchEvent(new Event('online')))
let offline = null
for (let i = 0; i < 30 && !offline; i++) {
  offline = await byTitle(`Offline ${stamp}`)
  if (!offline) await sleep(300)
}
check('a note captured offline reaches the server when back online', Boolean(offline))

// N2: [[ links, creating the target; the link survives renaming it.
const source = await trpcMutation(context, 'documents.createDocument', {
  kind: 'note',
  title: `Source ${stamp}`,
})
await openEditor(page, source.id)
await sleep(800)
const body = page.locator('.ProseMirror')
await body.click()
await page.keyboard.type('See [[')
await page.getByRole('listbox', { name: 'Link to a document' }).waitFor({ timeout: 5000 })
await page.keyboard.type(`Target ${stamp}`)
await page
  .getByRole('option', { name: new RegExp(`New note “Target ${stamp}”`) })
  .waitFor({ timeout: 5000 })
await page.keyboard.press('Enter')
await page.keyboard.type('for more.')
await waitSaved(page)
await sleep(2500)
let target = null
for (let i = 0; i < 20 && !target; i++) {
  target = await byTitle(`Target ${stamp}`)
  if (!target) await sleep(250)
}
const sourceJson = await page.evaluate(() =>
  document.querySelector('.ProseMirror').editor.getJSON()
)
const link = JSON.stringify(sourceJson).includes(`"documentId":"${target?.id}"`)
check('[[ creates the note it links to, and the link holds its id', Boolean(target) && link, {
  target: target?.id,
})

// N3: backlinks with the sentence around the link.
let backlinks = null
for (let i = 0; i < 20; i++) {
  backlinks = await trpcQuery(context, 'notes.backlinks', { id: target.id })
  if (backlinks.links.length > 0) break
  await sleep(500)
}
check(
  'the target lists the source in “Linked from”, with its sentence',
  backlinks?.links.some((l) => l.sourceId === source.id && l.context.includes('for more')),
  { backlinks }
)

// Rename the target: the link still points at it, and shows the new title.
await trpcMutation(context, 'documents.upsertDocument', {
  id: target.id,
  title: `Renamed ${stamp}`,
})
await page.reload({ waitUntil: 'networkidle' })
await sleep(1500)
const label = await page
  .locator('.ProseMirror a[data-document-link]')
  .first()
  .getAttribute('data-label')
check('a renamed note keeps its links, which show the new title', label === `Renamed ${stamp}`, {
  label,
})

// The backlinks panel on the target, in the UI.
await openEditor(page, target.id)
await page
  .getByRole('region', { name: 'Links to this note' })
  .getByText(`Source ${stamp}`)
  .waitFor({ timeout: 8000 })
check('the backlinks panel shows the linking note', true)

// N6: today's note, one shortcut; asking again opens the same note.
await page.goto(`${APP}/app`, { waitUntil: 'networkidle' })
await page.keyboard.press(`${mod}+Alt+KeyD`)
await page.waitForURL(/\/write\//, { timeout: 8000 })
const firstDaily = page.url()
await page.goto(`${APP}/app`, { waitUntil: 'networkidle' })
await page.keyboard.press(`${mod}+Alt+KeyD`)
await page.waitForURL(/\/write\//, { timeout: 8000 })
check(
  'today’s note opens with one shortcut, and it’s the same note the second time',
  page.url() === firstDaily,
  {
    first: firstDaily,
    second: page.url(),
  }
)

// N7: turn a note into a post without copying it.
await openEditor(page, source.id)
await page.getByRole('button', { name: 'More actions' }).click()
await page.getByRole('menuitem', { name: 'Turn into a post' }).click()
await sleep(1000)
const after = await trpcQuery(context, 'documents.getDocumentById', { id: source.id })
check('a note becomes a post in place (same id, same text)', after?.kind === 'post', {
  kind: after?.kind,
})
await page.getByRole('button', { name: 'Publish' }).waitFor({ timeout: 5000 })
check('…and now shows publishing', true)

// N4: search finds a word written seconds ago.
const fresh = `zebracorn${stamp}`
const searchNote = await trpcMutation(context, 'documents.createDocument', {
  kind: 'note',
  title: `Search ${stamp}`,
})
await openEditor(page, searchNote.id)
await sleep(800)
await page.locator('.ProseMirror').click()
await page.keyboard.type(`The word ${fresh} is new.`)
await waitSaved(page)
const started = Date.now()
let found = []
for (let i = 0; i < 40 && found.length === 0; i++) {
  found = await trpcQuery(context, 'documents.searchDocuments', { query: fresh, limit: 5 })
  if (found.length === 0) await sleep(250)
}
check(
  'a note is searchable by a word typed seconds ago',
  found.some((hit) => hit.id === searchNote.id),
  {
    afterSave: Date.now() - started,
  }
)

finish()
await browser.close()
console.log(`API ${API}`)
