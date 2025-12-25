import { toggleMark } from "prosemirror-commands";
import type { EditorState, Transaction } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import type { MarkType } from "prosemirror-model";
import { schema } from "../schema";

type Command = (
  state: EditorState,
  dispatch?: (tr: Transaction) => void,
  view?: EditorView
) => boolean;

/**
 * Toggle bold mark
 */
export const toggleBold: Command = (state, dispatch, view) => {
  return toggleMark(schema.marks.bold)(state, dispatch, view);
};

/**
 * Toggle italic mark
 */
export const toggleItalic: Command = (state, dispatch, view) => {
  return toggleMark(schema.marks.italic)(state, dispatch, view);
};

/**
 * Toggle underline mark
 */
export const toggleUnderline: Command = (state, dispatch, view) => {
  return toggleMark(schema.marks.underline)(state, dispatch, view);
};

/**
 * Toggle strikethrough mark
 */
export const toggleStrikethrough: Command = (state, dispatch, view) => {
  return toggleMark(schema.marks.strikethrough)(state, dispatch, view);
};

/**
 * Toggle inline code mark
 */
export const toggleCode: Command = (state, dispatch, view) => {
  return toggleMark(schema.marks.code)(state, dispatch, view);
};

/**
 * Toggle highlight mark
 */
export const toggleHighlight: Command = (state, dispatch, view) => {
  return toggleMark(schema.marks.highlight)(state, dispatch, view);
};

/**
 * Check if a mark is active in the current selection
 */
export function isMarkActive(state: EditorState, markType: MarkType): boolean {
  const { from, $from, to, empty } = state.selection;

  if (empty) {
    return !!markType.isInSet(state.storedMarks || $from.marks());
  }

  return state.doc.rangeHasMark(from, to, markType);
}

/**
 * Set a link mark on the current selection
 */
export function setLink(href: string, title?: string): Command {
  return (state, dispatch) => {
    const { from, to, empty } = state.selection;

    if (empty) {
      return false;
    }

    if (dispatch) {
      const mark = schema.marks.link.create({ href, title });
      const tr = state.tr.addMark(from, to, mark);
      dispatch(tr);
    }

    return true;
  };
}

/**
 * Remove link mark from selection
 */
export const removeLink: Command = (state, dispatch) => {
  const { from, to } = state.selection;

  if (dispatch) {
    const tr = state.tr.removeMark(from, to, schema.marks.link);
    dispatch(tr);
  }

  return true;
};

/**
 * Set a tag mark
 */
export function setTag(name: string): Command {
  return (state, dispatch) => {
    const { from, to, empty } = state.selection;

    if (empty) {
      return false;
    }

    if (dispatch) {
      const mark = schema.marks.tag.create({ name });
      const tr = state.tr.addMark(from, to, mark);
      dispatch(tr);
    }

    return true;
  };
}

/**
 * Set a note link mark
 */
export function setNoteLink(noteId: string, noteTitle: string, customText?: string): Command {
  return (state, dispatch) => {
    const { from, to, empty } = state.selection;

    if (empty) {
      return false;
    }

    if (dispatch) {
      const mark = schema.marks.noteLink.create({ noteId, noteTitle, customText });
      const tr = state.tr.addMark(from, to, mark);
      dispatch(tr);
    }

    return true;
  };
}
