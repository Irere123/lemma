"use client";

import { trpc } from "@/trpc/client";
import { useState } from "react";

export default function SubscribeForm() {
  const [email, setEmail] = useState("");
  const { mutateAsync: subscribe } = trpc.newsletter.subscribe.useMutation();

  return (
    <div>
      <input
        name="email"
        placeholder="email address"
        onChange={(e) => setEmail(e.target.value)}
      />
      <button onClick={async () => await subscribe({ email })}>
        Subscribe
      </button>
    </div>
  );
}
