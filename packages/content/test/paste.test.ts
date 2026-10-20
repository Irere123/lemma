import { describe, expect, test } from 'bun:test'
import { Editor, type JSONContent } from '@tiptap/core'

import { renderToHTML } from '../src'
import { contentExtensions, getContentSchema } from '../src/schema'
import {
  looksLikeMarkdown,
  markdownSlice,
  normalizePastedHTML,
  PasteCleanup,
  type PasteCleanupOptions,
} from '../src/schema/paste'
import { kitchenSink } from './fixtures'
import { loadCorpus } from './paste-corpus'
import {
  blankParagraphs,
  classifyElement,
  classifyHTML,
  pasteHTML,
  pasteSlice,
} from './paste-harness'

const schema = getContentSchema()

/** Paste through normalizePastedHTML + the schema parser; the slice as JSON. */
const paste = (html: string, normalize = true): JSONContent[] =>
  (pasteSlice(html, { normalize }).slice.content.toJSON() as JSONContent[] | null) ?? []
const clean = (html: string) => normalizePastedHTML(html)

function all(nodes: JSONContent[], type: string): JSONContent[] {
  const out: JSONContent[] = []
  const visit = (node: JSONContent) => {
    if (node.type === type) out.push(node)
    node.content?.forEach(visit)
  }
  nodes.forEach(visit)
  return out
}

const textOf = (node: JSONContent | JSONContent[]): string =>
  Array.isArray(node)
    ? node.map(textOf).join('\n')
    : (node.text ?? '') + (node.content ?? []).map(textOf).join('')

const marksOn = (nodes: JSONContent[], text: string) =>
  all(nodes, 'text')
    .find((node) => node.text?.includes(text))
    ?.marks?.map((mark) => mark.type) ?? []

// ---------------------------------------------------------------------------

describe('Google Docs', () => {
  const docs = (body: string) =>
    `<meta charset="utf-8"><b style="font-weight:normal;" id="docs-internal-guid-1234">${body}</b>`
  const mono = (text: string) =>
    `<span style="font-family:'Courier New',monospace;font-weight:400">${text}</span>`
  const arial = (text: string) => `<span style="font-family:Arial,sans-serif">${text}</span>`

  test('the font-weight:normal wrapper goes, and nothing turns bold', () => {
    const html = clean(docs(`<p>${arial('Hello')}</p>`)).html
    expect(html).not.toContain('docs-internal-guid')
    expect(marksOn(paste(docs(`<p>${arial('Hello')}</p>`)), 'Hello')).not.toContain('bold')
  })

  test('consecutive monospace paragraphs become one code block, keeping line breaks and blank lines', () => {
    const nodes = paste(
      docs(
        `<p>${arial('Before')}</p><p>${mono('if (a) {')}${mono('<br>')}${mono('  run()')}</p><br><p>${mono('}')}</p><p>${arial('After')}</p>`
      )
    )
    expect(nodes.map((node) => node.type)).toEqual(['paragraph', 'codeBlock', 'paragraph'])
    expect(textOf(nodes[1]!)).toBe('if (a) {\n  run()\n\n}')
  })

  test('a monospace run inside prose stays inline code', () => {
    const nodes = paste(docs(`<p>${arial('Call ')}${mono('run()')}${arial(' now')}</p>`))
    expect(nodes.map((node) => node.type)).toEqual(['paragraph'])
    expect(marksOn(nodes, 'run()')).toEqual(['code'])
  })

  test('a monospace list item stays a list item with inline code', () => {
    const nodes = paste(docs(`<ul><li><p>${mono('foo.cc')}</p></li></ul>`))
    expect(all(nodes, 'codeBlock')).toHaveLength(0)
    expect(marksOn(nodes, 'foo.cc')).toEqual(['code'])
  })

  test('blank lines are dropped (paragraph spacing comes from the typography)', () => {
    const nodes = paste(
      docs(
        `<br><p><span></span></p><p>${arial('a')}</p><br><br><p><span></span></p><p>${arial('b')}</p><br><p></p><hr><p></p><p>${arial('c')}</p><br><br>`
      )
    )
    expect(nodes.map((node) => (node.content ? textOf(node) : node.type))).toEqual([
      'a',
      'b',
      'horizontalRule',
      'c',
    ])
  })

  test('an image paragraph leaves no empty paragraph behind', () => {
    const nodes = paste(
      docs(`<p>${arial('a')}</p><p><span><img src="https://example.com/a.png"></span></p>`)
    )
    expect(nodes.map((node) => node.type)).toEqual(['paragraph', 'image'])
  })

  test('footnotes (#ftnt1 ↔ #ftnt_ref1) become footnote nodes', () => {
    const nodes = paste(
      `<p><span>Claim</span><sup><a href="#ftnt1" id="ftnt_ref1">[1]</a></sup></p>` +
        `<hr><div><p><a href="#ftnt_ref1" id="ftnt1">[1]</a><span>&nbsp;Source: a book.</span></p></div>`
    )
    const [ref] = all(nodes, 'footnoteReference')
    const [note] = all(nodes, 'footnote')
    expect(ref?.attrs?.id).toBe(note?.attrs?.id)
    expect(textOf(note!)).toBe('Source: a book.')
    expect(all(nodes, 'horizontalRule')).toHaveLength(0)
    expect(nodes.at(-1)?.type).toBe('footnotes')
  })

  test('the default link blue and underline are not stored; a chosen link colour is', () => {
    const nodes = paste(
      docs(
        `<p><a href="https://a.example"><span style="color:#1155cc;text-decoration:underline">blue</span></a> <a href="https://b.example"><span style="color:#cc0000;text-decoration:underline">red</span></a></p>`
      )
    )
    expect(marksOn(nodes, 'blue')).toEqual(['link'])
    expect(all(nodes, 'text').find((n) => n.text === 'red')?.marks).toContainEqual({
      type: 'textStyle',
      attrs: { color: '#cc0000' },
    })
  })
})

