import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { EditorState, Transaction } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import type { Node as ProseMirrorNode } from "prosemirror-model";
import { schema, getDefaultDoc } from "../schema";
import { createEditorPlugins, type EditorPluginOptions } from "../plugins";

export interface UseEditorOptions extends EditorPluginOptions {
  /** Initial document content */
  content?: ProseMirrorNode;
  /** Called when document changes */
  onUpdate?: (doc: ProseMirrorNode) => void;
  /** Called on every transaction */
  onTransaction?: (transaction: Transaction) => void;
  /** Whether the editor is editable */
  editable?: boolean;
  /** Auto focus on mount */
  autoFocus?: boolean;
}

export interface UseEditorReturn {
  /** Editor view instance */
  view: EditorView | null;
  /** Current editor state */
  state: EditorState | null;
  /** Set the editor container element */
  setContainer: (element: HTMLElement | null) => void;
  /** Update editor content */
  setContent: (content: ProseMirrorNode) => void;
  /** Check if editor is focused */
  isFocused: boolean;
  /** Focus the editor */
  focus: () => void;
  /** Blur the editor */
  blur: () => void;
  /** Check if editor is empty */
  isEmpty: boolean;
  /** Get current document */
  getDocument: () => ProseMirrorNode | null;
}

/**
 * Hook to create and manage a ProseMirror editor instance
 */
export function useEditor(options: UseEditorOptions = {}): UseEditorReturn {
  const {
    content,
    onUpdate,
    onTransaction,
    editable = true,
    autoFocus = false,
    placeholder,
  } = options;

  const [view, setView] = useState<EditorView | null>(null);
  const [state, setState] = useState<EditorState | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef<HTMLElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);

  // Callbacks refs to avoid stale closures
  const onUpdateRef = useRef(onUpdate);
  const onTransactionRef = useRef(onTransaction);
  onUpdateRef.current = onUpdate;
  onTransactionRef.current = onTransaction;

  // Create initial state
  const initialState = useMemo(() => {
    const plugins = createEditorPlugins({ placeholder, schema });
    const doc = content || getDefaultDoc();

    return EditorState.create({
      doc,
      plugins,
    });
  }, [content, placeholder]);

  // Set container callback
  const setContainer = useCallback((element: HTMLElement | null) => {
    if (element === containerRef.current) return;

    // Cleanup existing view
    if (viewRef.current) {
      viewRef.current.destroy();
      viewRef.current = null;
      setView(null);
    }

    containerRef.current = element;

    // Create new view if element exists
    if (element) {
      const editorView = new EditorView(element, {
        state: initialState,
        editable: () => editable,

        dispatchTransaction(transaction) {
          const newState = editorView.state.apply(transaction);
          editorView.updateState(newState);
          setState(newState);

          // Call transaction callback
          onTransactionRef.current?.(transaction);

          // Call update callback if document changed
          if (transaction.docChanged) {
            onUpdateRef.current?.(newState.doc);
          }
        },

        handleDOMEvents: {
          focus: () => {
            setIsFocused(true);
            return false;
          },
          blur: () => {
            setIsFocused(false);
            return false;
          },
        },
      });

      viewRef.current = editorView;
      setView(editorView);
      setState(editorView.state);

      // Auto focus if enabled
      if (autoFocus) {
        editorView.focus();
      }
    }
  }, [initialState, editable, autoFocus]);

  // Update editable state
  useEffect(() => {
    if (viewRef.current) {
      viewRef.current.setProps({ editable: () => editable });
    }
  }, [editable]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
    };
  }, []);

  // Set content
  const setContent = useCallback((newContent: ProseMirrorNode) => {
    if (viewRef.current) {
      const tr = viewRef.current.state.tr;
      tr.replaceWith(0, viewRef.current.state.doc.content.size, newContent.content);
      viewRef.current.dispatch(tr);
    }
  }, []);

  // Focus the editor
  const focus = useCallback(() => {
    viewRef.current?.focus();
  }, []);

  // Blur the editor
  const blur = useCallback(() => {
    (viewRef.current?.dom as HTMLElement)?.blur();
  }, []);

  // Check if editor is empty
  const isEmpty = useMemo((): boolean => {
    if (!state) return true;
    const doc = state.doc;
    const firstChild = doc.firstChild;
    return (
      doc.childCount === 1 &&
      firstChild !== null &&
      firstChild.isTextblock &&
      firstChild.content.size === 0
    );
  }, [state]);

  // Get current document
  const getDocument = useCallback(() => {
    return viewRef.current?.state.doc || null;
  }, []);

  return {
    view,
    state,
    setContainer,
    setContent,
    isFocused,
    focus,
    blur,
    isEmpty,
    getDocument,
  };
}
