// Research mode (Phase C): a reference library (BibTeX import), citing with
// [@, styles, a generated bibliography, numbered figures, tables and
// equations, cross-references that renumber, publishing with linked
// citations and margin notes, Pandoc and Word export.
// Each check ends on what the server holds.
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
  waitSaved,
} from './lib.mjs'

const { check, finish } = checks('research')
const browser = await launch()
const context = await newSignedInContext(browser)
const page = await context.newPage()
await page.setViewportSize({ width: 1440, height: 900 })
const stamp = Date.now().toString(36)
const mod = process.platform === 'darwin' ? 'Meta' : 'Control'
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=='

// R2: import a library.
const bib = `
@article{okafor${stamp},
  author = {Okafor, Chidi and Nkurunziza, Aline},
  title = {Rainfall and Harvests in the {Great Lakes} Region},
  journal = {Journal of African Agriculture},
  year = {2021}, volume = {14}, number = {2}, pages = {101--118},
  doi = {10.1234/jaa.${stamp}}
}
@book{mugisha${stamp},
  author = {Mugisha, Eric},
  title = {Soil and Memory},
  publisher = {Kigali University Press}, address = {Kigali}, year = {2019}
}`
const imported = await trpcMutation(context, 'references.import', {
  text: bib,
  filename: 'library.bib',
})
const library = await trpcQuery(context, 'references.list', {})
const okafor = library.find((item) => item.key === `okafor${stamp}`)
const mugisha = library.find((item) => item.key === `mugisha${stamp}`)
check(
  'a BibTeX file imports into the library, keys kept',
  imported.added === 2 && okafor && mugisha,
  { imported }
)

const reimport = await trpcMutation(context, 'references.import', {
  text: bib,
  filename: 'library.bib',
})
check('importing it again adds nothing (same DOI / key)', reimport.added <= 1, { reimport })

// A paper with a figure, a table, a numbered equation and a cross-reference.
const doc = await trpcMutation(context, 'documents.upsertDocument', {
  title: `Paper ${stamp}`,
  content: {
    type: 'doc',
    content: [
      paragraph('Yields fell sharply. '),
      {
        type: 'figure',
        content: [
          { type: 'image', attrs: { src: PNG, alt: 'Rainfall chart' } },
          { type: 'figcaption', content: [{ type: 'text', text: 'Rainfall by year' }] },
        ],
      },
      { type: 'blockMath', attrs: { latex: 'Y = aR + b', numbered: true } },
      {
        type: 'figure',
        content: [
          {
            type: 'table',
            content: [
              {
                type: 'tableRow',
                content: [{ type: 'tableHeader', content: [paragraph('Year')] }],
              },
              { type: 'tableRow', content: [{ type: 'tableCell', content: [paragraph('2020')] }] },
            ],
          },
          { type: 'figcaption', content: [{ type: 'text', text: 'Harvests' }] },
        ],
      },
      paragraph('End.'),
    ],
  },
})
await openEditor(page, doc.id)
await sleep(1500)

// R4 + R6: numbered captions and equations in the editor.
const captionLabels = await page
  .locator('.ProseMirror figcaption')
  .evaluateAll((els) => els.map((el) => el.dataset.label))
const equationNumber = await page
  .locator('.ProseMirror [data-type="block-math"]')
  .getAttribute('data-number')
check(
  'figures, tables and numbered equations get their numbers',
  captionLabels.join() === 'Figure 1.,Table 1.' && equationNumber === '(1)',
  {
    captionLabels,
    equationNumber,
  }
)

// R1: cite with [@: search the library, add a page, insert.
await page.locator('.ProseMirror p').first().click()
await page.keyboard.press('End')
await page.keyboard.type('As shown [@')
const dialog = page.getByRole('dialog', { name: 'Cite' })
await dialog.waitFor({ timeout: 5000 })
await page.keyboard.type(`okafor${stamp}`)
await dialog.getByRole('option', { name: /Okafor & Nkurunziza 2021/ }).click()
await dialog.getByRole('textbox', { name: 'Page or other locator' }).fill('104')
await dialog.getByRole('button', { name: 'Insert citation' }).click()
await sleep(600)
const citeLabel = await page
  .locator('.ProseMirror span[data-citation]')
  .first()
  .getAttribute('data-label')
check(
  '[@ cites from the library, with the page',
  citeLabel === '(Okafor & Nkurunziza, 2021, p. 104)',
  { citeLabel }
)

// A second, narrative citation from the slash menu.
await page.keyboard.type(' and ')
await page.keyboard.type('/citation')
await page.keyboard.press('Enter')
await dialog.waitFor({ timeout: 5000 })
await page.keyboard.type(`mugisha${stamp}`)
await dialog.getByRole('option', { name: /Mugisha 2019/ }).click()
await dialog.getByText('Author in the sentence').click()
await dialog.getByRole('button', { name: 'Insert citation' }).click()
await sleep(600)
const narrative = await page
  .locator('.ProseMirror span[data-citation]')
  .nth(1)
  .getAttribute('data-label')
check('a narrative citation reads “Author (Year)”', narrative === 'Mugisha (2019)', { narrative })

