import type { HocuspocusProvider } from '@hocuspocus/provider'
import type { AnyExtension } from '@tiptap/core'
import CharacterCount from '@tiptap/extension-character-count'
import CodeBlockLowlight from '@tiptap/extension-code-block'
import Collaboration from '@tiptap/extension-collaboration'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import TextStyle from '@tiptap/extension-text-style'
import Underline from '@tiptap/extension-underline'
// types
import type {
  IEditorProps,
  IEditorPropsExtended,
  TExtensions,
  TFileHandler,
  TUserDetails,
} from '@/types'
// extensions
import { CalloutExtension } from './callout'
import { CustomColorExtension } from './custom-color'
import { CustomImageExtension } from './custom-image'
import { CustomLinkExtension } from './custom-link'
import { CustomEmojiExtension } from './emoji'
import { HeadingListExtension } from './heading-list'
import { HorizontalRuleExtension } from './horizontal-rule'
import { CustomKeymap } from './keymap'
import { CustomPlaceholderExtension } from './placeholder'
import { SideMenuExtension } from './side-menu'
import type { TSlashCommandAdditionalOption } from './slash-commands/root'
import { SlashCommands } from './slash-commands/root'
import { CustomStarterKitExtension } from './starter-kit'
import { Table, TableCell, TableHeader, TableRow } from './table'
import { CustomTextAlignExtension } from './text-align'

// Custom extensions
export * from './callout'
export * from './code'
export * from './custom-color'
export * from './custom-image'
export * from './custom-link'
export * from './emoji'
export * from './heading-list'
export * from './horizontal-rule'
export * from './keymap'
export * from './placeholder'
export * from './side-menu'
export * from './slash-commands'
export * from './starter-kit'
export * from './table'
export * from './text-align'
export * from './title-extension'

type CoreEditorAdditionalSlashCommandOptionsArgs = {
  disabledExtensions?: TExtensions[]
  flaggedExtensions?: TExtensions[]
}

/**
 * Returns additional slash command options for the core editor.
 * This can be extended to add more custom slash commands.
 */
export const coreEditorAdditionalSlashCommandOptions = (
  _args: CoreEditorAdditionalSlashCommandOptionsArgs
): TSlashCommandAdditionalOption[] => {
  // Add any additional core editor slash commands here
  // For now, returning an empty array
  return []
}

export type TDocumentEditorAdditionalExtensionsProps = Pick<
  IEditorProps,
  'disabledExtensions' | 'flaggedExtensions' | 'fileHandler' | 'extendedEditorProps'
> & {
  isEditable: boolean
  userDetails: TUserDetails
}

export type TDocumentEditorAdditionalExtensionsRegistry = {
  isEnabled: (disabledExtensions: TExtensions[], flaggedExtensions: TExtensions[]) => boolean
  getExtension: (props: TDocumentEditorAdditionalExtensionsProps) => AnyExtension
}

const extensionRegistry: TDocumentEditorAdditionalExtensionsRegistry[] = [
  {
    isEnabled: (disabledExtensions) => !disabledExtensions.includes('slash-commands'),
    getExtension: ({ disabledExtensions, flaggedExtensions }) =>
      SlashCommands({ disabledExtensions, flaggedExtensions }),
  },
]

export function DocumentEditorAdditionalExtensions(
  props: TDocumentEditorAdditionalExtensionsProps
) {
  const { disabledExtensions, flaggedExtensions } = props

  const documentExtensions = extensionRegistry
    .filter((config) => config.isEnabled(disabledExtensions, flaggedExtensions))
    .map((config) => config.getExtension(props))

  return documentExtensions
}

// Core Editor Extensions Props
export type TCoreEditorExtensionsProps = {
  disabledExtensions?: TExtensions[]
  editable?: boolean
  enableHistory?: boolean
  extendedEditorProps?: IEditorPropsExtended
  fileHandler?: TFileHandler
  flaggedExtensions?: TExtensions[]
  getEditorMetaData?: (htmlContent: string) => unknown
  isTouchDevice?: boolean
  placeholder?: string | ((isFocused: boolean, value: string) => string)
  provider?: HocuspocusProvider
  showPlaceholderOnEmpty?: boolean
}

/**
 * Returns the core editor extensions.
 */
export const CoreEditorExtensions = (props: TCoreEditorExtensionsProps): AnyExtension[] => {
  const {
    disabledExtensions: _disabledExtensions = [],
    editable = true,
    enableHistory = true,
    fileHandler,
    flaggedExtensions: _flaggedExtensions = [],
    isTouchDevice = false,
    placeholder,
    provider,
    showPlaceholderOnEmpty = true,
  } = props

  const extensions: AnyExtension[] = [
    // StarterKit with history config
    CustomStarterKitExtension({ enableHistory }) as AnyExtension,
    // Text styling
    TextStyle,
    Underline,
    // Custom extensions
    CustomColorExtension,
    CustomTextAlignExtension,
    CalloutExtension,
    CodeBlockLowlight,
    HorizontalRuleExtension,
    HeadingListExtension,
    CustomKeymap,
    // Table support
    Table,
    TableCell,
    TableHeader,
    TableRow,
    // Image support
    ...(fileHandler ? [CustomImageExtension({ fileHandler, isEditable: editable })] : []),
    // Link support
    CustomLinkExtension,
    // Emoji support
    CustomEmojiExtension(),
    // Character count
    CharacterCount,
    // Task lists
    TaskList,
    TaskItem.configure({
      nested: true,
      HTMLAttributes: {
        class: 'flex gap-2',
      },
    }),
    // Placeholder
    CustomPlaceholderExtension({
      placeholder,
      showPlaceholderOnEmpty,
    }),
  ]

  // Add side menu for non-touch devices
  if (!isTouchDevice && editable) {
    extensions.push(SideMenuExtension({ dragDropEnabled: true }))
  }

  // Add collaboration support if provider is available
  if (provider) {
    extensions.push(
      Collaboration.configure({
        document: provider.document,
      })
    )
  }

  // Note: Slash commands are added in DocumentEditorAdditionalExtensions
  // to avoid duplication. Do not add them here.

  return extensions
}
