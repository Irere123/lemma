import { expect, test } from 'bun:test'
import { describeSchema, getContentSchema } from '@lemma/content/schema'
import { createUndoManager } from '@lemma/content/yjs'
import { getSchema } from '@tiptap/core'
import * as Y from 'yjs'

import { createEditorExtensions } from '../src/components/editor/extensions'

// The editor layers behaviour (node views, keymaps, upload, drag) on the shared
// model but must store exactly what @lemma/content defines, renders, validates
// and migrates. A node, mark or attribute added only in the editor fails here.
test('the editor stores exactly the shared document model', () => {
  const doc = new Y.Doc()
  const extensions = createEditorExtensions({
    doc,
    undoManager: createUndoManager(doc),
    onEditMath: () => {},
  })
  expect(describeSchema(getSchema(extensions))).toEqual(describeSchema(getContentSchema()))
})
