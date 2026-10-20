import { NodeViewContent, type NodeViewProps, NodeViewWrapper } from '@lemma/headless'
import { Check, Copy } from 'lucide-react'
import { useState } from 'react'

import { Popover, PopoverPopup, PopoverTrigger } from '../ui/popover'

const LANGUAGE_NAMES: Record<string, string> = {
  bash: 'Bash',
  c: 'C',
  cpp: 'C++',
  csharp: 'C#',
  css: 'CSS',
  diff: 'Diff',
  go: 'Go',
  graphql: 'GraphQL',
  ini: 'INI / TOML',
  java: 'Java',
  javascript: 'JavaScript',
  json: 'JSON',
  kotlin: 'Kotlin',
  less: 'Less',
  lua: 'Lua',
  makefile: 'Makefile',
  markdown: 'Markdown',
  objectivec: 'Objective-C',
  perl: 'Perl',
  php: 'PHP',
  python: 'Python',
  r: 'R',
  ruby: 'Ruby',
  rust: 'Rust',
  scss: 'SCSS',
  shell: 'Shell session',
  sql: 'SQL',
  swift: 'Swift',
  typescript: 'TypeScript',
  vbnet: 'VB.NET',
  wasm: 'WebAssembly',
  xml: 'HTML / XML',
  yaml: 'YAML',
}

/**
 * Code block: the language (for highlighting, here and on the published page)
 * and a copy button, shown when the pointer or caret is in the block.
 */
export function CodeBlockView({ node, updateAttributes, extension, editor }: NodeViewProps) {
  const [copied, setCopied] = useState(false)
  const lowlight = extension.options.lowlight as { listLanguages(): string[] }
  const languages = lowlight
    .listLanguages()
    .filter((id) => LANGUAGE_NAMES[id])
    .sort((a, b) => (LANGUAGE_NAMES[a] as string).localeCompare(LANGUAGE_NAMES[b] as string))
  const language = (node.attrs.language as string | null) ?? ''

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(node.textContent)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard blocked: nothing to do
    }
  }

  return (
    <NodeViewWrapper className='code-block group/code relative' data-id={node.attrs.id}>
      <div
        contentEditable={false}
        className='code-block-toolbar absolute end-2 top-2 z-10 flex items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover/code:opacity-100'
      >
        <select
          aria-label='Code language'
          value={language}
          disabled={!editor.isEditable}
          onChange={(event) => updateAttributes({ language: event.currentTarget.value || null })}
          className='h-7 rounded-md border border-border/70 bg-background px-1.5 font-sans text-muted-foreground text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring'
        >
          <option value=''>Plain text</option>
          {languages.map((id) => (
            <option key={id} value={id}>
              {LANGUAGE_NAMES[id]}
            </option>
          ))}
        </select>
        <button
          type='button'
          onClick={() => void copy()}
          aria-label={copied ? 'Copied' : 'Copy code'}
          className='flex size-7 items-center justify-center rounded-md border border-border/70 bg-background text-muted-foreground hover:text-foreground [&_svg]:size-3.5'
        >
          {copied ? <Check /> : <Copy />}
        </button>
      </div>
      <pre>
        <NodeViewContent<'code'>
          as='code'
          className={language ? `language-${language}` : undefined}
        />
      </pre>
    </NodeViewWrapper>
  )
}

const CALLOUT_EMOJI = ['💡', 'ℹ️', '⚠️', '❗', '✅', '❌', '📌', '📝', '🔥', '❓', '🧪', '📚']

/** Callout: the emoji is a button that changes it. */
export function CalloutView({ node, updateAttributes, editor }: NodeViewProps) {
  const [open, setOpen] = useState(false)
  const emoji = (node.attrs.emoji as string) || '💡'
  return (
    <NodeViewWrapper className='callout' data-callout='' data-emoji={emoji} data-id={node.attrs.id}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <button
              type='button'
              contentEditable={false}
              disabled={!editor.isEditable}
              className='callout-icon rounded-md hover:bg-accent'
              aria-label={`Callout icon ${emoji}, change`}
            >
              {emoji}
            </button>
          }
        />
        <PopoverPopup align='start' className='w-auto p-1.5'>
          <div className='grid grid-cols-6 gap-0.5' role='listbox' aria-label='Callout icon'>
            {CALLOUT_EMOJI.map((choice) => (
              <button
                key={choice}
                type='button'
                role='option'
                aria-selected={choice === emoji}
                className='flex size-8 items-center justify-center rounded-md text-lg hover:bg-accent aria-selected:bg-accent'
                onClick={() => {
                  updateAttributes({ emoji: choice })
                  setOpen(false)
                }}
              >
                {choice}
              </button>
            ))}
          </div>
        </PopoverPopup>
      </Popover>
      <NodeViewContent className='callout-body' />
    </NodeViewWrapper>
  )
}
