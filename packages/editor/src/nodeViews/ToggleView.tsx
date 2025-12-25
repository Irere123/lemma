import { useCallback } from "react";
import type { ReactNodeViewProps } from "./ReactNodeView";

export function ToggleView({
  node,
  view,
  getPos,
  selected,
  updateAttributes,
}: ReactNodeViewProps) {
  const isOpen = node.attrs.open ?? false;

  const handleToggle = useCallback(() => {
    updateAttributes({ open: !isOpen });
  }, [isOpen, updateAttributes]);

  const handleDelete = useCallback(() => {
    const pos = getPos();
    if (pos === undefined) return;

    const { tr } = view.state;
    tr.delete(pos, pos + node.nodeSize);
    view.dispatch(tr);
  }, [view, getPos, node]);

  return (
    <div
      className={`toggle-view ${isOpen ? "open" : "closed"} ${
        selected ? "selected" : ""
      }`}
    >
      <div className="toggle-header">
        <button
          type="button"
          className="toggle-button"
          onClick={handleToggle}
          contentEditable={false}
          aria-expanded={isOpen}
          aria-label={isOpen ? "Collapse" : "Expand"}
        >
          <ChevronIcon />
        </button>
        <div className="toggle-summary" data-node-view-content="">
          {/* First child paragraph will be rendered here */}
        </div>
        {selected && (
          <div className="toggle-actions" contentEditable={false}>
            <button
              type="button"
              className="toggle-action-button danger"
              onClick={handleDelete}
              title="Delete toggle"
            >
              <TrashIcon />
            </button>
          </div>
        )}
      </div>
      {isOpen && (
        <div className="toggle-content">
          {/* Nested content will be rendered here by ProseMirror */}
        </div>
      )}
    </div>
  );
}

function ChevronIcon() {
  return (
    <svg
      className="chevron-icon"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M6 4L10 8L6 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M2.5 3.5H11.5M5.5 3.5V2.5C5.5 2.22386 5.72386 2 6 2H8C8.27614 2 8.5 2.22386 8.5 2.5V3.5M10.5 3.5V11.5C10.5 11.7761 10.2761 12 10 12H4C3.72386 12 3.5 11.7761 3.5 11.5V3.5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Styles for toggle view
export const toggleStyles = `
.toggle-view {
  margin: 0.5rem 0;
  border-radius: 4px;
}

.toggle-view.selected {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
  border-radius: 4px;
}

.toggle-header {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  position: relative;
}

.toggle-button {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  margin-top: 2px;
  padding: 0;
  color: #9ca3af;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}

.toggle-button:hover {
  color: #374151;
  background-color: #f3f4f6;
}

.toggle-button .chevron-icon {
  transition: transform 0.15s ease;
}

.toggle-view.open .toggle-button .chevron-icon {
  transform: rotate(90deg);
}

.toggle-summary {
  flex: 1;
  min-width: 0;
}

.toggle-summary > *:first-child {
  margin-top: 0;
}

.toggle-summary > *:last-child {
  margin-bottom: 0;
}

.toggle-actions {
  position: absolute;
  top: 0;
  right: 0;
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.15s;
}

.toggle-view:hover .toggle-actions,
.toggle-view.selected .toggle-actions {
  opacity: 1;
}

.toggle-action-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  color: #666;
  background: white;
  border: 1px solid #e5e5e5;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}

.toggle-action-button:hover {
  background-color: #f5f5f5;
}

.toggle-action-button.danger:hover {
  color: #ef4444;
  border-color: #fecaca;
  background-color: #fef2f2;
}

.toggle-content {
  padding-left: 28px;
  margin-top: 4px;
  animation: toggleFadeIn 0.15s ease;
}

.toggle-view.closed .toggle-content {
  display: none;
}

@keyframes toggleFadeIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Empty toggle placeholder */
.toggle-content:empty::before {
  content: "Click to add content...";
  color: #9ca3af;
  font-style: italic;
}
`;
