import { describe, expect, test } from 'bun:test'
import type { JSONContent } from '@tiptap/core'
import * as Y from 'yjs'

import {
  BLOCK_ID_PATTERN,
  blockChanges,
  carryBlockIds,
  newBlockId,
  stripBlockIds,
} from '../src/schema'
import {
  BODY_FIELD,
  createYDoc,
  META_FIELD,
  migrateYDoc,
  readBody,
  readSchemaVersion,
  SCHEMA_VERSION,
  writeBody,
} from '../src/yjs'

const p = (text: string, id?: string): JSONContent => ({
  type: 'paragraph',
  ...(id ? { attrs: { id } } : {}),
  content: [{ type: 'text', text }],
})
const doc = (...content: JSONContent[]): JSONContent => ({ type: 'doc', content })

function blockIds(node: JSONContent, out: string[] = []): string[] {
  if (node.type !== 'doc' && node.type !== 'text' && node.attrs && 'id' in node.attrs) {
    out.push(node.attrs.id as string)
  }
  for (const child of node.content ?? []) blockIds(child, out)
  return out
}

describe('block ids', () => {
  test('are short, start with a letter, and are unique', () => {
    const ids = new Set(Array.from({ length: 10_000 }, newBlockId))
    expect(ids.size).toBe(10_000)
    for (const id of ids) expect(id).toMatch(BLOCK_ID_PATTERN)
  })

  test('a new Yjs document gives every block an id and records the schema version', () => {
    const ydoc = createYDoc({
      title: 'T',
      content: doc(p('one'), {
        type: 'bulletList',
        content: [{ type: 'listItem', content: [p('item')] }],
      }),
    })
    const ids = blockIds(readBody(ydoc))
    expect(ids).toHaveLength(3) // paragraph, list item, paragraph inside it
    expect(new Set(ids).size).toBe(3)
    for (const id of ids) expect(id).toMatch(BLOCK_ID_PATTERN)
    expect(readSchemaVersion(ydoc)).toBe(SCHEMA_VERSION)
  })

  test('a whole-document write keeps the ids of blocks that did not change', () => {
    const ydoc = createYDoc({ content: doc(p('alpha'), p('beta'), p('gamma')) })
    const [a, b, c] = blockIds(readBody(ydoc))
    // An API client sends the whole document back without ids, with beta edited
    // and a new block inserted before gamma.
    writeBody(ydoc, doc(p('alpha'), p('beta edited'), p('new'), p('gamma')))
    const after = readBody(ydoc)
    const ids = blockIds(after)
    expect(ids[0]).toBe(a as string)
    expect(ids[3]).toBe(c as string)
    expect(ids[1]).not.toBe(b as string) // changed content: new identity
    expect(new Set(ids).size).toBe(4)
  })

  test('duplicate ids in an incoming write are re-assigned', () => {
    const incoming = doc(p('one', 'aaaaaaaaaa'), p('two', 'aaaaaaaaaa'))
    const ids = blockIds(carryBlockIds(incoming, doc()))
    expect(ids[0]).toBe('aaaaaaaaaa')
    expect(ids[1]).not.toBe('aaaaaaaaaa')
  })

  test('stripBlockIds removes ids but keeps footnote ids', () => {
    const stripped = stripBlockIds(
      doc(p('x', 'abcdefghij'), {
        type: 'footnotes',
        content: [{ type: 'footnote', attrs: { id: 'fn-1' }, content: [p('note', 'bcdefghijk')] }],
      })
    )
    expect(JSON.stringify(stripped)).not.toContain('abcdefghij')
    expect(JSON.stringify(stripped)).not.toContain('bcdefghijk')
    expect(JSON.stringify(stripped)).toContain('fn-1')
  })
})

describe('schema migration', () => {
  test('a version-0 document gets ids and is marked current', () => {
    // As written by the Phase B build: no ids, no version.
    const ydoc = new Y.Doc()
    const fragment = ydoc.getXmlFragment(BODY_FIELD)
    const para = new Y.XmlElement('paragraph')
    para.insert(0, [new Y.XmlText('hello')])
    const dup1 = new Y.XmlElement('paragraph')
    dup1.setAttribute('id', 'dupdupdupd')
    const dup2 = new Y.XmlElement('paragraph')
    dup2.setAttribute('id', 'dupdupdupd')
    fragment.insert(0, [para, dup1, dup2])

    expect(readSchemaVersion(ydoc)).toBe(0)
    expect(migrateYDoc(ydoc, 'test')).toBe(0)
    expect(readSchemaVersion(ydoc)).toBe(SCHEMA_VERSION)
    const ids = blockIds(readBody(ydoc))
    expect(ids).toHaveLength(3)
    expect(new Set(ids).size).toBe(3)
    expect(ids[1]).toBe('dupdupdupd')
  })

  test('is a no-op on a current document', () => {
    const ydoc = createYDoc({ content: doc(p('x')) })
    const before = Y.encodeStateVector(ydoc)
    expect(migrateYDoc(ydoc)).toBe(SCHEMA_VERSION)
    expect(Y.encodeStateVector(ydoc)).toEqual(before)
    expect(ydoc.getMap(META_FIELD).get('schemaVersion')).toBe(SCHEMA_VERSION)
  })
})

describe('blockChanges', () => {
  test('reports added, removed and changed innermost blocks', () => {
    const from = doc(p('same', 'aaaaaaaaaa'), p('old', 'bbbbbbbbbb'), p('gone', 'cccccccccc'), {
      type: 'bulletList',
      content: [
        { type: 'listItem', attrs: { id: 'dddddddddd' }, content: [p('item', 'eeeeeeeeee')] },
      ],
    })
    const to = doc(p('same', 'aaaaaaaaaa'), p('new text', 'bbbbbbbbbb'), p('fresh', 'ffffffffff'), {
      type: 'bulletList',
      content: [
        { type: 'listItem', attrs: { id: 'dddddddddd' }, content: [p('item!', 'eeeeeeeeee')] },
      ],
    })
    expect(blockChanges(from, to)).toEqual({
      added: ['ffffffffff'],
      removed: ['cccccccccc'],
      changed: ['bbbbbbbbbb', 'eeeeeeeeee'],
    })
  })
})
