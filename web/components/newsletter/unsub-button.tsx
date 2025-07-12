"use client";

import { trpc } from "@/trpc/client";
import { useRouter, useSearchParams } from "next/navigation";

export function UnsubButton() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") || "";
  const { isPending, mutateAsync } = trpc.newsletter.unsubscribe.useMutation();
  return (
    <button
      disabled={isPending}
      onClick={async () => {
        const resp = await mutateAsync({ token });
        if (resp.success) {
          router.push("/archive");
        }
      }}
    >
      Confirm
    </button>
  );
}
