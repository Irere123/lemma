// Typing-latency benchmark for the editor core (the app's editor extensions
// and CSS, no backend): keydown to the next frame, 60 keys mid-document at
// 80 ms intervals, at 1k / 10k / 50k / 100k words. Build the page first with
// `bun run bench:build`.
//
// Fails when typing cost grows with document length (the Phase A failure:
// 31 ms at 1k words, 1,000 ms at 100k), or passes an absolute ceiling. CI
// machines vary, so the main check is the ratio between sizes.
import { createReadStream, existsSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { checks, launch, sleep } from './lib.mjs'

const ROOT = fileURLToPath(new URL('../dist-bench', import.meta.url))
const SIZES = (process.env.SIZES ?? '1000,10000,50000,100000').split(',').map(Number)
const KEYS = Number(process.env.KEYS ?? 60)
// Budgets (ms / ratio). The 16 ms goal is checked on real hardware, not in CI.
const MAX_GROWTH = Number(process.env.MAX_GROWTH ?? 4) // p50 at the largest size vs the smallest
// INJECT_REGRESSION=1 re-creates the Phase A bug (the whole document
// serialised on every keystroke), to show this benchmark catches it.
const INJECT = process.env.INJECT_REGRESSION === '1'
const MAX_P95 = Number(process.env.MAX_P95 ?? 250)
// The editor's own JS per keystroke (measured here: ~2.5 ms at 1k words,
// ~8 ms at 100k; with the Phase A bug re-created, 48 ms).
const MAX_JS = Number(process.env.MAX_JS ?? 20)
const MAX_JS_GROWTH = Number(process.env.MAX_JS_GROWTH ?? 6)

if (!existsSync(join(ROOT, 'index.html'))) {
  console.error('dist-bench is missing: run `bun run bench:build` in apps/web first')
  process.exit(1)
}

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.woff2': 'font/woff2',
}
const server = createServer((req, res) => {
  const path = new URL(req.url ?? '/', 'http://x').pathname
  const file = join(ROOT, path === '/' ? 'index.html' : path)
  if (!file.startsWith(ROOT) || !existsSync(file)) {
    res.statusCode = 404
    res.end()
    return
  }
  res.setHeader('content-type', TYPES[extname(file)] ?? 'application/octet-stream')
  createReadStream(file).pipe(res)
}).listen(0)
const port = server.address().port

const percentile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b)
  return (
    Math.round(sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] * 10) / 10
  )
}

const browser = await launch()
const results = []
for (const words of SIZES) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  // Building a 100k-word document takes a while on a slow runner; wait for the
  // editor itself rather than the page's load event.
  await page.goto(`http://localhost:${port}/?words=${words}`, {
    waitUntil: 'commit',
    timeout: 120_000,
  })
  await page.waitForFunction(() => window.__ready, null, { timeout: 300_000, polling: 500 })
  await sleep(1500)
  if (INJECT) {
    await page.evaluate(() => {
      const editor = window.__editor
      editor.on('update', () => {
        window.__serialized = editor.getHTML().length + JSON.stringify(editor.getJSON()).length
      })
    })
  }
  await page.evaluate(() => {
    const editor = window.__editor
    window.__latency = []
    window.__js = []
    // The editor's own synchronous work per keystroke: reading the DOM change
    // and dispatching it (ProseMirror, plugins, Yjs). Steadier than frame
    // timing, which also includes the browser's style, layout and paint.
    const observer = editor.view.domObserver
    const flush = observer.flush.bind(observer)
    observer.flush = () => {
      const start = performance.now()
      flush()
      const ms = performance.now() - start
      if (ms > 0.3) window.__js.push(ms)
    }
    document.addEventListener(
      'keydown',
      (event) => {
        const start = event.timeStamp
        requestAnimationFrame(() => {
          const channel = new MessageChannel()
          channel.port1.onmessage = () => window.__latency.push(performance.now() - start)
          channel.port2.postMessage(0)
        })
      },
      true
    )
    // Mid-document, inside a paragraph.
    let target = 1
    editor.state.doc.forEach((node, offset, index) => {
      if (target === 1 && index >= editor.state.doc.childCount / 2 && node.textContent.length > 40)
        target = offset + 11
    })
    editor.chain().setTextSelection(target).scrollIntoView().focus().run()
  })
  await sleep(300)
  // Warm-up, then the measured run.
  await page.keyboard.type('warm up ', { delay: 80 })
  await page.evaluate(() => {
    window.__latency = []
    window.__js = []
  })
  const text = 'the quick brown fox jumps over the lazy dog '.repeat(3).slice(0, KEYS)
  await page.keyboard.type(text, { delay: 80 })
  await sleep(200)
  const { latency, js } = await page.evaluate(() => ({
    latency: window.__latency,
    js: window.__js,
  }))
  const result = {
    words,
    p50: percentile(latency, 50),
    p95: percentile(latency, 95),
    jsP50: percentile(js, 50),
    keys: latency.length,
  }
  results.push(result)
  console.log(JSON.stringify(result))
  await page.close()
}
await browser.close()
server.close()

const { check, finish } = checks('latency')
const smallest = results[0]
const largest = results[results.length - 1]
const growth = largest.p50 / Math.max(smallest.p50, 1)
check(
  `typing cost doesn't grow with length: p50 ${smallest.words} → ${largest.words} words is ×${growth.toFixed(1)} (budget ×${MAX_GROWTH})`,
  growth <= MAX_GROWTH,
  { results }
)
const jsGrowth = largest.jsP50 / Math.max(smallest.jsP50, 0.5)
check(
  `editor JS per keystroke at ${largest.words} words is ${largest.jsP50} ms (budget ${MAX_JS} ms), ×${jsGrowth.toFixed(1)} the ${smallest.words}-word cost (budget ×${MAX_JS_GROWTH})`,
  largest.jsP50 <= MAX_JS && jsGrowth <= MAX_JS_GROWTH,
  { results }
)
for (const result of results) {
  check(
    `p95 at ${result.words} words is ${result.p95} ms (ceiling ${MAX_P95} ms)`,
    result.p95 <= MAX_P95,
    result
  )
}
finish()
