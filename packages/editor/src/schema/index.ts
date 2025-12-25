import { Schema, NodeSpec, MarkSpec } from "prosemirror-model";
import { v4 as uuid } from "uuid";

// Helper to generate unique node IDs
export const createNodeId = (): string => uuid();

// Node specifications
const nodes: Record<string, NodeSpec> = {
  // Root document
  doc: {
    content: "block+",
  },

  // Paragraph - basic text block
  paragraph: {
    content: "inline*",
    group: "block",
    attrs: {
      id: { default: null },
    },
    parseDOM: [
      {
        tag: "p",
        getAttrs: (dom) => ({
          id: (dom as HTMLElement).getAttribute("data-id") || createNodeId(),
        }),
      },
    ],
    toDOM(node) {
      return ["p", { "data-id": node.attrs.id, class: "pm-paragraph" }, 0];
    },
  },

  // Heading with levels 1-4
  heading: {
    content: "inline*",
    group: "block",
    attrs: {
      level: { default: 1 },
      id: { default: null },
    },
    defining: true,
    parseDOM: [
      { tag: "h1", getAttrs: (dom) => ({ level: 1, id: (dom as HTMLElement).getAttribute("data-id") || createNodeId() }) },
      { tag: "h2", getAttrs: (dom) => ({ level: 2, id: (dom as HTMLElement).getAttribute("data-id") || createNodeId() }) },
      { tag: "h3", getAttrs: (dom) => ({ level: 3, id: (dom as HTMLElement).getAttribute("data-id") || createNodeId() }) },
      { tag: "h4", getAttrs: (dom) => ({ level: 4, id: (dom as HTMLElement).getAttribute("data-id") || createNodeId() }) },
    ],
    toDOM(node) {
      const tag = `h${node.attrs.level}`;
      const classes = [
        "pm-heading",
        node.attrs.level === 1 ? "text-3xl font-bold mt-6 mb-2" : "",
        node.attrs.level === 2 ? "text-2xl font-bold mt-5 mb-2" : "",
        node.attrs.level === 3 ? "text-xl font-semibold mt-4 mb-1" : "",
        node.attrs.level === 4 ? "text-lg font-semibold mt-3 mb-1" : "",
      ].filter(Boolean).join(" ");
      return [tag, { "data-id": node.attrs.id, class: classes }, 0];
    },
  },

  // Bullet list
  bulletList: {
    content: "listItem+",
    group: "block",
    attrs: {
      id: { default: null },
    },
    parseDOM: [
      {
        tag: "ul",
        getAttrs: (dom) => ({
          id: (dom as HTMLElement).getAttribute("data-id") || createNodeId(),
        }),
      },
    ],
    toDOM(node) {
      return ["ul", { "data-id": node.attrs.id, class: "pm-bullet-list ml-6 list-disc space-y-1 my-2" }, 0];
    },
  },

  // Ordered list
  orderedList: {
    content: "listItem+",
    group: "block",
    attrs: {
      id: { default: null },
      start: { default: 1 },
    },
    parseDOM: [
      {
        tag: "ol",
        getAttrs: (dom) => ({
          id: (dom as HTMLElement).getAttribute("data-id") || createNodeId(),
          start: (dom as HTMLElement).hasAttribute("start")
            ? parseInt((dom as HTMLElement).getAttribute("start")!, 10)
            : 1,
        }),
      },
    ],
    toDOM(node) {
      return [
        "ol",
        {
          "data-id": node.attrs.id,
          start: node.attrs.start,
          class: "pm-ordered-list ml-6 list-decimal space-y-1 my-2",
        },
        0,
      ];
    },
  },

  // List item - can contain paragraph and nested blocks
  listItem: {
    content: "paragraph block*",
    attrs: {
      id: { default: null },
    },
    defining: true,
    parseDOM: [
      {
        tag: "li",
        getAttrs: (dom) => ({
          id: (dom as HTMLElement).getAttribute("data-id") || createNodeId(),
        }),
      },
    ],
    toDOM(node) {
      return ["li", { "data-id": node.attrs.id, class: "pm-list-item py-0.5" }, 0];
    },
  },

  // Task list (todo list)
  taskList: {
    content: "taskItem+",
    group: "block",
    attrs: {
      id: { default: null },
    },
    parseDOM: [
      {
        tag: 'ul[data-type="taskList"]',
        getAttrs: (dom) => ({
          id: (dom as HTMLElement).getAttribute("data-id") || createNodeId(),
        }),
      },
    ],
    toDOM(node) {
      return [
        "ul",
        { "data-id": node.attrs.id, "data-type": "taskList", class: "pm-task-list space-y-1 my-2" },
        0,
      ];
    },
  },

  // Task item with checkbox
  taskItem: {
    content: "paragraph block*",
    attrs: {
      id: { default: null },
      checked: { default: false },
    },
    defining: true,
    parseDOM: [
      {
        tag: 'li[data-type="taskItem"]',
        getAttrs: (dom) => ({
          id: (dom as HTMLElement).getAttribute("data-id") || createNodeId(),
          checked: (dom as HTMLElement).getAttribute("data-checked") === "true",
        }),
      },
    ],
    toDOM(node) {
      return [
        "li",
        {
          "data-id": node.attrs.id,
          "data-type": "taskItem",
          "data-checked": node.attrs.checked ? "true" : "false",
          class: "pm-task-item flex items-start gap-2",
        },
        0,
      ];
    },
  },

  // Blockquote
  blockquote: {
    content: "block+",
    group: "block",
    attrs: {
      id: { default: null },
    },
    defining: true,
    parseDOM: [
      {
        tag: "blockquote",
        getAttrs: (dom) => ({
          id: (dom as HTMLElement).getAttribute("data-id") || createNodeId(),
        }),
      },
    ],
    toDOM(node) {
      return [
        "blockquote",
        {
          "data-id": node.attrs.id,
          class: "pm-blockquote border-l-4 border-gray-300 dark:border-gray-600 pl-4 my-3 italic text-gray-700 dark:text-gray-300",
        },
        0,
      ];
    },
  },

  // Code block with language
  codeBlock: {
    content: "text*",
    group: "block",
    code: true,
    defining: true,
    marks: "",
    attrs: {
      id: { default: null },
      language: { default: null },
    },
    parseDOM: [
      {
        tag: "pre",
        preserveWhitespace: "full",
        getAttrs: (dom) => ({
          id: (dom as HTMLElement).getAttribute("data-id") || createNodeId(),
          language: (dom as HTMLElement).getAttribute("data-language") || null,
        }),
      },
    ],
    toDOM(node) {
      return [
        "pre",
        {
          "data-id": node.attrs.id,
          "data-language": node.attrs.language,
          class: "pm-code-block bg-gray-100 dark:bg-gray-800 rounded-md p-4 my-3 overflow-x-auto font-mono text-sm",
        },
        ["code", 0],
      ];
    },
  },

  // Callout block with variant
  callout: {
    content: "block+",
    group: "block",
    attrs: {
      id: { default: null },
      variant: { default: "info" },
    },
    defining: true,
    parseDOM: [
      {
        tag: 'div[data-type="callout"]',
        getAttrs: (dom) => ({
          id: (dom as HTMLElement).getAttribute("data-id") || createNodeId(),
          variant: (dom as HTMLElement).getAttribute("data-variant") || "info",
        }),
      },
    ],
    toDOM(node) {
      const variantClasses: Record<string, string> = {
        info: "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800",
        warning: "bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800",
        success: "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800",
        error: "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800",
      };
      return [
        "div",
        {
          "data-id": node.attrs.id,
          "data-type": "callout",
          "data-variant": node.attrs.variant,
          class: `pm-callout border rounded-md p-4 my-3 ${variantClasses[node.attrs.variant] || variantClasses.info}`,
        },
        0,
      ];
    },
  },

  // Toggle block (collapsible)
  toggle: {
    content: "paragraph block*",
    group: "block",
    attrs: {
      id: { default: null },
      open: { default: false },
    },
    defining: true,
    parseDOM: [
      {
        tag: 'details[data-type="toggle"]',
        getAttrs: (dom) => ({
          id: (dom as HTMLElement).getAttribute("data-id") || createNodeId(),
          open: (dom as HTMLElement).hasAttribute("open"),
        }),
      },
    ],
    toDOM(node) {
      const attrs: Record<string, string> = {
        "data-id": node.attrs.id,
        "data-type": "toggle",
        class: "pm-toggle border rounded-md my-3",
      };
      if (node.attrs.open) {
        attrs.open = "true";
      }
      return ["details", attrs, 0];
    },
  },

  // Image block
  image: {
    group: "block",
    atom: true,
    attrs: {
      id: { default: null },
      src: { default: null },
      alt: { default: null },
      caption: { default: null },
    },
    parseDOM: [
      {
        tag: "figure",
        getAttrs: (dom) => {
          const img = (dom as HTMLElement).querySelector("img");
          const figcaption = (dom as HTMLElement).querySelector("figcaption");
          return {
            id: (dom as HTMLElement).getAttribute("data-id") || createNodeId(),
            src: img?.getAttribute("src") || null,
            alt: img?.getAttribute("alt") || null,
            caption: figcaption?.textContent || null,
          };
        },
      },
      {
        tag: "img[src]",
        getAttrs: (dom) => ({
          id: createNodeId(),
          src: (dom as HTMLElement).getAttribute("src"),
          alt: (dom as HTMLElement).getAttribute("alt"),
          caption: null,
        }),
      },
    ],
    toDOM(node) {
      const figure = [
        "figure",
        { "data-id": node.attrs.id, class: "pm-image my-4" },
        [
          "img",
          {
            src: node.attrs.src,
            alt: node.attrs.alt || "",
            class: "max-w-full rounded-md",
          },
        ],
      ];
      if (node.attrs.caption) {
        (figure as any[]).push([
          "figcaption",
          { class: "text-center text-sm text-gray-500 mt-2" },
          node.attrs.caption,
        ]);
      }
      return figure as any;
    },
  },

  // Divider (horizontal rule)
  divider: {
    group: "block",
    atom: true,
    attrs: {
      id: { default: null },
    },
    parseDOM: [
      {
        tag: "hr",
        getAttrs: () => ({ id: createNodeId() }),
      },
    ],
    toDOM(node) {
      return [
        "hr",
        {
          "data-id": node.attrs.id,
          class: "pm-divider border-t border-gray-300 dark:border-gray-600 my-6",
        },
      ];
    },
  },

  // Hard break
  hardBreak: {
    inline: true,
    group: "inline",
    selectable: false,
    parseDOM: [{ tag: "br" }],
    toDOM() {
      return ["br"];
    },
  },

  // Text node
  text: {
    group: "inline",
  },
};

