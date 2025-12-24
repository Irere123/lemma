import type { Descendant } from "slate";
import serialize from "./serialize";

/**
 * Converts Slate content to Markdown string
 */
export const slateToMarkdown = (content: Descendant[]): string => {
  return content
    .map((node) => serialize(node as any))
    .join("")
    .trim();
};
