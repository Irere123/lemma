import type { RenderElementProps } from "slate-react";

const DividerElement = (props: RenderElementProps) => {
  const { attributes, children } = props;

  return (
    <div {...attributes} className="my-4">
      <div contentEditable={false} className="flex items-center gap-4">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent dark:via-gray-700" />
      </div>
      {children}
    </div>
  );
};

export default DividerElement;
