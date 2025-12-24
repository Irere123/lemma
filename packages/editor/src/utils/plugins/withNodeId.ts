/*
The following was modified from the source code of plate.

The MIT License (MIT)

Ziad Beyens
Dylan Schiemann
Luke Murray
Ian Storm Taylor

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/
import { Element, type Descendant, Node, Editor } from "slate";
import { v4 as uuidv4 } from "uuid";

export const createNodeId = () => uuidv4();

const recursivelySetIds = (node: Node): Node => {
  const newNode = { ...node };
  if (Element.isElement(newNode)) {
    if (!newNode.id) {
      newNode.id = createNodeId();
    }

    const newChildren = newNode.children.map<Descendant>(
      (child) => recursivelySetIds(child) as Descendant
    );
    newNode.children = newChildren;
  }
  return newNode;
};

export const isPartialElement = (node: any): node is Partial<Element> => {
  return node.type !== undefined;
};

const withNodeId = (editor: Editor): Editor => {
  const { apply } = editor;

  editor.apply = (operation) => {
    if (operation.type === "insert_node") {
      let node = operation.node;

      // delete node id if the node is an element and it has a duplicate id
      if (!Editor.isEditor(node) && Element.isElement(node) && node.id) {
        // id will be set later, ignore this error
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        node = { ...node, id: undefined };
      }

      // recursively set ids for children, if they don't have an id
      node = recursivelySetIds(node);

      return apply({
        ...operation,
        node,
      });
    }

    if (operation.type === "split_node") {
      const node = operation.properties;

      if (isPartialElement(node)) {
        let id = node.id;

        /**
         * Create a new id if:
         * - the node has no id, or
         * - the id in the new node is already being used
         */
        if (!id) {
          id = createNodeId();
        }

        return apply({
          ...operation,
          properties: {
            ...node,
            id,
          },
        });
      }
    }

    return apply(operation);
  };

  return editor;
};

export default withNodeId;
