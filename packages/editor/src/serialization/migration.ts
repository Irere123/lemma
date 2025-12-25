import type { Node as ProseMirrorNode, Schema } from "prosemirror-model";
import { schema as defaultSchema, createNodeId } from "../schema";

// Slate element types (from old implementation)
const SlateElementType = {
  Paragraph: "paragraph",
  HeadingOne: "heading-one",
  HeadingTwo: "heading-two",
  HeadingThree: "heading-three",
  HeadingFour: "heading-four",
  ListItem: "list-item",
  BulletedList: "bulleted-list",
  NumberedList: "numbered-list",
  CheckListItem: "check-list-item",
  Blockquote: "block-quote",
  ExternalLink: "link",
  NoteLink: "note-link",
  Tag: "tag",
  CodeBlock: "code-block",
  ThematicBreak: "thematic-break",
  Image: "image",
  BlockReference: "block-reference",
  Callout: "callout",
  Toggle: "toggle",
  Divider: "divider",
} as const;

// Slate content types
interface SlateText {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  highlight?: boolean;
}

interface SlateElement {
  id?: string;
  type: string;
  children: (SlateElement | SlateText)[];
  // Various optional attributes
  url?: string;
  noteId?: string;
  noteTitle?: string;
  customText?: string;
  name?: string;
  language?: string;
  checked?: boolean;
  variant?: string;
  open?: boolean;
  caption?: string;
  alt?: string;
  level?: number;
  blockId?: string;
}

/**
 * Migrate Slate content to ProseMirror document
 */
export function migrateFromSlate(
  slateContent: (SlateElement | SlateText)[],
  s: Schema = defaultSchema
): ProseMirrorNode {
  const blocks = slateContent
    .map((node) => migrateNode(node, s))
    .filter((n): n is ProseMirrorNode => n !== null);

  // Ensure at least one paragraph
  if (blocks.length === 0) {
    blocks.push(s.nodes.paragraph.create({ id: createNodeId() }));
  }

  return s.nodes.doc.create(null, blocks);
}

function migrateNode(
  node: SlateElement | SlateText,
  s: Schema
): ProseMirrorNode | null {
  // Handle text nodes
  if ("text" in node) {
    return migrateTextNode(node as SlateText, s);
  }

  const element = node as SlateElement;
  const children = element.children || [];

  switch (element.type) {
    case SlateElementType.Paragraph:
      return s.nodes.paragraph.create(
        { id: element.id || createNodeId() },
        migrateInlineContent(children, s)
      );

    case SlateElementType.HeadingOne:
      return s.nodes.heading.create(
        { level: 1, id: element.id || createNodeId() },
        migrateInlineContent(children, s)
      );

    case SlateElementType.HeadingTwo:
      return s.nodes.heading.create(
        { level: 2, id: element.id || createNodeId() },
        migrateInlineContent(children, s)
      );

    case SlateElementType.HeadingThree:
      return s.nodes.heading.create(
        { level: 3, id: element.id || createNodeId() },
        migrateInlineContent(children, s)
      );

    case SlateElementType.HeadingFour:
      return s.nodes.heading.create(
        { level: 4, id: element.id || createNodeId() },
        migrateInlineContent(children, s)
      );

    case SlateElementType.BulletedList:
      return s.nodes.bulletList.create(
        { id: element.id || createNodeId() },
        migrateListItems(children, s)
      );

    case SlateElementType.NumberedList:
      return s.nodes.orderedList.create(
        { id: element.id || createNodeId() },
        migrateListItems(children, s)
      );

    case SlateElementType.ListItem:
      // List items need a paragraph inside
      const listItemContent = migrateInlineContent(children, s);
      const listItemParagraph = s.nodes.paragraph.create(
        { id: createNodeId() },
        listItemContent
      );
      return s.nodes.listItem.create(
        { id: element.id || createNodeId() },
        listItemParagraph
      );

    case SlateElementType.CheckListItem:
      const taskItemContent = migrateInlineContent(children, s);
      const taskItemParagraph = s.nodes.paragraph.create(
        { id: createNodeId() },
        taskItemContent
      );
      return s.nodes.taskItem.create(
        { checked: element.checked || false, id: element.id || createNodeId() },
        taskItemParagraph
      );

    case SlateElementType.Blockquote:
      const quoteBlocks = children
        .map((child) => migrateNode(child, s))
        .filter((n): n is ProseMirrorNode => n !== null);
      // If empty or only text, wrap in paragraph
      if (quoteBlocks.length === 0 || quoteBlocks.every((n) => n.isText)) {
        const quoteParagraph = s.nodes.paragraph.create(
          { id: createNodeId() },
          migrateInlineContent(children, s)
        );
        return s.nodes.blockquote.create(
          { id: element.id || createNodeId() },
          quoteParagraph
        );
      }
      return s.nodes.blockquote.create(
        { id: element.id || createNodeId() },
        quoteBlocks
      );

    case SlateElementType.CodeBlock:
      // Code blocks contain raw text
      const codeText = extractText(children);
      return s.nodes.codeBlock.create(
        { language: element.language || null, id: element.id || createNodeId() },
        codeText ? s.text(codeText) : null
      );

    case SlateElementType.Image:
      return s.nodes.image.create({
        src: element.url,
        alt: element.alt || element.caption || "",
        caption: element.caption || null,
        id: element.id || createNodeId(),
      });

    case SlateElementType.ThematicBreak:
    case SlateElementType.Divider:
      return s.nodes.divider.create({ id: element.id || createNodeId() });

    case SlateElementType.Callout:
      const calloutBlocks = children
        .map((child) => migrateNode(child, s))
        .filter((n): n is ProseMirrorNode => n !== null);
      if (calloutBlocks.length === 0) {
        const calloutParagraph = s.nodes.paragraph.create(
          { id: createNodeId() },
          migrateInlineContent(children, s)
        );
        return s.nodes.callout.create(
          { variant: element.variant || "info", id: element.id || createNodeId() },
          calloutParagraph
        );
      }
      return s.nodes.callout.create(
        { variant: element.variant || "info", id: element.id || createNodeId() },
        calloutBlocks
      );

    case SlateElementType.Toggle:
      const toggleBlocks = children
        .map((child) => migrateNode(child, s))
        .filter((n): n is ProseMirrorNode => n !== null);
      if (toggleBlocks.length === 0) {
        const toggleParagraph = s.nodes.paragraph.create(
          { id: createNodeId() },
          migrateInlineContent(children, s)
        );
        return s.nodes.toggle.create(
          { open: element.open || false, id: element.id || createNodeId() },
          toggleParagraph
        );
      }
      return s.nodes.toggle.create(
        { open: element.open || false, id: element.id || createNodeId() },
        toggleBlocks
      );

    // Inline elements (shouldn't be at block level, but handle gracefully)
    case SlateElementType.ExternalLink:
    case SlateElementType.NoteLink:
    case SlateElementType.Tag:
      // Wrap in paragraph
      return s.nodes.paragraph.create(
        { id: element.id || createNodeId() },
        migrateInlineContent([element], s)
      );

    case SlateElementType.BlockReference:
      // Skip block references for now (they need special handling)
      return null;

    default:
      // Unknown type, treat as paragraph
      return s.nodes.paragraph.create(
        { id: element.id || createNodeId() },
        migrateInlineContent(children, s)
      );
  }
}

