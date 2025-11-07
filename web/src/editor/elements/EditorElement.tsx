import type { RenderElementProps } from "slate-react";

import ParagraphElement from "./ParagraphElement";
import ThematicBreakElement from "./ThematicBreakElement";
import ExternalLinkElement from "./ExternalLinkElement";
import CheckListItemElement from "./CheckListItemElement";
import TagElement from "./TagElement";
import CalloutElement from "./CalloutElement";
import ToggleElement from "./ToggleElement";
import DividerElement from "./DividerElement";
import ImageElement from "./ImageElement";
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
        <h1
          className={`text-3xl font-bold mt-6 mb-2 ${className}`}
          {...attributes}
        >
          {children}
        </h1>
      );
    case ElementType.HeadingTwo:
      return (
        <h2
          className={`text-2xl font-bold mt-5 mb-2 ${className}`}
          {...attributes}
        >
          {children}
        </h2>
      );
    case ElementType.HeadingThree:
      return (
        <h3
          className={`text-xl font-semibold mt-4 mb-1 ${className}`}
          {...attributes}
        >
          {children}
        </h3>
      );
    case ElementType.HeadingFour:
      return (
        <h4
          className={`text-lg font-semibold mt-3 mb-1 ${className}`}
          {...attributes}
        >
          {children}
        </h4>
      );
    case ElementType.ListItem:
      return (
        <li className={`${className} py-0.5`} {...attributes}>
          {children}
        </li>
      );
    case ElementType.BulletedList:
      return (
        <ul
          className={`ml-6 list-disc space-y-1 my-2 ${className}`}
          {...attributes}
        >
          {children}
        </ul>
      );
    case ElementType.NumberedList:
      return (
        <ol
          className={`ml-6 list-decimal space-y-1 my-2 ${className}`}
          {...attributes}
        >
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
        <blockquote
          className={`border-l-4 border-gray-300 dark:border-gray-600 pl-4 my-3 italic text-gray-700 dark:text-gray-300 ${className}`}
          {...attributes}
        >
          {children}
        </blockquote>
      );
    case ElementType.CodeBlock:
      return (
        <code
          className={`block rounded-md border border-gray-200 bg-gray-50 dark:bg-gray-900 dark:border-gray-700 p-4 my-3 font-mono text-sm ${className}`}
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
    case ElementType.Callout:
      return (
        <CalloutElement element={element} attributes={attributes}>
          {children}
        </CalloutElement>
      );
    case ElementType.Toggle:
      return (
        <ToggleElement element={element} attributes={attributes}>
          {children}
        </ToggleElement>
      );
    case ElementType.Divider:
      return (
        <DividerElement element={element} attributes={attributes}>
          {children}
        </DividerElement>
      );
    case ElementType.Image:
      return (
        <ImageElement element={element} attributes={attributes}>
          {children}
        </ImageElement>
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
