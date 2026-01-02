import { Extension } from "@tiptap/core";
import type { Transaction } from "@tiptap/pm/state";
import { Plugin, PluginKey } from "@tiptap/pm/state";
// constants
import { CORE_EXTENSIONS } from "@/constants/extension";
// types
import type { IMarking } from "@/types";

export type HeadingExtensionStorage = {
  headings: IMarking[];
};

export const HeadingListExtension = Extension.create<unknown, HeadingExtensionStorage>({
  name: CORE_EXTENSIONS.HEADINGS_LIST,

  addStorage() {
    return {
      headings: [] as IMarking[],
    };
  },

  addProseMirrorPlugins() {
    const extensionThis = this;

    const plugin = new Plugin({
      key: new PluginKey("heading-list"),
      appendTransaction: (_transactions: readonly Transaction[], _oldState, newState) => {
        const headings: IMarking[] = [];
        let h1Sequence = 0;
        let h2Sequence = 0;
        let h3Sequence = 0;

        newState.doc.descendants((node) => {
          if (node.type.name === "heading") {
            const level = node.attrs.level;
            const text = node.textContent;

            headings.push({
              type: "heading",
              level: level,
              text: text,
              sequence: level === 1 ? ++h1Sequence : level === 2 ? ++h2Sequence : ++h3Sequence,
            });
          }
        });

        extensionThis.storage.headings = headings;

        return null;
      },
    });

    return [plugin];
  },
});