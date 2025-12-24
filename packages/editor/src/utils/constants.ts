import type { Descendant } from "slate";

import { createNodeId } from "./plugins/withNodeId";
import { ElementType } from "../types";

export const getDefaultEditorValue = (): Descendant[] => [
  { id: createNodeId(), type: ElementType.Paragraph, children: [{ text: "" }] },
];
