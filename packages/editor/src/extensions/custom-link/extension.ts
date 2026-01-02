import { Mark, markInputRule, markPasteRule, mergeAttributes } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
// constants
import { CORE_EXTENSIONS } from "@/constants/extension";

export type LinkOptions = {
  HTMLAttributes: Record<string, unknown>;
  autolink: boolean;
  linkOnPaste: boolean;
  openOnClick: boolean;
  validate?: (url: string) => boolean;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    link: {
      setLink: (attributes: { href: string; target?: string }) => ReturnType;
      toggleLink: (attributes: { href: string; target?: string }) => ReturnType;
      unsetLink: () => ReturnType;
    };
  }
}

export const CustomLinkExtension = Mark.create<LinkOptions>({
  name: CORE_EXTENSIONS.CUSTOM_LINK,

  priority: 1000,

  keepOnSplit: false,

  inclusive() {
    return false;
  },

  addOptions() {
    return {
      HTMLAttributes: {
        target: "_blank",
        rel: "noopener noreferrer nofollow",
        class: "editor-link",
      },
      autolink: true,
      linkOnPaste: true,
      openOnClick: true,
      validate: undefined,
    };
  },

  addAttributes() {
    return {
      href: {
        default: null,
      },
      target: {
        default: this.options.HTMLAttributes.target,
      },
      rel: {
        default: this.options.HTMLAttributes.rel,
      },
      class: {
        default: this.options.HTMLAttributes.class,
      },
    };
  },

  parseHTML() {
    return [{ tag: 'a[href]:not([href *= "javascript:" i])' }];
  },

  renderHTML({ HTMLAttributes }) {
    // Validate URL to prevent javascript: protocol
    if (HTMLAttributes.href?.startsWith("javascript:")) {
      return ["a", mergeAttributes(this.options.HTMLAttributes, { ...HTMLAttributes, href: "" }), 0];
    }
    return ["a", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setLink:
        (attributes) =>
        ({ chain }) => {
          return chain().setMark(this.name, attributes).setMeta("preventAutolink", true).run();
        },

      toggleLink:
        (attributes) =>
        ({ chain }) => {
          return chain()
            .toggleMark(this.name, attributes, { extendEmptyMarkRange: true })
            .setMeta("preventAutolink", true)
            .run();
        },

      unsetLink:
        () =>
        ({ chain }) => {
          return chain()
            .unsetMark(this.name, { extendEmptyMarkRange: true })
            .setMeta("preventAutolink", true)
            .run();
        },
    };
  },

  addPasteRules() {
    return [
      markPasteRule({
        find: /(https?:\/\/[^\s]+)/g,
        type: this.type,
        getAttributes: (match) => ({
          href: match[0],
        }),
      }),
    ];
  },

  addInputRules() {
    return [
      markInputRule({
        find: /(?:^|\s)\[(.+?)\]\((\S+)\)$/,
        type: this.type,
        getAttributes: (match) => ({
          href: match[2],
        }),
      }),
    ];
  },

  addProseMirrorPlugins() {
    const plugins: Plugin[] = [];

    if (this.options.openOnClick) {
      plugins.push(
        new Plugin({
          key: new PluginKey("handleClickLink"),
          props: {
            handleClick: (_view, _pos, event) => {
              const attrs = this.editor.getAttributes(this.name);
              const link = (event.target as HTMLElement).closest("a");

              if (link && attrs.href) {
                window.open(attrs.href, attrs.target);
                return true;
              }

              return false;
            },
          },
        })
      );
    }

    return plugins;
  },
});
