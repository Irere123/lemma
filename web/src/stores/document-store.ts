import type { Draft } from "immer";
import localforage from "localforage";
import { createStore, useStore } from "zustand";
import {
  createJSONStorage,
  persist,
  type StateStorage,
} from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

import {
  deleteTreeItem,
  insertTreeItem,
  toggleDocumentTreeItemCollapsed,
} from "./document-store-utils";
import { caseInsensitiveStringEqual } from "@/lib/utils";

localforage.config({
  name: "irere.dev",
  version: 1.0,
  storeName: "user_data",
});

const storage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return await localforage.getItem(name);
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await localforage.setItem(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await localforage.removeItem(name);
  },
};

type FunctionPropertyNames<T> = {
  [K in keyof T]: T[K] extends Function ? K : never;
}[keyof T];
type StoreWithoutFunctions = Omit<Store, FunctionPropertyNames<Store>>;

export type Setter<T> = (value: T | ((value: T) => T)) => void;
export type CreateSetter = <K extends keyof StoreWithoutFunctions>(
  set: (fn: (draft: Draft<Store>) => void) => void,
  key: K
) => (value: Store[K] | ((value: Store[K]) => Store[K])) => void;

/**
 * Helper function that constructs a setter function.
 */
export const createSetter: CreateSetter = (set, key) => (value) => {
  if (typeof value === "function") {
    set((state) => {
      state[key] = value(state[key]);
    });
  } else {
    set((state) => {
      state[key] = value;
    });
  }
};

export type Document = {
  id: string;
  title: string;
  subtitle: string;
  content: string;
};

export type Documents = Record<Document["id"], Document>;

export type DocumentTreeItem = {
  id: Document["id"];
  children: DocumentTreeItem[];
  collapsed: boolean;
};

export type Store = {
  documents: Documents;
  setDocuments: Setter<Documents>;
  upsertDocument: (docuemnt: Document) => void;
  deleteDocument: (documentId: string) => void;
  documentTree: DocumentTreeItem[];
  openDocumentIds: string[];
  setDocumentTree: Setter<DocumentTreeItem[]>;
  moveDocumentTreeItem: (
    documentId: string,
    newParentDocumentId: string | null
  ) => void;
  toggleDocumentTreeItemCollapsed: (documentId: string) => void;
};

export const documentStore = createStore<Store>()(
  persist(
    immer((set) => ({
      /**
       * Map of document id to documents
       */
      documents: {},
      /**
       * Sets the documents
       */
      setDocuments: createSetter(set, "documents"),
      /**
       * If the document id exists, then update the document. Otherwise, insert it
       */
      upsertDocument: (document: Document) => {
        set((state) => {
          if (state.documents[document.id]) {
            state.documents[document.id] = {
              ...state.documents[document.id],
              ...document,
            };
          } else {
            const existingdocument = Object.values(state.documents).find((n) =>
              caseInsensitiveStringEqual(n.title, document.title)
            );
            if (existingdocument) {
              // Update existing document
              state.documents[existingdocument.id] = {
                ...state.documents[existingdocument.id],
                ...document,
              };
            } else {
              // Insert new document
              state.documents[document.id] = document;
              insertTreeItem(
                state.documentTree,
                { id: document.id, children: [], collapsed: true },
                null
              );
            }
          }
        });
      },
      /**
       * Delete the document with the given documentId
       */
      deleteDocument: (documentId: string) => {
        set((state) => {
          delete state.documents[documentId];
          const item = deleteTreeItem(state.documentTree, documentId);
          if (item && item.children.length > 0) {
            for (const child of item.children) {
              insertTreeItem(state.documentTree, child, null);
            }
          }
        });
      },
      /**
       * The documents that have their content visible, including the main document and the stacked documents
       */
      openDocumentIds: [],
      /**
       * The tree of documents visible in the sidebar
       */
      documentTree: [],
      setDocumentTree: createSetter(set, "documentTree"),
      /**
       * Moves the tree item with the given documentId to the given newParentDocumentId's children
       */
      moveDocumentTreeItem: (
        documentId: string,
        newParentDocumentId: string | null
      ) => {
        // Don't do anything if the document ids are the same
        if (documentId === newParentDocumentId) {
          return;
        }
        set((state) => {
          const item = deleteTreeItem(state.documentTree, documentId);
          if (item) {
            insertTreeItem(state.documentTree, item, newParentDocumentId);
          }
        });
      },
      /**
       * Expands or collapses the tree item with the given documentId
       */
      toggleDocumentTreeItemCollapsed: (documentId: string) => {
        set((state) => {
          toggleDocumentTreeItemCollapsed(state.documentTree, documentId);
        });
      },
    })),
    {
      name: "document-storage",
      version: 1,
      storage: createJSONStorage(() => storage),
      partialize: (state) => ({
        opendocumentIds: state.openDocumentIds,
      }),
    }
  )
);

const useBoundStore = <T>(selector: (state: Store) => T) =>
  useStore(documentStore, selector);

export { useBoundStore as useDocumentStore };
