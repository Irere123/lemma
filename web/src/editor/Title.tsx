import { useDocumentStore } from "@/stores/document-store";
import { useEffect, useRef } from "react";

type Props = {
  documentId: string;
  onChange: (value: string) => void;
  onChangeSubtitle: (value: string) => void;

  className?: string;
};

export default function Title(props: Props) {
  const { documentId, onChange, onChangeSubtitle, className = "" } = props;
  const titleRef = useRef<HTMLDivElement | null>(null);
  const subtitleRef = useRef<HTMLDivElement | null>(null);
  const document = useDocumentStore((state) => state.documents[documentId]);

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
    // Update title only if it's different from the document value
    if (titleRef.current && document) {
      const titleValue = document.title ?? "";
      if (titleRef.current.textContent !== titleValue) {
        titleRef.current.textContent = titleValue;
      }
    }

    // Update subtitle only if it's different from the document value
    if (subtitleRef.current && document) {
      const subtitleValue = document.subtitle ?? "";
      if (subtitleRef.current.textContent !== subtitleValue) {
        subtitleRef.current.textContent = subtitleValue;
      }
    }
  }, [document?.title, document?.subtitle, document]);

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
