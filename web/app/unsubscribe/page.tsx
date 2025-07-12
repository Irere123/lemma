import { Metadata } from "next";
import { Suspense } from "react";
import { UnsubButton } from "@/components/newsletter/unsub-button";

export const metadata: Metadata = {
  title: "Unsubscribe",
};

export default function UnsubscribePage() {
  return (
    <Suspense fallback={null}>
      <UnsubButton />
    </Suspense>
  );
}
