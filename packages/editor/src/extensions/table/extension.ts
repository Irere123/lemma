import { Extension } from "@tiptap/core";
import Table from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";

export type TableExtensionOptions = {
  resizable: boolean;
  handleWidth: number;
  cellMinWidth: number;
  lastColumnResizable: boolean;
  allowTableNodeSelection: boolean;
};

export const TableExtension = (options?: Partial<TableExtensionOptions>) => {
  const defaultOptions: TableExtensionOptions = {
    resizable: true,
    handleWidth: 5,
    cellMinWidth: 100,
    lastColumnResizable: true,
    allowTableNodeSelection: true,
  };

  const mergedOptions = { ...defaultOptions, ...options };

  return Extension.create({
    name: "tableGroup",

    addExtensions() {
      return [
        Table.configure({
          resizable: mergedOptions.resizable,
          handleWidth: mergedOptions.handleWidth,
          cellMinWidth: mergedOptions.cellMinWidth,
          lastColumnResizable: mergedOptions.lastColumnResizable,
          allowTableNodeSelection: mergedOptions.allowTableNodeSelection,
          HTMLAttributes: {
            class: "editor-table",
          },
        }),
        TableRow.configure({
          HTMLAttributes: {
            class: "editor-table-row",
          },
        }),
        TableCell.configure({
          HTMLAttributes: {
            class: "editor-table-cell",
          },
        }),
        TableHeader.configure({
          HTMLAttributes: {
            class: "editor-table-header",
          },
        }),
      ];
    },
  });
};
