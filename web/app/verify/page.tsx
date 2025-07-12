"use client";

import { trpc } from "@/trpc/client";
import { useRouter, useSearchParams } from "next/navigation";

export const dynamic = "force-dynamic";

export default function VerifyPage() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") || "";
  const { isPending, mutateAsync } = trpc.newsletter.confirmation.useMutation();

  return (
    <div>
      <p>Verify email</p>
      <button
        disabled={isPending}
        onClick={async () => {
          const resp = await mutateAsync({ token });
          if (resp.success) {
            router.push("/");
          }
        }}
      >
        Verify your email brother
      </button>
    </div>
  );
}
