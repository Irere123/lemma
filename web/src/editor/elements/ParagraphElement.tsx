import type { EditorElementProps } from "./EditorElement";

export default function ParagraphElement(props: EditorElementProps) {
  const { className, attributes, children } = props;
  return (
    <div
      className={`${className} my-1 leading-relaxed`}
      data-testid="paragraph"
      {...attributes}
    >
      {children}
    </div>
  );
}
