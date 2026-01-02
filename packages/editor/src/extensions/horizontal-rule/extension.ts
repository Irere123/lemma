import { Node, mergeAttributes } from "@tiptap/core";
// constants
import { CORE_EXTENSIONS } from "@/constants/extension";

export type HorizontalRuleOptions = {
  HTMLAttributes: Record<string, unknown>;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    horizontalRule: {
      setHorizontalRule: () => ReturnType;
    };
  }
}

export const HorizontalRuleExtension = Node.create<HorizontalRuleOptions>({
  name: CORE_EXTENSIONS.HORIZONTAL_RULE,

  group: "block",

  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {
        class: "editor-horizontal-rule",
      },
    };
  },

  parseHTML() {
    return [{ tag: "hr" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-type": "horizontalRule",
      }),
      ["hr"],
    ];
  },

  addCommands() {
    return {
      setHorizontalRule:
        () =>
        ({ chain, state }) => {
          const { selection } = state;
          const { $from: $originFrom, $to: $originTo } = selection;

          const currentChain = chain();

          if ($originFrom.parentOffset === 0) {
            currentChain.insertContentAt(
              {
                from: Math.max($originFrom.pos - 1, 0),
                to: $originTo.pos,
              },
              {
                type: this.name,
              }
            );
          } else if ($originFrom.pos === $originTo.pos) {
            currentChain.insertContentAt($originTo.pos, {
              type: this.name,
            });
          } else {
            currentChain.insertContentAt(
              {
                from: $originFrom.pos,
                to: $originTo.pos,
              },
              {
                type: this.name,
              }
            );
          }

          return currentChain
            .command(({ tr, dispatch }) => {
              if (dispatch) {
                const { $to } = tr.selection;
                const posAfter = $to.end();

                if ($to.nodeAfter) {
                  if ($to.nodeAfter.isTextblock) {
                    tr.setSelection(
                      state.schema.nodes.paragraph
                        ? state.schema.nodes.paragraph.createAndFill()
                          ? tr.selection
                          : tr.selection
                        : tr.selection
                    );
                  } else if ($to.nodeAfter.isBlock) {
                    tr.setSelection(tr.selection);
                  } else {
                    tr.setSelection(tr.selection);
                  }
                } else {
                  const node = $to.parent.type.contentMatch.defaultType?.createAndFill();

                  if (node) {
                    tr.insert(posAfter, node);
                    tr.setSelection(tr.selection);
                  }
                }

                tr.scrollIntoView();
              }

              return true;
            })
            .run();
        },
    };
  },

  // Input rules handled by the default horizontal rule extension
});
