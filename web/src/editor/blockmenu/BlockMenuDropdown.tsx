import { useCallback, useMemo } from "react";
import { Editor, Element, Transforms } from "slate";
import { ReactEditor, useSlateStatic } from "slate-react";
import { IconDotsVertical, IconLink, IconPlus } from "@tabler/icons-react";

import { type ReferenceableBlockElement, ElementType } from "../types";
import { isReferenceableBlockElement } from "../utils/checks";
import { createNodeId } from "../utils/plugins/withNodeId";
import ChangeBlockOptions from "./ChangeBlockOptions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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

  const buttonClassName = useMemo(() => {
    const buttonClassName = `select-none hover:bg-gray-200 active:bg-gray-300 rounded absolute top-0.5 ${className}`;
    if (element.type === ElementType.ListItem) {
      return `${buttonClassName} -left-14`;
    } else {
      return `${buttonClassName} -left-8`;
    }
  }, [element.type, className]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={`${buttonClassName}`}>
        <span className="flex h-6 w-6 items-center justify-center">
          <IconDotsVertical className="text-gray-500" size={18} />
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={onAddBlock}>
          <IconPlus size={18} className="mr-1" />
          <span>Add block below</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onCopyBlockRef}>
          <IconLink size={18} className="mr-1" />
          <span>Copy block reference</span>
        </DropdownMenuItem>
        <ChangeBlockOptions
          element={element}
          className="border-t px-8 dark:border-gray-700"
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
