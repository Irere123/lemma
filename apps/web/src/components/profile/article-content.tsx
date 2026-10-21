import { useEffect, useRef } from 'react'

import { cn } from '@/lib/utils'

// Wide enough for a note column beside the text (see .sidenote in app.css).
const SIDENOTE_MEDIA = '(min-width: 1280px)'

/**
 * Footnotes as margin notes on wide screens: each note sits beside the line
 * that references it (pushed down when notes would overlap), and the list at
 * the end is hidden. Narrow screens keep the endnotes.
 */
function useSidenotes(
  root: React.RefObject<HTMLDivElement | null>,
  html: string | null | undefined
) {
  useEffect(() => {
    const container = root.current
    const prose = container?.querySelector<HTMLElement>('.writer-prose')
    if (!container || !prose) return
    const media = window.matchMedia(SIDENOTE_MEDIA)
    let notes: HTMLElement[] = []
    let frame = 0
    let disposed = false

    const clear = () => {
      for (const note of notes) note.remove()
      notes = []
      container.classList.remove('has-sidenotes')
    }

    const layout = () => {
      clear()
      if (!media.matches) return
      const refs = prose.querySelectorAll<HTMLAnchorElement>('sup.footnote-ref > a[href^="#fn-"]')
      if (refs.length === 0) return
      container.classList.add('has-sidenotes')
      const origin = prose.getBoundingClientRect().top
      let lastBottom = Number.NEGATIVE_INFINITY
      for (const ref of refs) {
        const item = prose.querySelector(`li[id="${CSS.escape(ref.hash.slice(1))}"]`)
        if (!item) continue
        const note = document.createElement('aside')
        note.className = 'sidenote'
        note.setAttribute('role', 'note')
        const number = document.createElement('span')
        number.className = 'sidenote-number'
        number.textContent = ref.textContent ?? ''
        note.appendChild(number)
        for (const child of item.childNodes) {
          const copy = child.cloneNode(true)
          if (copy instanceof Element) copy.querySelector('.footnote-backref')?.remove()
          if (copy instanceof Element && copy.classList.contains('footnote-backref')) continue
          note.appendChild(copy)
        }
        prose.appendChild(note)
        const top = Math.max(ref.getBoundingClientRect().top - origin, lastBottom + 14)
        note.style.top = `${top}px`
        lastBottom = top + note.offsetHeight
        notes.push(note)
      }
    }

    const schedule = () => {
      // A late callback (fonts loading) after cleanup must not lay out again.
      if (disposed) return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(layout)
    }
    schedule()
    // Images and web fonts move lines after first layout.
    void document.fonts?.ready.then(schedule)
    prose.addEventListener('load', schedule, true)
    media.addEventListener('change', schedule)
    window.addEventListener('resize', schedule)
    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      prose.removeEventListener('load', schedule, true)
      media.removeEventListener('change', schedule)
      window.removeEventListener('resize', schedule)
      clear()
    }
  }, [root, html])
}

/**
 * Reader body: the HTML the server rendered from the document (escaped,
 * URL- and colour-sanitised by @lemma/content, math pre-rendered by KaTeX,
 * citations formatted, figures and equations numbered). No editor ships to
 * readers.
 */
export function ArticleBody({ html, className }: { html?: string | null; className?: string }) {
  const root = useRef<HTMLDivElement>(null)
  useSidenotes(root, html)
  return (
    <div ref={root} className={cn('writer-editor', className)}>
      {/* Rendered and sanitised by @lemma/content on the server. */}
      <div className='writer-prose relative' dangerouslySetInnerHTML={{ __html: html ?? '' }} />
    </div>
  )
}
