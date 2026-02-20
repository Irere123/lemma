import {
  CharacterCount,
  CodeBlockLowlight,
  Color,
  GlobalDragHandle,
  HighlightExtension,
  HorizontalRule,
  MarkdownExtension,
  Mathematics,
  Placeholder,
  StarterKit,
  TaskItem,
  TaskList,
  TextStyle,
  TiptapImage,
  TiptapLink,
  TiptapUnderline,
  UploadImagesPlugin,
  Youtube,
} from '@lemma/headless'
import type { AnyExtension } from '@tiptap/core'

import { cx } from 'class-variance-authority'
import { common, createLowlight } from 'lowlight'

//TODO I am using cx here to get tailwind autocomplete working, idk if someone else can write a regex to just capture the class key in objects
//You can overwrite the placeholder with your own configuration
const placeholder = Placeholder
const tiptapLink = TiptapLink.configure({
  openOnClick: false,
  autolink: true,
  linkOnPaste: true,
  HTMLAttributes: {
    class: cx(
      'text-foreground underline decoration-muted-foreground underline-offset-[3px] transition-colors hover:decoration-foreground'
    ),
  },
})

const tiptapImage = TiptapImage.extend({
  addProseMirrorPlugins() {
    return [
      UploadImagesPlugin({
        imageClass: cx('opacity-40 rounded-lg border border-border'),
      }),
    ]
  },
}).configure({
  allowBase64: true,
  HTMLAttributes: {
    class: cx('my-6 rounded-xl border border-border'),
  },
})

const taskList = TaskList.configure({
  HTMLAttributes: {
    class: cx('not-prose my-4 pl-2'),
  },
})
const taskItem = TaskItem.configure({
  HTMLAttributes: {
    class: cx('my-2 flex items-start gap-2'),
  },
  nested: true,
})

const horizontalRule = HorizontalRule.configure({
  HTMLAttributes: {
    class: cx('my-8 border-t border-border'),
  },
})

const starterKit = StarterKit.configure({
  bulletList: {
    HTMLAttributes: {
      class: cx('my-4 ml-6 list-disc'),
    },
  },
  orderedList: {
    HTMLAttributes: {
      class: cx('my-4 ml-6 list-decimal'),
    },
  },
  listItem: {
    HTMLAttributes: {
      class: cx('my-1 leading-7'),
    },
  },
  blockquote: {
    HTMLAttributes: {
      class: cx('my-6 border-l-2 border-border pl-5 text-muted-foreground italic'),
    },
  },
  codeBlock: {
    HTMLAttributes: {
      class: cx(
        'my-6 overflow-x-auto rounded-xl border border-border bg-muted/60 p-4 font-mono text-sm'
      ),
    },
  },
  code: {
    HTMLAttributes: {
      class: cx('rounded-md border border-border/70 bg-muted/70 px-1 py-0.5 font-mono text-sm'),
      spellcheck: 'false',
    },
  },
  horizontalRule: false,
  dropcursor: {
    color: '#DBEAFE',
    width: 4,
  },
  gapcursor: false,
})

const codeBlockLowlight = CodeBlockLowlight.configure({
  // configure lowlight: common /  all / use highlightJS in case there is a need to specify certain language grammars only
  // common: covers 37 language grammars which should be good enough in most cases
  lowlight: createLowlight(common),
})

const youtube = Youtube.configure({
  HTMLAttributes: {
    class: cx('my-6 rounded-xl border border-border'),
  },
  inline: false,
})

const mathematics = Mathematics.configure({
  HTMLAttributes: {
    class: cx('cursor-pointer rounded px-1 text-foreground hover:bg-accent'),
  },
  katexOptions: {
    throwOnError: false,
  },
})

const characterCount = CharacterCount.configure()

const markdownExtension = MarkdownExtension.configure({
  html: true,
  tightLists: true,
  tightListClass: 'tight',
  bulletListMarker: '-',
  linkify: false,
  breaks: false,
  transformPastedText: false,
  transformCopiedText: false,
})

export const defaultExtensions = [
  starterKit,
  placeholder,
  tiptapLink,
  tiptapImage,

  taskList,
  taskItem,
  horizontalRule,

  codeBlockLowlight,
  youtube,

  mathematics,
  characterCount,
  TiptapUnderline,
  markdownExtension,
  HighlightExtension,
  TextStyle,
  Color,

  GlobalDragHandle,
] as AnyExtension[]