function migrateInlineContent(
  children: (SlateElement | SlateText)[],
  s: Schema
): ProseMirrorNode[] {
  const nodes: ProseMirrorNode[] = [];

  for (const child of children) {
    if ("text" in child) {
      const textNode = migrateTextNode(child as SlateText, s);
      if (textNode) {
        nodes.push(textNode);
      }
    } else {
      const element = child as SlateElement;

      // Handle inline elements
      switch (element.type) {
        case SlateElementType.ExternalLink:
          const linkText = extractText(element.children);
          if (linkText) {
            const linkMark = s.marks.link.create({ href: element.url });
            nodes.push(s.text(linkText, [linkMark]));
          }
          break;

        case SlateElementType.NoteLink:
          const noteLinkText = element.customText || element.noteTitle || "";
          if (noteLinkText) {
            const noteLinkMark = s.marks.noteLink.create({
              noteId: element.noteId,
              noteTitle: element.noteTitle,
              customText: element.customText,
            });
            nodes.push(s.text(noteLinkText, [noteLinkMark]));
          }
          break;

        case SlateElementType.Tag:
          const tagMark = s.marks.tag.create({ name: element.name });
          nodes.push(s.text(`#${element.name}`, [tagMark]));
          break;

        default:
          // For other element types, just extract text
          const text = extractText(element.children);
          if (text) {
            nodes.push(s.text(text));
          }
      }
    }
  }

  return nodes;
}

function migrateTextNode(node: SlateText, s: Schema): ProseMirrorNode | null {
  if (!node.text) {
    return null;
  }

  const marks = [];

  if (node.bold) {
    marks.push(s.marks.bold.create());
  }
  if (node.italic) {
    marks.push(s.marks.italic.create());
  }
  if (node.code) {
    marks.push(s.marks.code.create());
  }
  if (node.underline) {
    marks.push(s.marks.underline.create());
  }
  if (node.strikethrough) {
    marks.push(s.marks.strikethrough.create());
  }
  if (node.highlight) {
    marks.push(s.marks.highlight.create());
  }

  return s.text(node.text, marks);
}

function migrateListItems(
  children: (SlateElement | SlateText)[],
  s: Schema
): ProseMirrorNode[] {
  return children
    .map((child) => {
      if ("text" in child) {
        // Text shouldn't be direct child of list, wrap in list item
        const paragraph = s.nodes.paragraph.create(
          { id: createNodeId() },
          [(child as SlateText).text ? s.text((child as SlateText).text) : null].filter(Boolean) as ProseMirrorNode[]
        );
        return s.nodes.listItem.create({ id: createNodeId() }, paragraph);
      }
      return migrateNode(child, s);
    })
    .filter((n): n is ProseMirrorNode => n !== null);
}

function extractText(children: (SlateElement | SlateText)[]): string {
  let text = "";

  for (const child of children) {
    if ("text" in child) {
      text += (child as SlateText).text || "";
    } else {
      text += extractText((child as SlateElement).children || []);
    }
  }

  return text;
}

// Export for convenience
export { migrateFromSlate as slateToProsemir };
