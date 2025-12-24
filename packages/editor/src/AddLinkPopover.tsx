import { IconLink, IconUnlink } from "@tabler/icons-react";
import type { AddLinkPopoverState } from "./Editor";
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ComponentType,
} from "react";
import { ReactEditor, useSlate } from "slate-react";
import { isUrl } from "./utils/url";
import { Transforms } from "slate";
import { insertExternalLink } from "./utils/formatting";
import { removeLink } from "./utils/formatting";
import EditorPopover from "./EditorPopover";

type IconProps = {
  size?: number;
  className?: string;
};

enum OptionType {
  DOCUMENT,
  NEW_DOCUMENT,
  URL,
  REMOVE_LINK,
}

type Option = {
  id: string;
  type: OptionType;
  text: string;
  icon?: ComponentType<IconProps>;
};

type Props = {
  addLinkPopoverState: AddLinkPopoverState;
  setAddLinkPopoverState: (state: AddLinkPopoverState) => void;
};

export default function AddLinkPopover(props: Props) {
  const { addLinkPopoverState, setAddLinkPopoverState } = props;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [linkText, setLinkText] = useState<string>("");
  const editor = useSlate();

  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number>(0);

  const options = useMemo(() => {
    const result: Array<Option> = [];
    if (linkText) {
      // Show url option if `linkText` is a url
      if (isUrl(linkText)) {
        result.push({
          id: "URL",
          type: OptionType.URL,
          text: `Link to web page: ${linkText}`,
          icon: IconLink,
        });
      }
    }
    // Show remove link option if there is no `linkText` and the selected text is part of a link
    else if (addLinkPopoverState.isLink) {
      result.push({
        id: "REMOVE_LINK",
        type: OptionType.REMOVE_LINK,
        text: "Remove link",
        icon: IconUnlink,
      });
    }

    return result;
  }, [addLinkPopoverState.isLink, linkText]);

  const hidePopover = useCallback(() => {
    if (!addLinkPopoverState.selection) {
      return;
    }

    Transforms.select(editor, addLinkPopoverState.selection as any);
    ReactEditor.focus(editor); // Focus the editor
    setAddLinkPopoverState({
      isVisible: false,
      selection: undefined,
      isLink: false,
    });
  }, [editor, addLinkPopoverState, setAddLinkPopoverState]);

  const onOptionClick = useCallback(
    async (option?: Option) => {
      if (!option) {
        return;
      }

      // Restore selection and hide popover
      hidePopover();

      if (option.type === OptionType.URL) {
        // Insert a link to a url
        insertExternalLink(editor, linkText);
        Transforms.move(editor, { distance: 1, unit: "offset" }); // Focus after the note link
      } else if (option.type === OptionType.REMOVE_LINK) {
        // Remove the link
        removeLink(editor);
      } else {
        throw new Error(`Option type ${option.type} is not supported`);
      }
    },
    [editor, hidePopover, linkText]
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      // Update the selected option based on arrow key input
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedOptionIndex((index) => {
          return index <= 0 ? options.length - 1 : index - 1;
        });
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedOptionIndex((index) => {
          return index >= options.length - 1 ? 0 : index + 1;
        });
      } else if (event.key === "Enter") {
        event.preventDefault();
        onOptionClick(options[selectedOptionIndex]);
      }
    },
    [options, onOptionClick, selectedOptionIndex]
  );

  return (
    <EditorPopover
      selection={addLinkPopoverState.selection as any}
      placement="bottom"
      className="flex w-96 flex-col pt-4 pb-2"
      onClose={hidePopover}
    >
      <input
        ref={inputRef}
        type="text"
        className="input mx-4 dark:border-gray-700 dark:bg-gray-700 dark:text-gray-200"
        value={linkText}
        onChange={(e) => setLinkText(e.target.value)}
        placeholder="Search for a note or enter web page link"
        onKeyDown={onKeyDown}
        autoFocus
      />
      <div className="mt-2">
        {options.map((option, index) => (
          <OptionItem
            key={option.id}
            option={option}
            isSelected={index === selectedOptionIndex}
            onClick={() => onOptionClick(option)}
          />
        ))}
      </div>
    </EditorPopover>
  );
}

type OptionProps = {
  option: Option;
  isSelected: boolean;
  onClick: () => void;
};

const OptionItem = (props: OptionProps) => {
  const { option, isSelected, onClick } = props;
  const IconComponent = option.icon;

  return (
    <div
      className={`flex cursor-pointer flex-row items-center px-4 py-1 text-gray-800 hover:bg-gray-100 active:bg-gray-200 dark:text-gray-200 dark:hover:bg-gray-700 dark:active:bg-gray-600 ${
        isSelected ? "bg-gray-100 dark:bg-gray-700" : ""
      }`}
      onPointerDown={(event) => event.preventDefault()}
      onPointerUp={(event) => {
        if (event.button === 0) {
          event.preventDefault();
          onClick();
        }
      }}
    >
      {IconComponent ? (
        <IconComponent size={18} className="mr-1 shrink-0" />
      ) : null}
      <span className="overflow-hidden overflow-ellipsis whitespace-nowrap">
        {option.text}
      </span>
    </div>
  );
};
