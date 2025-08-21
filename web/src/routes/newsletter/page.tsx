import { ProfileHeader } from "@/components/landing";
import { type FormEvent, useState } from "react";
import { Link } from "react-router";

export function meta() {
  return [
    { title: "Newsletter — Irere Emmanuel" },
    {
      name: "description",
      content:
        "Subscribe to Irere Emmanuel’s newsletter for notes on edge runtimes, DX, and practical engineering.",
    },
  ] as const;
}

export default function NewsletterPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus("loading");
    try {
      // TODO: Integrate with @brain/api newsletter endpoint
      await new Promise((r) => setTimeout(r, 800));
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <ProfileHeader
        title="Newsletter"
        current="Newsletter"
        links={[
          { label: "About", to: "/" },
          { label: "Blog", to: "/posts" },
          { label: "Newsletter", to: "/newsletter" },
          { label: "GitHub", href: "https://github.com/irere123" },
        ]}
      />

      <section className="space-y-4">
        <p className="text-[15px] leading-7 text-neutral-800">
          Get occasional emails about new posts and notes on edge runtimes, DX,
          and practical engineering. No spam—unsubscribe anytime.
        </p>

        <form
          onSubmit={onSubmit}
          className="mt-2 flex flex-col sm:flex-row gap-3"
        >
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full sm:max-w-sm rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-neutral-500"
          />
          <button
            type="submit"
            disabled={status === "loading"}
            className="inline-flex items-center justify-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
          >
            {status === "loading" ? "Subscribing…" : "Subscribe"}
          </button>
        </form>

        {status === "success" ? (
          <div className="rounded-md border border-green-200 bg-green-50/60 p-3 text-sm text-neutral-800">
            Thanks! Please check your inbox to confirm the subscription.
          </div>
        ) : null}

        {status === "error" ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            Something went wrong. Please try again.
          </div>
        ) : null}

        <p className="text-xs text-neutral-500">
          By subscribing, you agree to receive emails from Irere Emmanuel.
        </p>
      </section>
    </main>
  );
}
