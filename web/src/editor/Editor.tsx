import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
} from "react";
import {
  Editor as SlateEditor,
  Transforms,
  type Descendant,
  type Path,
} from "slate";
import { Editable, Slate } from "slate-react";
import isHotkey from "is-hotkey";

import withBlockSideMenu from "./blockmenu/withBlockSideMenu";
import withVerticalSpacing from "./elements/withVerticalSpacing";
import useHighlightedPath from "./utils/useHighlightedPath";
import EditorLeaf from "./elements/EditorLeaf";
import useIsMounted from "./hooks/useIsMounted";
import HoveringToolbar from "./toolbar/HoveringToolbar";
import activeEditorsStore from "@/stores/active-editors-store";
import EditorElement from "./elements/EditorElement";

import {
  handleEnter,
  handleIndent,
  handleUnindent,
  isElementActive,
  toggleElement,
  toggleMark,
} from "./utils/formatting";
import { ElementType, Mark } from "./types";
import { getDefaultEditorValue } from "./utils/constants";
import { documentStore, useDocumentStore } from "@/stores/document-store";
import AddLinkPopover from "./AddLinkPopover";

type Props = {
  documentId: string;
  onChange: (value: Descendant[]) => void;
  className?: string;
  highlightedPath?: Path;
};

export type AddLinkPopoverState = {
  isVisible: boolean;
  selection?: Range;
  isLink?: boolean;
};

