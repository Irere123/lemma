import {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type KeyboardEvent,
} from "react";
import { Editor, Range, Transforms } from "slate";
import { ReactEditor, useSlate } from "slate-react";
import {
  IconH1,
  IconH2,
  IconH3,
  IconList,
  IconListNumbers,
  IconListCheck,
  IconQuote,
  IconCode,
  IconMinus,
  IconTypography,
  IconBulb,
  IconChevronRight,
} from "@tabler/icons-react";
import { ElementType } from "../types";
import { toggleElement } from "../utils/formatting";
import { createNodeId } from "../utils/plugins/withNodeId";
import Portal from "../Portal";

type SlashMenuItem = {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  keywords: string[];
  action: (editor: Editor) => void;
};

const createSlashMenuItems = (): SlashMenuItem[] => [
  {
    id: "paragraph",
    label: "Text",
    description: "Just start writing with plain text",
    icon: IconTypography,
    keywords: ["paragraph", "text", "plain"],
    action: (editor) => toggleElement(editor, ElementType.Paragraph),
  },
  {
    id: "heading1",
    label: "Heading 1",
    description: "Big section heading",
    icon: IconH1,
    keywords: ["heading", "h1", "title", "big"],
    action: (editor) => toggleElement(editor, ElementType.HeadingOne),
  },
  {
    id: "heading2",
    label: "Heading 2",
    description: "Medium section heading",
    icon: IconH2,
    keywords: ["heading", "h2", "subtitle", "medium"],
    action: (editor) => toggleElement(editor, ElementType.HeadingTwo),
  },
  {
    id: "heading3",
    label: "Heading 3",
    description: "Small section heading",
    icon: IconH3,
    keywords: ["heading", "h3", "small"],
    action: (editor) => toggleElement(editor, ElementType.HeadingThree),
  },
  {
    id: "bulleted-list",
    label: "Bulleted List",
    description: "Create a simple bulleted list",
    icon: IconList,
    keywords: ["bullet", "list", "unordered", "ul"],
    action: (editor) => toggleElement(editor, ElementType.BulletedList),
  },
  {
    id: "numbered-list",
    label: "Numbered List",
    description: "Create a list with numbering",
    icon: IconListNumbers,
    keywords: ["number", "list", "ordered", "ol"],
    action: (editor) => toggleElement(editor, ElementType.NumberedList),
  },
  {
    id: "todo-list",
    label: "To-do List",
    description: "Track tasks with a to-do list",
    icon: IconListCheck,
    keywords: ["todo", "task", "checklist", "checkbox"],
    action: (editor) => toggleElement(editor, ElementType.CheckListItem),
  },
  {
    id: "quote",
    label: "Quote",
    description: "Capture a quote",
    icon: IconQuote,
    keywords: ["quote", "blockquote", "citation"],
    action: (editor) => toggleElement(editor, ElementType.Blockquote),
  },
  {
    id: "code",
    label: "Code",
    description: "Capture a code snippet",
    icon: IconCode,
    keywords: ["code", "codeblock", "snippet", "programming"],
    action: (editor) => toggleElement(editor, ElementType.CodeBlock),
  },
  {
    id: "divider",
    label: "Divider",
    description: "Visually divide blocks",
    icon: IconMinus,
    keywords: ["divider", "separator", "hr", "line"],
    action: (editor) => {
      Transforms.insertNodes(editor, {
        id: createNodeId(),
        type: ElementType.Divider,
        children: [{ text: "" }],
      });
    },
  },
  {
    id: "callout",
    label: "Callout",
    description: "Make writing stand out",
    icon: IconBulb,
    keywords: ["callout", "info", "note", "highlight"],
    action: (editor) => {
      Transforms.insertNodes(editor, {
        id: createNodeId(),
        type: ElementType.Callout,
        variant: "info",
        children: [{ text: "" }],
      });
    },
  },
  {
    id: "toggle",
    label: "Toggle",
    description: "Toggles can hide and show content",
    icon: IconChevronRight,
    keywords: ["toggle", "collapse", "expand", "accordion"],
    action: (editor) => {
      Transforms.insertNodes(editor, {
        id: createNodeId(),
        type: ElementType.Toggle,
        open: false,
        children: [{ text: "" }],
      });
    },
  },
];

type SlashMenuProps = {
  onClose: () => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
};

export default function SlashMenu(props: SlashMenuProps) {
  const { onClose, searchTerm } = props;
  const editor = useSlate();
  const menuRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const allItems = useMemo(() => createSlashMenuItems(), []);

  const filteredItems = useMemo(() => {
    if (!searchTerm) return allItems;
    const term = searchTerm.toLowerCase();
    return allItems.filter(
      (item) =>
        item.label.toLowerCase().includes(term) ||
        item.keywords.some((k) => k.includes(term))
    );
  }, [searchTerm, allItems]);

  // Reset selection when items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredItems.length]);

  const executeAction = useCallback(
    (item: SlashMenuItem) => {
      // Delete the slash and search term
      const { selection } = editor;
      if (selection) {
        const slashLength = 1 + searchTerm.length;
        Transforms.delete(editor, {
          at: selection,
          distance: slashLength,
          unit: "character",
          reverse: true,
        });
      }
      item.action(editor);
      onClose();
    },
    [editor, onClose, searchTerm]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((i) => (i + 1) % filteredItems.length);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((i) =>
          i === 0 ? filteredItems.length - 1 : i - 1
        );
      } else if (event.key === "Enter") {
        event.preventDefault();
        if (filteredItems[selectedIndex]) {
          executeAction(filteredItems[selectedIndex]);
        }
      } else if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    },
    [filteredItems, selectedIndex, executeAction, onClose]
  );

  // Get position from selection
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    const { selection } = editor;
    if (!selection || !Range.isCollapsed(selection)) {
      setPosition(null);
      return;
    }

    try {
      const domRange = ReactEditor.toDOMRange(editor, selection);
      const rect = domRange.getBoundingClientRect();
      setPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
      });
    } catch {
      setPosition(null);
    }
  }, [editor]);

  if (!position || filteredItems.length === 0) {
    return null;
  }

  return (
    <Portal>
      <div
        ref={menuRef}
        className="fixed z-50 w-72 max-h-80 overflow-y-auto bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700"
        style={{ top: position.top, left: position.left }}
        onKeyDown={handleKeyDown}
      >
        <div className="p-2">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 px-2 py-1 uppercase">
            Basic blocks
          </div>
          {filteredItems.map((item, index) => {
            const isSelected = index === selectedIndex;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className={`w-full flex items-center gap-3 px-2 py-2 rounded-md text-left transition-colors ${
                  isSelected
                    ? "bg-gray-100 dark:bg-gray-700"
                    : "hover:bg-gray-50 dark:hover:bg-gray-750"
                }`}
                onClick={() => executeAction(item)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-md">
                  <Icon size={20} className="text-gray-600 dark:text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 dark:text-gray-100">
                    {item.label}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {item.description}
                  </div>
                </div>
              </button>
            );
          })}
          {filteredItems.length === 0 && (
            <div className="px-2 py-4 text-center text-gray-500 dark:text-gray-400">
              No results found
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
}
