import { useState } from "react";
import type { RenderElementProps } from "slate-react";
import { Transforms } from "slate";
import { ReactEditor, useSlateStatic } from "slate-react";
import { IconChevronRight, IconChevronDown } from "@tabler/icons-react";
import type { Toggle } from "../types";

const ToggleElement = (props: RenderElementProps) => {
  const { attributes, children, element } = props;
  const editor = useSlateStatic();
  const toggle = element as Toggle;
  const [isOpen, setIsOpen] = useState(toggle.open ?? false);

  const handleToggle = () => {
    const path = ReactEditor.findPath(editor, element);
    const newIsOpen = !isOpen;
    setIsOpen(newIsOpen);
    Transforms.setNodes(editor, { open: newIsOpen }, { at: path });
  };

  return (
    <div {...attributes} className="my-1">
      <div className="flex items-start gap-2 group">
        <button
          contentEditable={false}
          onClick={handleToggle}
          className="flex-shrink-0 mt-1 p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
          aria-label={isOpen ? "Collapse" : "Expand"}
        >
          {isOpen ? (
            <IconChevronDown
              size={18}
              className="text-gray-600 dark:text-gray-400"
            />
          ) : (
            <IconChevronRight
              size={18}
              className="text-gray-600 dark:text-gray-400"
            />
          )}
        </button>
        <div className="flex-1">
          <div className="font-medium">{children}</div>
        </div>
      </div>
      {isOpen && (
        <div className="ml-7 mt-1 pl-4 border-l-2 border-gray-200 dark:border-gray-700">
          {/* Toggle content would go here in a more complex implementation */}
        </div>
      )}
    </div>
  );
};

export default ToggleElement;
