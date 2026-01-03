import Emoji from "@tiptap/extension-emoji";

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

/**
 * Custom emoji extension that wraps @tiptap/extension-emoji
 * with additional configuration and commands.
 */
export const CustomEmojiExtension = (options?: CustomEmojiExtensionOptions) => {
  return Emoji.extend<CustomEmojiExtensionOptions, ExtendedEmojiStorage>({
    addStorage() {
      return {
        forceOpen: false,
        emojis: [],
      };
    },

    addCommands() {
      return {
        ...this.parent?.(),
        setEmoji:
          (emoji: string) =>
          ({ commands }) => {
            return commands.insertContent(emoji);
          },
      };
    },
  }).configure({
    enableEmoticons: options?.enableEmoticons ?? true,
  });
};