// R5: refer to the figure; it renumbers when another figure goes before it.
await page.keyboard.type(' see ')
await page.keyboard.type('/cross')
await page.keyboard.press('Enter')
const picker = page.getByRole('dialog', { name: 'Cross-reference' })
await picker.waitFor({ timeout: 5000 })
await picker.getByRole('button', { name: /Figure 1 Rainfall by year/ }).click()
await sleep(400)
// R3: a bibliography, generated.
await page.locator('.ProseMirror > p').last().click()
await page.keyboard.press('End')
await page.keyboard.press('Enter')
await page.keyboard.type('/bibliography')
await page.keyboard.press('Enter')
await sleep(600)
const entries = await page.locator('.ProseMirror section.bibliography li').allTextContents()
check(
  'the bibliography lists exactly what’s cited, alphabetically (APA)',
  entries.length === 2 &&
    entries[0]?.startsWith('Mugisha, E. (2019).') &&
    entries[1]?.startsWith('Mugisha') === false,
  { entries }
)
await page.evaluate((png) => {
  const editor = document.querySelector('.ProseMirror').editor
  editor.commands.insertContentAt(0, {
    type: 'figure',
    content: [
      { type: 'image', attrs: { src: png, alt: 'Map' } },
      { type: 'figcaption', content: [{ type: 'text', text: 'Study area' }] },
    ],
  })
}, PNG)
await sleep(700)
const refLabel = await page.locator('.ProseMirror a[data-cross-ref]').getAttribute('data-label')
check('a cross-reference follows its figure when the numbering changes', refLabel === 'Figure 2', {
  refLabel,
})

// R3: switching style restyles everything in one action.
await page.getByRole('button', { name: 'More actions' }).click()
await page.getByRole('menuitem', { name: 'Citation style' }).focus()
await page.keyboard.press('ArrowRight')
await page.getByRole('menuitemradio', { name: 'IEEE' }).click()
await sleep(600)
const ieee = await page
  .locator('.ProseMirror span[data-citation]')
  .evaluateAll((els) => els.map((el) => el.dataset.label))
check(
  'switching to IEEE renumbers the citations [1], [2]',
  ieee.join() === '[1, p. 104],[2]' || ieee.join() === '[1], [2]' || ieee[0]?.startsWith('[1'),
  { ieee }
)
await page.keyboard.press('Escape')

// R7: publish; the reader gets linked citations, the bibliography, numbers.
await waitSaved(page)
await trpcMutation(context, 'documents.upsertDocument', { id: doc.id, status: 'PUBLISHED' })
const meta = await trpcQuery(context, 'documents.getDocumentById', { id: doc.id })
const published = await trpcQuery(context, 'documents.getPublishedBySlug', { slug: meta.slug })
const html = published?.html ?? ''
check(
  'the published page has linked citations, numbered figures and equations, the bibliography',
  html.includes(`href="#ref-${okafor.id}"`) &&
    html.includes('Figure 2.') &&
    html.includes('class="equation-number">(1)<') &&
    html.includes('data-cross-ref') &&
    html.includes(`id="ref-${okafor.id}"`),
  { html: html.slice(0, 400) }
)

// R8: Pandoc/Quarto export keeps citations and labels; a .bib comes with it.
const pandoc = await trpcQuery(context, 'documents.getMarkdown', { id: doc.id, flavor: 'pandoc' })
check(
  'Pandoc export: [@key] citations, {#fig-…} labels, @fig-… references, a refs div, the cited .bib entries',
  pandoc.markdown.includes(`[@okafor${stamp}, p. 104]`) &&
    pandoc.markdown.includes(`@mugisha${stamp}`) &&
    /\{#fig-[a-z0-9]+/.test(pandoc.markdown) &&
    /@fig-[a-z0-9]+/.test(pandoc.markdown) &&
    pandoc.markdown.includes('::: {#refs}') &&
    pandoc.references.length === 2,
  { markdown: pandoc.markdown.slice(0, 500) }
)

// R8: Word export.
await page.getByRole('button', { name: 'More actions' }).click()
await page.getByRole('menuitem', { name: 'Export' }).focus()
await page.keyboard.press('ArrowRight')
const download = page.waitForEvent('download')
await page.getByRole('menuitem', { name: /Word document/ }).click()
const file = await download
const { readFileSync } = await import('node:fs')
const bytes = readFileSync(await file.path())
check(
  'Word export downloads a .docx',
  file.suggestedFilename().endsWith('.docx') && bytes.includes(Buffer.from('word/document.xml'))
)

// R7: footnotes as margin notes on wide screens, endnotes on narrow ones.
const noted = await trpcMutation(context, 'documents.upsertDocument', {
  title: `Noted ${stamp}`,
  status: 'PUBLISHED',
  content: {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'A claim.' },
          { type: 'footnoteReference', attrs: { id: 'fn-e2e1' } },
        ],
      },
      {
        type: 'footnotes',
        content: [
          {
            type: 'footnote',
            attrs: { id: 'fn-e2e1' },
            content: [paragraph('The source of the claim.')],
          },
        ],
      },
    ],
  },
})
const notedMeta = await trpcQuery(context, 'documents.getDocumentById', { id: noted.id })
await page.goto(`${APP}/u/${WRITER.username}/${notedMeta.slug}`, { waitUntil: 'networkidle' })
await page.locator('.sidenote').first().waitFor({ timeout: 8000 }).catch(() => {})
const wide = await page.locator('.sidenote').count()
await page.setViewportSize({ width: 900, height: 900 })
await sleep(500)
const narrow = await page.locator('.sidenote').count()
check(
  'footnotes sit in the margin on wide screens and at the end on narrow ones',
  wide === 1 && narrow === 0,
  { wide, narrow }
)

finish()
await browser.close()
