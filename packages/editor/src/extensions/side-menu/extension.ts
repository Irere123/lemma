import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
// constants
import { CORE_EXTENSIONS } from '@/constants/extension'
// plugins
import { DragHandlePlugin, nodeDOMAtCoords } from '@/plugins/drag-handle'

type Props = {
  dragDropEnabled: boolean
}

export type SideMenuPluginProps = {
  dragHandleWidth: number
  handlesConfig: {
    dragDrop: boolean
  }
  scrollThreshold: {
    up: number
    down: number
  }
}

export type SideMenuHandleOptions = {
  view: (view: EditorView, sideMenu: HTMLDivElement | null) => void
  domEvents?: {
    [key: string]: (...args: any) => void
  }
}

export const SideMenuExtension = (props: Props) => {
  const {  dragDropEnabled } = props

  return Extension.create({
    name: CORE_EXTENSIONS.SIDE_MENU,
    addProseMirrorPlugins() {
      return [
        SideMenu({
          dragHandleWidth: 24,
          handlesConfig: {
           
            dragDrop: dragDropEnabled,
          },
          scrollThreshold: { up: 200, down: 150 },
        }),
      ]
    },
  })
}

const absoluteRect = (node: Element) => {
  const data = node.getBoundingClientRect()

  return {
    top: data.top,
    left: data.left,
    width: data.width,
  }
}

const SideMenu = (options: SideMenuPluginProps) => {
  const { handlesConfig } = options
  const editorSideMenu: HTMLDivElement | null = document.createElement('div')
  editorSideMenu.id = 'editor-side-menu'
  // side menu view actions
  const hideSideMenu = () => {
    if (!editorSideMenu?.classList.contains('side-menu-hidden'))
      editorSideMenu?.classList.add('side-menu-hidden')
  }
  const showSideMenu = () => editorSideMenu?.classList.remove('side-menu-hidden')
  // side menu elements
  const { view: dragHandleView, domEvents: dragHandleDOMEvents } = DragHandlePlugin(options)

  return new Plugin({
    key: new PluginKey('sideMenu'),
    view: (view) => {
      hideSideMenu()
      view?.dom.parentElement?.appendChild(editorSideMenu)
      // side menu elements' initialization

      if (handlesConfig.dragDrop && !editorSideMenu.querySelector('#drag-handle')) {
        dragHandleView(view, editorSideMenu)
      }

      return {
        destroy: () => hideSideMenu(),
      }
    },
    props: {
      handleDOMEvents: {
        mousemove: (view, event) => {
          if (!view.editable) return

          const node = nodeDOMAtCoords({
            x: event.clientX + 50 + options.dragHandleWidth,
            y: event.clientY,
          })

          if (!(node instanceof Element) || node.matches('ul, ol')) {
            hideSideMenu()
            return
          }

          const compStyle = window.getComputedStyle(node)
          const lineHeight = Number.parseInt(compStyle.lineHeight, 10)
          const paddingTop = Number.parseInt(compStyle.paddingTop, 10)

          const rect = absoluteRect(node)

          rect.top += (lineHeight - 20) / 2
          rect.top += paddingTop

          if (
            node.parentElement?.parentElement?.matches('td') ||
            node.parentElement?.parentElement?.matches('th')
          ) {
            if (node.matches('ul:not([data-type=taskList]) li, ol li')) {
              rect.left -= 5
            }
          } else {
            // Li markers
            if (node.matches('ul:not([data-type=taskList]) li, ol li')) {
              rect.left -= 18
            }
          }

          if (node.matches('table')) {
            rect.top += 8
            rect.left -= 8
          }

          rect.width = options.dragHandleWidth

          if (!editorSideMenu) return

          editorSideMenu.style.left = `${rect.left - rect.width}px`
          editorSideMenu.style.top = `${rect.top}px`
          showSideMenu()
          if (handlesConfig.dragDrop) {
            dragHandleDOMEvents?.mousemove()
          }
          
        },
        // keydown: () => hideSideMenu(),
        mousewheel: () => hideSideMenu(),
        dragenter: (view) => {
          if (handlesConfig.dragDrop) {
            dragHandleDOMEvents?.dragenter?.(view)
          }
        },
        drop: (view, event) => {
          if (handlesConfig.dragDrop) {
            dragHandleDOMEvents?.drop?.(view, event)
          }
        },
        dragend: (view) => {
          if (handlesConfig.dragDrop) {
            dragHandleDOMEvents?.dragend?.(view)
          }
        },
      },
    },
  })
}
