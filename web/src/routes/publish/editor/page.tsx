import { Editor } from "@/editor";
import { useCallback, useEffect, useMemo, useState } from "react";
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

  const isSynced = useMemo(
    () => syncState.isTitleSynced && syncState.isContentSynced,
    [syncState]
  );

  const onEditorValueChange = useCallback(() => {
    setSyncState((syncState) => ({ ...syncState, isContentSynced: false }));
  }, []);

  // Prompt the user with a dialog box about unsaved changes if they navigate away
  useEffect(() => {
    const warningText =
      "You have unsaved changes — are you sure you wish to leave this page?";

    const handleWindowClose = (e: BeforeUnloadEvent) => {
      if (isSynced) return;
      e.preventDefault();
      return (e.returnValue = warningText);
    };
    const handleBrowseAway = () => {
      if (isSynced) return;
      if (window.confirm(warningText)) return;
      throw "routeChange aborted";
    };

    window.addEventListener("beforeunload", handleWindowClose);

    return () => {
      window.removeEventListener("beforeunload", handleWindowClose);
    };
  }, [isSynced]);

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