describe('Word', () => {
  const word = (body: string) =>
    `<html xmlns:o="urn:schemas-microsoft-com:office:office"><head><meta name=Generator content="Microsoft Word 15"><style>p.MsoNormal{margin:0}</style></head><body lang=EN-US><!--StartFragment-->${body}<!--EndFragment--></body></html>`
  const ref = (n: number, kind = 'ftn') =>
    `<a style='mso-${kind === 'ftn' ? 'foot' : 'end'}note-id:${kind}${n}' href="#_${kind}${n}" name="_${kind}ref${n}" title=""><span class=MsoFootnoteReference><span style='mso-special-character:footnote'><![if !supportFootnotes]><span class=MsoFootnoteReference>[${n}]</span><![endif]></span></span></a>`
  const list = (n: number, text: string, kind = 'ftn') =>
    `<div style='mso-element:${kind === 'ftn' ? 'foot' : 'end'}note-list'><![if !supportFootnotes]><br clear=all><hr align=left size=1 width="33%"><![endif]><div style='mso-element:${kind === 'ftn' ? 'foot' : 'end'}note' id=${kind}${n}><p class=MsoFootnoteText><a style='mso-${kind === 'ftn' ? 'foot' : 'end'}note-id:${kind}${n}' href="#_${kind}ref${n}" name="_${kind}${n}" title=""><span class=MsoFootnoteReference>[${n}]</span></a> ${text}<o:p></o:p></p></div></div>`

  test('footnotes become footnote nodes; the "[1]" back-link and separator rule go', () => {
    const nodes = paste(
      word(`<p class=MsoNormal>Claim${ref(1)} here.</p>${list(1, 'The source.')}`)
    )
    expect(nodes.map((node) => node.type)).toEqual(['paragraph', 'footnotes'])
    const [note] = all(nodes, 'footnote')
    expect(textOf(note!)).toBe('The source.')
    expect(all(nodes, 'footnoteReference')[0]?.attrs?.id).toBe(note?.attrs?.id)
    expect(textOf(nodes[0]!)).toBe('Claim here.')
  })

  test('endnotes (#_edn) too', () => {
    const nodes = paste(
      word(`<p class=MsoNormal>End${ref(1, 'edn')}.</p>${list(1, 'Endnote.', 'edn')}`)
    )
    expect(textOf(all(nodes, 'footnote'))).toBe('Endnote.')
  })

  test('two references to one note share it', () => {
    const nodes = paste(
      word(`<p class=MsoNormal>A${ref(1)} and B${ref(1)}.</p>${list(1, 'Shared.')}`)
    )
    const ids = all(nodes, 'footnoteReference').map((node) => node.attrs?.id)
    expect(ids).toHaveLength(2)
    expect(new Set(ids).size).toBe(1)
    expect(all(nodes, 'footnote')).toHaveLength(1)
  })

  test('a reference whose note was not copied keeps its number as plain superscript', () => {
    const nodes = paste(word(`<h4>Title${ref(24)}</h4>`))
    expect(all(nodes, 'footnoteReference')).toHaveLength(0)
    expect(marksOn(nodes, '24')).toEqual(['superscript'])
    expect(all(nodes, 'text').some((n) => n.marks?.some((m) => m.type === 'link'))).toBe(false)
  })

  test('review comments (anchors and the comment list) are not pasted as text', () => {
    const nodes = paste(
      word(
        `<p class=MsoNormal>Body<span class=MsoCommentReference><![if !supportAnnotations]><a class=msocomanchor id="_anchor_1" href="#_msocom_1" name="_msoanchor_1">[AB1]</a><![endif]></span></p>` +
          `<div style='mso-element:comment-list'><div style='mso-element:comment'><div id="_com_1" class=msocomtxt><p class=MsoCommentText>Reviewer note</p></div></div></div>`
      )
    )
    expect(textOf(nodes)).toBe('Body')
  })

  test('mso-list paragraphs become nested lists, bullets and numbers as list types', () => {
    const item = (level: number, marker: string, text: string) =>
      `<p class=MsoListParagraph style='margin-left:${level * 36}pt;mso-list:l0 level${level} lfo1'><![if !supportLists]><span style='font-family:Symbol'><span style='mso-list:Ignore'>${marker}<span style='font:7.0pt "Times New Roman"'>&nbsp;&nbsp;&nbsp; </span></span></span><![endif]>${text}<o:p></o:p></p>\n`
    const nodes = paste(
      word(
        `<p class=MsoNormal>Intro</p>${item(1, '·', 'Parser')}${item(2, 'o', 'Faster')}${item(2, 'o', 'Smaller')}${item(1, '·', 'Editor')}${item(1, '3.', 'Install')}${item(1, '4.', 'Run')}<p class=MsoNormal>Outro</p>`
      )
    )
    expect(nodes.map((node) => node.type)).toEqual([
      'paragraph',
      'bulletList',
      'orderedList',
      'paragraph',
    ])
    const [bullets, numbers] = [nodes[1]!, nodes[2]!]
    expect(textOf(bullets.content![0]!)).toBe('ParserFasterSmaller')
    expect(all([bullets.content![0]!], 'bulletList')).toHaveLength(1)
    expect(numbers.attrs?.start).toBe(3)
    expect(textOf(numbers)).toBe('InstallRun')
    expect(textOf(nodes)).not.toContain('·')
  })

  test('mso-highlight and background:yellow become highlights', () => {
    const nodes = paste(
      word(
        `<p class=MsoNormal><span style='mso-highlight:lime'>green</span> <span style='background:yellow;mso-highlight:yellow'>yellow</span></p>`
      )
    )
    expect(marksOn(nodes, 'green')).toContain('highlight')
    expect(marksOn(nodes, 'yellow')).toContain('highlight')
  })

  test('white text on a shaded cell keeps the shading as a highlight; with no shading it loses the colour', () => {
    const nodes = paste(
      word(
        `<table><tr><td style='background:#A100FF'><p class=MsoNormal><b><span style='color:white'>Banner</span></b></p></td></tr></table><p class=MsoNormal><span style='color:white'>Ghost</span></p>`
      )
    )
    const banner = all(nodes, 'text').find((n) => n.text === 'Banner')
    expect(banner?.marks?.find((m) => m.type === 'highlight')?.attrs?.color).toMatch(
      /a100ff|161, 0, 255/i
    )
    expect(marksOn(nodes, 'Ghost')).toEqual([])
  })

  test('local file:// images are dropped and counted, VML ones too', () => {
    const result = clean(
      word(
        `<p class=MsoNormal><a href="http://example.com/"><span><![if !vml]><img width=204 src="file:///C:/Users/x/clip_image001.jpg" v:shapes="Obraz_x0020_2"><![endif]></span></a></p>` +
          `<p class=MsoNormal><v:shape id="_x0000_s1026"><v:imagedata src="file:////Users/x/clip_image004.png"/></v:shape>Text</p>`
      )
    )
    expect(result.droppedImages).toBe(2)
    expect(result.html).not.toContain('file:')
    expect(paste(result.html).map((node) => node.type)).toEqual(['paragraph'])
  })
})

