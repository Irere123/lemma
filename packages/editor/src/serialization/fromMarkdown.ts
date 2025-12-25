import type { Node as ProseMirrorNode, Schema } from "prosemirror-model";
import { schema as defaultSchema, createNodeId } from "../schema";

/**
 * Simple Markdown parser that converts markdown to ProseMirror nodes
 *
 * Note: For production use, consider using a proper markdown parser like
 * prosemirror-markdown or remark with a custom transformer.
 */
export function fromMarkdown(markdown: string, s: Schema = defaultSchema): ProseMirrorNode {
  const lines = markdown.split("\n");
  const blocks: ProseMirrorNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Skip empty lines
    if (!trimmedLine) {
      i++;
      continue;
    }

    // Heading
    const headingMatch = trimmedLine.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3 | 4;
      const content = parseInline(headingMatch[2], s);
      blocks.push(
        s.nodes.heading.create({ level, id: createNodeId() }, content)
      );
      i++;
      continue;
    }

    // Divider
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmedLine)) {
      blocks.push(s.nodes.divider.create({ id: createNodeId() }));
      i++;
      continue;
    }

    // Code block
    if (trimmedLine.startsWith("```")) {
      const language = trimmedLine.slice(3).trim() || null;
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // Skip closing ```
      blocks.push(
        s.nodes.codeBlock.create(
          { language, id: createNodeId() },
          codeLines.length > 0 ? s.text(codeLines.join("\n")) : null
        )
      );
      continue;
    }

    // Blockquote
    if (trimmedLine.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("> ")) {
        quoteLines.push(lines[i].trim().slice(2));
        i++;
      }
      const quoteContent = quoteLines.join("\n");
      const quoteParagraphs = quoteContent
        .split("\n\n")
        .filter(Boolean)
        .map((text) =>
          s.nodes.paragraph.create({ id: createNodeId() }, parseInline(text, s))
        );
      blocks.push(s.nodes.blockquote.create({ id: createNodeId() }, quoteParagraphs));
      continue;
    }

    // Unordered list
    if (/^[-*]\s/.test(trimmedLine)) {
      const listItems: ProseMirrorNode[] = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i].trim())) {
        const itemContent = lines[i].trim().slice(2);
        const itemParagraph = s.nodes.paragraph.create(
          { id: createNodeId() },
          parseInline(itemContent, s)
        );
        listItems.push(s.nodes.listItem.create({ id: createNodeId() }, itemParagraph));
        i++;
      }
      blocks.push(s.nodes.bulletList.create({ id: createNodeId() }, listItems));
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(trimmedLine)) {
      const listItems: ProseMirrorNode[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        const itemContent = lines[i].trim().replace(/^\d+\.\s/, "");
        const itemParagraph = s.nodes.paragraph.create(
          { id: createNodeId() },
          parseInline(itemContent, s)
        );
        listItems.push(s.nodes.listItem.create({ id: createNodeId() }, itemParagraph));
        i++;
      }
      blocks.push(s.nodes.orderedList.create({ id: createNodeId() }, listItems));
      continue;
    }

    // Task list
    if (/^- \[[ x]\]\s/.test(trimmedLine)) {
      const taskItems: ProseMirrorNode[] = [];
      while (i < lines.length && /^- \[[ x]\]\s/.test(lines[i].trim())) {
        const match = lines[i].trim().match(/^- \[([ x])\]\s(.*)$/);
        if (match) {
          const checked = match[1] === "x";
          const itemContent = match[2];
          const itemParagraph = s.nodes.paragraph.create(
            { id: createNodeId() },
            parseInline(itemContent, s)
          );
          taskItems.push(
            s.nodes.taskItem.create({ checked, id: createNodeId() }, itemParagraph)
          );
        }
        i++;
      }
      blocks.push(s.nodes.taskList.create({ id: createNodeId() }, taskItems));
      continue;
    }

    // Image
    const imageMatch = trimmedLine.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imageMatch) {
      blocks.push(
        s.nodes.image.create({
          alt: imageMatch[1],
          src: imageMatch[2],
          id: createNodeId(),
        })
      );
      i++;
      continue;
    }

    // Regular paragraph
    const paragraphLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith("#") &&
      !lines[i].trim().startsWith(">") &&
      !/^[-*]\s/.test(lines[i].trim()) &&
      !/^\d+\.\s/.test(lines[i].trim()) &&
      !lines[i].trim().startsWith("```") &&
      !/^(-{3,}|\*{3,}|_{3,})$/.test(lines[i].trim())
    ) {
      paragraphLines.push(lines[i]);
      i++;
    }
    if (paragraphLines.length > 0) {
      const text = paragraphLines.join(" ");
      blocks.push(
        s.nodes.paragraph.create({ id: createNodeId() }, parseInline(text, s))
      );
    }
  }

  // Ensure at least one paragraph
  if (blocks.length === 0) {
    blocks.push(s.nodes.paragraph.create({ id: createNodeId() }));
  }

  return s.nodes.doc.create(null, blocks);
}

/**
 * Parse inline markdown elements (bold, italic, links, etc.)
 */
function parseInline(text: string, s: Schema): ProseMirrorNode[] {
  const nodes: ProseMirrorNode[] = [];

  if (!text) {
    return nodes;
  }

  // For now, just return plain text
  // TODO: Implement proper inline parsing with marks (bold, italic, links, etc.)
  if (text) {
    nodes.push(s.text(text));
  }

  return nodes;
}

// Export alias
export const markdownToProsemirror = fromMarkdown;
