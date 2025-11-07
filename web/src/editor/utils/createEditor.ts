import { withReact } from "slate-react";
import { withHistory } from "slate-history";
import { createEditor } from "slate";

import withNormalization from "./plugins/withNormalization";
import withCustomDeleteBackward from "./plugins/withCustomDeleteBackward";
import withVoidElements from "./plugins/withVoidElements";
import withTags from "./plugins/withTags";
import withHtml from "./plugins/withHtml";
import withNodeId from "./plugins/withNodeId";
import withAutoMarkdown from "./plugins/withAutoMarkdown";
import withBlockBreakout from "./plugins/withBlockBreakout";
import withLinks from "./plugins/withLinks";
import withImages from "./plugins/withImages";

const createCustomEditor = () =>
  withNormalization(
    withCustomDeleteBackward(
      withAutoMarkdown(
        withHtml(
          withImages(
            withBlockBreakout(
              withVoidElements(
                withTags(
                  withLinks(withNodeId(withHistory(withReact(createEditor()))))
                )
              )
            )
          )
        )
      )
    )
  );
export default createCustomEditor;
