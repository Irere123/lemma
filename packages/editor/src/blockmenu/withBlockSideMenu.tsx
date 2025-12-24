import type { ComponentType } from "react";
import type { EditorElementProps } from "../elements/EditorElement";
import BlockMenuDropdown from "./BlockMenuDropdown";
import { isReferenceableBlockElement } from "../utils/checks";

export default function withBlockSideMenu(
  EditorElement: ComponentType<EditorElementProps>
) {
  const ElementWithSideMenu = (props: EditorElementProps) => {
    const { element } = props;

    if (!isReferenceableBlockElement(element)) {
      return <EditorElement {...props} />;
    }

    return (
      <div className="group relative w-full before:absolute before:top-0 before:bottom-0 before:right-full before:w-full">
        <EditorElement {...props} />
        <BlockMenuDropdown
          element={element}
          className="opacity-0 group-hover:opacity-100"
        />
      </div>
    );
  };

  return ElementWithSideMenu;
}
