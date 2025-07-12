import { UnsubButton } from "@/components/newsletter/unsub-button";
import { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Unsubscribe",
};

export default function UnsubscribePage() {
  return <UnsubButton />;
}
