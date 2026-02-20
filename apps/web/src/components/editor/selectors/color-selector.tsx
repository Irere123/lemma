import { EditorBubbleItem, useEditor } from '@lemma/headless'
import { Check, ChevronDown } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Popover, PopoverPopup, PopoverTrigger } from '@/components/ui/popover'

export interface BubbleColorMenuItem {
  name: string
  color: null | string
}

const TEXT_COLORS: BubbleColorMenuItem[] = [
  {
    name: 'Default',
    color: null,
  },
  {
    name: 'Slate',
    color: '#334155',
  },
  {
    name: 'Red',
    color: '#b91c1c',
  },
  {
    name: 'Amber',
    color: '#b45309',
  },
  {
    name: 'Blue',
    color: '#1d4ed8',
  },
  {
    name: 'Green',
    color: '#166534',
  },
  {
    name: 'Rose',
    color: '#be185d',
  },
  {
    name: 'Gray',
    color: '#64748b',
  },
]

const HIGHLIGHT_COLORS: BubbleColorMenuItem[] = [
  {
    name: 'Default',
    color: null,
  },
  {
    name: 'Amber',
    color: '#fef08a',
  },
  {
    name: 'Green',
    color: '#bbf7d0',
  },
  {
    name: 'Blue',
    color: '#bfdbfe',
  },
  {
    name: 'Rose',
    color: '#fecdd3',
  },
  {
    name: 'Gray',
    color: '#e2e8f0',
  },
]

interface ColorSelectorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const ColorSelector = ({ open, onOpenChange }: ColorSelectorProps) => {
  const { editor } = useEditor()

  if (!editor) return null
  const activeTextColor = editor.getAttributes('textStyle').color as string | undefined
  const activeHighlightColor = editor.getAttributes('highlight').color as string | undefined

  const activeColorItem =
    TEXT_COLORS.find(({ color }) => color && editor.isActive('textStyle', { color })) ??
    (activeTextColor ? null : TEXT_COLORS[0])

  const activeHighlightItem =
    HIGHLIGHT_COLORS.find(({ color }) => color && editor.isActive('highlight', { color })) ??
    (activeHighlightColor ? null : HIGHLIGHT_COLORS[0])

  return (
    <Popover modal={true} open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger>
        <Button
          size='sm'
          variant='ghost'
          className='gap-1 rounded-none px-2'
          onMouseDown={(event) => event.preventDefault()}
        >
          <span
            className='rounded-sm px-1'
            style={{
              color: activeColorItem?.color ?? 'inherit',
              backgroundColor: activeHighlightItem?.color ?? 'transparent',
            }}
          >
            A
          </span>
          <ChevronDown className='h-4 w-4' />
        </Button>
      </PopoverTrigger>
      <PopoverPopup sideOffset={5} align='start' className='h-52 w-56 p-1'>
        <div className='h-full overflow-y-auto pr-1'>
          <div className='px-2 py-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase'>
            Color
          </div>
          {TEXT_COLORS.map(({ name, color }) => {
            const isActive = color ? editor.isActive('textStyle', { color }) : !activeTextColor

            return (
              <EditorBubbleItem
                key={name}
                onSelect={() => {
                  editor.commands.unsetColor()
                  if (color) {
                    editor.chain().focus().setColor(color).run()
                  }
                  onOpenChange(false)
                }}
                className='flex cursor-pointer items-center justify-between rounded-sm px-2 py-1 text-sm hover:bg-accent'
              >
                <div className='flex items-center gap-2'>
                  <div
                    className='rounded-sm border px-2 py-px font-medium'
                    style={{ color: color ?? undefined }}
                  >
                    A
                  </div>
                  <span>{name}</span>
                </div>
                {isActive && <Check className='h-4 w-4' />}
              </EditorBubbleItem>
            )
          })}
          <div className='my-1 h-px bg-border' />
          <div className='px-2 py-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase'>
            Background
          </div>
          {HIGHLIGHT_COLORS.map(({ name, color }) => {
            const isActive = color ? editor.isActive('highlight', { color }) : !activeHighlightColor

            return (
              <EditorBubbleItem
                key={name}
                onSelect={() => {
                  editor.commands.unsetHighlight()
                  if (color) {
                    editor.chain().focus().setHighlight({ color }).run()
                  }
                  onOpenChange(false)
                }}
                className='flex cursor-pointer items-center justify-between rounded-sm px-2 py-1 text-sm hover:bg-accent'
              >
                <div className='flex items-center gap-2'>
                  <div
                    className='rounded-sm border px-2 py-px font-medium'
                    style={{ backgroundColor: color ?? undefined }}
                  >
                    A
                  </div>
                  <span>{name}</span>
                </div>
                {isActive && <Check className='h-4 w-4' />}
              </EditorBubbleItem>
            )
          })}
        </div>
      </PopoverPopup>
    </Popover>
  )
}
