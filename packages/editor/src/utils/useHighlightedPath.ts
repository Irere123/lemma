import { useEffect } from "react";
import { Editor, Path } from "slate";
import { ReactEditor } from "slate-react";

// Tailwind yellow color values
const HIGHLIGHT_COLORS = {
  light: "#fef08a", // yellow-200
  dark: "#854d0e", // yellow-800
};

export default function useHighlightedPath(
  editor: Editor,
  highlightedPath: Path | undefined,
  darkMode: boolean
) {
  // If highlightedPath is defined, highlight the path
  useEffect(() => {
    if (!highlightedPath) {
      return;
    }

    try {
      // Scroll to line
      const [node] = Editor.node(editor, highlightedPath);
      const domNode = ReactEditor.toDOMNode(editor, node);
      domNode.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });

      // Highlight line, but restore original color if mouse is clicked or component is re-rendered
      const originalBgColor = domNode.style.backgroundColor;
      const removeHighlight = () => {
        domNode.style.backgroundColor = originalBgColor;
      };

      domNode.style.backgroundColor = darkMode
        ? HIGHLIGHT_COLORS.dark
        : HIGHLIGHT_COLORS.light;
      domNode.addEventListener("click", removeHighlight, { once: true });

      return () => {
        removeHighlight();
        document.removeEventListener("click", removeHighlight);
      };
    } catch {
      // Do nothing if an error occurs, which sometimes happens if the router changes before the editor does
    }
  }, [editor, highlightedPath, darkMode]);
}
