import { useState, useCallback, useMemo, type ReactNode, type CSSProperties } from "react";
import { Highlight, themes, type Language, type Token } from "prism-react-renderer";
import { Node, Transforms } from "slate";
import { ReactEditor, useSlate, useReadOnly } from "slate-react";
import {
  IconCopy,
  IconCheck,
  IconChevronDown,
  IconCode,
} from "@tabler/icons-react";
import type { CodeBlock } from "../types";

// Supported languages for the dropdown
const SUPPORTED_LANGUAGES: { value: string; label: string }[] = [
  { value: "plaintext", label: "Plain Text" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "jsx", label: "JSX" },
  { value: "tsx", label: "TSX" },
  { value: "python", label: "Python" },
  { value: "rust", label: "Rust" },
  { value: "go", label: "Go" },
  { value: "java", label: "Java" },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
  { value: "csharp", label: "C#" },
  { value: "ruby", label: "Ruby" },
  { value: "php", label: "PHP" },
  { value: "swift", label: "Swift" },
  { value: "kotlin", label: "Kotlin" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "scss", label: "SCSS" },
  { value: "json", label: "JSON" },
  { value: "yaml", label: "YAML" },
  { value: "markdown", label: "Markdown" },
  { value: "bash", label: "Bash" },
  { value: "shell", label: "Shell" },
  { value: "sql", label: "SQL" },
  { value: "graphql", label: "GraphQL" },
  { value: "docker", label: "Dockerfile" },
];

type CodeBlockElementProps = {
  element: CodeBlock;
  attributes: { contentEditable?: boolean };
  children: ReactNode;
};