// Mark specifications
const marks: Record<string, MarkSpec> = {
  // Bold
  bold: {
    parseDOM: [
      { tag: "strong" },
      { tag: "b", getAttrs: (node) => (node as HTMLElement).style.fontWeight !== "normal" && null },
      {
        style: "font-weight",
        getAttrs: (value) => /^(bold(er)?|[5-9]\d{2,})$/.test(value as string) && null,
      },
    ],
    toDOM() {
      return ["strong", 0];
    },
  },

  // Italic
  italic: {
    parseDOM: [
      { tag: "i" },
      { tag: "em" },
      { style: "font-style=italic" },
    ],
    toDOM() {
      return ["em", 0];
    },
  },

  // Code (inline)
  code: {
    parseDOM: [{ tag: "code" }],
    toDOM() {
      return ["code", { class: "bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm font-mono" }, 0];
    },
  },

  // Underline
  underline: {
    parseDOM: [
      { tag: "u" },
      { style: "text-decoration=underline" },
    ],
    toDOM() {
      return ["u", 0];
    },
  },

  // Strikethrough
  strikethrough: {
    parseDOM: [
      { tag: "s" },
      { tag: "del" },
      { tag: "strike" },
      { style: "text-decoration=line-through" },
    ],
    toDOM() {
      return ["s", 0];
    },
  },

  // Highlight
  highlight: {
    parseDOM: [
      { tag: "mark" },
      {
        style: "background-color",
        getAttrs: (value) => (value as string).includes("yellow") && null,
      },
    ],
    toDOM() {
      return ["mark", { class: "bg-yellow-200 dark:bg-yellow-800" }, 0];
    },
  },

  // Link
  link: {
    attrs: {
      href: {},
      title: { default: null },
    },
    inclusive: false,
    parseDOM: [
      {
        tag: "a[href]",
        getAttrs: (dom) => ({
          href: (dom as HTMLElement).getAttribute("href"),
          title: (dom as HTMLElement).getAttribute("title"),
        }),
      },
    ],
    toDOM(node) {
      return [
        "a",
        {
          href: node.attrs.href,
          title: node.attrs.title,
          class: "text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300",
          target: "_blank",
          rel: "noopener noreferrer",
        },
        0,
      ];
    },
  },

  // Tag (hashtag)
  tag: {
    attrs: {
      name: {},
    },
    inclusive: false,
    parseDOM: [
      {
        tag: 'span[data-type="tag"]',
        getAttrs: (dom) => ({
          name: (dom as HTMLElement).getAttribute("data-name"),
        }),
      },
    ],
    toDOM(node) {
      return [
        "span",
        {
          "data-type": "tag",
          "data-name": node.attrs.name,
          class: "pm-tag text-blue-600 dark:text-blue-400 cursor-pointer hover:underline",
        },
        `#${node.attrs.name}`,
      ];
    },
  },

  // Note link (internal link)
  noteLink: {
    attrs: {
      noteId: {},
      noteTitle: {},
      customText: { default: null },
    },
    inclusive: false,
    parseDOM: [
      {
        tag: 'a[data-type="noteLink"]',
        getAttrs: (dom) => ({
          noteId: (dom as HTMLElement).getAttribute("data-note-id"),
          noteTitle: (dom as HTMLElement).getAttribute("data-note-title"),
          customText: (dom as HTMLElement).getAttribute("data-custom-text") || null,
        }),
      },
    ],
    toDOM(node) {
      return [
        "a",
        {
          "data-type": "noteLink",
          "data-note-id": node.attrs.noteId,
          "data-note-title": node.attrs.noteTitle,
          "data-custom-text": node.attrs.customText,
          class: "pm-note-link text-purple-600 dark:text-purple-400 underline cursor-pointer hover:text-purple-800 dark:hover:text-purple-300",
        },
        0,
      ];
    },
  },
};

// Create and export the schema
export const schema = new Schema({ nodes, marks });

// Export node and mark types for convenience
export const nodeTypes = schema.nodes;
export const markTypes = schema.marks;

// Default document content
export const getDefaultDoc = () => {
  return schema.node("doc", null, [
    schema.node("paragraph", { id: createNodeId() }),
  ]);
};

// Export types
export type LemmaSchema = typeof schema;