export default function Editor(props: Props) {
  const { documentId, className = "", highlightedPath, onChange } = props;
  const isMounted = useIsMounted();

  const updateStoreDocument = useCallback(
    (value: Descendant[]) =>
      documentStore
        .getState()
        .updateDocument({ id: documentId, content: value }),
    [documentId]
  );

  // Use the document store hook to get reactive updates
  const document = useDocumentStore((state) => state.documents[documentId]);

  const initialValueRef = useRef<Descendant[] | undefined>(undefined);

  // Initialize or update the initial value when document content becomes available
  if (!initialValueRef.current && document?.content) {
    activeEditorsStore.addActiveEditor(documentId);
    initialValueRef.current = document?.content ?? getDefaultEditorValue();
  }

  const initialValue = initialValueRef.current ?? getDefaultEditorValue();

  const editor = useSyncExternalStore(
    activeEditorsStore.subscribe,
    () => activeEditorsStore.getActiveEditor(documentId),
    () => activeEditorsStore.getActiveEditor(documentId)
  );

  // Ensure an editor instance exists for this document
  useEffect(() => {
    if (!activeEditorsStore.getActiveEditor(documentId)) {
      activeEditorsStore.addActiveEditor(documentId);
    }
  }, [documentId]);

  const renderElement = useMemo(() => {
    const ElementWithSideMenu = withBlockSideMenu(
      withVerticalSpacing(EditorElement)
    );
    return ElementWithSideMenu;
  }, []);

  const [addLinkPopoverState, setAddLinkPopoverState] =
    useState<AddLinkPopoverState>({
      isVisible: false,
      selection: undefined,
      isLink: false,
    });

  const [toolbarCanBeVisible, setToolbarCanBeVisible] = useState(true);

  const hotkeys = useMemo(
    () => [
      {
        hotkey: "mod+b",
        callback: () => toggleMark(editor, Mark.Bold),
      },
      {
        hotkey: "mod+i",
        callback: () => toggleMark(editor, Mark.Italic),
      },
      {
        hotkey: "mod+u",
        callback: () => toggleMark(editor, Mark.Underline),
      },
      {
        hotkey: "mod+`",
        callback: () => toggleMark(editor, Mark.Code),
      },
      {
        hotkey: "mod+shift+s",
        callback: () => toggleMark(editor, Mark.Strikethrough),
      },
      {
        hotkey: "mod+shift+h",
        callback: () => toggleMark(editor, Mark.Highlight),
      },
      {
        hotkey: "mod+shift+1",
        callback: () => toggleElement(editor, ElementType.HeadingOne),
      },
      {
        hotkey: "mod+shift+2",
        callback: () => toggleElement(editor, ElementType.HeadingTwo),
      },
      {
        hotkey: "mod+shift+3",
        callback: () => toggleElement(editor, ElementType.HeadingThree),
      },
      {
        hotkey: "mod+shift+4",
        callback: () => toggleElement(editor, ElementType.HeadingFour),
      },
      {
        hotkey: "mod+shift+5",
        callback: () => toggleElement(editor, ElementType.BulletedList),
      },
      {
        hotkey: "mod+shift+6",
        callback: () => toggleElement(editor, ElementType.NumberedList),
      },
      {
        hotkey: "mod+shift+7",
        callback: () => toggleElement(editor, ElementType.CheckListItem),
      },
      {
        hotkey: "mod+shift+8",
        callback: () => toggleElement(editor, ElementType.Blockquote),
      },
      {
        hotkey: "mod+shift+9",
        callback: () => toggleElement(editor, ElementType.CodeBlock),
      },
      {
        hotkey: "mod+shift+0",
        callback: () => toggleElement(editor, ElementType.Paragraph),
      },
      {
        hotkey: "mod+k",
        callback: () => {
          if (editor.selection) {
            // Save the selection and make the add link popover visible
            setAddLinkPopoverState({
              isVisible: true,
              selection: editor.selection as any,
              isLink:
                isElementActive(editor, ElementType.ExternalLink) ||
                isElementActive(editor, ElementType.NoteLink),
            });
          }
        },
      },
      {
        hotkey: "tab",
        callback: () => handleIndent(editor),
      },
      {
        hotkey: "shift+tab",
        callback: () => handleUnindent(editor),
      },
      {
        hotkey: "enter",
        callback: () => handleEnter(editor),
      },
      {
        hotkey: "shift+enter",
        callback: () => Transforms.insertText(editor, "\n"),
      },
      {
        hotkey: "mod+enter",
        callback: () => editor.insertBreak(),
      },
    ],
    [editor, setAddLinkPopoverState]
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      // Handle keyboard shortcuts for adding marks
      for (const { hotkey, callback } of hotkeys) {
        if (isHotkey(hotkey, event.nativeEvent)) {
          event.preventDefault();
          callback();
        }
      }
    },
    [hotkeys]
  );

  const onSlateChange = useCallback(
    (newValue: Descendant[]) => {
      // Guard against invalid selections that reference non-existent paths
      const selection = editor?.selection;
      if (selection) {
        const { anchor, focus } = selection;
        const anchorValid = SlateEditor.hasPath(editor as any, anchor.path);
        const focusValid = SlateEditor.hasPath(editor as any, focus.path);
        if (!anchorValid || !focusValid) {
          Transforms.deselect(editor as any);
        }
      }

      const isAstChange = editor?.operations?.some(
        (op) => op.type !== "set_selection"
      );
      if (isAstChange) {
        updateStoreDocument(newValue);
        onChange(newValue);
      }
    },
    [editor, updateStoreDocument, onChange]
  );

  useHighlightedPath(editor, highlightedPath, false);

  if (!editor) return null;

  return (
    <Slate editor={editor} initialValue={initialValue} onChange={onSlateChange}>
      <HoveringToolbar
        canBeVisible={toolbarCanBeVisible && !addLinkPopoverState.isVisible}
        setAddLinkPopoverState={setAddLinkPopoverState}
      />
      {addLinkPopoverState.isVisible ? (
        <AddLinkPopover
          addLinkPopoverState={addLinkPopoverState}
          setAddLinkPopoverState={setAddLinkPopoverState}
        />
      ) : null}
      <Editable
        className={`overflow-hidden placeholder-gray-400 focus:outline-none ${className}`}
        data-testid="editor"
        renderElement={renderElement}
        renderLeaf={EditorLeaf}
        placeholder="Start writing..."
        onKeyDown={onKeyDown}
        onPointerDown={() => setToolbarCanBeVisible(false)}
        onPointerUp={() =>
          setTimeout(() => {
            if (isMounted()) setToolbarCanBeVisible(true);
          }, 100)
        }
        spellCheck
      />
    </Slate>
  );
}
