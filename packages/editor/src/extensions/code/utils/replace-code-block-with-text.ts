import type { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
// constants
import { CORE_EXTENSIONS } from "@/constants/extension";

/**
 * Replaces a code block with its text content as paragraphs
 */
export const replaceCodeWithText = (editor: Editor): boolean => {
  const { state, view } = editor;
  const { selection } = state;
  const { $from } = selection;

  // Find the code block node
  let codeBlockPos: number | null = null;
  let codeBlockNode = null;

  for (let d = $from.depth; d >= 0; d--) {
    const node = $from.node(d);
    if (node.type.name === CORE_EXTENSIONS.CODE_BLOCK) {
      codeBlockPos = $from.before(d);
      codeBlockNode = node;
      break;
    }
  }

  if (codeBlockPos === null || !codeBlockNode) {
    return false;
  }

  // Get the text content from the code block
  const textContent = codeBlockNode.textContent;
  const lines = textContent.split("\n");

  // Create paragraph nodes for each line
  const paragraphType = state.schema.nodes[CORE_EXTENSIONS.PARAGRAPH];
  if (!paragraphType) {
    return false;
  }

  const paragraphs = lines.map((line) =>
    paragraphType.create(null, line ? state.schema.text(line) : null)
  );

  // Create a transaction to replace the code block
  const tr = state.tr;
  const codeBlockEnd = codeBlockPos + codeBlockNode.nodeSize;

  // Delete the code block
  tr.delete(codeBlockPos, codeBlockEnd);

  // Insert paragraphs at the same position
  paragraphs.forEach((para, index) => {
    tr.insert(codeBlockPos! + index, para);
  });

  // Set selection to the end of the first paragraph
  const newPos = codeBlockPos + 1;
  tr.setSelection(TextSelection.create(tr.doc, newPos));

  view.dispatch(tr);
  return true;
};
