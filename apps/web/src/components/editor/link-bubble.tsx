import { useEditor, useEditorState } from '@lemma/headless'
import type { Editor } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import { BubbleMenu } from '@tiptap/react/menus'
import { Copy, ExternalLink, Pencil, Unlink } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '../ui/button'

const linkBubbleKey = new PluginKey('linkBubble')
// Module-level: a new options object per render would re-send them to every
// bubble menu (see EditorBubble in @lemma/headless).
const OPTIONS = { placement: 'bottom-start', offset: 6, shift: { padding: 8 } } as const

const shouldShow = ({ editor }: { editor: Editor }) =>
  editor.isEditable && editor.state.selection.empty && editor.isActive('link')

function displayUrl(href: string): string {
  try {
    const url = new URL(href)
    if (url.protocol === 'mailto:') return url.pathname
    return `${url.host}${url.pathname === '/' ? '' : url.pathname}${url.search}`
  } catch {
    return href
  }
}

/**
 * With the caret in a link: where it goes, and open / edit / copy / unlink.
 * Edit selects the link and opens the link field (as ⌘K does).
 */
export function LinkBubble({ onEdit }: { onEdit: () => void }) {
  const { editor } = useEditor()
  // The link under the caret, re-read as the caret moves between links.
  const current = useEditorState({
    editor,
    selector: ({ editor: e }) => (e ? String(e.getAttributes('link').href ?? '') : ''),
  })
  if (!editor) return null

  const href = () => current ?? ''

  return (
    <BubbleMenu
      editor={editor as unknown as Parameters<typeof BubbleMenu>[0]['editor']}
      pluginKey={linkBubbleKey}
      shouldShow={shouldShow as Parameters<typeof BubbleMenu>[0]['shouldShow']}
      options={OPTIONS}
      className='link-bubble flex max-w-[min(26rem,92vw)] items-center gap-0.5 rounded-lg border border-border/80 bg-popover p-1 text-sm shadow-lg'
    >
      <a
        href={href()}
        target='_blank'
        rel='noreferrer'
        className='min-w-0 truncate rounded-md px-2 py-1 text-muted-foreground hover:text-foreground'
        title={href()}
      >
        {displayUrl(href())}
      </a>
      <Button
        type='button'
        variant='ghost'
        size='icon-sm'
        aria-label='Open link'
        onClick={() => window.open(href(), '_blank', 'noopener,noreferrer')}
      >
        <ExternalLink />
      </Button>
      <Button
        type='button'
        variant='ghost'
        size='icon-sm'
        aria-label='Copy link'
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(href())
            toast.success('Link copied')
          } catch {
            toast.error('Could not copy the link')
          }
        }}
      >
        <Copy />
      </Button>
      <Button
        type='button'
        variant='ghost'
        size='icon-sm'
        aria-label='Edit link'
        onClick={() => {
          editor.chain().focus().extendMarkRange('link').run()
          onEdit()
        }}
      >
        <Pencil />
      </Button>
      <Button
        type='button'
        variant='ghost'
        size='icon-sm'
        aria-label='Remove link'
        onClick={() => editor.chain().focus().extendMarkRange('link').unsetLink().run()}
      >
        <Unlink />
      </Button>
    </BubbleMenu>
  )
}
