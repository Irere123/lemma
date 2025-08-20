import type { ReactNode } from "react";
import type { RenderElementProps } from "slate-react";

import Tooltip from "../ui/Tooltip";
import type { ExternalLink } from "../types";
import { classnames } from "../utils/classnames";

type ExternalLinkElementProps = {
  element: ExternalLink;
  children: ReactNode;
  attributes: RenderElementProps["attributes"];
  className?: string;
};

export default function ExternalLinkElement(props: ExternalLinkElementProps) {
  const { element, children, attributes, className } = props;
  const linkClassName = classnames(`link hover:underline`, className);

  return (
    <Tooltip
      content={<span className="break-words">{element.url}</span>}
      placement="bottom-start"
    >
      <a
        className={linkClassName}
        href={element.url}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          window.open(element.url, "_blank", "noopener noreferrer");
        }}
        {...attributes}
      >
        {children}
      </a>
    </Tooltip>
  );
}
