import { escapeHtml } from '../sanitize'

// Formatted output is built twice in lockstep: plain text, and HTML that is
// escaped everywhere and only ever contains <i> and <sup>.

export type Rich = { text: string; html: string }

/** Strings are plain text; falsy values are skipped. */
export type RichLike = Rich | string | null | undefined | false

export const EMPTY: Rich = { text: '', html: '' }

export function rich(value: RichLike): Rich {
  if (!value) return EMPTY
  return typeof value === 'string' ? { text: value, html: escapeHtml(value) } : value
}

export function italic(value: RichLike): Rich {
  const r = rich(value)
  return r.text ? { text: r.text, html: `<i>${r.html}</i>` } : EMPTY
}

export function superscript(value: RichLike): Rich {
  const r = rich(value)
  return r.text ? { text: r.text, html: `<sup>${r.html}</sup>` } : EMPTY
}

export function cat(...parts: RichLike[]): Rich {
  let text = ''
  let html = ''
  for (const part of parts) {
    const r = rich(part)
    text += r.text
    html += r.html
  }
  return { text, html }
}

/** Join the non-empty parts with a separator. */
export function join(parts: RichLike[], separator: RichLike): Rich {
  const present = parts.map(rich).filter((r) => r.text)
  const sep = rich(separator)
  let text = ''
  let html = ''
  present.forEach((r, i) => {
    if (i) {
      text += sep.text
      html += sep.html
    }
    text += r.text
    html += r.html
  })
  return { text, html }
}

/** Surround with affixes, but only when there is something to surround. */
export function wrap(before: string, value: RichLike, after: string): Rich {
  const r = rich(value)
  return r.text ? cat(before, r, after) : EMPTY
}

const TERMINAL = /[.?!]["”’]?$/

export function endsWithTerminal(value: RichLike): boolean {
  return TERMINAL.test(rich(value).text)
}

/** Add a closing period unless the text already ends a sentence. */
export function dot(value: RichLike): Rich {
  const r = rich(value)
  if (!r.text || TERMINAL.test(r.text)) return r
  return cat(r, '.')
}

/**
 * A title in curly quotes with trailing punctuation moved inside, as in
 * American usage: “Title,” — dropped when the title ends in ? or !.
 */
export function quoted(title: string, punctuation = ''): Rich {
  const mark = punctuation && !/[.?!]$/.test(title) ? punctuation : ''
  return rich(`“${title}${mark}”`)
}
