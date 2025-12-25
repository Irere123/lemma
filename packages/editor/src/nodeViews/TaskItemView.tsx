import { useCallback } from "react";
import type { ReactNodeViewProps } from "./ReactNodeView";

export function TaskItemView({
  node,
  selected,
  updateAttributes,
}: ReactNodeViewProps) {
  const checked = node.attrs.checked ?? false;

  const handleToggle = useCallback(() => {
    updateAttributes({ checked: !checked });
  }, [checked, updateAttributes]);

  return (
    <div
      className={`task-item-view ${checked ? "completed" : ""} ${
        selected ? "selected" : ""
      }`}
      data-checked={checked}
    >
      <label className="task-checkbox-container" contentEditable={false}>
        <input
          type="checkbox"
          className="task-checkbox-input"
          checked={checked}
          onChange={handleToggle}
        />
        <span className="task-checkbox">
          {checked && <CheckIcon />}
        </span>
      </label>
      <div className="task-content" data-node-view-content="" />
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      className="check-icon"
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M2 5L4 7L8 3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Styles for task item view
export const taskItemStyles = `
.task-item-view {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 2px 0;
  position: relative;
}

.task-item-view.selected {
  background-color: rgba(59, 130, 246, 0.05);
  border-radius: 4px;
}

.task-checkbox-container {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 4px;
  cursor: pointer;
}

.task-checkbox-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.task-checkbox {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: 2px solid #d1d5db;
  border-radius: 4px;
  background-color: white;
  transition: all 0.15s;
}

.task-checkbox-container:hover .task-checkbox {
  border-color: #9ca3af;
}

.task-item-view.completed .task-checkbox {
  background-color: #3b82f6;
  border-color: #3b82f6;
}

.task-checkbox .check-icon {
  color: white;
  opacity: 0;
  transform: scale(0.5);
  transition: all 0.15s;
}

.task-item-view.completed .task-checkbox .check-icon {
  opacity: 1;
  transform: scale(1);
}

.task-content {
  flex: 1;
  min-width: 0;
}

.task-item-view.completed .task-content {
  color: #9ca3af;
  text-decoration: line-through;
}

.task-content > *:first-child {
  margin-top: 0;
}

.task-content > *:last-child {
  margin-bottom: 0;
}

/* Animation for check */
@keyframes checkBounce {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.2); }
}

.task-item-view.completed .task-checkbox {
  animation: checkBounce 0.2s ease;
}

/* Task list container styles */
.ProseMirror [data-node-type="taskList"] {
  list-style: none;
  padding-left: 0;
  margin: 0.5rem 0;
}

.ProseMirror [data-node-type="taskList"] > li {
  list-style: none;
}

/* Drag handle area */
.task-item-view::before {
  content: "";
  position: absolute;
  left: -24px;
  top: 0;
  bottom: 0;
  width: 20px;
}
`;
