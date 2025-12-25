import React, { useCallback, useEffect, useRef, useState } from "react";
import { useFloating, offset, flip, shift, autoUpdate } from "@floating-ui/react";
import { useEditorView } from "../context/EditorContext";
import { useMarkActive, useSelectionRect } from "../hooks";
import {
  toggleBold,
  toggleItalic,
  toggleUnderline,
  toggleStrikethrough,
  toggleCode,
  toggleHighlight,
  setLink,
  removeLink,
} from "../commands";

export interface BubbleMenuProps {
  className?: string;
  children?: React.ReactNode;
}

export function BubbleMenu({ className }: BubbleMenuProps) {
  const view = useEditorView();
  const selectionRect = useSelectionRect();
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const linkInputRef = useRef<HTMLInputElement>(null);

  const isBold = useMarkActive("bold");
  const isItalic = useMarkActive("italic");
  const isUnderline = useMarkActive("underline");
  const isStrikethrough = useMarkActive("strikethrough");
  const isCode = useMarkActive("code");
  const isHighlight = useMarkActive("highlight");
  const isLink = useMarkActive("link");

  const { refs, floatingStyles } = useFloating({
    open: !!selectionRect,
    placement: "top",
    middleware: [
      offset(8),
      flip({ fallbackPlacements: ["bottom", "top"] }),
      shift({ padding: 8 }),
    ],
    whileElementsMounted: autoUpdate,
  });

  // Update virtual reference based on selection
  useEffect(() => {
    if (selectionRect) {
      refs.setReference({
        getBoundingClientRect: () => selectionRect,
      });
    }
  }, [selectionRect, refs]);

  // Focus link input when shown
  useEffect(() => {
    if (showLinkInput) {
      linkInputRef.current?.focus();
      // Get current link href if editing
      if (view) {
        const { from, to } = view.state.selection;
        view.state.doc.nodesBetween(from, to, (node) => {
          const linkMark = node.marks.find((m) => m.type.name === "link");
          if (linkMark) {
            setLinkUrl(linkMark.attrs.href || "");
          }
        });
      }
    }
  }, [showLinkInput, view]);

  const handleFormat = useCallback(
    (command: (view: any) => boolean) => {
      if (view) {
        command(view);
        view.focus();
      }
    },
    [view]
  );

  const handleLinkSubmit = useCallback(() => {
    if (view && linkUrl) {
      setLink(linkUrl)(view.state, view.dispatch);
      view.focus();
    }
    setShowLinkInput(false);
    setLinkUrl("");
  }, [view, linkUrl]);

  const handleLinkRemove = useCallback(() => {
    if (view) {
      removeLink(view.state, view.dispatch);
      view.focus();
    }
    setShowLinkInput(false);
    setLinkUrl("");
  }, [view]);

  const handleLinkKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleLinkSubmit();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowLinkInput(false);
        setLinkUrl("");
        view?.focus();
      }
    },
    [handleLinkSubmit, view]
  );

  // Don't show if no selection or selection is empty
  if (!selectionRect || !view) {
    return null;
  }

  // Check if selection is collapsed (no text selected)
  if (view.state.selection.empty) {
    return null;
  }

  return (
    <div
      ref={refs.setFloating}
      style={floatingStyles}
      className={`bubble-menu ${className || ""}`}
    >
      {showLinkInput ? (
        <div className="bubble-menu-link-input">
          <input
            ref={linkInputRef}
            type="url"
            className="link-input"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={handleLinkKeyDown}
            placeholder="Enter URL..."
          />
          <button
            type="button"
            className="link-submit"
            onClick={handleLinkSubmit}
            disabled={!linkUrl}
          >
            <CheckIcon />
          </button>
          {isLink && (
            <button
              type="button"
              className="link-remove"
              onClick={handleLinkRemove}
              title="Remove link"
            >
              <TrashIcon />
            </button>
          )}
          <button
            type="button"
            className="link-cancel"
            onClick={() => {
              setShowLinkInput(false);
              setLinkUrl("");
            }}
          >
            <CloseIcon />
          </button>
        </div>
      ) : (
        <div className="bubble-menu-buttons">
          <button
            type="button"
            className={`bubble-menu-button ${isBold ? "active" : ""}`}
            onClick={() => handleFormat(toggleBold)}
            title="Bold (Cmd+B)"
          >
            <BoldIcon />
          </button>
          <button
            type="button"
            className={`bubble-menu-button ${isItalic ? "active" : ""}`}
            onClick={() => handleFormat(toggleItalic)}
            title="Italic (Cmd+I)"
          >
            <ItalicIcon />
          </button>
          <button
            type="button"
            className={`bubble-menu-button ${isUnderline ? "active" : ""}`}
            onClick={() => handleFormat(toggleUnderline)}
            title="Underline (Cmd+U)"
          >
            <UnderlineIcon />
          </button>
          <button
            type="button"
            className={`bubble-menu-button ${isStrikethrough ? "active" : ""}`}
            onClick={() => handleFormat(toggleStrikethrough)}
            title="Strikethrough"
          >
            <StrikethroughIcon />
          </button>
          <div className="bubble-menu-divider" />
          <button
            type="button"
            className={`bubble-menu-button ${isCode ? "active" : ""}`}
            onClick={() => handleFormat(toggleCode)}
            title="Inline Code (Cmd+E)"
          >
            <CodeIcon />
          </button>
          <button
            type="button"
            className={`bubble-menu-button ${isHighlight ? "active" : ""}`}
            onClick={() => handleFormat(toggleHighlight)}
            title="Highlight"
          >
            <HighlightIcon />
          </button>
          <div className="bubble-menu-divider" />
          <button
            type="button"
            className={`bubble-menu-button ${isLink ? "active" : ""}`}
            onClick={() => setShowLinkInput(true)}
            title="Add Link (Cmd+K)"
          >
            <LinkIcon />
          </button>
        </div>
      )}
    </div>
  );
}

