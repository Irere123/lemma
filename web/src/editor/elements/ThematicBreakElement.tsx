import type { ReactNode } from "react";
import { type RenderElementProps, useFocused, useSelected } from "slate-react";

type ThematicBreakElementProps = {
  children: ReactNode;
  attributes: RenderElementProps["attributes"];
  className?: string;
};

export default function ThematicBreakElement(props: ThematicBreakElementProps) {
  const { children, attributes, className } = props;
  const selected = useSelected();
  const focused = useFocused();
  return (
    <div className={`py-2 ${className}`} {...attributes}>
      <div
        className={`py-0.25 ${
          selected && focused
            ? "bg-green-100 dark:bg-green-900"
            : "bg-gray-200 dark:bg-green-700"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
