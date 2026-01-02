# @lemma/editor-v2

A powerful, extensive, and collaborative rich text editor built with Tiptap.

## Features

- **Rich Text Formatting**: Headings, lists, bold, italic, and more.
- **Media Support**: Images, videos, and file attachments.
- **Slash Commands**: Quick access to nodes and commands via `/`.
- **Drag and Drop**: Reorder blocks easily.
- **Collaboration**: Real-time collaboration support (via Hocuspocus).
- **Markdown Support**: Import and export Markdown.
- **Custom Extensions**: Callouts, custom links, and more.

## Installation

```bash
npm install @lemma/editor-v2
```

## Usage

### Basic Setup

```tsx
import { useEditor } from '@lemma/editor-v2'
import { EditorContent } from '@tiptap/react'

export const MyEditor = () => {
  const editor = useEditor({
    initialValue: '<p>Hello World</p>',
    placeholder: 'Start typing...',
    onChange: (json, html) => {
      console.log('Content changed:', json)
    },
  })

  if (!editor) return null

  return <EditorContent editor={editor} />
}
```

### With Collaboration

```tsx
import { useEditor } from '@lemma/editor-v2'
import { HocuspocusProvider } from '@hocuspocus/provider'

const provider = new HocuspocusProvider({
  url: 'ws://localhost:1234',
  name: 'document-name',
})

export const CollaborativeEditor = () => {
  const editor = useEditor({
    provider,
    user: {
      name: 'John Doe',
      color: '#ff0000',
    },
    // ...
  })

  return <EditorContent editor={editor} />
}
```

## Props

| Prop | Type | Description |
| content | `string` | The initial content of the editor. |
| onChange | `function` | Callback when content changes. |
| editable | `boolean` | Whether the editor is editable. |
| extensions | `array` | Additional Tiptap extensions. |
| ... | ... | ... |

