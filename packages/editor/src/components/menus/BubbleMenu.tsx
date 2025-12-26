import { BubbleMenu as TiptapBubbleMenu, type Editor } from '@tiptap/react'
import { useCallback, useState } from 'react'
import { clsx } from 'clsx'
import {
  IconBold,
  IconItalic,
  IconUnderline,
  IconStrikethrough,
  IconCode,
  IconHighlight,
  IconLink,
  IconCheck,
  IconX,
} from '@tabler/icons-react'

export interface BubbleMenuProps {
  editor: Editor | null
}

interface MenuButton {
  id: string
  icon: React.ReactNode
  title: string
  isActive: () => boolean
  command: () => void
}

export function BubbleMenu({ editor }: BubbleMenuProps) {
  const [isLinkMode, setIsLinkMode] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')

  const setLink = useCallback(() => {
    if (!editor) return

    if (linkUrl === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      setIsLinkMode(false)
      return
    }

    // Add https:// if no protocol is specified
    const url = linkUrl.match(/^https?:\/\//) ? linkUrl : `https://${linkUrl}`
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    setIsLinkMode(false)
    setLinkUrl('')
  }, [editor, linkUrl])

  const openLinkInput = useCallback(() => {
    if (!editor) return

    const previousUrl = editor.getAttributes('link').href || ''
    setLinkUrl(previousUrl)
    setIsLinkMode(true)
  }, [editor])

  const cancelLink = useCallback(() => {
    setIsLinkMode(false)
    setLinkUrl('')
  }, [])

  if (!editor) {
    return null
  }

  const buttons: MenuButton[] = [
    {
      id: 'bold',
      icon: <IconBold size={16} />,
      title: 'Bold (Cmd+B)',
      isActive: () => editor.isActive('bold'),
      command: () => editor.chain().focus().toggleBold().run(),
    },
    {
      id: 'italic',
      icon: <IconItalic size={16} />,
      title: 'Italic (Cmd+I)',
      isActive: () => editor.isActive('italic'),
      command: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      id: 'underline',
      icon: <IconUnderline size={16} />,
      title: 'Underline (Cmd+U)',
      isActive: () => editor.isActive('underline'),
      command: () => editor.chain().focus().toggleUnderline().run(),
    },
    {
      id: 'strike',
      icon: <IconStrikethrough size={16} />,
      title: 'Strikethrough',
      isActive: () => editor.isActive('strike'),
      command: () => editor.chain().focus().toggleStrike().run(),
    },
    {
      id: 'code',
      icon: <IconCode size={16} />,
      title: 'Code (Cmd+E)',
      isActive: () => editor.isActive('code'),
      command: () => editor.chain().focus().toggleCode().run(),
    },
    {
      id: 'highlight',
      icon: <IconHighlight size={16} />,
      title: 'Highlight',
      isActive: () => editor.isActive('highlight'),
      command: () => editor.chain().focus().toggleHighlight().run(),
    },
    {
      id: 'link',
      icon: <IconLink size={16} />,
      title: 'Link (Cmd+K)',
      isActive: () => editor.isActive('link'),
      command: openLinkInput,
    },
  ]

  return (
    <TiptapBubbleMenu
      editor={editor}
      tippyOptions={{
        duration: 100,
        placement: 'top',
        animation: 'shift-toward-subtle',
      }}
      shouldShow={({ editor, state, from, to }) => {
        // Don't show when selection is empty
        if (from === to) return false

        // Don't show when selecting a node (like an image)
        if (state.selection.$from.parent.type.name === 'imageBlock') return false

        // Don't show in code blocks
        if (editor.isActive('codeBlock')) return false

        return true
      }}
    >
      <div className='bubble-menu'>
        {isLinkMode ? (
          <div className='bubble-menu-link-input'>
            <input
              type='url'
              placeholder='Enter URL...'
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  setLink()
                }
                if (e.key === 'Escape') {
                  e.preventDefault()
                  cancelLink()
                }
              }}
              autoFocus
              className='bubble-menu-link-field'
            />
            <button
              type='button'
              onClick={setLink}
              className='bubble-menu-link-button'
              title='Apply link'
            >
              <IconCheck size={16} />
            </button>
            <button
              type='button'
              onClick={cancelLink}
              className='bubble-menu-link-button'
              title='Cancel'
            >
              <IconX size={16} />
            </button>
          </div>
        ) : (
          buttons.map((button) => (
            <button
              key={button.id}
              type='button'
              onClick={button.command}
              className={clsx(
                'bubble-menu-button',
                button.isActive() && 'bubble-menu-button-active'
              )}
              title={button.title}
            >
              {button.icon}
            </button>
          ))
        )}
      </div>
    </TiptapBubbleMenu>
  )
}

export default BubbleMenu
