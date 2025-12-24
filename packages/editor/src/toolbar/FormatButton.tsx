import { type HTMLAttributes, type ComponentType, memo } from "react";
import { useSlate } from "slate-react";

import ToolbarButton from "./ToolbarButton";
import type { Mark } from "../types";
import { isMarkActive, toggleMark } from "../utils/formatting";

type IconProps = {
  size?: number;
  className?: string;
};

interface FormatButtonProps
  extends Omit<HTMLAttributes<HTMLSpanElement>, "onClick"> {
  format: Mark;
  Icon: ComponentType<IconProps>;
  tooltip?: string;
  className?: string;
}

const FormatButton = (props: FormatButtonProps) => {
  const { format, Icon, tooltip, className, ...otherProps } = props;
  const editor = useSlate();
  const isActive = isMarkActive(editor, format);

  return (
    <ToolbarButton
      icon={Icon}
      onClick={() => toggleMark(editor, format)}
      isActive={isActive}
      className={className}
      tooltip={tooltip}
      {...otherProps}
    />
  );
};

export default memo(FormatButton);
