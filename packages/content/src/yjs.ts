import type { JSONContent } from '@tiptap/core'
import {
  defaultDeleteFilter,
  defaultProtectedNodes,
  prosemirrorJSONToYXmlFragment,
  updateYFragment,
  ySyncPluginKey,
  yXmlFragmentToProsemirrorJSON,
} from '@tiptap/y-tiptap'
import * as Y from 'yjs'

import {
  carryBlockIds,
  ensureYBlockIds,
  getContentSchema,
  toPlainJSON,
  validateContent,
} from './schema'

/**
 * Layout of a Lemma document as a Yjs doc. The body uses the field the Tiptap
 * Collaboration extension binds to; title and subtitle are plain Y.Text so
 * concurrent edits to them merge like the body does.
 */
export const BODY_FIELD = 'default'
export const TITLE_FIELD = 'title'
export const SUBTITLE_FIELD = 'subtitle'
/** Y.Map holding `schemaVersion`. */
export const META_FIELD = 'meta'

/**
 * Version of the document model a Yjs document is written in.
 *
 * Bump it, and add a migration below, whenever a node, mark or attribute is
 * added or changes meaning. An editor running older code silently drops what
 * its schema doesn't know (y-prosemirror deletes unknown nodes and attributes
 * when it touches them), so the room migrates documents on load and refuses
 * editors older than the document. test/schema-contract.test.ts fails if the
 * schema changes without a bump.
 */
export const SCHEMA_VERSION = 1

const MIGRATIONS: Record<number, (ydoc: Y.Doc) => void> = {
  // 0 → 1: every block gets a stable id.
  1: (ydoc) => {
    ensureYBlockIds(ydoc.getXmlFragment(BODY_FIELD))
  },
}

export function readSchemaVersion(ydoc: Y.Doc): number {
  const version = ydoc.getMap(META_FIELD).get('schemaVersion')
  return typeof version === 'number' ? version : 0
}

/** Bring a document up to SCHEMA_VERSION. Returns the version it started at. */
export function migrateYDoc(ydoc: Y.Doc, origin?: unknown): number {
  const from = readSchemaVersion(ydoc)
  if (from >= SCHEMA_VERSION) return from
  ydoc.transact(() => {
    for (let version = from + 1; version <= SCHEMA_VERSION; version++) MIGRATIONS[version]?.(ydoc)
    ydoc.getMap(META_FIELD).set('schemaVersion', SCHEMA_VERSION)
  }, origin)
  return from
}

export type DocumentFields = {
  title: string
  subtitle: string
  content: JSONContent
}

const EMPTY_DOC: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] }

export function readBody(ydoc: Y.Doc): JSONContent {
  const fragment = ydoc.getXmlFragment(BODY_FIELD)
  if (fragment.length === 0) return EMPTY_DOC
  const raw = yXmlFragmentToProsemirrorJSON(fragment)
  // Canonicalise through the schema (fills defaults, drops empty attrs).
  try {
    return toPlainJSON(getContentSchema().nodeFromJSON(raw))
  } catch {
    return validateContent(raw)
  }
}

export function readFields(ydoc: Y.Doc): DocumentFields {
  return {
    title: ydoc.getText(TITLE_FIELD).toString(),
    subtitle: ydoc.getText(SUBTITLE_FIELD).toString(),
    content: readBody(ydoc),
  }
}

/** Replace a Y.Text's value with the smallest edit (common prefix/suffix kept). */
export function setText(text: Y.Text, next: string): void {
  const current = text.toString()
  if (current === next) return
  let start = 0
  const max = Math.min(current.length, next.length)
  while (start < max && current[start] === next[start]) start++
  let end = 0
  while (end < max - start && current[current.length - 1 - end] === next[next.length - 1 - end]) {
    end++
  }
  text.delete(start, current.length - start - end)
  text.insert(start, next.slice(start, next.length - end))
}

/**
 * Make the body equal `content` as a minimal diff against what's there, so an
 * API write lands as an ordinary edit that open editors merge, not a reset.
 * `content` must already be validated.
 */
