import { documentStore, useDocumentStore } from "@/stores/document-store";
import { useEffect, useRef } from "react";

type Props = {
  documentId: string;
  onChange: (value: string) => void;
  className?: string;
};

export default function Title(props: Props) {
  const { documentId, onChange, className = "" } = props;
  const titleRef = useRef<HTMLDivElement | null>(null);
  const document = useDocumentStore((state) => state.documents[documentId]);

  const emitChange = () => {
    if (!titleRef.current) {
      return;
    }
    const title = titleRef.current.textContent ?? "";
    onChange(title);
  };

  // Set the initial title and update when document changes
  useEffect(() => {
    if (!titleRef.current) {
      return;
    }
    const initialValue = document?.title ?? "";

    // Only set if the title is empty or different from current content
    if (!titleRef.current.textContent || titleRef.current.textContent !== initialValue) {
      titleRef.current.textContent = initialValue;
    }
  }, [document?.title]);

  return (
    <>
      <div
        ref={titleRef}
        className={`title cursor-text border-none p-0 text-3xl font-semibold leading-tight focus:outline-none md:text-4xl ${className}`}
        data-testid="note-title"
        role="textbox"
        placeholder="Untitled"
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
          document.execCommand("insertText", false, text);
        }}
        onInput={emitChange}
        spellCheck
        contentEditable
      />
      <style>{`
        .title[placeholder]:empty:before {
          content: attr(placeholder);
          color: #d1d5db;
        }
      `}</style>
    </>
  );
}