describe('LaTeXML (arXiv)', () => {
  const note = (role: string, mark: string, body: string) =>
    `<span class="ltx_note ltx_role_${role}"><sup class="ltx_note_mark">${mark}</sup><span class="ltx_note_outer"><span class="ltx_note_content"><sup class="ltx_note_mark">${mark}</sup><span class="ltx_note_type">${role}: </span><span class="ltx_tag ltx_tag_note">${mark}</span>${body}</span></span></span>`

  test('footnotes move out of the sentence into footnote nodes, math and all', () => {
    const math = `<math alttext="q" display="inline"><semantics><mi>q</mi><annotation encoding="application/x-tex">q</annotation></semantics></math>`
    const nodes = paste(
      `<p class="ltx_p">Scaled${note('footnote', '1', `Assume ${math} is random.`)} attention.</p>`
    )
    expect(textOf(nodes[0]!)).toBe('Scaled attention.')
    const [footnote] = all(nodes, 'footnote')
    expect(textOf(footnote!)).toBe('Assume  is random.')
    expect(all([footnote!], 'inlineMath')[0]?.attrs?.latex).toBe('q')
  })

  test('author "thanks" notes too, without the "thanks:" label', () => {
    const nodes = paste(
      `<div class="ltx_authors"><span class="ltx_personname">Ashish Vaswani</span>${note('thanks', '†', 'Equal contribution.')}</div>`
    )
    expect(textOf(all(nodes, 'footnote'))).toBe('Equal contribution.')
    expect(textOf(nodes)).not.toContain('thanks')
  })

  test('a \\footnotemark with no text of its own stays a superscript mark', () => {
    const nodes = paste(`<p>Noam Shazeer${note('footnotemark', '1', '')}</p>`)
    expect(all(nodes, 'footnote')).toHaveLength(0)
    expect(marksOn(nodes, '1')).toEqual(['superscript'])
  })

  test('citations keep their text; links into the bibliography go', () => {
    const nodes = paste(
      `<p>Recurrent models <cite class="ltx_cite ltx_citemacro_citep">[<a href="#bib.bib35" class="ltx_ref">35</a>, <a href="#bib.bib2" class="ltx_ref">2</a>]</cite>.</p><ul class="ltx_biblist"><li id="bib.bib2" class="ltx_bibitem">[2] Bahdanau et al.</li></ul>`
    )
    expect(textOf(nodes[0]!)).toBe('Recurrent models [35, 2].')
    expect(all(nodes, 'text').some((n) => n.marks?.some((m) => m.type === 'link'))).toBe(false)
  })

  test('an aligned equation group becomes one aligned block', () => {
    const cell = (tex: string) =>
      `<td class="ltx_td ltx_eqn_cell"><math alttext="${tex}" display="inline"><semantics><mi>x</mi><annotation encoding="application/x-tex">${tex}</annotation></semantics></math></td>`
    const nodes = paste(
      `<table class="ltx_equationgroup ltx_eqn_align ltx_eqn_table"><tbody><tr class="ltx_equation">${cell('\\displaystyle a')}${cell('\\displaystyle=b')}</tr></tbody><tbody><tr class="ltx_equation">${cell('\\displaystyle c')}${cell('\\displaystyle=d')}</tr></tbody></table>`
    )
    expect(all(nodes, 'blockMath')[0]?.attrs?.latex).toBe(
      '\\begin{aligned}a & =b \\\\ c & =d\\end{aligned}'
    )
  })
})

