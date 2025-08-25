import { useMemo } from "react";
import { Editable, Slate } from "slate-react";
import { type Descendant } from "slate";

import withVerticalSpacing from "./elements/withVerticalSpacing";
import EditorLeaf from "./elements/EditorLeaf";
import EditorElement from "./elements/EditorElement";
import { getDefaultEditorValue } from "./utils/constants";
import createCustomEditor from "./utils/createEditor";

type Props = {
    content: Descendant[];
    className?: string;
};

export default function ReadOnlyEditor({ content, className = "" }: Props) {
    const editor = useMemo(() => createCustomEditor(), []);
    const value = useMemo(() => {
        if (!content || content.length === 0) {
            return getDefaultEditorValue();
        }
        return content;
    }, [content]);

    const renderElement = useMemo(() => {
        return withVerticalSpacing(EditorElement);
    }, []);

    return (
        <Slate editor={editor} initialValue={value} onChange={() => { }}>
            <Editable
                className={`overflow-hidden focus:outline-none ${className}`}
                renderElement={renderElement}
                renderLeaf={EditorLeaf}
                readOnly
            />
        </Slate>
    );
}