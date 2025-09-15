import YooptaEditor, {
  createYooptaEditor,
  type YooptaContentValue,
  type YooptaEventChangePayload,
} from "@yoopta/editor";

import Paragraph from "@yoopta/paragraph";
import Blockquote from "@yoopta/blockquote";
import Embed from "@yoopta/embed";
import Image from "@yoopta/image";
import Link from "@yoopta/link";
import Callout from "@yoopta/callout";
import { NumberedList, BulletedList, TodoList } from "@yoopta/lists";
import {
  Bold,
  Italic,
  CodeMark,
  Underline,
  Strike,
  Highlight,
} from "@yoopta/marks";
import { HeadingOne, HeadingThree, HeadingTwo } from "@yoopta/headings";
import Code from "@yoopta/code";
import Table from "@yoopta/table";
import Divider from "@yoopta/divider";
import ActionMenuList, {
  DefaultActionMenuRender,
} from "@yoopta/action-menu-list";
import Toolbar, { DefaultToolbarRender } from "@yoopta/toolbar";
import LinkTool, { DefaultLinkToolRender } from "@yoopta/link-tool";

import { useEffect, useMemo, useRef, useState } from "react";
import { useDebounce } from "use-debounce";

const plugins = [
  Paragraph,
  Table,
  Divider,
  HeadingOne,
  HeadingTwo,
  HeadingThree,
  Blockquote,
  Callout,
  NumberedList,
  BulletedList,
  TodoList,
  Code,
  Link,
  Embed,
  Image.extend({
    options: {
      async onUpload(file) {
        // const data = await uploadToCloudinary(file, "image");

        return {
          src: "data.secure_url",
          alt: "cloudinary",
          sizes: {
            width: 23,
            height: 100,
          },
        };
      },
    },
  }),
];

const TOOLS = {
  ActionMenu: {
    render: DefaultActionMenuRender,
    tool: ActionMenuList,
  },
  Toolbar: {
    render: DefaultToolbarRender,
    tool: Toolbar,
  },
  LinkTool: {
    render: DefaultLinkToolRender,
    tool: LinkTool,
  },
};

const MARKS = [Bold, Italic, CodeMark, Underline, Strike, Highlight];

export function EditorSavingToDatabase() {
  const editor = useMemo(() => createYooptaEditor(), []);
  const selectionRef = useRef(null);
  const [value, setValue] = useState<YooptaContentValue>({});
  const [debouncedValue] = useDebounce(value, 1000);

  const fetchToServer = async (data: YooptaContentValue, showAlert = false) => {
    //...your async call to server
    console.log("SUBMITED DATA", data);
  };

  const onSaveToServer = async () => {
    const editorContent = editor.getEditorValue();
    await fetchToServer(editorContent, true);
  };

  function handleChange(payload: YooptaEventChangePayload) {
    console.log("DATA ON CHANGE", payload.value);
  }

  // [TODO] - UPDATE EXAMPLE
  useEffect(() => {
    editor.on("change", handleChange);
    return () => {
      editor.off("change", handleChange);
    };
  }, [editor]);

  const onChange = (newValue: YooptaContentValue) => {
    setValue(newValue);
  };

  useEffect(() => {
    fetchToServer(value);
  }, [debouncedValue]);

  return (
    <div
      className="md:py-[100px] md:pl-[200px] md:pr-[80px] px-[20px] pt-[80px] pb-[40px] flex flex-col justify-center items-center"
      ref={selectionRef}
    >
      <button
        type="button"
        onClick={onSaveToServer}
        className="bg-[#007aff] text-[14px] text-nowrap my-2 mr-0 md:mr-4 text-[#fff] max-w-[100px] px-4 py-2 rounded-md"
      >
        Save data
      </button>
      <YooptaEditor
        editor={editor}
        plugins={plugins as any}
        tools={TOOLS}
        marks={MARKS}
        selectionBoxRoot={selectionRef}
        value={value}
        onChange={onChange}
        autoFocus
      />
    </div>
  );
}
