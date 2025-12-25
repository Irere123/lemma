import React, { useCallback, useState } from "react";
import type { ReactNodeViewProps } from "./ReactNodeView";

const CALLOUT_VARIANTS = [
  { value: "info", label: "Info", icon: "ℹ️", color: "#3b82f6" },
  { value: "success", label: "Success", icon: "✅", color: "#22c55e" },
  { value: "warning", label: "Warning", icon: "⚠️", color: "#f59e0b" },
  { value: "error", label: "Error", icon: "❌", color: "#ef4444" },
  { value: "tip", label: "Tip", icon: "💡", color: "#8b5cf6" },
  { value: "note", label: "Note", icon: "📝", color: "#6b7280" },
];

export function CalloutView({
  node,
  view,
  getPos,
  selected,
  updateAttributes,
}: ReactNodeViewProps) {
  const [showVariantPicker, setShowVariantPicker] = useState(false);
  const variant = node.attrs.variant || "info";
  const currentVariant = CALLOUT_VARIANTS.find((v) => v.value === variant) || CALLOUT_VARIANTS[0];

  const handleVariantChange = useCallback(
    (newVariant: string) => {
      updateAttributes({ variant: newVariant });
      setShowVariantPicker(false);
    },
    [updateAttributes]
  );

  const handleDelete = useCallback(() => {
    const pos = getPos();
    if (pos === undefined) return;

    const { tr } = view.state;
    tr.delete(pos, pos + node.nodeSize);
    view.dispatch(tr);
  }, [view, getPos, node]);

  return (
    <div
      className={`callout-view ${selected ? "selected" : ""}`}
      data-variant={variant}
      style={{
        "--callout-color": currentVariant.color,
      } as React.CSSProperties}
    >
      <div className="callout-icon-container">
        <button
          type="button"
          className="callout-icon-button"
          onClick={() => setShowVariantPicker(!showVariantPicker)}
          contentEditable={false}
          title="Change callout type"
        >
          <span className="callout-icon">{currentVariant.icon}</span>
        </button>
        {showVariantPicker && (
          <div className="variant-picker" contentEditable={false}>
            {CALLOUT_VARIANTS.map((v) => (
              <button
                key={v.value}
                type="button"
                className={`variant-option ${
                  variant === v.value ? "active" : ""
                }`}
                onClick={() => handleVariantChange(v.value)}
              >
                <span className="variant-icon">{v.icon}</span>
                <span className="variant-label">{v.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="callout-content" data-node-view-content="" />
      {selected && (
        <div className="callout-actions" contentEditable={false}>
          <button
            type="button"
            className="callout-action-button danger"
            onClick={handleDelete}
            title="Delete callout"
          >
            <TrashIcon />
          </button>
        </div>
      )}
    </div>
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

// Styles for callout view
export const calloutStyles = `
.callout-view {
  position: relative;
  display: flex;
  gap: 12px;
  margin: 0.75rem 0;
  padding: 1rem;
  background-color: color-mix(in srgb, var(--callout-color) 8%, white);
  border-left: 4px solid var(--callout-color);
  border-radius: 0 8px 8px 0;
}

.callout-view.selected {
  outline: 2px solid var(--callout-color);
  outline-offset: -2px;
}

.callout-icon-container {
  position: relative;
  flex-shrink: 0;
}

.callout-icon-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}

.callout-icon-button:hover {
  background-color: rgba(0, 0, 0, 0.05);
  border-color: rgba(0, 0, 0, 0.1);
}

.callout-icon {
  font-size: 18px;
  line-height: 1;
}

.variant-picker {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 50;
  min-width: 140px;
  margin-top: 4px;
  padding: 4px;
  background-color: white;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.variant-option {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  font-size: 14px;
  color: #374151;
  text-align: left;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.variant-option:hover {
  background-color: #f5f5f5;
}

.variant-option.active {
  background-color: #eff6ff;
  color: #2563eb;
}

.variant-icon {
  font-size: 16px;
}

.variant-label {
  font-weight: 500;
}

.callout-content {
  flex: 1;
  min-width: 0;
}

.callout-content > *:first-child {
  margin-top: 0;
}

.callout-content > *:last-child {
  margin-bottom: 0;
}

.callout-actions {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 4px;
}

.callout-action-button {
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

.callout-action-button:hover {
  background-color: #f5f5f5;
}

.callout-action-button.danger:hover {
  color: #ef4444;
  border-color: #fecaca;
  background-color: #fef2f2;
}

/* Variant-specific backgrounds */
.callout-view[data-variant="info"] {
  --callout-color: #3b82f6;
}

.callout-view[data-variant="success"] {
  --callout-color: #22c55e;
}

.callout-view[data-variant="warning"] {
  --callout-color: #f59e0b;
}

.callout-view[data-variant="error"] {
  --callout-color: #ef4444;
}

.callout-view[data-variant="tip"] {
  --callout-color: #8b5cf6;
}

.callout-view[data-variant="note"] {
  --callout-color: #6b7280;
}
`;
