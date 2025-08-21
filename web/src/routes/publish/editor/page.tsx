import { Editor } from "@/editor";
import { useCallback, useState } from "react";
import type { Route } from "../+types/layout";
import Title from "@/editor/Title";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Editor" }];
}

export default function EditorPage() {
  const onTitleChange = useCallback((title: string) => {
    console.log(title);
    setSyncState((syncState) => ({ ...syncState, isTitleSynced: false }));
  }, []);

  const [syncState, setSyncState] = useState({
    isTitleSynced: true,
    isContentSynced: true,
  });

  const onEditorValueChange = useCallback(() => {
    setSyncState((syncState) => ({ ...syncState, isContentSynced: false }));
  }, []);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
      <div className="mx-auto flex w-full flex-1 flex-col md:w-128 lg:w-160 xl:w-192">
        <Title
          className="px-8 pt-8 pb-1 md:px-12 md:pt-12"
          onChange={onTitleChange}
        />
        <Editor
          className="px-8 pt-2 pb-8 md:px-12 md:pb-12"
          onChange={onEditorValueChange}
          highlightedPath={undefined}
        />
      </div>
    </div>
  );
}
