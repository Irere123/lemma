import type { DocumentTreeItem } from "./document-store";

/**
 * Deletes the tree item with the given id and returns it.
 */
export const deleteTreeItem = (
  tree: DocumentTreeItem[],
  id: string
): DocumentTreeItem | null => {
  for (let i = 0; i < tree.length; i++) {
    const item = tree[i];
    if (item.id === id) {
      tree.splice(i, 1);
      return item;
    } else if (item.children.length > 0) {
      const result = deleteTreeItem(item.children, id);
      if (result) {
        return result;
      }
    }
  }
  return null;
};

/**
 * Inserts the given item into the tree as a child of the item with targetId, and returns true if it was inserted.
 * If targetId is null, inserts the item into the root level.
 */
export const insertTreeItem = (
  tree: DocumentTreeItem[],
  item: DocumentTreeItem,
  targetId: string | null
): boolean => {
  if (targetId === null) {
    tree.push(item);
    return true;
  }

  for (let i = 0; i < tree.length; i++) {
    const treeItem = tree[i];
    if (treeItem.id === targetId) {
      tree[i].children.push(item);
      return true;
    } else if (treeItem.children.length > 0) {
      const result = insertTreeItem(treeItem.children, item, targetId);
      if (result) {
        return result;
      }
    }
  }
  return false;
};

/**
 * Expands or collapses the tree item with the given id, and returns true if it was updated.
 */
export const toggleDocumentTreeItemCollapsed = (
  tree: DocumentTreeItem[],
  id: string
): boolean => {
  for (let i = 0; i < tree.length; i++) {
    const item = tree[i];
    if (item.id === id) {
      tree[i] = { ...item, collapsed: !item.collapsed };
      return true;
    } else if (item.children.length > 0) {
      const result = toggleDocumentTreeItemCollapsed(item.children, id);
      if (result) {
        return result;
      }
    }
  }
  return false;
};

/**
 * Gets the document tree item corresponding to the given noteId.
 */
export const getDocumentTreeItem = (
  tree: DocumentTreeItem[],
  id: string
): DocumentTreeItem | null => {
  for (let i = 0; i < tree.length; i++) {
    const item = tree[i];
    if (item.id === id) {
      return item;
    } else if (item.children.length > 0) {
      const result = getDocumentTreeItem(item.children, id);
      if (result) {
        return result;
      }
    }
  }
  return null;
};
