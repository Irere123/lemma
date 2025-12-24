import { useState, useCallback, useEffect } from "react";
import { Editor, Range } from "slate";

export type SlashMenuState = {
  isOpen: boolean;
  searchTerm: string;
};

export function useSlashMenu(editor: Editor) {
  const [state, setState] = useState<SlashMenuState>({
    isOpen: false,
    searchTerm: "",
  });

  const openMenu = useCallback(() => {
    setState({ isOpen: true, searchTerm: "" });
  }, []);

  const closeMenu = useCallback(() => {
    setState({ isOpen: false, searchTerm: "" });
  }, []);

  const updateSearchTerm = useCallback((term: string) => {
    setState((prev) => ({ ...prev, searchTerm: term }));
  }, []);

  // Detect "/" character and open menu
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Close menu on Escape
      if (event.key === "Escape" && state.isOpen) {
        closeMenu();
        return;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [state.isOpen, closeMenu]);

  // Check for slash command trigger in editor
  const checkForSlashTrigger = useCallback(() => {
    const { selection } = editor;
    if (!selection || !Range.isCollapsed(selection)) {
      if (state.isOpen) closeMenu();
      return;
    }

    try {
      const [start] = Range.edges(selection);
      const lineStart = Editor.before(editor, start, { unit: "line" });
      if (!lineStart) {
        if (state.isOpen) closeMenu();
        return;
      }

      const range = { anchor: lineStart, focus: start };
      const text = Editor.string(editor, range);

      // Check if text starts with "/" (slash command)
      const slashMatch = text.match(/\/(\w*)$/);
      if (slashMatch) {
        if (!state.isOpen) {
          openMenu();
        }
        updateSearchTerm(slashMatch[1] || "");
      } else if (state.isOpen) {
        closeMenu();
      }
    } catch {
      if (state.isOpen) closeMenu();
    }
  }, [editor, state.isOpen, openMenu, closeMenu, updateSearchTerm]);

  return {
    state,
    openMenu,
    closeMenu,
    updateSearchTerm,
    checkForSlashTrigger,
  };
}