export default function CodeBlockElement({
  element,
  attributes,
  children,
}: CodeBlockElementProps) {
  const editor = useSlate();
  const readOnly = useReadOnly();
  const [copied, setCopied] = useState(false);
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [isEditingFilename, setIsEditingFilename] = useState(false);
  const [filenameInput, setFilenameInput] = useState(element.filename || "");

  const language = element.language || "plaintext";
  const showLineNumbers = element.showLineNumbers ?? true;
  const highlightLines = element.highlightLines || [];
  const filename = element.filename;

  // Get the text content of the code block
  const codeText = useMemo(() => {
    return Node.string(element);
  }, [element]);

  // Copy code to clipboard
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(codeText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy code:", err);
    }
  }, [codeText]);

  // Update language
  const handleLanguageChange = useCallback(
    (newLanguage: string) => {
      const path = ReactEditor.findPath(editor, element);
      Transforms.setNodes(editor, { language: newLanguage }, { at: path });
      setShowLanguageDropdown(false);
    },
    [editor, element]
  );

  // Toggle line numbers
  const handleToggleLineNumbers = useCallback(() => {
    const path = ReactEditor.findPath(editor, element);
    Transforms.setNodes(
      editor,
      { showLineNumbers: !showLineNumbers },
      { at: path }
    );
  }, [editor, element, showLineNumbers]);

  // Update filename
  const handleFilenameSubmit = useCallback(() => {
    const path = ReactEditor.findPath(editor, element);
    Transforms.setNodes(
      editor,
      { filename: filenameInput || undefined },
      { at: path }
    );
    setIsEditingFilename(false);
  }, [editor, element, filenameInput]);

  // Get the selected language label
  const selectedLanguageLabel = useMemo(() => {
    const lang = SUPPORTED_LANGUAGES.find((l) => l.value === language);
    return lang?.label || language;
  }, [language]);

  // Map language to prism language
  const prismLanguage = useMemo((): Language => {
    const languageMap: Record<string, Language> = {
      plaintext: "plain" as Language,
      javascript: "javascript",
      typescript: "typescript",
      jsx: "jsx",
      tsx: "tsx",
      python: "python",
      rust: "rust",
      go: "go",
      java: "java",
      c: "c",
      cpp: "cpp",
      csharp: "csharp",
      ruby: "ruby",
      php: "php",
      swift: "swift",
      kotlin: "kotlin",
      html: "markup",
      css: "css",
      scss: "scss",
      json: "json",
      yaml: "yaml",
      markdown: "markdown",
      bash: "bash",
      shell: "bash",
      sql: "sql",
      graphql: "graphql",
      docker: "docker",
    };
    return languageMap[language] || ("plain" as Language);
  }, [language]);

  return (
    <div
      className="my-4 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden bg-[#1e1e1e] group"
      {...attributes}
    >
      {/* Header with filename and controls */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#2d2d2d] border-b border-gray-700">
        <div className="flex items-center gap-2">
          {/* Filename */}
          {!readOnly && isEditingFilename ? (
            <input
              type="text"
              value={filenameInput}
              onChange={(e) => setFilenameInput(e.target.value)}
              onBlur={handleFilenameSubmit}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleFilenameSubmit();
                }
                if (e.key === "Escape") {
                  setIsEditingFilename(false);
                  setFilenameInput(element.filename || "");
                }
              }}
              className="bg-transparent text-gray-300 text-sm border-b border-gray-500 focus:border-blue-500 outline-none px-1"
              placeholder="filename.ts"
              autoFocus
            />
          ) : filename ? (
            <button
              type="button"
              onClick={() => !readOnly && setIsEditingFilename(true)}
              className="text-gray-300 text-sm hover:text-white transition-colors flex items-center gap-1"
            >
              <IconCode size={14} className="text-gray-500" />
              {filename}
            </button>
          ) : !readOnly ? (
            <button
              type="button"
              onClick={() => setIsEditingFilename(true)}
              className="text-gray-500 text-sm hover:text-gray-300 transition-colors opacity-0 group-hover:opacity-100"
            >
              + Add filename
            </button>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {/* Language selector */}
          {!readOnly && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-white bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded transition-colors"
              >
                {selectedLanguageLabel}
                <IconChevronDown size={12} />
              </button>

              {showLanguageDropdown && (
                <div className="absolute right-0 top-full mt-1 z-50 w-40 max-h-60 overflow-y-auto bg-gray-800 border border-gray-600 rounded-md shadow-lg">
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <button
                      key={lang.value}
                      type="button"
                      onClick={() => handleLanguageChange(lang.value)}
                      className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-700 transition-colors ${
                        lang.value === language
                          ? "text-blue-400 bg-gray-700"
                          : "text-gray-300"
                      }`}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Line numbers toggle */}
          {!readOnly && (
            <button
              type="button"
              onClick={handleToggleLineNumbers}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                showLineNumbers
                  ? "text-blue-400 bg-blue-500/20"
                  : "text-gray-400 hover:text-white"
              }`}
              title={showLineNumbers ? "Hide line numbers" : "Show line numbers"}
            >
              #
            </button>
          )}

          {/* Copy button */}
          <button
            type="button"
            onClick={handleCopy}
            className="text-gray-400 hover:text-white transition-colors p-1 rounded hover:bg-gray-700"
            title="Copy code"
          >
            {copied ? (
              <IconCheck size={16} className="text-green-400" />
            ) : (
              <IconCopy size={16} />
            )}
          </button>
        </div>
      </div>

      {/* Code content with syntax highlighting overlay */}
      <div className="relative">
        {/* Syntax highlighted background (visual only) */}
        <Highlight
          theme={themes.vsDark}
          code={codeText || " "}
          language={prismLanguage}
        >
          {({
            className,
            style,
            tokens,
            getLineProps,
            getTokenProps,
          }: {
            className: string;
            style: CSSProperties;
            tokens: Token[][];
            getLineProps: (input: { line: Token[] }) => { className?: string };
            getTokenProps: (input: { token: Token }) => { className?: string; children: string };
          }) => (
            <pre
              className={`${className} p-4 overflow-x-auto text-sm leading-6`}
              style={{ ...style, margin: 0, background: "transparent" }}
              aria-hidden="true"
            >
              {tokens.map((line: Token[], lineIndex: number) => {
                const lineNumber = lineIndex + 1;
                const isHighlighted = highlightLines.includes(lineNumber);
                return (
                  <div
                    key={lineIndex}
                    {...getLineProps({ line })}
                    className={`${isHighlighted ? "bg-yellow-500/20 -mx-4 px-4" : ""}`}
                  >
                    {showLineNumbers && (
                      <span className="inline-block w-8 mr-4 text-gray-500 text-right select-none">
                        {lineNumber}
                      </span>
                    )}
                    {line.map((token: Token, tokenIndex: number) => (
                      <span key={tokenIndex} {...getTokenProps({ token })} />
                    ))}
                  </div>
                );
              })}
            </pre>
          )}
        </Highlight>

        {/* Actual editable content (invisible but interactive) */}
        <div
          className="absolute inset-0 p-4 overflow-auto font-mono text-sm leading-6 text-transparent caret-white"
          style={{
            paddingLeft: showLineNumbers ? "4.5rem" : "1rem",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

// Helper to check if a line should be highlighted
// Can be used when parsing code block with meta strings like ```js {1,3-5}
export function parseHighlightLines(meta?: string): number[] {
  if (!meta) return [];

  const lineNumbers: number[] = [];
  const matches = meta.match(/\{([^}]+)\}/);

  if (matches?.[1]) {
    const parts = matches[1].split(",");
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.includes("-")) {
        const [start, end] = trimmed.split("-").map(Number);
        if (!isNaN(start) && !isNaN(end)) {
          for (let i = start; i <= end; i++) {
            lineNumbers.push(i);
          }
        }
      } else {
        const num = Number(trimmed);
        if (!isNaN(num)) {
          lineNumbers.push(num);
        }
      }
    }
  }

  return lineNumbers;
}
