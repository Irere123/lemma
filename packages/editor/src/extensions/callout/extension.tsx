import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
// constants
import { CORE_EXTENSIONS } from "@/constants/extension";
// components
import { CalloutNodeView } from "./node-view";

export type CalloutOptions = {
  HTMLAttributes: Record<string, unknown>;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    callout: {
      insertCallout: () => ReturnType;
      setCalloutType: (type: string) => ReturnType;
    };
  }
}

export type TCalloutType = "info" | "warning" | "error" | "success";

export const CalloutExtension = Node.create<CalloutOptions>({
  name: CORE_EXTENSIONS.CALLOUT,

  group: "block",

  content: "block+",

  defining: true,

  addOptions() {
    return {
      HTMLAttributes: {
        class: "editor-callout-component",
      },
    };
  },

  addAttributes() {
    return {
      type: {
        default: "info" as TCalloutType,
        parseHTML: (element) => element.getAttribute("data-callout-type") || "info",
        renderHTML: (attributes) => ({
          "data-callout-type": attributes.type,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: `div[data-type="${CORE_EXTENSIONS.CALLOUT}"]`,
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-type": CORE_EXTENSIONS.CALLOUT,
      }),
      0,
    ];
  },

  addCommands() {
    return {
      insertCallout:
        () =>
        ({ commands }) => {
          return commands.insertContent({
            type: CORE_EXTENSIONS.CALLOUT,
            attrs: { type: "info" },
            content: [
              {
                type: "paragraph",
              },
            ],
          });
        },

      setCalloutType:
        (type: string) =>
        ({ commands }) => {
          return commands.updateAttributes(CORE_EXTENSIONS.CALLOUT, { type });
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      // Enter at the end of callout creates a new paragraph outside
      Enter: ({ editor }) => {
        const { state } = editor;
        const { selection } = state;
        const { $from, empty } = selection;

        if (!empty) return false;

        // Check if we're at the end of a callout
        for (let d = $from.depth; d > 0; d--) {
          const node = $from.node(d);
          if (node.type.name === CORE_EXTENSIONS.CALLOUT) {
            // Check if cursor is at the end of the callout content
            const endOfCallout = $from.end(d);
            if ($from.pos === endOfCallout - 1) {
              // Check if last content is empty paragraph
              const lastChild = node.lastChild;
              if (lastChild?.type.name === "paragraph" && lastChild.content.size === 0) {
                // Delete the empty paragraph and exit callout
                return editor
                  .chain()
                  .deleteNode("paragraph")
                  .insertContentAt($from.after(d), { type: "paragraph" })
                  .focus()
                  .run();
              }
            }
            break;
          }
        }

        return false;
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutNodeView);
  },
});
