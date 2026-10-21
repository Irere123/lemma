import type { Editor, Range } from '@tiptap/core'
import { Command, useCommandState } from 'cmdk'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import type {
  ComponentPropsWithoutRef,
  Context,
  FC,
  ForwardRefExoticComponent,
  RefAttributes,
} from 'react'
import { createContext, forwardRef, useEffect } from 'react'
import type tunnel from 'tunnel-rat'

import { queryAtom, rangeAtom } from '../utils/atoms'
import { headlessStore } from '../utils/store'

export const EditorCommandTunnelContext: Context<ReturnType<typeof tunnel>> = createContext(
  {} as ReturnType<typeof tunnel>
)

interface EditorCommandOutProps {
  readonly query: string
  readonly range: Range
  readonly editor?: Editor
}

/**
 * The slash menu's query and range as the suggestion plugin last reported
 * them: synchronously, on the keystroke, unlike the atoms and the menu, which
 * follow through React. `navigated` is set once the arrows have moved the
 * selection away from the first match for this query.
 */
export const slashState: { query: string; range: Range | null; navigated: boolean } = {
  query: '',
  range: null,
  navigated: false,
}

export function trackSlashSuggestion({ query, range }: { query: string; range: Range }): void {
  if (query !== slashState.query) slashState.navigated = false
  slashState.query = query
  slashState.range = range
}

/** Whether the menu shows, and has selected for, the query the writer last typed. */
function menuCaughtUp(): boolean {
  const menu = document.querySelector('#slash-command')
  if (!menu) return true
  if (
    menu.querySelector('[data-slash-search]')?.getAttribute('data-slash-search') !==
    slashState.query
  )
    return false
  const range = headlessStore.get(rangeAtom)
  if (range?.from !== slashState.range?.from || range?.to !== slashState.range?.to) return false
  if (slashState.navigated) return true
  const first = menu.querySelector('[cmdk-item]:not([aria-disabled="true"])')
  return !first || first.getAttribute('aria-selected') === 'true'
}

/** Runs `fn` as soon as the menu has caught up with the writer (at most a second later). */
function whenMenuCaughtUp(fn: () => void) {
  const started = performance.now()
  const check = () => {
    if (menuCaughtUp() || performance.now() - started > 1000) fn()
    else setTimeout(check, 8)
  }
  check()
}

/**
 * Holds back the keys typed from now on. The returned function stops holding
 * them and replays them into the editor, so typing straight after Enter lands
 * after the item it ran, not in the menu's query.
 */
function holdKeys(editor: Editor | undefined): () => void {
  const held: KeyboardEvent[] = []
  const hold = (event: KeyboardEvent) => {
    // Only what the writer types: the Enter forwarded to the menu passes.
    if (!event.isTrusted || event.isComposing || event.key === 'Process') return
    event.preventDefault()
    event.stopImmediatePropagation()
    held.push(event)
  }
  window.addEventListener('keydown', hold, true)
  return () => {
    window.removeEventListener('keydown', hold, true)
    if (!editor || editor.isDestroyed) return
    const { view } = editor
    for (const event of held) {
      const isText = event.key.length === 1 && !event.metaKey && (!event.ctrlKey || event.altKey)
      if (isText) {
        const { from, to } = view.state.selection
        const insert = () => view.state.tr.insertText(event.key, from, to)
        const handled = view.someProp('handleTextInput', (f) =>
          f(view, from, to, event.key, insert)
        )
        if (!handled) view.dispatch(insert())
      } else {
        view.dom.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: event.key,
            code: event.code,
            keyCode: event.keyCode,
            shiftKey: event.shiftKey,
            altKey: event.altKey,
            ctrlKey: event.ctrlKey,
            metaKey: event.metaKey,
            bubbles: true,
            cancelable: true,
          })
        )
      }
    }
  }
}

export const EditorCommandOut: FC<EditorCommandOutProps> = ({ query, range, editor }) => {
  const setQuery = useSetAtom(queryAtom, { store: headlessStore })
  const setRange = useSetAtom(rangeAtom, { store: headlessStore })

  useEffect(() => {
    setQuery(query)
  }, [query, setQuery])

  useEffect(() => {
    setRange(range)
  }, [range, setRange])

  useEffect(() => {
    const navigationKeys = ['ArrowUp', 'ArrowDown', 'Enter']
    const onKeyDown = (e: KeyboardEvent) => {
      if (navigationKeys.includes(e.key)) {
        e.preventDefault()
        const forward = () =>
          document.querySelector('#slash-command')?.dispatchEvent(
            new KeyboardEvent('keydown', {
              key: e.key,
              cancelable: true,
              bubbles: true,
            })
          )
        // The query and range reach the menu through React effects, a frame
        // or so after the keystroke that changed them. Enter typed right
        // after the last letter must run the item that letter selected, with
        // the range that covers it, so it waits for them, holding back
        // whatever is typed meanwhile.
        if (e.key === 'Enter') {
          const release = holdKeys(editor)
          whenMenuCaughtUp(() => {
            forward()
            release()
          })
        } else {
          slashState.navigated = true
          forward()
        }

        return false
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [editor])

  return (
    <EditorCommandTunnelContext.Consumer>
      {(tunnelInstance) => <tunnelInstance.Out />}
    </EditorCommandTunnelContext.Consumer>
  )
}

/** The query the menu is filtering by, for `menuCaughtUp`. */
function MenuSearch() {
  const search = useCommandState((state) => state.search)
  return <span hidden data-slash-search={search} />
}

export const EditorCommand: ForwardRefExoticComponent<
  ComponentPropsWithoutRef<typeof Command> & RefAttributes<HTMLDivElement>
> = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof Command>>(
  ({ children, className, ...rest }, ref) => {
    const [query, setQuery] = useAtom(queryAtom)

    return (
      <EditorCommandTunnelContext.Consumer>
        {(tunnelInstance) => (
          <tunnelInstance.In>
            <Command
              ref={ref}
              onKeyDown={(e) => {
                e.stopPropagation()
              }}
              id='slash-command'
              className={className}
              {...rest}
            >
              <Command.Input value={query} onValueChange={setQuery} style={{ display: 'none' }} />
              <MenuSearch />
              {children}
            </Command>
          </tunnelInstance.In>
        )}
      </EditorCommandTunnelContext.Consumer>
    )
  }
)
export const EditorCommandList: typeof Command.List = Command.List

/** What the writer has typed after the slash. */
export function useEditorCommandQuery(): string {
  return useAtomValue(queryAtom, { store: headlessStore })
}

EditorCommand.displayName = 'EditorCommand'