export function writeBody(ydoc: Y.Doc, content: JSONContent, origin?: unknown): void {
  const schema = getContentSchema()
  const fragment = ydoc.getXmlFragment(BODY_FIELD)
  ydoc.transact(() => {
    if (fragment.length === 0) {
      prosemirrorJSONToYXmlFragment(schema, content, fragment)
    } else {
      // Unchanged blocks keep their ids (a whole-document write would
      // otherwise strip them).
      const withIds = carryBlockIds(content, readBody(ydoc))
      updateYFragment(ydoc, fragment, schema.nodeFromJSON(withIds), {
        mapping: new Map(),
        isOMark: new Map(),
      })
    }
    ensureYBlockIds(fragment)
  }, origin)
}

export function writeFields(ydoc: Y.Doc, fields: Partial<DocumentFields>, origin?: unknown): void {
  ydoc.transact(() => {
    if (fields.title !== undefined) setText(ydoc.getText(TITLE_FIELD), fields.title)
    if (fields.subtitle !== undefined) setText(ydoc.getText(SUBTITLE_FIELD), fields.subtitle)
    if (fields.content !== undefined) writeBody(ydoc, fields.content, origin)
  }, origin)
}

/** Origin for the writer's own title/subtitle edits (tracked by undo). */
export const FIELD_EDIT_ORIGIN = 'field-edit'

/**
 * One undo history for the title, subtitle and body, as in a single page:
 * ⌘Z steps back through the writer's own edits in order, wherever they were,
 * and never undoes edits from other tabs or devices. Pass it to the editor's
 * Collaboration extension (`yUndoOptions.undoManager`) and use it for the
 * title and subtitle fields.
 */
export function createUndoManager(ydoc: Y.Doc): Y.UndoManager {
  return new Y.UndoManager(
    [ydoc.getXmlFragment(BODY_FIELD), ydoc.getText(TITLE_FIELD), ydoc.getText(SUBTITLE_FIELD)],
    {
      trackedOrigins: new Set([ySyncPluginKey, FIELD_EDIT_ORIGIN]),
      deleteFilter: (item) => defaultDeleteFilter(item, defaultProtectedNodes),
      captureTransaction: (transaction) => transaction.meta.get('addToHistory') !== false,
    }
  )
}

/** Build a fresh Yjs doc from stored JSON (legacy rows, imports). */
export function createYDoc(fields: Partial<DocumentFields>): Y.Doc {
  const ydoc = new Y.Doc()
  ydoc.transact(() => {
    writeFields(ydoc, {
      ...fields,
      content: fields.content ? validateContent(fields.content) : undefined,
    })
    ydoc.getMap(META_FIELD).set('schemaVersion', SCHEMA_VERSION)
  })
  return ydoc
}

/**
 * Wire protocol between the editor and its DocumentRoom: the y-websocket
 * message types (so the stock provider works), plus MESSAGE_SAVED. The room
 * answers every sync step 2 / update a client sends with MESSAGE_SAVED once
 * that message is durably stored, in order, so a client knows exactly what has
 * reached the server. (State vectors can't tell: deletions don't advance them.)
 */
export const MESSAGE_SYNC = 0
export const MESSAGE_AWARENESS = 1
export const MESSAGE_AUTH = 2
export const MESSAGE_QUERY_AWARENESS = 3
export const MESSAGE_SAVED = 100

/** Editors pass their SCHEMA_VERSION in this URL parameter when connecting. */
export const SCHEMA_VERSION_PARAM = 'schema'
/**
 * Close code for an editor older than the document's schema: it must reload
 * before it may sync (its unsynced edits stay on the device). 4400–4499 is
 * terminal for y-websocket, so it stops reconnecting.
 */
export const CLOSE_OUTDATED_EDITOR = 4426

/** y-protocols sync sub-types. */
export const SYNC_STEP_1 = 0
export const SYNC_STEP_2 = 1
export const SYNC_UPDATE = 2
