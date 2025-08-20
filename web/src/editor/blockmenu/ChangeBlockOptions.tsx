import type { Element } from "slate";
import {
  IconBlockquote,
  IconBraces,
  IconH1,
  IconH2,
  IconH3,
  IconList,
  IconListCheck,
  IconListNumbers,
  IconTypography,
  type TablerIcon,
} from "@tabler/icons-react";
import { ReactEditor, useSlate } from "slate-react";

import { ElementType } from "../types";
import { useMemo } from "react";
import { isElementActive, toggleElement } from "../utils/formatting";
import Tooltip from "../ui/Tooltip";
import { DropdownItem } from "../ui/Dropdown";

type BlockButtonProps = {
  format: ElementType;
  element: Element;
  Icon: TablerIcon;
  tooltip?: string;
  className?: string;
};

type ChangeBlockOptionsProps = {
  element: Element;
  className?: string;
};

export default function ChangeBlockOptions(props: ChangeBlockOptionsProps) {
  const { element, className = "" } = props;

  return (
    <div className={`divide-y ${className}`}>
      <div className="flex items-center justify-center">
        <BlockButton
          format={ElementType.Paragraph}
          element={element}
          Icon={IconTypography}
          tooltip="Paragraph"
        />
        <BlockButton
          format={ElementType.HeadingOne}
          element={element}
          Icon={IconH1}
          tooltip="Heading 1"
        />
        <BlockButton
          format={ElementType.HeadingTwo}
          element={element}
          Icon={IconH2}
          tooltip="Heading 2"
        />
        <BlockButton
          format={ElementType.HeadingThree}
          element={element}
          Icon={IconH3}
          tooltip="Heading 3"
        />
      </div>
      <div className="flex items-center justify-center">
        <BlockButton
          format={ElementType.BulletedList}
          element={element}
          Icon={IconList}
          tooltip="Bulleted List"
        />
        <BlockButton
          format={ElementType.NumberedList}
          element={element}
          Icon={IconListNumbers}
          tooltip="Numbered List"
        />
        <BlockButton
          format={ElementType.CheckListItem}
          element={element}
          Icon={IconListCheck}
          tooltip="Checklist"
        />
      </div>
      <div className="flex items-center justify-center">
        <BlockButton
          format={ElementType.Blockquote}
          element={element}
          Icon={IconBlockquote}
          tooltip="Quote Block"
        />
        <BlockButton
          format={ElementType.CodeBlock}
          element={element}
          Icon={IconBraces}
          tooltip="Code Block"
        />
      </div>
    </div>
  );
}

const BlockButton = ({
  Icon,
  element,
  format,
  className,
  tooltip,
}: BlockButtonProps) => {
  const editor = useSlate();
  const path = useMemo(
    () => ReactEditor.findPath(editor, element),
    [editor, element]
  );
  const isActive = isElementActive(editor, format, path);

  return (
    <Tooltip content={tooltip} placement="top" disabled={!tooltip}>
      <span>
        <DropdownItem
          className={`flex cursor-pointer items-center rounded px-2 py-2 hover:bg-gray-100 active:bg-gray-200 ${className}`}
          onClick={() => toggleElement(editor, format, path)}
        >
          <Icon
            size={18}
            className={isActive ? "text-green-500" : "text-neutral-800"}
          />
        </DropdownItem>
      </span>
    </Tooltip>
  );
};