describe('Notion', () => {
  const todo = (text: string, checked = false) =>
    `<div data-virtual-item-slot="true"><div data-index="1"><div class="notion-selectable notion-to_do-block"><div><div class="notion-list-item-box-left"><input type="checkbox" disabled=""${checked ? ' checked=""' : ''}></div><div><div data-content-editable-leaf="true"${checked ? ' style="text-decoration: line-through;"' : ''}>${text}</div></div></div></div></div></div>`

  test('public-page to-do blocks become one task list', () => {
    const nodes = paste(
      `<div class="notion-page-content">${todo('Buy milk')}${todo('Call Bob', true)}</div>`
    )
    const lists = all(nodes, 'taskList')
    expect(lists).toHaveLength(1)
    expect(all(nodes, 'taskItem').map((item) => [textOf(item), item.attrs?.checked])).toEqual([
      ['Buy milk', false],
      ['Call Bob', true],
    ])
  })

  test('app clipboard "[ ]" / "[x]" items become task items; a mixed list is split', () => {
    const nodes = paste(
      `<ul><li><p>[ ]  Draft</p></li><li><p>[x] Ship</p></li><li><p>Notes</p></li></ul>`
    )
    expect(nodes.map((node) => node.type)).toEqual(['taskList', 'bulletList'])
    expect(all(nodes, 'taskItem').map((item) => [textOf(item), item.attrs?.checked])).toEqual([
      ['Draft', false],
      ['Ship', true],
    ])
  })

  test('inline code in an inline <div> stays inside its paragraph', () => {
    const nodes = paste(
      `<div data-content-editable-leaf="true">Click the <div class="notion-inline-code-container" style="display: inline;"><span style="font-family: SFMono-Regular, Menlo, Consolas, monospace; color: rgb(207, 81, 72);">+</span></div> button.</div>`
    )
    expect(nodes).toHaveLength(1)
    expect(textOf(nodes[0]!)).toBe('Click the + button.')
    expect(marksOn(nodes, '+')).toEqual(['code'])
  })

  test('attachment: images are dropped and counted', () => {
    const result = clean(`<p><img src="attachment:8bc8:logo.png" alt="logo.png"></p><p>Text</p>`)
    expect(result.droppedImages).toBe(1)
    expect(paste(result.html).map((node) => node.type)).toEqual(['paragraph'])
  })
})

