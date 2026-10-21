import type { JSONContent } from '@tiptap/core'

const text = (value: string, marks?: JSONContent['marks']): JSONContent =>
  marks ? { type: 'text', text: value, marks } : { type: 'text', text: value }
const p = (...content: JSONContent[]): JSONContent => ({ type: 'paragraph', content })

/**
 * Every node type, mark and non-default attribute the schema can store. The
 * parity tests fail if a renderer drops any of it, so extend this whenever the
 * schema grows (the coverage test enforces that too).
 */
export const kitchenSink: JSONContent = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [text('Heading one')] },
    { type: 'heading', attrs: { level: 2 }, content: [text('Heading two')] },
    { type: 'heading', attrs: { level: 3 }, content: [text('Heading three')] },
    { type: 'heading', attrs: { level: 4 }, content: [text('Heading four')] },
    { type: 'heading', attrs: { level: 5 }, content: [text('Heading five')] },
    { type: 'heading', attrs: { level: 6 }, content: [text('Heading six')] },
    p(
      text('Bold', [{ type: 'bold' }]),
      text(' '),
      text('italic', [{ type: 'italic' }]),
      text(' '),
      text('strike', [{ type: 'strike' }]),
      text(' '),
      text('underline', [{ type: 'underline' }]),
      text(' '),
      text('code', [{ type: 'code' }]),
      text(' H'),
      text('2', [{ type: 'subscript' }]),
      text('O and x'),
      text('2', [{ type: 'superscript' }]),
      text(' '),
      text('red', [{ type: 'textStyle', attrs: { color: '#b91c1c' } }]),
      text(' '),
      text('marked', [{ type: 'highlight', attrs: { color: '#fef08a' } }]),
      text(' '),
      text('a link', [
        {
          type: 'link',
          attrs: {
            href: 'https://example.com/',
            title: 'Example',
            target: '_blank',
            rel: 'noopener noreferrer nofollow',
            class: null,
          },
        },
      ]),
      { type: 'hardBreak' },
      text('after a break, energy '),
      { type: 'inlineMath', attrs: { latex: 'E = mc^2' } },
      text(' and a note'),
      { type: 'footnoteReference', attrs: { id: 'fn-a' } },
      text('.')
    ),
    { type: 'blockMath', attrs: { latex: '\\int_0^1 x^2\\,dx = \\tfrac{1}{3}' } },
    {
      type: 'blockMath',
      attrs: { id: 'eqnumbered1', latex: 'E = mc^2', numbered: true, tag: null },
    },
    { type: 'blockMath', attrs: { latex: 'a^2 + b^2 = c^2', numbered: true, tag: '3.2' } },
    {
      type: 'figure',
      attrs: { id: 'figkitchen1' },
      content: [
        { type: 'image', attrs: { src: 'https://example.com/figure.png', alt: 'A chart' } },
        { type: 'figcaption', content: [text('Growth by '), text('year', [{ type: 'italic' }])] },
      ],
    },
    p(
      text('See '),
      { type: 'crossReference', attrs: { target: 'figkitchen1' } },
      text(' and '),
      { type: 'crossReference', attrs: { target: 'eqnumbered1' } },
      text(', as argued '),
      {
        type: 'citation',
        attrs: { items: [{ id: 'ref-smith', locator: '12', label: 'page' }], mode: 'normal' },
      },
      text(' and by '),
      { type: 'citation', attrs: { items: [{ id: 'ref-lee' }], mode: 'author-in-text' } },
      text('; compare '),
      {
        type: 'documentLink',
        attrs: { documentId: 'doc-notes', blockId: null, title: 'My notes' },
      },
      text('.')
    ),
    { type: 'bibliography', attrs: { title: 'Works cited' } },
    {
      type: 'bulletList',
      content: [
        { type: 'listItem', content: [p(text('Bullet'))] },
        {
          type: 'listItem',
          content: [
            p(text('Nested parent')),
            {
              type: 'bulletList',
              content: [{ type: 'listItem', content: [p(text('Nested child'))] }],
            },
          ],
        },
      ],
    },
    {
      type: 'orderedList',
      attrs: { start: 3, type: null },
      content: [
        { type: 'listItem', content: [p(text('Third'))] },
        { type: 'listItem', content: [p(text('Fourth'))] },
      ],
    },
    {
      type: 'taskList',
      content: [
        { type: 'taskItem', attrs: { checked: true }, content: [p(text('Done task'))] },
        { type: 'taskItem', attrs: { checked: false }, content: [p(text('Open task'))] },
      ],
    },
    { type: 'blockquote', content: [p(text('A quotation.'))] },
    { type: 'codeBlock', attrs: { language: 'ts' }, content: [text('const x = 1 < 2\n')] },
    { type: 'horizontalRule' },
    {
      type: 'image',
      attrs: {
        src: 'https://assets.example.com/a.png',
        alt: 'An image',
        title: 'Caption',
        width: 320,
        height: 200,
      },
    },
    {
      type: 'youtube',
      attrs: {
        src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        start: 42,
        width: 640,
        height: 480,
      },
    },
    { type: 'callout', attrs: { emoji: '⚠️' }, content: [p(text('Careful now.'))] },
    {
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableHeader',
              attrs: { colspan: 1, rowspan: 1, colwidth: [120] },
              content: [p(text('Name'))],
            },
            {
              type: 'tableHeader',
              attrs: { colspan: 1, rowspan: 1, colwidth: [240] },
              content: [p(text('Value'))],
            },
          ],
        },
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableCell',
              attrs: { colspan: 1, rowspan: 1, colwidth: [120] },
              content: [p(text('alpha'))],
            },
            {
              type: 'tableCell',
              attrs: { colspan: 1, rowspan: 1, colwidth: [240] },
              content: [p(text('1'))],
            },
          ],
        },
      ],
    },
    {
      type: 'footnotes',
      content: [{ type: 'footnote', attrs: { id: 'fn-a' }, content: [p(text('The note body.'))] }],
    },
  ],
}
