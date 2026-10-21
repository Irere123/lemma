/**
 * Numbering and cross-references under random edits and moves (Phase C):
 * whatever order blocks end up in, figures and tables are numbered 1…n in
 * reading order, untagged equations count up while tagged ones keep their
 * tag, and every cross-reference reads as its target's current label, in the
 * numbering and in the published HTML.
 */
import { describe, expect, test } from 'bun:test'
import fc from 'fast-check'

import { numberDocument, renderToHTML } from '../src'
import type { ContentNode } from '../src/types'

type Block = ContentNode

const ids = (prefix: string, n: number) =>
  Array.from({ length: n }, (_, i) => `${prefix}${String(i).padStart(6, 'a')}`)
const FIGURES = ids('fig', 6)
const TABLES = ids('tab', 4)
const EQUATIONS = ids('equ', 5)
const TARGETS = [...FIGURES, ...TABLES, ...EQUATIONS]

const caption = (text: string): Block => ({
  type: 'figcaption',
  content: text ? [{ type: 'text', text }] : [],
})

const figure = (id: string, text: string): Block => ({
  type: 'figure',
  attrs: { id },
  content: [
    { type: 'image', attrs: { src: 'https://example.com/i.png', alt: null } },
    caption(text),
  ],
})

const table = (id: string, text: string): Block => ({
  type: 'figure',
  attrs: { id },
  content: [
    {
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableCell',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }],
            },
          ],
        },
      ],
    },
    caption(text),
  ],
})

const equation = (id: string, tag: string | null): Block => ({
  type: 'blockMath',
  attrs: { id, latex: 'x', numbered: true, tag },
})

const reference = (target: string): Block => ({
  type: 'paragraph',
  content: [
    { type: 'text', text: 'See ' },
    { type: 'crossReference', attrs: { target } },
    { type: 'text', text: '.' },
  ],
})

/** A document: a subset of targets (each at most once) and references to any target. */
const docArb = fc
  .record({
    figures: fc.subarray(FIGURES),
    tables: fc.subarray(TABLES),
    equations: fc.subarray(EQUATIONS),
    tags: fc.array(fc.option(fc.constantFrom('A', '3.2', '7'), { nil: null, freq: 3 }), {
      minLength: 5,
      maxLength: 5,
    }),
    references: fc.array(fc.constantFrom(...TARGETS), { maxLength: 8 }),
    captions: fc.array(fc.constantFrom('', 'Rain', 'Harvest by year'), {
      minLength: 10,
      maxLength: 10,
    }),
  })
  .chain((parts) => {
    const blocks: Block[] = [
      ...parts.figures.map((id, i) => figure(id, parts.captions[i] ?? '')),
      ...parts.tables.map((id, i) => table(id, parts.captions[i + 6] ?? '')),
      ...parts.equations.map((id, i) => equation(id, parts.tags[i] ?? null)),
      ...parts.references.map(reference),
    ]
    // Random order: as if blocks were moved around.
    return fc.shuffledSubarray(blocks, { minLength: blocks.length, maxLength: blocks.length })
  })
  .map(
    (content): ContentNode => ({
      type: 'doc',
      content: content.length > 0 ? content : [{ type: 'paragraph' }],
    })
  )

/** Labels expected from reading order alone, computed independently. */
function expectedLabels(doc: ContentNode): Map<string, string> {
  const labels = new Map<string, string>()
  let figures = 0
  let tables = 0
  let equations = 0
  for (const block of doc.content ?? []) {
    const id = String(block.attrs?.id ?? '')
    if (block.type === 'figure') {
      if (block.content?.[0]?.type === 'table') labels.set(id, `Table ${++tables}`)
      else labels.set(id, `Figure ${++figures}`)
    }
    if (block.type === 'blockMath') {
      const tag = block.attrs?.tag
      labels.set(id, `Eq. (${typeof tag === 'string' ? tag : ++equations})`)
    }
  }
  return labels
}

describe('numbering under random moves', () => {
  test('numbers follow reading order; tags keep theirs', () => {
    fc.assert(
      fc.property(docArb, (doc) => {
        const targets = numberDocument(doc)
        for (const [id, label] of expectedLabels(doc)) expect(targets.get(id)?.label).toBe(label)
      }),
      { numRuns: 300 }
    )
  })

  test('every cross-reference in the published HTML reads as its target’s label and links to it', () => {
    fc.assert(
      fc.property(docArb, (doc) => {
        const labels = expectedLabels(doc)
        const html = renderToHTML(doc)
        const refs = [
          ...html.matchAll(
            /<a data-cross-ref data-target="([^"]+)" href="#([^"]+)" class="cross-ref">([^<]*)<\/a>/g
          ),
        ]
        const missing = [...html.matchAll(/class="cross-ref cross-ref-missing"/g)].length
        const cited = (doc.content ?? []).filter(
          (block) => block.type === 'paragraph' && block.content?.[1]?.type === 'crossReference'
        )
        // Every reference renders, resolved or (target absent) marked missing.
        expect(refs.length + missing).toBe(cited.length)
        for (const [, target, href, text] of refs) {
          expect(href).toBe(target)
          expect(text).toBe(labels.get(target as string))
        }
        // …and the figure it points to carries the same number in its caption.
        for (const [id, label] of labels) {
          if (!label.startsWith('Figure') && !label.startsWith('Table')) continue
          expect(html).toContain(`<figure id="${id}"`)
          expect(html).toMatch(
            new RegExp(
              `<figure id="${id}"[^>]*>(?:(?!</figure>).)*<span class="figure-label">${label}\\.</span>`
            )
          )
        }
      }),
      { numRuns: 300 }
    )
  })
})
