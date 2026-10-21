import { describe, expect, test } from 'bun:test'

import { lowerDocument, renderToMarkdown } from '../src'
import { markdownToContent } from '../src/markdown-parse'
import { getContentSchema, validateContent } from '../src/schema'
import { kitchenSink } from './fixtures'

const schema = getContentSchema()
const canonical = (json: unknown) => schema.nodeFromJSON(validateContent(json, { strict: true }))

describe('markdown import', () => {
  test('parses the common GFM constructs', () => {
    const doc = canonical(
      markdownToContent(
        [
          '# Title',
          'Some **bold**, _italic_, `code`, ~~gone~~ and [a link](https://x.com "t").',
          '> quoted **text**',
          '- a\n- b\n  - nested',
          '3. three\n4. four',
          '- [ ] todo\n- [x] done',
          '```js\nconst a = 1\n```',
          '| a | b |\n|---|---|\n| 1 | 2 |',
          'Inline $E=mc^2$ math, but $5 and $10 stay money.',
          '$$\n\\int x\\,dx\n$$',
          '---',
          '![alt](https://img.example/x.png)',
          'H<sub>2</sub>O and x<sup>2</sup>.',
          'Text with a note[^1].',
          '[^1]: The note.',
        ].join('\n\n')
      )
    )
    const json = JSON.stringify(doc.toJSON())
    for (const fragment of [
      '"level":1',
      '"type":"bold"',
      '"type":"italic"',
      '"type":"code"',
      '"type":"strike"',
      '"href":"https://x.com"',
      '"type":"blockquote"',
      '"text":"quoted "',
      '"start":3',
      '"checked":true',
      '"language":"js"',
      '"type":"tableHeader"',
      '"text":"2"',
      '"latex":"E=mc^2"',
      '$5 and $10 stay money',
      '"type":"blockMath"',
      '"type":"horizontalRule"',
      '"src":"https://img.example/x.png"',
      '"type":"subscript"',
      '"type":"superscript"',
      '"type":"footnoteReference"',
      '"text":"The note."',
    ]) {
      expect(json).toContain(fragment)
    }
  })

  test('round-trips the kitchen sink through renderToMarkdown', () => {
    const back = canonical(markdownToContent(renderToMarkdown(kitchenSink)))
    const text = (node: { textContent: string }) => node.textContent.replace(/\s+/g, ' ').trim()
    // Markdown can't carry colours, widths or YouTube start times, but no text may be lost.
    // Cross-references and document links are written as the text a reader sees.
    expect(text(back)).toBe(text(canonical(lowerDocument(kitchenSink))))
    const types = new Set<string>()
    back.descendants((node) => {
      types.add(node.type.name)
      return true
    })
    for (const type of [
      'heading',
      'inlineMath',
      'blockMath',
      'taskItem',
      'table',
      'callout',
      'footnote',
      'codeBlock',
    ]) {
      expect(types.has(type)).toBe(true)
    }
  })

  test('keeps nested task lists and headings inside callouts', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              attrs: { checked: false },
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'open' }] },
                {
                  type: 'taskList',
                  content: [
                    {
                      type: 'taskItem',
                      attrs: { checked: true },
                      content: [
                        { type: 'paragraph', content: [{ type: 'text', text: 'nested done' }] },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: 'callout',
          attrs: { emoji: '⚠️' },
          content: [
            { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Careful' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'Body' }] },
          ],
        },
      ],
    }
    const back = canonical(markdownToContent(renderToMarkdown(doc)))
    expect(back.toJSON()).toEqual(canonical(doc).toJSON())
  })

  test('leaves plain prose alone', () => {
    const doc = markdownToContent('Just a sentence. Another one.')
    expect(doc).toEqual({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Just a sentence. Another one.' }] },
      ],
    })
  })
})
