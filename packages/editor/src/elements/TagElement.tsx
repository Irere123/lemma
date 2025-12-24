import { type MouseEvent, type ReactNode, useCallback } from "react";
import { type RenderElementProps, useFocused, useSelected } from "slate-react";
import type { Tag } from "../types";
import { classnames } from "../utils/classnames";
import { useCallbacks } from "../context";

type Props = {
  element: Tag;
  children: ReactNode;
  attributes: RenderElementProps["attributes"];
  className?: string;
};

export default function TagElement(props: Props) {
  const { className, element, children, attributes } = props;
  const callbacks = useCallbacks();

  const selected = useSelected();
  const focused = useFocused();
  const tagClassName = classnames(
    "inline-flex items-center px-1.5 py-0.5 rounded cursor-pointer select-none text-sm font-medium",
    "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800",
    "transition-colors",
    { "ring-2 ring-blue-500": selected && focused },
    className
  );

  const onClick = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      callbacks?.onTagClick?.(element.name);
    },
    [element.name, callbacks]
  );

  return (
    <span
      role="button"
      className={tagClassName}
      onClick={onClick}
      contentEditable={false}
      {...attributes}
    >
      #{element.name}
      {children}
    </span>
  );
}
