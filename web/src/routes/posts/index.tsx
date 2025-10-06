import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";

import { DateText, ListItem, ProfileHeader } from "@/components/landing";
import { useTRPC } from "@/trpc/client";

export const Route = createFileRoute("/posts/")({
  component: RouteComponent,
  loader: async ({ context }) => {
    // This is a public route, no authentication needed
    if (typeof window === "undefined") {
      const { serverPrefetch } = await import("@/trpc/server");

      // Get the request from context for cookie forwarding
      const request = (context as any)?.request as Request | undefined;

      await serverPrefetch({
        request,
        queryKey: [
          ["documents", "getAdminPublishedArticles"],
          { input: undefined, type: "query" },
        ],
        fetchFn: (client) => client.documents.getAdminPublishedArticles.query(),
      });
    }
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
      </div>
    </main>
  );
}
