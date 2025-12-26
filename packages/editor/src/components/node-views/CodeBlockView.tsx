import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useState, useCallback } from 'react'
import { clsx } from 'clsx'
import { IconCopy, IconCheck, IconChevronDown } from '@tabler/icons-react'

const LANGUAGES = [
  { value: 'plaintext', label: 'Plain Text' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'rust', label: 'Rust' },
  { value: 'go', label: 'Go' },
  { value: 'java', label: 'Java' },
  { value: 'c', label: 'C' },
  { value: 'cpp', label: 'C++' },
  { value: 'csharp', label: 'C#' },
  { value: 'php', label: 'PHP' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'swift', label: 'Swift' },
  { value: 'kotlin', label: 'Kotlin' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'scss', label: 'SCSS' },
  { value: 'json', label: 'JSON' },
  { value: 'yaml', label: 'YAML' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'sql', label: 'SQL' },
  { value: 'bash', label: 'Bash' },
  { value: 'shell', label: 'Shell' },
  { value: 'dockerfile', label: 'Dockerfile' },
  { value: 'graphql', label: 'GraphQL' },
]

export function CodeBlockView({ node, updateAttributes }: NodeViewProps) {
  const [copied, setCopied] = useState(false)
  const [showLanguageSelect, setShowLanguageSelect] = useState(false)

  const language = node.attrs.language || 'plaintext'

  const copyCode = useCallback(() => {
    const text = node.textContent
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [node.textContent])

  const selectLanguage = useCallback(
    (lang: string) => {
      updateAttributes({ language: lang })
      setShowLanguageSelect(false)
    },
    [updateAttributes]
  )

  const currentLanguageLabel = LANGUAGES.find((l) => l.value === language)?.label || language

  return (
    <NodeViewWrapper className='code-block-wrapper'>
      <div className='code-block-header' contentEditable={false}>
        <div className='code-block-language-select'>
          <button
            type='button'
            onClick={() => setShowLanguageSelect(!showLanguageSelect)}
            className='code-block-language-button'
          >
            {currentLanguageLabel}
            <IconChevronDown size={14} />
          </button>
          {showLanguageSelect && (
            <div className='code-block-language-dropdown'>
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.value}
                  type='button'
                  onClick={() => selectLanguage(lang.value)}
                  className={clsx(
                    'code-block-language-option',
                    lang.value === language && 'code-block-language-option-active'
                  )}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type='button'
          onClick={copyCode}
          className='code-block-copy-button'
          title='Copy code'
        >
          {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
        </button>
      </div>
      <pre className='code-block-pre'>
        <NodeViewContent as='code' className={`language-${language}`} />
      </pre>
    </NodeViewWrapper>
  )
}

export default CodeBlockView
