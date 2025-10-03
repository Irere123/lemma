import { useCallback, useMemo } from "react";
import { Editor, Element, Transforms } from "slate";
import { ReactEditor, useSlateStatic } from "slate-react";
import {
  IconDotsVertical,
  IconLink,
  IconPlus,
  IconGripVertical,
  IconTrash,
  IconCopy,
} from "@tabler/icons-react";

import { type ReferenceableBlockElement, ElementType } from "../types";
import { isReferenceableBlockElement } from "../utils/checks";
import { createNodeId } from "../utils/plugins/withNodeId";
import ChangeBlockOptions from "./ChangeBlockOptions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

type BlockMenuDropdownProps = {
  element: ReferenceableBlockElement;
  className?: string;
};

export default function BlockMenuDropdown(props: BlockMenuDropdownProps) {
  const { element, className = "" } = props;
  const editor = useSlateStatic();

  const onAddBlock = useCallback(() => {
    // Insert new paragraph after the current block
    const path = ReactEditor.findPath(editor, element);
    const location = Editor.after(editor, path, { unit: "line", voids: true });
    Transforms.insertNodes(
      editor,
      {
        id: createNodeId(),
        type: ElementType.Paragraph,
        children: [{ text: "" }],
      },
      { at: location ?? Editor.end(editor, []) }
    );
  }, [editor, element]);

  const onCopyBlockRef = useCallback(() => {
    let blockId;

    // We still need this because there are cases where block ids might not exist
    if (!element.id) {
      // Generate block id if it doesn't exist
      blockId = createNodeId();
      const path = ReactEditor.findPath(editor, element);
      Transforms.setNodes(
        editor,
        { id: blockId },
        {
          at: path,
          match: (n) =>
            Element.isElement(n) &&
            isReferenceableBlockElement(n) &&
            n.type === element.type,
        }
      );
    } else {
      // Use the existing block id
      blockId = element.id;
    }

    navigator.clipboard.writeText(`((${blockId}))`);
  }, [editor, element]);

  const onDuplicate = useCallback(() => {
    const path = ReactEditor.findPath(editor, element);
    const newNode = {
      ...element,
      id: createNodeId(),
    };
    Transforms.insertNodes(editor, newNode, { at: [path[0] + 1] });
  }, [editor, element]);

  const onDelete = useCallback(() => {
    const path = ReactEditor.findPath(editor, element);
    Transforms.removeNodes(editor, { at: path });
  }, [editor, element]);

  const buttonClassName = useMemo(() => {
    const baseClassName = `absolute top-0.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${className}`;
    if (element.type === ElementType.ListItem) {
      return `${baseClassName} -left-16`;
    } else {
      return `${baseClassName} -left-10`;
    }
  }, [element.type, className]);

  return (
    <div className={buttonClassName}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex h-6 w-6 items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors">
            <IconDotsVertical className="text-gray-400" size={16} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuItem onClick={onAddBlock}>
            <IconPlus size={18} className="mr-2" />
            <span>Add block below</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onDuplicate}>
            <IconCopy size={18} className="mr-2" />
            <span>Duplicate</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onCopyBlockRef}>
            <IconLink size={18} className="mr-2" />
            <span>Copy block reference</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={onDelete}
            className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
          >
            <IconTrash size={18} className="mr-2" />
            <span>Delete</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <ChangeBlockOptions element={element} className="px-2" />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