describe('any source', () => {
  test('blank lines: one survives per run, none at the edges', () => {
    const nodes = paste('<p><br></p><p>a</p><p><br></p><p><br></p><p>b</p><p><br></p>')
    expect(nodes.map((node) => (node.content ? textOf(node) : node.type))).toEqual([
      'a',
      'paragraph',
      'b',
    ])
  })

  test('links to #anchors keep their text but not the link; other links stay', () => {
    const nodes = paste(
      `<p><a href="#S3">Section 3</a> and <a href="https://example.com/#top">site</a></p>`
    )
    expect(marksOn(nodes, 'Section 3')).toEqual([])
    expect(marksOn(nodes, 'site')).toEqual(['link'])
  })

  test('a table of contents is not mistaken for footnotes', () => {
    const nodes = paste(
      `<p><a href="#intro" id="toc-intro">Introduction</a></p><h2 id="intro"><a href="#toc-intro">Introduction</a></h2><p>Text</p>`
    )
    expect(all(nodes, 'footnote')).toHaveLength(0)
    expect(textOf(nodes)).toBe('Introduction\nIntroduction\nText')
  })

  test('Pandoc / markdown-it footnotes, including a note cited twice', () => {
    const nodes = paste(
      `<p>One<sup><a href="#fn1" id="fnref1">1</a></sup> two<sup><a href="#fn1" id="fnref1b">1</a></sup>.</p>` +
        `<section class="footnotes"><hr><ol><li id="fn1"><p>The note. <a href="#fnref1" class="footnote-back">↩︎</a></p></li></ol></section>`
    )
    expect(nodes.map((node) => node.type)).toEqual(['paragraph', 'footnotes'])
    expect(new Set(all(nodes, 'footnoteReference').map((n) => n.attrs?.id)).size).toBe(1)
    expect(all(nodes, 'footnoteReference')).toHaveLength(2)
    expect(textOf(all(nodes, 'footnote'))).toBe('The note.')
  })

  test('images: only what a reader could load is kept', () => {
    const srcs = [
      'https://example.com/a.png',
      '//cdn.example.com/b.png',
      '/c.png',
      'data:image/png;base64,iVBORw0KGgo=',
      'data:text/html;base64,PHA+',
      'file:///C:/d.png',
      'cid:image001.png@01D',
      'blob:https://other.example/1234',
      'webkit-fake-url://e.png',
      'relative/f.png',
    ]
    const result = clean(srcs.map((src) => `<img src="${src}">`).join(''))
    expect(result.droppedImages).toBe(6)
    expect(Array.from(result.html.matchAll(/src="([^"]+)"/g), (m) => m[1])).toEqual(
      srcs.slice(0, 4)
    )
  })

  test('relative image URLs resolve against a <base> in the clipboard HTML', () => {
    const result = clean(
      `<html><head><base href="https://arxiv.org/html/1706.03762v7/"></head><body><img src="Figures/a.png"></body></html>`
    )
    expect(result.droppedImages).toBe(0)
    expect(result.html).toContain('src="https://arxiv.org/html/1706.03762v7/Figures/a.png"')
  })

  test('GitHub-style checkbox items become task items', () => {
    const nodes = paste(
      `<ul class="contains-task-list"><li class="task-list-item"><input type="checkbox" disabled checked> Done</li><li class="task-list-item"><input type="checkbox" disabled> Todo</li></ul>`
    )
    expect(all(nodes, 'taskItem').map((item) => [textOf(item), item.attrs?.checked])).toEqual([
      ['Done', true],
      ['Todo', false],
    ])
  })

  test('VS Code-style monospace boxes become a code block', () => {
    const nodes = paste(
      `<div style="color: #d4d4d4;background-color: #1e1e1e;font-family: Menlo, Monaco, 'Courier New', monospace;white-space: pre;"><div><span style="color: #569cd6;">const</span> a = 1</div><div><br></div><div>run(a)</div></div>`
    )
    expect(nodes.map((node) => node.type)).toEqual(['codeBlock'])
    expect(textOf(nodes[0]!)).toBe('const a = 1\n\nrun(a)')
  })

  test('nothing but blank lines pastes nothing', () => {
    expect(paste(`<p><br></p><p>&nbsp;</p>`)).toEqual([])
  })

  test("Lemma's published HTML parses the same with and without cleanup (bar footnote ids)", () => {
    // No embed: happy-dom would fetch the YouTube iframe, which no browser does in an inert document.
    const content = (kitchenSink.content ?? []).filter((node) => node.type !== 'youtube')
    const html = renderToHTML({ ...kitchenSink, content })
    const ids = (nodes: JSONContent[]) => JSON.stringify(nodes).replace(/"id":"[^"]*"/g, '"id":"…"')
    expect(ids(paste(html))).toBe(ids(paste(html, false)))
    expect(all(paste(html), 'footnote').length).toBeGreaterThan(0)
  })

  test('markup that trips a rule still pastes, untouched', () => {
    const html = '<p>Text</p>'
    const original = DOMParser.prototype.parseFromString
    DOMParser.prototype.parseFromString = function (this: DOMParser, ...args) {
      const doc = original.apply(this, args)
      Object.defineProperty(doc.body, 'getElementsByTagName', {
        value: () => {
          throw new Error('boom')
        },
      })
      return doc
    }
    const warn = console.warn
    console.warn = () => {}
    try {
      expect(clean(html)).toEqual({ html, droppedImages: 0 })
    } finally {
      DOMParser.prototype.parseFromString = original
      console.warn = warn
    }
  })

  test("ProseMirror's own clipboard HTML is left alone", () => {
    const html = `<p data-pm-slice="1 1 []">a</p><p></p><p></p><p><a href="#x">b</a></p>`
    expect(clean(html)).toEqual({ html, droppedImages: 0 })
  })

  test('a copied cell range stays a cell range', () => {
    const html = clean(`<td><p>a</p></td><td><p>b</p></td>`).html
    expect(html).toBe('<td><p>a</p></td><td><p>b</p></td>')
  })
})

