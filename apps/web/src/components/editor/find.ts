import { Extension } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey, TextSelection, type Transaction } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

/**
 * Find & replace in the open document: matches are highlighted, the current
 * one scrolled to; replacing keeps each match's formatting. Code blocks are
 * skipped, as in the book-wide replace (see books.replaceAll).
 */

export type FindQuery = { query: string; caseSensitive: boolean; wholeWord: boolean }
type Match = { from: number; to: number }
export type FindState = FindQuery & {
  matches: Match[]
  current: number
  decorations: DecorationSet
}

export const findKey = new PluginKey<FindState>('find')

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    find: {
      setFind: (query: FindQuery) => ReturnType
      findStep: (by: 1 | -1) => ReturnType
      replaceCurrent: (text: string) => ReturnType
      replaceAllMatches: (text: string) => ReturnType
      clearFind: () => ReturnType
    }
  }
}

function pattern({ query, caseSensitive, wholeWord }: FindQuery): RegExp | null {
  if (!query) return null
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const source = wholeWord ? `(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])` : escaped
  return new RegExp(source, caseSensitive ? 'gu' : 'giu')
}

function findMatches(doc: PMNode, query: FindQuery): Match[] {
  const regex = pattern(query)
  if (!regex) return []
  const matches: Match[] = []
  doc.descendants((node, pos) => {
    if (node.type.spec.code) return false
    if (!node.isTextblock) return true
    // Runs of text between inline nodes, matched on their own.
    let run = ''
    let runStart = -1
    const flush = () => {
      if (run) {
        for (const found of run.matchAll(regex)) {
          const from = runStart + (found.index ?? 0)
          matches.push({ from, to: from + found[0].length })
        }
      }
      run = ''
      runStart = -1
    }
    node.forEach((child, offset) => {
      if (child.isText) {
        if (runStart === -1) runStart = pos + 1 + offset
        run += child.text ?? ''
      } else flush()
    })
    flush()
    return false
  })
  return matches
}

const EMPTY: FindState = {
  query: '',
  caseSensitive: false,
  wholeWord: false,
  matches: [],
  current: -1,
  decorations: DecorationSet.empty,
}

function decorate(doc: PMNode, matches: Match[], current: number) {
  return DecorationSet.create(
    doc,
    matches.map((match, index) =>
      Decoration.inline(match.from, match.to, {
        class: index === current ? 'find-match is-current' : 'find-match',
      })
    )
  )
}

function build(doc: PMNode, query: FindQuery, near: number): FindState {
  const matches = findMatches(doc, query)
  // Start at the first match after the caret.
  const after = matches.findIndex((match) => match.from >= near)
  const current = matches.length === 0 ? -1 : after === -1 ? 0 : after
  return { ...query, matches, current, decorations: decorate(doc, matches, current) }
}

const select = (tr: Transaction, match: Match | undefined) =>
  match ? tr.setSelection(TextSelection.create(tr.doc, match.from, match.to)).scrollIntoView() : tr

export const Find = Extension.create({
  name: 'find',

  addCommands() {
    return {
      setFind:
        (query) =>
        ({ state, tr, dispatch }) => {
          if (dispatch) dispatch(tr.setMeta(findKey, { set: query, near: state.selection.from }))
          return true
        },
      findStep:
        (by) =>
        ({ state, tr, dispatch }) => {
          const find = findKey.getState(state)
          if (!find || find.matches.length === 0) return false
          const current = (find.current + by + find.matches.length) % find.matches.length
          if (dispatch) dispatch(select(tr.setMeta(findKey, { current }), find.matches[current]))
          return true
        },
      replaceCurrent:
        (text) =>
        ({ state, tr, dispatch }) => {
          const find = findKey.getState(state)
          const match = find?.matches[find.current]
          if (!find || !match) return false
          if (dispatch) {
            // insertText keeps the marks of the text it replaces.
            tr.insertText(text, match.from, match.to)
            dispatch(tr.setMeta(findKey, { set: find, near: match.from + text.length }))
          }
          return true
        },
      replaceAllMatches:
        (text) =>
        ({ state, tr, dispatch }) => {
          const find = findKey.getState(state)
          if (!find || find.matches.length === 0) return false
          if (dispatch) {
            // One transaction: one undo step for the whole replace.
            for (const match of [...find.matches].reverse())
              tr.insertText(text, match.from, match.to)
            dispatch(tr.setMeta(findKey, { set: find, near: 0 }))
          }
          return true
        },
      clearFind:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) dispatch(tr.setMeta(findKey, { clear: true }))
          return true
        },
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<FindState>({
        key: findKey,
        state: {
          init: () => EMPTY,
          apply: (tr, value) => {
            const meta = tr.getMeta(findKey) as
              | { set?: FindQuery; near?: number; current?: number; clear?: boolean }
              | undefined
            if (meta?.clear) return EMPTY
            if (meta?.set) return build(tr.doc, meta.set, meta.near ?? 0)
            if (meta?.current !== undefined) {
              return {
                ...value,
                current: meta.current,
                decorations: decorate(tr.doc, value.matches, meta.current),
              }
            }
            if (tr.docChanged && value.query) return build(tr.doc, value, tr.selection.from)
            return value
          },
        },
        props: { decorations: (state) => findKey.getState(state)?.decorations },
      }),
    ]
  },
})
