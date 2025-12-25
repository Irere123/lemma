import type { Node as ProseMirrorNode, Mark } from "prosemirror-model";

/**
 * Converts a ProseMirror document to Markdown string
 */
export function toMarkdown(doc: ProseMirrorNode): string {
  return serializeNode(doc).trim();
}

function serializeNode(node: ProseMirrorNode, listDepth: number = 0): string {
  if (node.isText) {
    return serializeText(node);
  }

  const children = serializeChildren(node, listDepth);

  switch (node.type.name) {
    case "doc":
      return children;

    case "paragraph":
      return `${children}\n\n`;

    case "heading":
      const level = node.attrs.level || 1;
      const prefix = "#".repeat(level);
      return `${prefix} ${children}\n\n`;

    case "bulletList":
      return `${children}\n`;

    case "orderedList":
      return `${children}\n`;

    case "listItem":
      const indent = "  ".repeat(listDepth);
      const marker = isInOrderedList(node) ? "1." : "-";
      return `${indent}${marker} ${children.trim()}\n`;

    case "taskList":
      return `${children}\n`;

    case "taskItem":
      const checked = node.attrs.checked ? "x" : " ";
      return `- [${checked}] ${children.trim()}\n`;

    case "blockquote":
      const lines = children.trim().split("\n");
      return lines.map((line) => `> ${line}`).join("\n") + "\n\n";

    case "codeBlock":
      const language = node.attrs.language || "";
      return `\`\`\`${language}\n${node.textContent}\n\`\`\`\n\n`;

    case "callout":
      // Render callout as blockquote (markdown doesn't have native callout)
      return `> ${children.trim()}\n\n`;

    case "toggle":
      // Render toggle as details/summary in HTML
      return `<details>\n<summary>${children.trim()}</summary>\n</details>\n\n`;

    case "image":
      const alt = node.attrs.alt || node.attrs.caption || "";
      const src = node.attrs.src || "";
      return `![${alt}](${src})\n\n`;

    case "divider":
      return `---\n\n`;

    case "hardBreak":
      return `\n`;

    default:
      return children;
  }
}

function serializeChildren(node: ProseMirrorNode, listDepth: number = 0): string {
  let result = "";
  const isListContainer = node.type.name === "bulletList" || node.type.name === "orderedList";
  const newListDepth = isListContainer ? listDepth + 1 : listDepth;

  node.forEach((child) => {
    result += serializeNode(child, newListDepth);
  });

  return result;
}

function serializeText(node: ProseMirrorNode): string {
  let text = node.text || "";

  if (node.marks) {
    for (const mark of node.marks) {
      text = applyMark(text, mark);
    }
  }

  return text;
}

function applyMark(text: string, mark: Mark): string {
  // Handle whitespace preservation
  const leadingWhitespace = text.match(/^(\s*)/)?.[1] || "";
  const trailingWhitespace = text.match(/(\s*)$/)?.[1] || "";
  const trimmedText = text.trim();

  if (!trimmedText) {
    return text;
  }

  let formatted = trimmedText;

  switch (mark.type.name) {
    case "bold":
      formatted = `**${formatted}**`;
      break;

    case "italic":
      formatted = `_${formatted}_`;
      break;

    case "code":
      formatted = `\`${formatted}\``;
      break;

    case "strikethrough":
      formatted = `~~${formatted}~~`;
      break;

    case "underline":
      formatted = `<u>${formatted}</u>`;
      break;

    case "highlight":
      formatted = `<mark>${formatted}</mark>`;
      break;

    case "link":
      const href = mark.attrs.href || "";
      formatted = `[${formatted}](${href})`;
      break;

    case "tag":
      const name = mark.attrs.name || "";
      formatted = `#${name}`;
      break;

    case "noteLink":
      const noteTitle = mark.attrs.noteTitle || "";
      const customText = mark.attrs.customText;
      if (customText) {
        formatted = `[[${noteTitle}|${customText}]]`;
      } else {
        formatted = `[[${noteTitle}]]`;
      }
      break;
  }

  return leadingWhitespace + formatted + trailingWhitespace;
}

function isInOrderedList(_node: ProseMirrorNode): boolean {
  // This is a simplification - in practice we'd need to check parent
  return false;
}

// Export alias for compatibility
export const prosemirrorToMarkdown = toMarkdown;
