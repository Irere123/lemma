import { IconCheck, IconChevronDown, IconCopy } from '@tabler/icons-react'
import { NodeViewContent, type NodeViewProps, NodeViewWrapper } from '@tiptap/react'
import { useCallback, useEffect, useRef, useState } from 'react'

// Common programming languages
const LANGUAGES = [
  { value: 'plaintext', label: 'Plain Text' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'jsx', label: 'JSX' },
  { value: 'tsx', label: 'TSX' },
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
  { value: 'xml', label: 'XML' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'sql', label: 'SQL' },
  { value: 'graphql', label: 'GraphQL' },
  { value: 'bash', label: 'Bash' },
  { value: 'shell', label: 'Shell' },
  { value: 'dockerfile', label: 'Dockerfile' },
]

export function CodeBlockView({ node, updateAttributes }: NodeViewProps) {
  const [copied, setCopied] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const language = node.attrs.language || 'plaintext'

  const copyCode = useCallback(() => {
    const code = node.textContent
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [node])

  const setLanguage = useCallback(
    (lang: string) => {
      updateAttributes({ language: lang })
      setShowDropdown(false)
    },
    [updateAttributes]
  )

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const currentLanguage = LANGUAGES.find((l) => l.value === language)?.label || 'Plain Text'

  return (
    <NodeViewWrapper className='code-block-wrapper'>
      <div className='code-block-header'>
        <div className='code-block-language-select'>
          <button
            ref={buttonRef}
            type='button'
            className='code-block-language-button'
            onClick={() => setShowDropdown(!showDropdown)}
          >
            <span>{currentLanguage}</span>
            <IconChevronDown size={12} />
          </button>
          {showDropdown && (
            <div ref={dropdownRef} className='code-block-language-dropdown'>
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.value}
                  type='button'
                  className={`code-block-language-option ${language === lang.value ? 'code-block-language-option-active' : ''}`}
                  onClick={() => setLanguage(lang.value)}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type='button'
          className='code-block-copy-button'
          onClick={copyCode}
          title='Copy code'
        >
          {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
        </button>
      </div>
      <pre className='code-block-pre'>
        <NodeViewContent as='code' />
      </pre>
    </NodeViewWrapper>
  )
}
