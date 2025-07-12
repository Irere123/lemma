import { Metadata } from "next";
import { Suspense } from "react";
import { VerifyButton } from "@/components/newsletter/verify-button";

export const metadata: Metadata = {
  title: "Verification",
};

export default function VerifyPage() {
  return (
    <Suspense fallback={null}>
      <VerifyButton />
    </Suspense>
  );
}
