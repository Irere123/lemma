import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useEditorContext } from "./context";

export type TitleProps = {
  documentId: string;
  initialTitle?: string;
  initialSubtitle?: string;
  onChange: (value: string) => void;
  onChangeSubtitle: (value: string) => void;
  className?: string;
};

export default function Title(props: TitleProps) {
  const {
    documentId,
    initialTitle,
    initialSubtitle,
    onChange,
    onChangeSubtitle,
    className = "",
  } = props;

  const { documentStore } = useEditorContext();
  const titleRef = useRef<HTMLDivElement | null>(null);
  const subtitleRef = useRef<HTMLDivElement | null>(null);

  // Memoize getSnapshot to prevent infinite loops
  const getSnapshot = useCallback(() => {
    return documentStore?.getDocument(documentId);
  }, [documentStore, documentId]);

  // Memoize getServerSnapshot as well
  const getServerSnapshot = useCallback(() => {
    return documentStore?.getDocument(documentId);
  }, [documentStore, documentId]);

  // Subscribe to document store for reactive updates
  const document = useSyncExternalStore(
    documentStore?.subscribe ?? (() => () => {}),
    getSnapshot,
    getServerSnapshot
  );

  const emitTitleChange = () => {
    if (!titleRef.current) {
      return;
    }
    const title = titleRef.current.textContent ?? "";
    onChange(title);
  };

  const emitSubtitleChange = () => {
    if (!subtitleRef.current) {
      return;
    }
    const subtitle = subtitleRef.current.textContent ?? "";
    onChangeSubtitle(subtitle);
  };

  // Set the initial title and subtitle and update when document changes
  useEffect(() => {
    const titleValue = document?.title ?? initialTitle ?? "";
    const subtitleValue = document?.subtitle ?? initialSubtitle ?? "";

    // Update title only if it's different from the document value
    if (titleRef.current && titleRef.current.textContent !== titleValue) {
      titleRef.current.textContent = titleValue;
    }

    // Update subtitle only if it's different from the document value
    if (subtitleRef.current && subtitleRef.current.textContent !== subtitleValue) {
      subtitleRef.current.textContent = subtitleValue;
    }
  }, [document?.title, document?.subtitle, initialTitle, initialSubtitle]);

  return (
    <>
      <div
        ref={titleRef}
        className={`title cursor-text border-none p-0 text-3xl font-semibold leading-tight focus:outline-none md:text-4xl ${className}`}
        data-testid="note-title"
        data-placeholder="Untitled"
        role="textbox"
        onKeyDown={(event) => {
          // Disallow newlines in the title field
          if (event.key === "Enter") {
            event.preventDefault();
          }
        }}
        onPaste={(event) => {
          // Remove styling and newlines from the text
          event.preventDefault();
          let text = event.clipboardData.getData("text/plain");
          text = text.replace(/\r?\n|\r/g, " ");
          if (titleRef.current) {
            titleRef.current.textContent = text;
            emitTitleChange();
          }
        }}
        onInput={emitTitleChange}
        spellCheck
        contentEditable
      />
      <div
        ref={subtitleRef}
        data-placeholder="Add a subtitle"
        contentEditable
        className={`subtitle cursor-text border-none p-0 text-lg font-semibold leading-tight focus:outline-none ${className}`}
        onKeyDown={(event) => {
          // Disallow newlines in the subtitle field
          if (event.key === "Enter") {
            event.preventDefault();
          }
        }}
        onPaste={(event) => {
          // Remove styling and newlines from the text
          event.preventDefault();
          let text = event.clipboardData.getData("text/plain");
          text = text.replace(/\r?\n|\r/g, " ");
          if (subtitleRef.current) {
            subtitleRef.current.textContent = text;
            emitSubtitleChange();
          }
        }}
        onInput={emitSubtitleChange}
        spellCheck
      />
      <style>{`
        .title[data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: #d1d5db;
        }
        .subtitle[data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: #d1d5db;
        }
      `}</style>
    </>
  );
}
