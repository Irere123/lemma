// Replays the Phase A corpus in headless Chromium, the engine Phase A measured
// with, and prints before/after tables for test/PASTE-RESULTS.md:
//
//   bun test/paste-chromium.ts [out.json]
//
// Needs the study checkout (corpus + Playwright's Chromium). Not part of `bun test`.

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { CORPUS_ROOT, loadCorpus } from './paste-corpus'

const STUDY = join(CORPUS_ROOT, '..')
const playwrightPath = join(STUDY, 'node_modules/playwright/index.mjs')
if (!existsSync(playwrightPath)) {
  console.log(`skipped: no Playwright at ${playwrightPath}`)
  process.exit(0)
}
const { chromium } = await import(playwrightPath)

const build = await Bun.build({
  entrypoints: [join(import.meta.dir, 'paste-browser.ts')],
  target: 'browser',
  format: 'iife',
  minify: false,
})
if (!build.success) throw new AggregateError(build.logs, 'bundle failed')
const bundle = await build.outputs[0]!.text()

const phaseA = new Map<string, any>()
const phaseAPath = join(STUDY, 'results/paste.json')
if (existsSync(phaseAPath)) {
  for (const row of JSON.parse(readFileSync(phaseAPath, 'utf8')))
    phaseA.set(`${row.source}/${row.name}`, row)
}

// The study vendors Chromium's shared libraries next to the corpus.
const libs = join(STUDY, '.syslibs/root/usr/lib/x86_64-linux-gnu')
const browser = await chromium.launch(
  existsSync(libs) ? { env: { ...process.env, LD_LIBRARY_PATH: libs } } : {}
)
const page = await browser.newPage()
await page.setContent('<!DOCTYPE html><html><body></body></html>')
await page.addScriptTag({ content: bundle })

const rows: any[] = []
for (const fx of loadCorpus()) {
  const key = `${fx.source}/${fx.name}`
  const row = await page.evaluate(
    ({ html, text }: { html: string; text: string }) => {
      const api = (globalThis as any).__paste
      return {
        source: api.classifyHTML(html),
        schemaOnly: api.schemaPaste(html, false),
        schema: api.schemaPaste(html, true),
        editor: api.editorPaste(html, text),
        normalizeMs: api.timeNormalize(html, 5),
      }
    },
    { html: fx.html, text: fx.text }
  )
  rows.push({ key, phaseA: phaseA.get(key), ...row })
  console.error(`done ${key}`)
}

// Text-only pastes (no HTML on the clipboard), where Markdown detection applies.
const textOnly: any[] = []
for (const fx of loadCorpus().filter((f) => f.text && /chatgpt|notion/.test(f.source))) {
  const out = await page.evaluate(
    (text: string) => (globalThis as any).__paste.editorPaste('', text),
    fx.text
  )
  textOnly.push({ key: `${fx.source}/${fx.name}`, ...out })
}

// Timing on large inputs: book-length plain HTML and ~1 MB of style-heavy Docs HTML.
// `parseOnlyMs` is the DOMParser round trip alone, the floor under `ms`. Median of 15 runs.
const timings: Record<string, { kb: number; ms: number; parseOnlyMs: number }> = {}
const book = join(CORPUS_ROOT, 'book/book-full.html')
const docs = loadCorpus().filter((f) => f.source === 'google-docs' || f.source === 'arxiv')
const inputs: Record<string, string> = {
  'book-full.html (Gutenberg, plain)': existsSync(book) ? readFileSync(book, 'utf8') : '',
  'Docs ×4 + arXiv concatenated': docs.map((f) => f.html).join('\n'),
}
for (const [name, html] of Object.entries(inputs)) {
  if (!html) continue
  const [ms, parseOnlyMs] = await page.evaluate((h: string) => {
    const api = (globalThis as any).__paste
    const median = (time: () => number) => {
      const runs = Array.from({ length: 15 }, time).sort((a, b) => a - b)
      return runs[7] as number
    }
    return [median(() => api.timeNormalize(h, 1)), median(() => api.timeParse(h, 1))]
  }, html)
  const round = (n: number) => Math.round(n * 10) / 10
  timings[name] = {
    kb: Math.round(html.length / 1024),
    ms: round(ms),
    parseOnlyMs: round(parseOnlyMs),
  }
}
await browser.close()

const out = process.argv[2]
if (out) writeFileSync(out, JSON.stringify({ rows, textOnly, timings }, null, 2))

const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : '–')
const metrics = [
  'alnum',
  'code',
  'highlight',
  'link',
  'tasks',
  'images',
  'math',
  'footnoteRefs',
  'internalLinks',
] as const
console.log('| fixture | metric | source | Phase A | schema only | + cleanup | editor paste |')
console.log('|---|---|---|---|---|---|---|')
for (const row of rows) {
  for (const m of metrics) {
    const src = row.source[m]
    const before = row.phaseA?.result?.[m]
    const vals = [row.schemaOnly.result[m], row.schema.result[m], row.editor.result[m]]
    if (!src && !before && vals.every((v) => !v)) continue
    console.log(`| ${row.key} | ${m} | ${src} | ${before ?? '–'} | ${vals.join(' | ')} |`)
  }
  console.log(
    `| ${row.key} | blank ¶ (top / longest run) | | ${row.phaseA?.emptyParagraphs ?? '–'} empty | ${row.schemaOnly.blank.top}/${row.schemaOnly.blank.longestRun} | ${row.schema.blank.top}/${row.schema.blank.longestRun} | ${row.editor.blank.top}/${row.editor.blank.longestRun} |`
  )
  console.log(
    `| ${row.key} | footnotes / dropped images / normalize ms | | | | ${row.schema.result.footnotes} / ${row.schema.droppedImages} | ${row.editor.result.footnotes} / ${row.editor.droppedImages} / ${row.normalizeMs.toFixed(1)} |`
  )
  console.log(
    `|  | alnum % | | ${pct(row.phaseA?.result?.alnum ?? 0, row.source.alnum)} | ${pct(row.schemaOnly.result.alnum, row.source.alnum)} | ${pct(row.schema.result.alnum, row.source.alnum)} | ${pct(row.editor.result.alnum, row.source.alnum)} |`
  )
}
console.log('\nText-only pastes:')
for (const t of textOnly) console.log(t.key, JSON.stringify(t.nodes))
console.log('\nTimings:', JSON.stringify(timings, null, 2))
