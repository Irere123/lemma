import { useState, useCallback } from "react";
import type { RenderElementProps } from "slate-react";
import { Transforms, Editor } from "slate";
import { ReactEditor, useSlateStatic } from "slate-react";
import { IconChevronRight, IconChevronDown } from "@tabler/icons-react";
import type { Toggle } from "../types";
import { ElementType } from "../types";
import { createNodeId } from "../utils/plugins/withNodeId";

const ToggleElement = (props: RenderElementProps) => {
  const { attributes, children, element } = props;
  const editor = useSlateStatic();
  const toggle = element as Toggle;
  const [isOpen, setIsOpen] = useState(toggle.open ?? false);

  const handleToggle = useCallback(() => {
    const path = ReactEditor.findPath(editor, element);
    const newIsOpen = !isOpen;
    setIsOpen(newIsOpen);
    Transforms.setNodes(editor, { open: newIsOpen }, { at: path });
  }, [editor, element, isOpen]);

  return (
    <div {...attributes} className="my-2">
      <div className="flex items-start gap-1.5 group">
        <button
          contentEditable={false}
          onClick={handleToggle}
          className="flex-shrink-0 mt-0.5 p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors cursor-pointer select-none"
          aria-label={isOpen ? "Collapse" : "Expand"}
          aria-expanded={isOpen}
          type="button"
        >
          {isOpen ? (
            <IconChevronDown
              size={16}
              className="text-gray-500 dark:text-gray-400"
            />
          ) : (
            <IconChevronRight
              size={16}
              className="text-gray-500 dark:text-gray-400"
            />
          )}
        </button>
        <div className="flex-1 min-w-0">
          <div className="font-medium leading-relaxed">{children}</div>
        </div>
      </div>
      {isOpen && (
        <div
          className="ml-6 mt-1 pl-4 border-l-2 border-gray-200 dark:border-gray-700"
          contentEditable={false}
        >
          <div
            className="text-gray-600 dark:text-gray-400 py-1 px-2 text-sm cursor-text"
            onClick={() => {
              // Insert a new paragraph inside the toggle when clicking the empty content area
              const path = ReactEditor.findPath(editor, element);
              // Add a paragraph at the end of the document for now
              // In a full implementation, this would insert inside the toggle
              Transforms.insertNodes(
                editor,
                {
                  id: createNodeId(),
                  type: ElementType.Paragraph,
                  children: [{ text: "" }],
                },
                { at: Editor.end(editor, path) }
              );
            }}
          >
            Click here to add content...
          </div>
        </div>
      )}
    </div>
  );
};

export default ToggleElement;
