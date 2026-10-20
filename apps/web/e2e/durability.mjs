// Chaos test: two tabs, slow and lost network frames, offline, crashes and
// closing mid-save must end with zero lost characters on the server.
// Network trouble is simulated on the document's WebSocket (routeWebSocket).
import {
  checks,
  createDoc,
  launch,
  newSignedInContext,
  openEditor,
  paragraph,
  saveState,
  serverText,
  sleep,
  trpcQuery,
  typeAtEnd,
  waitSaved,
} from './lib.mjs'

const BASE = 'BASE paragraph.'
const base = { type: 'doc', content: [paragraph(BASE)] }
const { check, finish } = checks('durability')

/** Control a page's document socket: mode 'online' | 'offline' | 'slow' | 'drop-first'. */
async function controlSocket(page, state) {
  await page.routeWebSocket(/\/realtime\/documents\//, (ws) => {
    if (state.mode === 'offline') {
      ws.close({ code: 1006, reason: 'offline' })
      return
    }
    const server = ws.connectToServer()
    state.sockets.push({ ws, server })
    let dropped = false
    ws.onMessage((message) => {
      if (state.mode === 'offline') return
      const bytes = typeof message === 'string' ? null : message
      // y-protocols sync update (0, 2): drop the first one the server would get.
      if (state.mode === 'drop-first' && bytes && bytes[0] === 0 && bytes[1] === 2 && !dropped) {
        dropped = true
        state.dropped = (state.dropped ?? 0) + 1
        return
      }
      if (state.mode === 'slow') setTimeout(() => server.send(message), state.delayMs ?? 4000)
      else server.send(message)
    })
    server.onMessage((message) => {
      if (state.mode !== 'offline') ws.send(message)
    })
    ws.onClose(() => server.close())
    server.onClose(() => ws.close())
  })
}

function goOffline(state) {
  state.mode = 'offline'
  for (const { ws, server } of state.sockets.splice(0)) {
    ws.close({ code: 1006, reason: 'offline' })
    server.close()
  }
}

async function reopenAndRead(context, id) {
  const page = await context.newPage()
  await openEditor(page, id)
  await waitSaved(page)
  await sleep(500)
  const text = await serverText(context, id)
  await page.close()
  return text
}

const browser = await launch()
const context = await newSignedInContext(browser)

// Opening a document without editing writes nothing.
{
  const doc = await createDoc(context, { title: 'Open no edit', content: base })
  const before = await trpcQuery(context, 'documents.getDocumentById', { id: doc.id })
  const page = await context.newPage()
  await openEditor(page, doc.id)
  await sleep(4000)
  const after = await trpcQuery(context, 'documents.getDocumentById', { id: doc.id })
  check('opening without editing writes nothing', before.updatedAt === after.updatedAt, {
    before: before.updatedAt,
    after: after.updatedAt,
  })
  await page.close()
}

// Two tabs edit the same document.
{
  const doc = await createDoc(context, { title: 'Two tabs', content: base })
  const a = await context.newPage()
  const b = await context.newPage()
  await openEditor(a, doc.id)
  await openEditor(b, doc.id)
  await typeAtEnd(a, ' AAA')
  await sleep(600)
  await typeAtEnd(b, ' BBB')
  await sleep(600)
  await typeAtEnd(a, ' CCC')
  await waitSaved(a)
  await waitSaved(b)
  await sleep(500)
  const server = await serverText(context, doc.id)
  const tabs = [
    await a.locator('.ProseMirror').innerText(),
    await b.locator('.ProseMirror').innerText(),
  ]
  check(
    'two tabs: every edit reaches the server and both tabs',
    ['AAA', 'BBB', 'CCC'].every((t) => server.includes(t) && tabs.every((tab) => tab.includes(t))),
    { server, tabs }
  )
  await a.close()
  await b.close()
}

