import { Extension } from "@tiptap/core";
import Emoji from "@tiptap/extension-emoji";
// constants
import { CORE_EXTENSIONS } from "@/constants/extension";

export interface ExtendedEmojiStorage {
  forceOpen: boolean;
  emojis: string[];
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    emoji: {
      setEmoji: (emoji: string) => ReturnType;
    };
  }
}

export type CustomEmojiExtensionOptions = {
  enableEmoticons?: boolean;
};

export const CustomEmojiExtension = (options?: CustomEmojiExtensionOptions) => {
  return Extension.create<CustomEmojiExtensionOptions, ExtendedEmojiStorage>({
    name: CORE_EXTENSIONS.EMOJI,

    addStorage() {
      return {
        forceOpen: false,
        emojis: [],
      };
    },

    addExtensions() {
      return [
        Emoji.configure({
          enableEmoticons: options?.enableEmoticons ?? true,
        }),
      ];
    },

    addCommands() {
      return {
        setEmoji:
          (emoji: string) =>
          ({ commands }) => {
            return commands.insertContent(emoji);
          },
      };
    },
  });
};