describe('Markdown in text/plain', () => {
  test('detection is conservative', () => {
    expect(looksLikeMarkdown('# Title\n\nBody')).toBe(true)
    expect(looksLikeMarkdown('Intro\n\n- one\n- two')).toBe(true)
    expect(looksLikeMarkdown('Energy:\n\n$$ E = mc^2 $$\n')).toBe(true)
    expect(looksLikeMarkdown('a | b\n--- | ---\n1 | 2')).toBe(true)
    expect(looksLikeMarkdown('That is **important** to me.')).toBe(true)
    expect(looksLikeMarkdown('Just a sentence. And another one.')).toBe(false)
    expect(looksLikeMarkdown('https://example.com/a_b_c')).toBe(false)
    expect(looksLikeMarkdown('It costs $5 and $10.\nOr 2**10 bytes.')).toBe(false)
    expect(looksLikeMarkdown('- just one dash line\nand text')).toBe(false)
  })

  test('one block the validator rejects does not flatten the rest', () => {
    const slice = markdownSlice('# Title\n\n>\n\n- a\n- b\n\n**`$$`** code in bold\n', schema)
    const types: string[] = []
    slice.content.forEach((node) => {
      types.push(node.type.name)
    })
    expect(types).toContain('heading')
    expect(types).toContain('bulletList')
  })
})

