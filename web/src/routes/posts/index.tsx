import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";

import { DateText, ListItem, ProfileHeader } from "@/components/landing";
import { NewsletterSubscribeForm } from "@/components/newsletter-subscribe-form";
import { useTRPC } from "@/trpc/client";
import { prefetch, trpc } from "@/trpc/server";

export const Route = createFileRoute("/posts/")({
  component: RouteComponent,
  loader: () => {
    prefetch(trpc.documents.getAdminPublishedArticles.queryOptions());
  },
});

function RouteComponent() {
  const trpc = useTRPC();
  const { data: posts } = useSuspenseQuery(
    trpc.documents.getAdminPublishedArticles.queryOptions()
  );

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <ProfileHeader
        title="Blog"
        current="Blog"
        links={[
          { label: "About", to: "/" },
          { label: "Blog", to: "/posts" },
          { label: "Newsletter", to: "/newsletter" },
          { label: "GitHub", href: "https://github.com/irere123" },
        ]}
      />

      <div className="space-y-8">
        {!posts || posts.length === 0 ? (
          <div className="py-8 text-center text-gray-500">
            No published articles yet.
          </div>
        ) : (
          <ul className="divide-y divide-neutral-200">
            {posts.map((post) => (
              <li key={post.id} className="py-4">
                <ListItem
                  to={`/posts/${post.id}`}
                  left={
                    <DateText
                      date={
                        post.createdAt
                          ? format(new Date(post.createdAt), "yyyy-MM-dd")
                          : undefined
                      }
                    />
                  }
                >
                  <h2 className="text-[16px] font-medium leading-6 hover:underline">
                    {post.title || "Untitled"}
                  </h2>
                  {post.subtitle ? (
                    <p className="text-sm text-neutral-600 mt-1">
                      {post.subtitle}
                    </p>
                  ) : null}
                </ListItem>
              </li>
            ))}
          </ul>
        )}

        {/* Newsletter Subscription */}
        <div className="pt-8 border-t border-neutral-200">
          <NewsletterSubscribeForm
            variant="card"
            title="Never Miss an Update"
            description="Subscribe to get notified when new articles are published."
          />
        </div>
      </div>
    </main>
  );
}
