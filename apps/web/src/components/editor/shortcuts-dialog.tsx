import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from '../ui/dialog'
import { Kbd, KbdGroup } from '../ui/kbd'

const isMac = () =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform ?? '')

const SECTIONS: { title: string; items: [string, string[]][] }[] = [
  {
    title: 'Text',
    items: [
      ['Bold', ['Mod', 'B']],
      ['Italic', ['Mod', 'I']],
      ['Underline', ['Mod', 'U']],
      ['Strikethrough', ['Mod', 'Shift', 'S']],
      ['Inline code', ['Mod', 'E']],
      ['Highlight', ['Mod', 'Shift', 'H']],
      ['Link', ['Mod', 'K']],
      ['Superscript / subscript', ['Mod', '.', '|', ',']],
      ['Line break in a paragraph', ['Shift', 'Enter']],
    ],
  },
  {
    title: 'Blocks',
    items: [
      ['Insert a block', ['/']],
      ['Heading 1–3', ['Mod', 'Alt', '1–3']],
      ['Bulleted list', ['Mod', 'Shift', '8']],
      ['Numbered list', ['Mod', 'Shift', '7']],
      ['To-do list', ['Mod', 'Shift', '9']],
      ['Quote', ['Mod', 'Shift', 'B']],
      ['Code block', ['Mod', 'Alt', 'C']],
      ['Footnote', ['Mod', 'Alt', 'F']],
      ['Move block up / down', ['Mod', 'Shift', '↑', '|', '↓']],
      ['Edit a selected equation', ['Enter']],
    ],
  },
  {
    title: 'As you type',
    items: [
      ['Heading', ['#', 'Space']],
      ['Bulleted list', ['-', 'Space']],
      ['Numbered list', ['1.', 'Space']],
      ['To-do', ['[]', 'Space']],
      ['Quote', ['>', 'Space']],
      ['Code block', ['```']],
      ['Divider', ['---']],
      ['Inline equation', ['$$x$$']],
    ],
  },
  {
    title: 'Document',
    items: [
      ['Undo / redo', ['Mod', 'Z', '|', 'Mod', 'Shift', 'Z']],
      ['Title → subtitle → text', ['Enter']],
      ['Keyboard shortcuts', ['Mod', '/']],
    ],
  },
]

function Keys({ keys }: { keys: string[] }) {
  const mac = isMac()
  return (
    <KbdGroup>
      {keys.map((key, index) =>
        key === '|' ? (
          <span key={`${key}-${index}`} className='px-0.5 text-muted-foreground'>
            or
          </span>
        ) : (
          <Kbd key={`${key}-${index}`}>
            {key === 'Mod'
              ? mac
                ? '⌘'
                : 'Ctrl'
              : key === 'Alt'
                ? mac
                  ? '⌥'
                  : 'Alt'
                : key === 'Shift'
                  ? mac
                    ? '⇧'
                    : 'Shift'
                  : key}
          </Kbd>
        )
      )}
    </KbdGroup>
  )
}

/** ⌘/ (Ctrl+/) anywhere on the writing page opens it. */
export function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className='max-w-2xl'>
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Everything in the editor works without a mouse.</DialogDescription>
        </DialogHeader>
        <DialogPanel className='grid gap-x-8 gap-y-6 sm:grid-cols-2'>
          {SECTIONS.map((section) => (
            <section key={section.title}>
              <h3 className='mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide'>
                {section.title}
              </h3>
              <dl className='space-y-1.5 text-sm'>
                {section.items.map(([label, keys]) => (
                  <div key={label} className='flex items-center justify-between gap-4'>
                    <dt>{label}</dt>
                    <dd>
                      <Keys keys={keys} />
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  )
}