// Icons
function BoldIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3.5 2.5H8C9.38071 2.5 10.5 3.61929 10.5 5C10.5 6.38071 9.38071 7.5 8 7.5H3.5V2.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3.5 7.5H8.5C9.88071 7.5 11 8.61929 11 10C11 11.3807 9.88071 12.5 8.5 12.5H3.5V7.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ItalicIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5.5 12.5H8.5M5.5 2.5H8.5M8 2.5L6 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function UnderlineIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3.5 2.5V7C3.5 9.20914 5.29086 11 7.5 11C9.70914 11 11.5 9.20914 11.5 7V2.5M2.5 13H12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function StrikethroughIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 7H12M4.5 3.5H9.5C10.6046 3.5 11.5 4.39543 11.5 5.5C11.5 6.05228 11.2761 6.55228 10.9142 6.91421M4.5 11.5H9.5C10.6046 11.5 11.5 10.6046 11.5 9.5C11.5 8.94772 11.2761 8.44772 10.9142 8.08579" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4.5 4L1.5 7L4.5 10M9.5 4L12.5 7L9.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function HighlightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8.5 2L2.5 8L4 9.5L5.5 11L11.5 5L8.5 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2 12.5H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 8C6.55228 8.55228 7.44772 8.55228 8 8L10 6C11.1046 4.89543 11.1046 3.10457 10 2C8.89543 0.895431 7.10457 0.895431 6 2L5 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M8 6C7.44772 5.44772 6.55228 5.44772 6 6L4 8C2.89543 9.10457 2.89543 10.8954 4 12C5.10457 13.1046 6.89543 13.1046 8 12L9 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2.5 3.5H11.5M5.5 3.5V2.5C5.5 2.22386 5.72386 2 6 2H8C8.27614 2 8.5 2.22386 8.5 2.5V3.5M10.5 3.5V11.5C10.5 11.7761 10.2761 12 10 12H4C3.72386 12 3.5 11.7761 3.5 11.5V3.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3.5 3.5L10.5 10.5M10.5 3.5L3.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// Styles for bubble menu
export const bubbleMenuStyles = `
.bubble-menu {
  display: flex;
  align-items: center;
  padding: 4px;
  background-color: #1f2937;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.05);
  z-index: 100;
  animation: bubbleMenuFadeIn 0.15s ease;
}

@keyframes bubbleMenuFadeIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.bubble-menu-buttons {
  display: flex;
  align-items: center;
  gap: 2px;
}

.bubble-menu-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  color: #d1d5db;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}

.bubble-menu-button:hover {
  color: #fff;
  background-color: rgba(255, 255, 255, 0.1);
}

.bubble-menu-button.active {
  color: #60a5fa;
  background-color: rgba(96, 165, 250, 0.15);
}

.bubble-menu-divider {
  width: 1px;
  height: 16px;
  margin: 0 4px;
  background-color: rgba(255, 255, 255, 0.1);
}

.bubble-menu-link-input {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 4px;
}

.link-input {
  width: 200px;
  padding: 6px 8px;
  font-size: 13px;
  color: #fff;
  background-color: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 4px;
  outline: none;
}

.link-input:focus {
  border-color: #60a5fa;
  background-color: rgba(255, 255, 255, 0.15);
}

.link-input::placeholder {
  color: #9ca3af;
}

.link-submit,
.link-remove,
.link-cancel {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  color: #d1d5db;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}

.link-submit:hover {
  color: #22c55e;
  background-color: rgba(34, 197, 94, 0.15);
}

.link-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.link-remove:hover {
  color: #ef4444;
  background-color: rgba(239, 68, 68, 0.15);
}

.link-cancel:hover {
  color: #fff;
  background-color: rgba(255, 255, 255, 0.1);
}
`;