describe('PasteCleanup in an editor', () => {
  function editorWith(options: Partial<PasteCleanupOptions> = {}) {
    const element = document.createElement('div')
    document.body.append(element)
    return new Editor({
      element,
      extensions: [...contentExtensions, PasteCleanup.configure(options)],
    })
  }
  function pasteEvent(editor: Editor, data: Record<string, string>) {
    const transfer = new DataTransfer()
    for (const [type, value] of Object.entries(data)) transfer.setData(type, value)
    editor.view.dom.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: transfer, bubbles: true, cancelable: true })
    )
  }

  test('cleans pasted HTML, lands footnotes at the end and reports dropped images', () => {
    const dropped: number[] = []
    const editor = editorWith({ onDroppedImages: (count) => dropped.push(count) })
    editor.view.pasteHTML(
      `<p>Claim<sup><a href="#fn1" id="fnref1">1</a></sup></p><p><img src="file:///C:/a.png"></p><ol><li id="fn1"><p>Note. <a href="#fnref1">↩</a></p></li></ol>`
    )
    const json = editor.getJSON()
    expect(json.content?.map((node) => node.type)).toEqual(['paragraph', 'footnotes'])
    expect(textOf(all([json], 'footnote'))).toBe('Note.')
    expect(dropped).toEqual([1])
    editor.destroy()
  })

  test('Markdown that arrives as text only is parsed', () => {
    const editor = editorWith()
    pasteEvent(editor, { 'text/plain': '## Energy\n\n- one\n- **two**\n\n$$\nE = mc^2\n$$\n' })
    const types = editor.getJSON().content?.map((node) => node.type)
    expect(types).toEqual(['heading', 'bulletList', 'blockMath'])
    editor.destroy()
  })

  test('HTML wins over the Markdown text/plain sent with it', () => {
    const editor = editorWith()
    pasteEvent(editor, {
      'text/html': '<p>Rich <strong>text</strong></p>',
      'text/plain': '# Not a heading',
    })
    expect(editor.getJSON().content?.map((node) => node.type)).toEqual(['paragraph'])
    editor.destroy()
  })

  test('a plain-text paste (Shift+paste) stays plain', () => {
    const editor = editorWith()
    editor.view.pasteText('# Title\n\n- a')
    expect(editor.getJSON().content?.every((node) => node.type === 'paragraph')).toBe(true)
    editor.destroy()
  })

  // footnotes.ts transformPasted renames the second reference to an id it has
  // already seen in the same paste, so the first reference gets an empty note.
  test('two references to one pasted note both keep its text', () => {
    const editor = editorWith()
    editor.view.pasteHTML(
      `<p>A<sup><a href="#fn1" id="fnref1">1</a></sup> B<sup><a href="#fn1" id="fnref2">1</a></sup></p><ol><li id="fn1"><p>Shared. <a href="#fnref1">↩</a></p></li></ol>`
    )
    const json = editor.getJSON()
    expect(new Set(all([json], 'footnoteReference').map((n) => n.attrs?.id)).size).toBe(1)
    expect(textOf(all([json], 'footnote'))).toBe('Shared.')
    editor.destroy()
  })
})

// ---------------------------------------------------------------------------
// The Phase A corpus (skipped when the study checkout isn't there).

const corpus = loadCorpus()

/**
 * Out of Word's source counts: review comments (not document content) and the
 * typed-out list markers ("·", "1.") that the rebuilt lists render themselves.
 */
function withoutWordChrome(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  for (const el of doc.querySelectorAll(
    'a.msocomanchor, div[style*="mso-element:comment-list"], span[style*="mso-list:Ignore"]'
  )) {
    el.remove()
  }
  return doc.documentElement.outerHTML
}

