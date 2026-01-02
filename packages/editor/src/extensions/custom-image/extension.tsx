import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { v4 as uuidv4 } from "uuid";
// constants
import { CORE_EXTENSIONS } from "@/constants/extension";
import { ACCEPTED_IMAGE_MIME_TYPES } from "@/constants/config";
// types
import type { TFileHandler } from "@/types";
import type { InsertImageComponentProps, TImageStatus, TImageStorage } from "./types";
// components
import { ImageNodeView } from "./node-view";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    imageComponent: {
      insertImageComponent: (props: InsertImageComponentProps) => ReturnType;
      updateImageAttributes: (attrs: Partial<{ src: string; status: TImageStatus }>) => ReturnType;
    };
  }
}

export type CustomImageExtensionOptions = {
  fileHandler: TFileHandler;
  isEditable: boolean;
};

export const CustomImageExtension = (options: CustomImageExtensionOptions) => {
  const { fileHandler, isEditable } = options;

  return Node.create<CustomImageExtensionOptions, TImageStorage>({
    name: CORE_EXTENSIONS.CUSTOM_IMAGE,

    group: "block",

    atom: true,

    draggable: true,

    addOptions() {
      return {
        fileHandler,
        isEditable,
      };
    },

    addStorage() {
      return {
        fileMap: new Map<string, File>(),
        deletedImageSet: new Set<string>(),
        maxFileSize: fileHandler.validation.maxFileSize,
      };
    },

    addAttributes() {
      return {
        id: {
          default: null,
        },
        src: {
          default: null,
        },
        width: {
          default: "100%",
        },
        height: {
          default: "auto",
        },
        aspectRatio: {
          default: 1,
        },
        status: {
          default: "PENDING" as TImageStatus,
        },
      };
    },

    parseHTML() {
      return [
        {
          tag: `div[data-type="${CORE_EXTENSIONS.CUSTOM_IMAGE}"]`,
        },
        {
          tag: "img[src]",
          getAttrs: (dom) => {
            if (typeof dom === "string") return false;
            const element = dom as HTMLImageElement;
            return {
              src: element.getAttribute("src"),
              width: element.getAttribute("width") || "100%",
              height: element.getAttribute("height") || "auto",
            };
          },
        },
      ];
    },

    renderHTML({ HTMLAttributes }) {
      return [
        "div",
        mergeAttributes(HTMLAttributes, {
          "data-type": CORE_EXTENSIONS.CUSTOM_IMAGE,
          class: "image-component",
        }),
        [
          "img",
          {
            src: HTMLAttributes.src,
            width: HTMLAttributes.width,
            height: HTMLAttributes.height,
          },
        ],
      ];
    },

    addCommands() {
      return {
        insertImageComponent:
          (props: InsertImageComponentProps) =>
          ({ commands, state }) => {
            const { file, pos } = props;

            // Validate file if provided
            if (file) {
              if (!ACCEPTED_IMAGE_MIME_TYPES.includes(file.type)) {
                console.error("Invalid file type:", file.type);
                return false;
              }

              if (file.size > this.storage.maxFileSize) {
                console.error("File too large:", file.size);
                return false;
              }
            }

            // Generate unique ID for the image
            const id = uuidv4();

            // Store file in map if provided
            if (file) {
              this.storage.fileMap.set(id, file);
            }

            // Determine insertion position
            const insertPos = pos ?? state.selection.from;

            // Create image node attributes
            const attrs = {
              id,
              src: file ? URL.createObjectURL(file) : null,
              status: "PENDING" as TImageStatus,
            };

            return commands.insertContentAt(insertPos, {
              type: CORE_EXTENSIONS.CUSTOM_IMAGE,
              attrs,
            });
          },

        updateImageAttributes:
          (attrs) =>
          ({ tr, state }) => {
            const { selection } = state;
            const node = state.doc.nodeAt(selection.from);

            if (node?.type.name !== CORE_EXTENSIONS.CUSTOM_IMAGE) {
              return false;
            }

            tr.setNodeMarkup(selection.from, undefined, {
              ...node.attrs,
              ...attrs,
            });

            return true;
          },
      };
    },

    addKeyboardShortcuts() {
      return {
        ArrowUp: ({ editor }) => {
          const { state } = editor;
          const { selection } = state;
          const node = state.doc.nodeAt(selection.from);

          if (node?.type.name === CORE_EXTENSIONS.CUSTOM_IMAGE) {
            const pos = selection.from;
            if (pos === 0) {
              // Insert paragraph before
              return editor.commands.insertContentAt(0, { type: "paragraph" });
            }
          }
          return false;
        },
        ArrowDown: ({ editor }) => {
          const { state } = editor;
          const { selection } = state;
          const node = state.doc.nodeAt(selection.from);

          if (node?.type.name === CORE_EXTENSIONS.CUSTOM_IMAGE) {
            const pos = selection.from + node.nodeSize;
            if (pos >= state.doc.content.size) {
              // Insert paragraph after
              return editor.commands.insertContentAt(pos, { type: "paragraph" });
            }
          }
          return false;
        },
      };
    },

    addNodeView() {
      return ReactNodeViewRenderer(ImageNodeView);
    },
  });
};
