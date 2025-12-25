import { useCallback, useRef, useState } from 'react'
import type { ReactNodeViewProps } from './ReactNodeView'

const LANGUAGES = [
  { value: null, label: 'Plain text' },
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
  { value: 'ruby', label: 'Ruby' },
  { value: 'php', label: 'PHP' },
  { value: 'swift', label: 'Swift' },
  { value: 'kotlin', label: 'Kotlin' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'scss', label: 'SCSS' },
  { value: 'json', label: 'JSON' },
  { value: 'yaml', label: 'YAML' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'bash', label: 'Bash' },
  { value: 'shell', label: 'Shell' },
  { value: 'sql', label: 'SQL' },
  { value: 'graphql', label: 'GraphQL' },
]

export function CodeBlockView({ node, selected, updateAttributes }: ReactNodeViewProps) {
  const codeRef = useRef<HTMLPreElement>(null)
  const [showLanguageSelect, setShowLanguageSelect] = useState(false)
  const language = node.attrs.language || null

  const handleLanguageChange = useCallback(
    (newLanguage: string | null) => {
      updateAttributes({ language: newLanguage })
      setShowLanguageSelect(false)
    },
    [updateAttributes]
  )

  const handleCopy = useCallback(async () => {
    const text = node.textContent
    try {
      await navigator.clipboard.writeText(text)
    } catch (err) {
      console.error('Failed to copy code:', err)
    }
  }, [node])

  // Get display language
  const displayLanguage = LANGUAGES.find((l) => l.value === language)?.label || 'Plain text'

  return (
    <div
      className={`code-block-view ${selected ? 'selected' : ''}`}
      data-language={language || 'plaintext'}
    >
      <div className='code-block-header'>
        <div className='language-selector'>
          <button
            type='button'
            className='language-button'
            onClick={() => setShowLanguageSelect(!showLanguageSelect)}
            contentEditable={false}
          >
            {displayLanguage}
            <ChevronDownIcon />
          </button>
          {showLanguageSelect && (
            <div className='language-dropdown' contentEditable={false}>
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.value || 'plain'}
                  type='button'
                  className={`language-option ${language === lang.value ? 'active' : ''}`}
                  onClick={() => handleLanguageChange(lang.value)}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type='button'
          className='copy-button'
          onClick={handleCopy}
          contentEditable={false}
          title='Copy code'
        >
          <CopyIcon />
        </button>
      </div>
      <pre ref={codeRef} className='code-block-content'>
        <code className={language ? `language-${language}` : ''}>{node.textContent || '\n'}</code>
      </pre>
    </div>
  )
}

function ChevronDownIcon() {
  return (
    <svg width='12' height='12' viewBox='0 0 12 12' fill='none' xmlns='http://www.w3.org/2000/svg'>
      <path
        d='M3 4.5L6 7.5L9 4.5'
        stroke='currentColor'
        strokeWidth='1.5'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg width='14' height='14' viewBox='0 0 14 14' fill='none' xmlns='http://www.w3.org/2000/svg'>
      <rect x='4.5' y='4.5' width='7' height='7' rx='1' stroke='currentColor' strokeWidth='1.5' />
      <path
        d='M2.5 9.5V3C2.5 2.17157 3.17157 1.5 4 1.5H9.5'
        stroke='currentColor'
        strokeWidth='1.5'
        strokeLinecap='round'
      />
    </svg>
  )
}

// Styles for the code block view
export const codeBlockStyles = `
.code-block-view {
  position: relative;
  margin: 0.5rem 0;
  border-radius: 6px;
  background-color: #1e1e1e;
  overflow: hidden;
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
}

.code-block-view.selected {
  outline: 2px solid #3b82f6;
}

.code-block-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0.75rem;
  background-color: #2d2d2d;
  border-bottom: 1px solid #404040;
}

.language-selector {
  position: relative;
}

.language-button {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  font-size: 12px;
  color: #a0a0a0;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}

.language-button:hover {
  color: #ffffff;
  background-color: #404040;
}

.language-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 50;
  min-width: 150px;
  max-height: 300px;
  margin-top: 4px;
  padding: 4px;
  background-color: #2d2d2d;
  border: 1px solid #404040;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  overflow-y: auto;
}

.language-option {
  display: block;
  width: 100%;
  padding: 6px 10px;
  font-size: 13px;
  color: #d0d0d0;
  text-align: left;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.language-option:hover {
  background-color: #404040;
}

.language-option.active {
  color: #3b82f6;
  background-color: rgba(59, 130, 246, 0.1);
}

.copy-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  color: #a0a0a0;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}

.copy-button:hover {
  color: #ffffff;
  background-color: #404040;
}

.code-block-content {
  margin: 0;
  padding: 1rem;
  overflow-x: auto;
  font-size: 14px;
  line-height: 1.6;
  color: #d4d4d4;
}

.code-block-content code {
  font-family: inherit;
  white-space: pre;
}
`