describe.skipIf(corpus.length === 0)('Phase A corpus', () => {
  for (const fixture of corpus) {
    const key = `${fixture.source}/${fixture.name}`
    test(key, () => {
      const source = classifyHTML(
        fixture.source === 'word' ? withoutWordChrome(fixture.html) : fixture.html
      )
      const pasted = pasteHTML(fixture.html)
      const result = classifyElement(pasted.dom)
      const nodes = (pasted.slice.content.toJSON() as JSONContent[] | null) ?? []
      const ratio = (metric: keyof typeof source) =>
        (result[metric] as number) / Math.max(1, source[metric] as number)

      // Text: everything arrives once (no duplicated TeX, no inlined notes).
      if (source.alnum > 0) {
        expect(ratio('alnum')).toBeGreaterThanOrEqual(0.97)
        expect(ratio('alnum')).toBeLessThanOrEqual(1.03)
      }
      expect(result.internalLinks).toBe(0)
      expect(blankParagraphs(pasted.slice.content).longestRun).toBeLessThanOrEqual(1)
      for (const image of all(nodes, 'image')) {
        expect(image.attrs?.src).toMatch(/^(https?:|data:image\/|\/)/)
      }
      if (source.math > 0) expect(ratio('math')).toBeGreaterThanOrEqual(0.95)
      if (source.code > 0) expect(ratio('code')).toBeGreaterThanOrEqual(0.9)
      if (source.highlight > 0) expect(ratio('highlight')).toBeGreaterThanOrEqual(0.9)
      if (source.tasks > 0) expect(result.tasks).toBeGreaterThanOrEqual(source.tasks)

      // Notion's app clipboard writes to-dos as "[ ]" / "[x]" list items.
      const checkboxItems = (fixture.html.match(/<li>\s*(<p>)?\[[ xX]\]/g) ?? []).length
      expect(all(nodes, 'taskItem').length).toBeGreaterThanOrEqual(checkboxItems)

      // Math comes in as math, not as its TeX source spelled out next to it.
      const host = document.createElement('div')
      host.innerHTML = fixture.html
      for (const annotation of host.querySelectorAll('annotation[encoding="application/x-tex"]')) {
        const tex = annotation.textContent?.trim() ?? ''
        if (tex.length >= 3 && /[\\_^{]/.test(tex)) expect(result.text).not.toContain(tex)
      }

      if (fixture.source === 'word') {
        // Word's typed-out bullets and numbers become real list items.
        const listParagraphs = (fixture.html.match(/<p[^>]*mso-list:\s*l\d/g) ?? []).length
        expect(all(nodes, 'listItem').length).toBeGreaterThanOrEqual(
          listParagraphs + source.listItems
        )
      }
      if (fixture.source === 'word' && /mso-element:footnote-list/.test(fixture.html)) {
        expect(all(nodes, 'footnote').length).toBeGreaterThan(0)
        expect(all(nodes, 'footnoteReference').length).toBeGreaterThan(0)
      }

      if (fixture.source === 'arxiv') {
        expect(result.text).not.toContain('hth_{t}')
        // Every note with text of its own is a footnote, and its text is not in the body.
        const notes = Array.from(host.querySelectorAll('.ltx_note_content'))
          .map((content) => {
            const copy = content.cloneNode(true) as Element
            for (const junk of copy.querySelectorAll(
              '.ltx_note_mark, .ltx_note_type, .ltx_tag_note'
            )) {
              junk.remove()
            }
            return copy.textContent?.replace(/\s+/g, ' ').trim() ?? ''
          })
          .filter(Boolean)
        expect(all(nodes, 'footnote')).toHaveLength(notes.length)
        const body = textOf(nodes.filter((node) => node.type !== 'footnotes'))
        for (const note of notes) expect(body).not.toContain(note.slice(0, 40))
        expect(body).not.toMatch(/thanks:|footnotemark:/)
        // Citations keep their visible text, in order.
        const flat = result.text.replace(/\s+/g, ' ')
        let at = 0
        for (const cite of host.querySelectorAll('cite.ltx_cite')) {
          const text = cite.textContent?.replace(/\s+/g, ' ').trim() ?? ''
          const found = flat.indexOf(text, at)
          expect(found).toBeGreaterThanOrEqual(0)
          at = found + text.length
        }
      }
    })
  }
})
