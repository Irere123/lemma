import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import {
  IconH1,
  IconH2,
  IconH3,
  IconList,
  IconListNumbers,
  IconListCheck,
  IconQuote,
  IconCode,
  IconMinus,
  IconTypography,
  IconBulb,
  IconChevronRight,
} from '@tabler/icons-react'
import { useEditorContext } from '../context/EditorContext'
import {
  closeSlashMenu,
  deleteSlashTrigger,
  getSlashMenuState,
  type SlashMenuState,
} from '../plugins/slashMenu'
import {
  setParagraph,
  setHeading,
  wrapInBulletList,
  wrapInOrderedList,
  insertTaskList,
  setBlockquote,
  setCodeBlock,
  insertDivider,
  insertCallout,
  insertToggle,
} from '../commands'

interface SlashMenuItem {
  id: string
  label: string
  description: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  keywords: string[]
  action: () => void
}

interface SlashMenuProps {
  state: SlashMenuState
  onClose: () => void
}

export function SlashMenu({ state, onClose }: SlashMenuProps) {
  const { view } = useEditorContext()
  const menuRef = useRef<HTMLDivElement>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Create menu items
  const allItems = useMemo<SlashMenuItem[]>(() => {
    if (!view) return []

    return [
      {
        id: 'paragraph',
        label: 'Text',
        description: 'Just start writing with plain text',
        icon: IconTypography,
        keywords: ['paragraph', 'text', 'plain'],
        action: () => {
          deleteSlashTrigger(view)
          setParagraph(view.state, view.dispatch)
        },
      },
      {
        id: 'heading1',
        label: 'Heading 1',
        description: 'Big section heading',
        icon: IconH1,
        keywords: ['heading', 'h1', 'title', 'big'],
        action: () => {
          deleteSlashTrigger(view)
          setHeading(1)(view.state, view.dispatch)
        },
      },
      {
        id: 'heading2',
        label: 'Heading 2',
        description: 'Medium section heading',
        icon: IconH2,
        keywords: ['heading', 'h2', 'subtitle', 'medium'],
        action: () => {
          deleteSlashTrigger(view)
          setHeading(2)(view.state, view.dispatch)
        },
      },
      {
        id: 'heading3',
        label: 'Heading 3',
        description: 'Small section heading',
        icon: IconH3,
        keywords: ['heading', 'h3', 'small'],
        action: () => {
          deleteSlashTrigger(view)
          setHeading(3)(view.state, view.dispatch)
        },
      },
      {
        id: 'bulletList',
        label: 'Bulleted List',
        description: 'Create a simple bulleted list',
        icon: IconList,
        keywords: ['bullet', 'list', 'unordered', 'ul'],
        action: () => {
          deleteSlashTrigger(view)
          wrapInBulletList(view.state, view.dispatch)
        },
      },
      {
        id: 'orderedList',
        label: 'Numbered List',
        description: 'Create a list with numbering',
        icon: IconListNumbers,
        keywords: ['number', 'list', 'ordered', 'ol'],
        action: () => {
          deleteSlashTrigger(view)
          wrapInOrderedList(view.state, view.dispatch)
        },
      },
      {
        id: 'taskList',
        label: 'To-do List',
        description: 'Track tasks with a to-do list',
        icon: IconListCheck,
        keywords: ['todo', 'task', 'checklist', 'checkbox'],
        action: () => {
          deleteSlashTrigger(view)
          insertTaskList(view.state, view.dispatch)
        },
      },
      {
        id: 'quote',
        label: 'Quote',
        description: 'Capture a quote',
        icon: IconQuote,
        keywords: ['quote', 'blockquote', 'citation'],
        action: () => {
          deleteSlashTrigger(view)
          setBlockquote(view.state, view.dispatch)
        },
      },
      {
        id: 'code',
        label: 'Code',
        description: 'Capture a code snippet',
        icon: IconCode,
        keywords: ['code', 'codeblock', 'snippet', 'programming'],
        action: () => {
          deleteSlashTrigger(view)
          setCodeBlock()(view.state, view.dispatch)
        },
      },
      {
        id: 'divider',
        label: 'Divider',
        description: 'Visually divide blocks',
        icon: IconMinus,
        keywords: ['divider', 'separator', 'hr', 'line'],
        action: () => {
          deleteSlashTrigger(view)
          insertDivider(view.state, view.dispatch)
        },
      },
      {
        id: 'callout',
        label: 'Callout',
        description: 'Make writing stand out',
        icon: IconBulb,
        keywords: ['callout', 'info', 'note', 'highlight'],
        action: () => {
          deleteSlashTrigger(view)
          insertCallout('info')(view.state, view.dispatch)
        },
      },
      {
        id: 'toggle',
        label: 'Toggle',
        description: 'Toggles can hide and show content',
        icon: IconChevronRight,
        keywords: ['toggle', 'collapse', 'expand', 'accordion'],
        action: () => {
          deleteSlashTrigger(view)
          insertToggle()(view.state, view.dispatch)
        },
      },
    ]
  }, [view])

  // Filter items based on search term
  const filteredItems = useMemo(() => {
    if (!state.searchTerm) return allItems
    const term = state.searchTerm.toLowerCase()
    return allItems.filter(
      (item) =>
        item.label.toLowerCase().includes(term) || item.keywords.some((k) => k.includes(term))
    )
  }, [state.searchTerm, allItems])

  // Reset selection when items change
  useEffect(() => {
    setSelectedIndex(0)
  }, [filteredItems.length])

  // Execute selected action
  const executeAction = useCallback(
    (item: SlashMenuItem) => {
      item.action()
      onClose()
    },
    [onClose]
  )

  // Handle keyboard navigation
  useEffect(() => {
    if (!state.isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setSelectedIndex((i) => (i + 1) % filteredItems.length)
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        setSelectedIndex((i) => (i === 0 ? filteredItems.length - 1 : i - 1))
      } else if (event.key === 'Enter') {
        event.preventDefault()
        if (filteredItems[selectedIndex]) {
          executeAction(filteredItems[selectedIndex])
        }
      } else if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [state.isOpen, filteredItems, selectedIndex, executeAction, onClose])

  // Close on click outside
  useEffect(() => {
    if (!state.isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [state.isOpen, onClose])

  if (!state.isOpen || !state.position || filteredItems.length === 0) {
    return null
  }

  return (
    <div
      ref={menuRef}
      className='fixed z-50 w-72 max-h-80 overflow-y-auto bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700'
      style={{ top: state.position.top, left: state.position.left }}
    >
      <div className='p-2'>
        <div className='text-xs font-medium text-gray-500 dark:text-gray-400 px-2 py-1 uppercase'>
          Basic blocks
        </div>
        {filteredItems.map((item, index) => {
          const isSelected = index === selectedIndex
          const Icon = item.icon
          return (
            <button
              key={item.id}
              type='button'
              className={`w-full flex items-center gap-3 px-2 py-2 rounded-md text-left transition-colors ${
                isSelected
                  ? 'bg-gray-100 dark:bg-gray-700'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-750'
              }`}
              onClick={() => executeAction(item)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className='shrink-0 w-10 h-10 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-md'>
                <Icon size={20} className='text-gray-600 dark:text-gray-400' />
              </div>
              <div className='flex-1 min-w-0'>
                <div className='font-medium text-gray-900 dark:text-gray-100'>{item.label}</div>
                <div className='text-xs text-gray-500 dark:text-gray-400 truncate'>
                  {item.description}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Hook to manage slash menu state
 */
export function useSlashMenuState() {
  const { view } = useEditorContext()
  const [menuState, setMenuState] = useState<SlashMenuState>({
    isOpen: false,
    position: null,
    searchTerm: '',
    triggerPos: null,
  })

  // Update state when view changes
  useEffect(() => {
    if (!view) return

    const checkState = () => {
      const state = getSlashMenuState(view)
      if (state) {
        setMenuState(state)
      }
    }

    // Check initially
    checkState()

    // Subscribe to state changes
    const originalDispatch = view.dispatch.bind(view)
    ;(view as any).dispatch = (tr: any) => {
      originalDispatch(tr)
      checkState()
    }

    return () => {
      ;(view as any).dispatch = originalDispatch
    }
  }, [view])

  const closeMenu = useCallback(() => {
    if (view) {
      closeSlashMenu(view)
    }
  }, [view])

  return {
    state: menuState,
    closeMenu,
  }
}
