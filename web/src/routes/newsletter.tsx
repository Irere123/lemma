import { createFileRoute } from "@tanstack/react-router";

import { ProfileHeader } from "@/components/landing";
import { NewsletterSubscribeForm } from "@/components/newsletter-subscribe-form";

export const Route = createFileRoute("/newsletter")({
  component: RouteComponent,
  head: () => {
    return { meta: [{ title: "Newsletter" }] };
  },
});

function RouteComponent() {
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

      <section className="space-y-6">
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-900">
            Subscribe to the Newsletter
          </h2>
          <p className="text-[15px] leading-7 text-neutral-800">
            Get occasional emails about new posts and notes on edge runtimes,
            DX, and practical engineering. No spam—unsubscribe anytime.
          </p>
        </div>

        <NewsletterSubscribeForm
          variant="card"
          title="Join the Community"
          description="Be the first to know when new articles are published. Plus, get exclusive content and updates."
        />

        <div className="space-y-3 pt-4">
          <h3 className="text-lg font-semibold text-gray-900">
            What you'll get:
          </h3>
          <ul className="space-y-2 text-sm text-neutral-700">
            <li className="flex items-start gap-2">
              <span className="text-purple-600 mt-1">✓</span>
              <span>Weekly or bi-weekly updates on new articles and posts</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600 mt-1">✓</span>
              <span>
                Exclusive insights and deep dives into technical topics
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600 mt-1">✓</span>
              <span>Early access to new projects and experiments</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600 mt-1">✓</span>
              <span>Behind-the-scenes content and development stories</span>
            </li>
          </ul>
        </div>

        <p className="text-xs text-neutral-500 border-t pt-4">
          By subscribing, you agree to receive emails from Irere Emmanuel. You
          can unsubscribe at any time using the link in the email footer.
        </p>
      </section>
    </main>
  );
}
