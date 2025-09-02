import { IconCheck, IconCopy } from "@tabler/icons-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { useCopyToClipboard } from "usehooks-ts";

import { cn } from "@/lib/utils";

type Props = {
  value: string;
  className?: string;
};

export function CopyInput({ value, className }: Props) {
  const [isCopied, setCopied] = useState(false);
  const [, copy] = useCopyToClipboard();

  const handleClipboard = () => {
    setCopied(true);

    copy(value);

    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  return (
    <button
      type="button"
      onClick={handleClipboard}
      className={cn(
        "flex items-center relative w-full border py-2 px-4 cursor-pointer",
        className
      )}
    >
      <div className="pr-8 text-[#878787] text-sm truncate">{value}</div>

      <motion.div
        className="absolute right-4 top-2.5"
        initial={{ opacity: 1, scale: 1 }}
        animate={{ opacity: isCopied ? 0 : 1, scale: isCopied ? 0 : 1 }}
      >
        <IconCopy />
      </motion.div>

      <motion.div
        className="absolute right-4 top-2.5"
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: isCopied ? 1 : 0, scale: isCopied ? 1 : 0 }}
      >
        <IconCheck />
      </motion.div>
    </button>
  );
}
