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
      <div className="">
        <EditorElement {...props} />
        <BlockMenuDropdown
          element={element}
          /**
           * We're using opacity 0.001 here to support iOS Safari.
           * If we use anything else to hide this element, it would
           * require two taps to edit text (the first tap would display this element).
           */
          className="opacity-0.1 group-hover:opacity-100"
        />
      </div>
    );
  };

  return ElementWithSideMenu;
}
