import {
  inputRules,
  wrappingInputRule,
  textblockTypeInputRule,
  InputRule,
} from "prosemirror-inputrules";
import type { NodeType, MarkType, Schema } from "prosemirror-model";
import type { Plugin } from "prosemirror-state";
import { schema, createNodeId } from "../schema";

/**
 * Creates an input rule for inline marks (e.g., **bold**)
 */
function markInputRule(
  regexp: RegExp,
  markType: MarkType,
  getAttrs?: (match: RegExpMatchArray) => Record<string, any> | null
): InputRule {
  return new InputRule(regexp, (state, match, start, end) => {
    const attrs = getAttrs ? getAttrs(match) : {};
    const tr = state.tr;

    if (match[1]) {
      const textStart = start + match[0].indexOf(match[1]);
      const textEnd = textStart + match[1].length;

      if (textEnd < end) {
        tr.delete(textEnd, end);
      }
      if (textStart > start) {
        tr.delete(start, textStart);
      }

      const markEnd = start + match[1].length;
      tr.addMark(start, markEnd, markType.create(attrs));
    }

    return tr;
  });
}

/**
 * Heading input rules (# Heading)
 */
function headingInputRules(nodeType: NodeType): InputRule[] {
  return [
    textblockTypeInputRule(/^#\s$/, nodeType, { level: 1, id: createNodeId() }),
    textblockTypeInputRule(/^##\s$/, nodeType, { level: 2, id: createNodeId() }),
    textblockTypeInputRule(/^###\s$/, nodeType, { level: 3, id: createNodeId() }),
    textblockTypeInputRule(/^####\s$/, nodeType, { level: 4, id: createNodeId() }),
  ];
}

/**
 * Bullet list input rule (- or * at start)
 */
function bulletListInputRule(nodeType: NodeType): InputRule {
  return wrappingInputRule(/^\s*[-*]\s$/, nodeType, () => ({ id: createNodeId() }));
}

/**
 * Ordered list input rule (1. at start)
 */
function orderedListInputRule(nodeType: NodeType): InputRule {
  return wrappingInputRule(
    /^\s*(\d+)\.\s$/,
    nodeType,
    (match) => ({ start: +match[1], id: createNodeId() }),
    (match, node) => node.childCount + node.attrs.start === +match[1]
  );
}

/**
 * Task list input rule ([ ] or [x] at start)
 */
function taskListInputRule(nodeType: NodeType, taskItemType: NodeType): InputRule {
  return new InputRule(/^\s*\[([ x])\]\s$/, (state, match, start, end) => {
    const checked = match[1] === "x";
    const tr = state.tr.delete(start, end);

    // Create task item with paragraph inside
    const taskItem = taskItemType.create(
      { checked, id: createNodeId() },
      state.schema.nodes.paragraph.create({ id: createNodeId() })
    );

    // Create task list with the task item
    const taskList = nodeType.create({ id: createNodeId() }, taskItem);

    tr.replaceWith(start, start, taskList);
    return tr;
  });
}

/**
 * Blockquote input rule (> at start)
 */
function blockquoteInputRule(nodeType: NodeType): InputRule {
  return wrappingInputRule(/^\s*>\s$/, nodeType, () => ({ id: createNodeId() }));
}

/**
 * Code block input rule (``` at start)
 */
function codeBlockInputRule(nodeType: NodeType): InputRule {
  return textblockTypeInputRule(/^```(\w+)?\s$/, nodeType, (match) => ({
    language: match[1] || null,
    id: createNodeId(),
  }));
}

/**
 * Divider input rule (--- or *** at start)
 */
function dividerInputRule(nodeType: NodeType): InputRule {
  return new InputRule(/^(?:---|\*\*\*|___)\s$/, (state, _match, start, end) => {
    const tr = state.tr;
    const divider = nodeType.create({ id: createNodeId() });

    // Replace the trigger text with divider
    tr.replaceWith(start - 1, end, divider);

    // Insert a new paragraph after
    const paragraph = state.schema.nodes.paragraph.create({ id: createNodeId() });
    tr.insert(tr.mapping.map(end), paragraph);

    return tr;
  });
}

/**
 * Bold input rule (**text** or __text__)
 */
function boldInputRule(markType: MarkType): InputRule {
  return markInputRule(/(?:\*\*|__)([^*_]+)(?:\*\*|__)$/, markType);
}

/**
 * Italic input rule (*text* or _text_)
 */
function italicInputRule(markType: MarkType): InputRule {
  return markInputRule(/(?:^|[^*_])(?:\*|_)([^*_]+)(?:\*|_)$/, markType);
}

/**
 * Strikethrough input rule (~~text~~)
 */
function strikethroughInputRule(markType: MarkType): InputRule {
  return markInputRule(/~~([^~]+)~~$/, markType);
}

/**
 * Inline code input rule (`code`)
 */
function codeInputRule(markType: MarkType): InputRule {
  return markInputRule(/`([^`]+)`$/, markType);
}

/**
 * Creates all input rules for the editor
 */
export function createInputRules(s: Schema = schema): Plugin {
  const rules: InputRule[] = [];

  // Block input rules
  if (s.nodes.heading) {
    rules.push(...headingInputRules(s.nodes.heading));
  }

  if (s.nodes.bulletList) {
    rules.push(bulletListInputRule(s.nodes.bulletList));
  }

  if (s.nodes.orderedList) {
    rules.push(orderedListInputRule(s.nodes.orderedList));
  }

  if (s.nodes.taskList && s.nodes.taskItem) {
    rules.push(taskListInputRule(s.nodes.taskList, s.nodes.taskItem));
  }

  if (s.nodes.blockquote) {
    rules.push(blockquoteInputRule(s.nodes.blockquote));
  }

  if (s.nodes.codeBlock) {
    rules.push(codeBlockInputRule(s.nodes.codeBlock));
  }

  if (s.nodes.divider) {
    rules.push(dividerInputRule(s.nodes.divider));
  }

  // Mark input rules
  if (s.marks.bold) {
    rules.push(boldInputRule(s.marks.bold));
  }

  if (s.marks.italic) {
    rules.push(italicInputRule(s.marks.italic));
  }

  if (s.marks.strikethrough) {
    rules.push(strikethroughInputRule(s.marks.strikethrough));
  }

  if (s.marks.code) {
    rules.push(codeInputRule(s.marks.code));
  }

  return inputRules({ rules });
}