// A slow uplink (4 s) in one tab while another tab edits.
{
  const doc = await createDoc(context, { title: 'Slow uplink', content: base })
  const slow = await context.newPage()
  const state = { mode: 'online', sockets: [] }
  await controlSocket(slow, state)
  await openEditor(slow, doc.id)
  await waitSaved(slow)
  const fast = await context.newPage()
  await openEditor(fast, doc.id)
  state.mode = 'slow'
  state.delayMs = 4000
  await typeAtEnd(slow, ' ONE')
  const stateWhileDelayed = await saveState(slow)
  await sleep(300)
  await typeAtEnd(fast, ' TWO')
  await waitSaved(fast)
  await waitSaved(slow, 20_000)
  await sleep(800)
  const server = await serverText(context, doc.id)
  check('slow uplink: both edits kept', server.includes('ONE') && server.includes('TWO'), {
    server,
  })
  check('slow uplink: not shown as saved before the server has it', stateWhileDelayed !== 'saved', {
    stateWhileDelayed,
  })
  await slow.close()
  await fast.close()
}

// Offline, keep typing, close the tab; reopen online.
{
  const doc = await createDoc(context, { title: 'Offline then closed', content: base })
  const page = await context.newPage()
  const state = { mode: 'online', sockets: [] }
  await controlSocket(page, state)
  await openEditor(page, doc.id)
  await waitSaved(page)
  goOffline(state)
  await sleep(500)
  await typeAtEnd(page, ' OFFLINE-EDIT')
  await sleep(400)
  const shown = await saveState(page)
  await page.close({ runBeforeUnload: false })
  const server = await reopenAndRead(context, doc.id)
  check(
    'offline then closed: kept on the device, synced on reopen',
    server.includes('OFFLINE-EDIT'),
    {
      shown,
      server,
    }
  )
  check('offline: says so', shown === 'offline', { shown })
}

// The tab crashes right after typing, offline (only the device copy can save it).
for (const waitMs of [120, 0]) {
  const doc = await createDoc(context, { title: `Crash ${waitMs}`, content: base })
  const page = await context.newPage()
  const state = { mode: 'online', sockets: [] }
  await controlSocket(page, state)
  await openEditor(page, doc.id)
  await waitSaved(page)
  goOffline(state)
  await typeAtEnd(page, ' CRASH-EDIT')
  await sleep(waitMs)
  const cdp = await context.newCDPSession(page)
  // Page.crash never answers (the renderer is gone), so don't wait on it.
  void cdp.send('Page.crash').catch(() => {})
  await sleep(1000)
  await Promise.race([page.close().catch(() => {}), sleep(3000)])
  const server = await reopenAndRead(context, doc.id)
  check(
    `tab crashed ${waitMs} ms after typing: restored from the device`,
    server.includes('CRASH-EDIT'),
    {
      server,
    }
  )
}

// Slow save, tab closed while it's in flight.
{
  const doc = await createDoc(context, { title: 'Close during slow save', content: base })
  const page = await context.newPage()
  const state = { mode: 'online', sockets: [] }
  await controlSocket(page, state)
  await openEditor(page, doc.id)
  await waitSaved(page)
  state.mode = 'slow'
  state.delayMs = 3000
  await typeAtEnd(page, ' SLOW-EDIT')
  let prompted = false
  page.on('dialog', async (dialog) => {
    prompted = dialog.type() === 'beforeunload'
    await dialog.accept()
  })
  await sleep(300)
  await page.close({ runBeforeUnload: true })
  await sleep(500)
  const server = await reopenAndRead(context, doc.id)
  check(
    'closed during a slow save: warned, then restored and synced',
    prompted && server.includes('SLOW-EDIT'),
    {
      prompted,
      server,
    }
  )
}

// One update never reaches the server.
{
  const doc = await createDoc(context, { title: 'Dropped update', content: base })
  const page = await context.newPage()
  const state = { mode: 'online', sockets: [] }
  await controlSocket(page, state)
  await openEditor(page, doc.id)
  await waitSaved(page)
  state.mode = 'drop-first'
  await typeAtEnd(page, ' X')
  await sleep(1500)
  const during = await saveState(page)
  await waitSaved(page, 40_000).catch(() => {})
  await sleep(500)
  const server = await serverText(context, doc.id)
  check('an update lost in transit is resent', server.includes('X') && state.dropped === 1, {
    dropped: state.dropped,
    server,
  })
  check('...and the editor never claimed it was saved meanwhile', during !== 'saved', { during })
  await page.close()
}

finish()
await browser.close()
