import type { RenderElementProps } from "slate-react";

import ParagraphElement from "./ParagraphElement";
import ThematicBreakElement from "./ThematicBreakElement";
import ExternalLinkElement from "./ExternalLinkElement";
import CheckListItemElement from "./CheckListItemElement";
import TagElement from "./TagElement";
import { ElementType } from "../types";

export type EditorElementProps = {
  className?: string;
  attributes: { contentEditable?: boolean };
} & RenderElementProps;

export default function EditorElement(props: EditorElementProps) {
  const { className = "", attributes, children, element } = props;

  switch (element.type) {
    case ElementType.HeadingOne:
      return (
        <h1 className={`text-2xl font-semibold ${className}`} {...attributes}>
          {children}
        </h1>
      );
    case ElementType.HeadingTwo:
      return (
        <h2 className={`text-xl font-semibold ${className}`} {...attributes}>
          {children}
        </h2>
      );
    case ElementType.HeadingThree:
      return (
        <h3 className={`text-lg font-semibold ${className}`} {...attributes}>
          {children}
        </h3>
      );
    case ElementType.ListItem:
      return (
        <li className={className} {...attributes}>
          {children}
        </li>
      );
    case ElementType.BulletedList:
      return (
        <ul className={`ml-6 list-disc ${className}`} {...attributes}>
          {children}
        </ul>
      );
    case ElementType.NumberedList:
      return (
        <ol className={`ml-6 list-decimal ${className}`} {...attributes}>
          {children}
        </ol>
      );
    case ElementType.CheckListItem:
      return (
        <CheckListItemElement
          className={className}
          element={element}
          attributes={attributes}
        >
          {children}
        </CheckListItemElement>
      );
    case ElementType.Blockquote:
      return (
        <blockquote className={`border-l-4 pl-4 ${className}`} {...attributes}>
          {children}
        </blockquote>
      );
    case ElementType.CodeBlock:
      return (
        <code
          className={`block rounded border border-gray-200 bg-gray-100 p-2 dark:border-gray-700 dark:bg-gray-800 ${className}`}
          {...attributes}
        >
          {children}
        </code>
      );
    case ElementType.ThematicBreak:
      return (
        <ThematicBreakElement className={className} attributes={attributes}>
          {children}
        </ThematicBreakElement>
      );
    case ElementType.ExternalLink:
      return (
        <ExternalLinkElement
          className={className}
          element={element}
          attributes={attributes}
        >
          {children}
        </ExternalLinkElement>
      );
    case ElementType.Tag:
      return (
        <TagElement
          className={className}
          element={element}
          attributes={attributes}
        >
          {children}
        </TagElement>
      );

    default:
      return (
        <ParagraphElement
          className={className}
          element={element}
          attributes={attributes}
        >
          {children}
        </ParagraphElement>
      );
  }
}
