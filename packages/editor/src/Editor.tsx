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
import EditorElement from "./elements/EditorElement";
import { useEditorContext } from "./context";
import { SlashMenu, useSlashMenu } from "./slashmenu";

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
import AddLinkPopover from "./AddLinkPopover";

export type EditorProps = {
  documentId: string;
  initialValue?: Descendant[];
  onChange: (value: Descendant[]) => void;
  className?: string;
  highlightedPath?: Path;
};

export type AddLinkPopoverState = {
  isVisible: boolean;
  selection?: Range;
  isLink?: boolean;
};

export default function Editor(props: EditorProps) {
  const {
    documentId,
    initialValue: propInitialValue,
    className = "",
    highlightedPath,
    onChange,
  } = props;

  const isMounted = useIsMounted();
  const { editorStore, documentStore, createEditor } = useEditorContext();

  // Subscribe to document store for reactive updates
  const document = useSyncExternalStore(
    documentStore?.subscribe ?? (() => () => {}),
    () => documentStore?.getDocument(documentId),
    () => documentStore?.getDocument(documentId)
  );

  const updateStoreDocument = useCallback(
    (value: Descendant[]) => {
      documentStore?.updateDocument({ id: documentId, content: value });
    },
    [documentId, documentStore]
  );

  const initialValueRef = useRef<Descendant[] | undefined>(undefined);

  // Initialize or update the initial value when document content becomes available
  if (!initialValueRef.current) {
    if (propInitialValue) {
      initialValueRef.current = propInitialValue;
    } else if (document?.content) {
      initialValueRef.current = document.content;
    }

    if (initialValueRef.current && editorStore) {
      editorStore.addActiveEditor(documentId);
    }
  }

  const initialValue = initialValueRef.current ?? getDefaultEditorValue();

  // Get or create editor instance
  const editor = useSyncExternalStore(
    editorStore?.subscribe ?? (() => () => {}),
    () => editorStore?.getActiveEditor(documentId),
    () => editorStore?.getActiveEditor(documentId)
  );

  // Create a local editor if no store provided
  const localEditorRef = useRef<SlateEditor | null>(null);
  const activeEditor = useMemo(() => {
    if (editor) return editor;
    if (!localEditorRef.current) {
      localEditorRef.current = createEditor();
    }
    return localEditorRef.current;
  }, [editor, createEditor]);

  // Ensure an editor instance exists for this document
  useEffect(() => {
    if (editorStore && !editorStore.getActiveEditor(documentId)) {
      editorStore.addActiveEditor(documentId);
    }
  }, [documentId, editorStore]);

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

  // Slash menu state
  const slashMenu = useSlashMenu(activeEditor);

  const hotkeys = useMemo(
    () => [
      {
        hotkey: "mod+b",
        callback: () => toggleMark(activeEditor, Mark.Bold),
      },
      {
        hotkey: "mod+i",
        callback: () => toggleMark(activeEditor, Mark.Italic),
      },
      {
        hotkey: "mod+u",
        callback: () => toggleMark(activeEditor, Mark.Underline),
      },
      {
        hotkey: "mod+`",
        callback: () => toggleMark(activeEditor, Mark.Code),
      },
      {
        hotkey: "mod+shift+s",
        callback: () => toggleMark(activeEditor, Mark.Strikethrough),
      },
      {
        hotkey: "mod+shift+h",
        callback: () => toggleMark(activeEditor, Mark.Highlight),
      },
      {
        hotkey: "mod+shift+1",
        callback: () => toggleElement(activeEditor, ElementType.HeadingOne),
      },
      {
        hotkey: "mod+shift+2",
        callback: () => toggleElement(activeEditor, ElementType.HeadingTwo),
      },
      {
        hotkey: "mod+shift+3",
        callback: () => toggleElement(activeEditor, ElementType.HeadingThree),
      },
      {
        hotkey: "mod+shift+4",
        callback: () => toggleElement(activeEditor, ElementType.HeadingFour),
      },
      {
        hotkey: "mod+shift+5",
        callback: () => toggleElement(activeEditor, ElementType.BulletedList),
      },
      {
        hotkey: "mod+shift+6",
        callback: () => toggleElement(activeEditor, ElementType.NumberedList),
      },
      {
        hotkey: "mod+shift+7",
        callback: () => toggleElement(activeEditor, ElementType.CheckListItem),
      },
      {
        hotkey: "mod+shift+8",
        callback: () => toggleElement(activeEditor, ElementType.Blockquote),
      },
      {
        hotkey: "mod+shift+9",
        callback: () => toggleElement(activeEditor, ElementType.CodeBlock),
      },
      {
        hotkey: "mod+shift+0",
        callback: () => toggleElement(activeEditor, ElementType.Paragraph),
      },
      {
        hotkey: "mod+k",
        callback: () => {
          if (activeEditor.selection) {
            // Save the selection and make the add link popover visible
            setAddLinkPopoverState({
              isVisible: true,
              selection: activeEditor.selection as any,
              isLink:
                isElementActive(activeEditor, ElementType.ExternalLink) ||
                isElementActive(activeEditor, ElementType.NoteLink),
            });
          }
        },
      },
      {
        hotkey: "tab",
        callback: () => handleIndent(activeEditor),
      },
      {
        hotkey: "shift+tab",
        callback: () => handleUnindent(activeEditor),
      },
      {
        hotkey: "enter",
        callback: () => handleEnter(activeEditor),
      },
      {
        hotkey: "shift+enter",
        callback: () => Transforms.insertText(activeEditor, "\n"),
      },
      {
        hotkey: "mod+enter",
        callback: () => activeEditor.insertBreak(),
      },
    ],
    [activeEditor, setAddLinkPopoverState]
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
      const selection = activeEditor?.selection;
      if (selection) {
        const { anchor, focus } = selection;
        const anchorValid = SlateEditor.hasPath(activeEditor as any, anchor.path);
        const focusValid = SlateEditor.hasPath(activeEditor as any, focus.path);
        if (!anchorValid || !focusValid) {
          Transforms.deselect(activeEditor as any);
        }
      }

      const isAstChange = activeEditor?.operations?.some(
        (op) => op.type !== "set_selection"
      );
      if (isAstChange) {
        updateStoreDocument(newValue);
        onChange(newValue);
      }

      // Check for slash command trigger
      slashMenu.checkForSlashTrigger();
    },
    [activeEditor, updateStoreDocument, onChange, slashMenu]
  );

  useHighlightedPath(activeEditor, highlightedPath, false);

  if (!activeEditor) return null;

  return (
    <Slate editor={activeEditor} initialValue={initialValue} onChange={onSlateChange}>
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
      {slashMenu.state.isOpen && (
        <SlashMenu
          onClose={slashMenu.closeMenu}
          searchTerm={slashMenu.state.searchTerm}
          onSearchChange={slashMenu.updateSearchTerm}
        />
      )}
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
