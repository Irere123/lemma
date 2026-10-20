import { describe, expect, test } from 'bun:test'
import { DOMParser as PMDOMParser, type Node as PMNode } from '@tiptap/pm/model'

import { renderToEmail, renderToHTML, renderToMarkdown } from '../src'
import { getContentSchema, validateContent } from '../src/schema'
import { kitchenSink } from './fixtures'

const schema = getContentSchema()

function parseHTML(html: string): PMNode {
  const container = document.createElement('div')
  container.innerHTML = html
  return PMDOMParser.fromSchema(schema).parse(container)
}

const canonical = (json: unknown) => schema.nodeFromJSON(validateContent(json, { strict: true }))

function usedTypes(node: PMNode) {
  const nodes = new Set<string>()
  const marks = new Set<string>()
  node.descendants((child) => {
    nodes.add(child.type.name)
    for (const mark of child.marks) marks.add(mark.type.name)
    return true
  })
  nodes.add(node.type.name)
  return { nodes, marks }
}

describe('kitchen sink fixture', () => {
  test('is valid under the schema', () => {
    expect(() => canonical(kitchenSink)).not.toThrow()
  })

  test('uses every node and mark type in the schema', () => {
    const { nodes, marks } = usedTypes(canonical(kitchenSink))
    expect([...Object.keys(schema.nodes)].filter((name) => !nodes.has(name))).toEqual([])
    expect([...Object.keys(schema.marks)].filter((name) => !marks.has(name))).toEqual([])
  })
})

describe('published HTML', () => {
  test('parses back into the identical document (re-import parity)', () => {
    const original = canonical(kitchenSink)
    const reparsed = parseHTML(renderToHTML(original.toJSON()))
    // Compare as JSON for a readable diff on failure.
    expect(reparsed.toJSON()).toEqual(original.toJSON())
  })

  test('highlighted code blocks re-import as the same code', () => {
    const original = canonical(kitchenSink)
    const html = renderToHTML(original.toJSON(), {
      highlightCode: (code) =>
        code
          .split(/(\s+)/)
          .map((part) =>
            part.trim()
              ? `<span class="hljs-keyword">${part.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</span>`
              : part
          )
          .join(''),
    })
    expect(html).toContain('class="hljs-keyword"')
    expect(parseHTML(html).toJSON()).toEqual(original.toJSON())
  })

  test('keeps headings 4–6', () => {
    const html = renderToHTML(kitchenSink)
    for (const level of [4, 5, 6]) expect(html).toContain(`<h${level}>`)
  })

  test('keeps column widths', () => {
    const html = renderToHTML(kitchenSink)
    expect(html).toContain('<col style="width:120px"><col style="width:240px">')
    expect(html).toContain('<table style="width:360px">')
  })

  test('renders math through the provided renderer, keeping the TeX source', () => {
    const html = renderToHTML(kitchenSink, {
      renderMath: (latex, display) =>
        `<span class="katex${display ? '-display' : ''}">${latex}</span>`,
    })
    expect(html).toContain('data-type="inline-math" data-latex="E = mc^2"')
    expect(html).toContain('data-type="block-math"')
    expect(html).toContain('<span class="katex">E = mc^2</span>')
  })

  test('numbers footnotes and links both ways', () => {
    const html = renderToHTML(kitchenSink)
    expect(html).toContain('<a href="#fn-fn-a" id="fnref-fn-a">1</a>')
    expect(html).toContain('id="fn-fn-a"')
    expect(html).toContain('href="#fnref-fn-a"')
  })

  test('never emits presentational utility classes', () => {
    expect(renderToHTML(kitchenSink)).not.toMatch(/class="[^"]*\b(my-|ml-|px-|text-|border-)/)
  })
})

describe('email HTML', () => {
  const html = renderToEmail(kitchenSink)

  test('keeps headings 4–6 and ordered-list start', () => {
    for (const level of [4, 5, 6]) expect(html).toContain(`<h${level} style=`)
    expect(html).toContain('<ol start="3"')
  })

  test('keeps text colour and highlight', () => {
    expect(html).toContain('color:#b91c1c')
    expect(html).toContain('background-color:#fef08a')
  })

  test('puts the task checkbox on the same line as its text', () => {
    expect(html).toContain('☑&nbsp;Done task')
    expect(html).toContain('☐&nbsp;Open task')
  })

  test('keeps footnotes and table widths', () => {
    expect(html).toMatch(/<sup[^>]*>1<\/sup>/)
    expect(html).toContain('The note body.')
    expect(html).toContain('width="120"')
  })
})

describe('markdown export', () => {
  const md = renderToMarkdown(kitchenSink)

  test('is markdown, not HTML', () => {
    expect(md).not.toMatch(/<(div|ul|ol|li|p|table|span)\b/)
    expect(md).not.toContain('class=')
  })

  test('covers headings, lists, tasks, tables, math and footnotes', () => {
    expect(md).toContain('###### Heading six')
    expect(md).toContain('3. Third\n4. Fourth')
    expect(md).toContain('- [x] Done task')
    expect(md).toContain('- [ ] Open task')
    expect(md).toContain('| Name | Value |')
    expect(md).toContain('$E = mc^2$')
    expect(md).toContain('$$\n\\int_0^1')
    expect(md).toContain('note[^1].')
    expect(md).toContain('[^1]: The note body.')
    expect(md).toContain('> ⚠️ Careful now.')
    expect(md).toContain('```ts\nconst x = 1 < 2\n')
    expect(md).toContain('[a link](https://example.com/ "Example")')
  })

  test('nests list children under their item', () => {
    expect(md).toContain('- Nested parent\n  - Nested child')
  })
})
