import { Extension } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import Suggestion, { type SuggestionOptions } from "@tiptap/suggestion";
import tippy, { type Instance as TippyInstance } from "tippy.js";
// constants
import { CORE_EXTENSIONS } from "@/constants/extension";
// types
import type { TExtensions, ISlashCommandItem, TSlashCommandSectionKeys } from "@/types";
// components
import { SlashCommandsMenu } from "./command-menu";
import { getSlashCommandFilteredSections, type TSlashCommandSection } from "./command-items-list";

export type SlashCommandOptions = Partial<Omit<SuggestionOptions, "editor">>;

export type TSlashCommandAdditionalOption = ISlashCommandItem & {
  section: TSlashCommandSectionKeys;
  pushAfter?: string;
};

export type TExtensionProps = {
  additionalOptions?: TSlashCommandAdditionalOption[];
  disabledExtensions?: TExtensions[];
  flaggedExtensions?: TExtensions[];
};

type SlashCommandsExtensionOptions = TExtensionProps & {
  suggestion?: SlashCommandOptions;
};

export const SlashCommands = (props: SlashCommandsExtensionOptions) => {
  const { additionalOptions, disabledExtensions, flaggedExtensions } = props;

  return Extension.create<SlashCommandsExtensionOptions>({
    name: CORE_EXTENSIONS.SLASH_COMMANDS,

    addOptions() {
      return {
        additionalOptions,
        disabledExtensions,
        flaggedExtensions,
        suggestion: {
          char: "/",
          startOfLine: false,
          command: ({ editor, range, props: commandProps }) => {
            const item = commandProps as ISlashCommandItem;
            item.command?.({ editor, range });
          },
        },
      };
    },

    addProseMirrorPlugins() {
      return [
        Suggestion({
          editor: this.editor,
          ...this.options.suggestion,
          items: getSlashCommandFilteredSections({
            additionalOptions: this.options.additionalOptions,
            disabledExtensions: this.options.disabledExtensions,
            flaggedExtensions: this.options.flaggedExtensions,
          }),
          allow: ({ state, range }) => {
            // Don't show in code blocks
            const $from = state.doc.resolve(range.from);
            const type = $from.parent.type.name;

            if (type === CORE_EXTENSIONS.CODE_BLOCK) {
              return false;
            }

            return true;
          },
          render: () => {
            let component: ReactRenderer | null = null;
            let popup: TippyInstance[] | null = null;

            return {
              onStart: (props) => {
                component = new ReactRenderer(SlashCommandsMenu, {
                  props: {
                    ...props,
                    items: props.items as TSlashCommandSection[],
                    command: (item: ISlashCommandItem) => {
                      props.command(item);
                    },
                    onClose: () => {
                      popup?.[0]?.hide();
                    },
                  },
                  editor: props.editor,
                });

                if (!props.clientRect) {
                  return;
                }

                popup = tippy("body", {
                  getReferenceClientRect: props.clientRect as () => DOMRect,
                  appendTo: () => document.body,
                  content: component.element,
                  showOnCreate: true,
                  interactive: true,
                  trigger: "manual",
                  placement: "bottom-start",
                  animation: "shift-away",
                  maxWidth: "none",
                });
              },

              onUpdate: (props) => {
                if (component) {
                  component.updateProps({
                    ...props,
                    items: props.items as TSlashCommandSection[],
                    command: (item: ISlashCommandItem) => {
                      props.command(item);
                    },
                    onClose: () => {
                      popup?.[0]?.hide();
                    },
                  });
                }

                if (!props.clientRect) {
                  return;
                }

                popup?.[0]?.setProps({
                  getReferenceClientRect: props.clientRect as () => DOMRect,
                });
              },

              onKeyDown: (props) => {
                if (props.event.key === "Escape") {
                  popup?.[0]?.hide();
                  return true;
                }

                // Let the component handle arrow keys and enter
                return false;
              },

              onExit: () => {
                popup?.[0]?.destroy();
                component?.destroy();
              },
            };
          },
        }),
      ];
    },
  });
};
