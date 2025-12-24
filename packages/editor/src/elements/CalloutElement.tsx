import type { RenderElementProps } from "slate-react";
import type { Callout } from "../types";
import {
  IconInfoCircle,
  IconAlertTriangle,
  IconCircleCheck,
  IconAlertCircle,
} from "@tabler/icons-react";

const CalloutElement = (props: RenderElementProps) => {
  const { attributes, children, element } = props;
  const callout = element as Callout;
  const variant = callout.variant || "info";

  const variantStyles = {
    info: {
      bg: "bg-blue-50 dark:bg-blue-950",
      border: "border-blue-200 dark:border-blue-800",
      icon: (
        <IconInfoCircle
          className="text-blue-600 dark:text-blue-400"
          size={20}
        />
      ),
    },
    warning: {
      bg: "bg-yellow-50 dark:bg-yellow-950",
      border: "border-yellow-200 dark:border-yellow-800",
      icon: (
        <IconAlertTriangle
          className="text-yellow-600 dark:text-yellow-400"
          size={20}
        />
      ),
    },
    success: {
      bg: "bg-green-50 dark:bg-green-950",
      border: "border-green-200 dark:border-green-800",
      icon: (
        <IconCircleCheck
          className="text-green-600 dark:text-green-400"
          size={20}
        />
      ),
    },
    error: {
      bg: "bg-red-50 dark:bg-red-950",
      border: "border-red-200 dark:border-red-800",
      icon: (
        <IconAlertCircle className="text-red-600 dark:text-red-400" size={20} />
      ),
    },
  };

  const style = variantStyles[variant];

  return (
    <div
      {...attributes}
      className={`flex gap-3 p-4 my-2 rounded-lg border-l-4 ${style.bg} ${style.border}`}
    >
      <div className="flex-shrink-0 mt-0.5">{style.icon}</div>
      <div className="flex-1">{children}</div>
    </div>
  );
};

export default CalloutElement;
