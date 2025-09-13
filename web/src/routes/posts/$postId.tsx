import { createFileRoute } from "@tanstack/react-router";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

import { useTRPC } from "@/trpc/client";
import { ReadOnlyEditor } from "@/editor";

export const Route = createFileRoute("/posts/$postId")({
  loader: ({ params: { postId } }) => {
    return { postId };
  },
  component: PostDetails,
});

function PostDetails() {
  const { postId } = Route.useLoaderData();
  const trpc = useTRPC();
  const { data: post, error } = useQuery(
    trpc.documents.getDocumentById.queryOptions({ id: postId })
  );

  if (error || !post) {
    return (
      <main className="container mx-auto max-w-3xl px-6 py-10">
        <nav className="mb-6">
          <Link
            to="/posts"
            className="text-sm text-neutral-600 hover:underline"
          >
            ← Back to posts
          </Link>
        </nav>
        <div className="py-8 text-center text-gray-500">Article not found.</div>
      </main>
    );
  }

  return (
    <main className="container mx-auto max-w-3xl px-6 py-10">
      <nav className="mb-6">
        <Link to="/posts" className="text-sm text-neutral-600 hover:underline">
          ← Back to posts
        </Link>
      </nav>

      <article>
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">
            {post.title || "Untitled"}
          </h1>
          {post.subtitle && (
            <p className="text-lg text-neutral-600 mt-2">{post.subtitle}</p>
          )}
          {post.createdAt ? (
            <time
              dateTime={post.createdAt.toString()}
              className="text-xs text-neutral-500 mt-2 block"
            >
              {format(new Date(post.createdAt), "MMMM d, yyyy")}
            </time>
          ) : null}
        </header>

        <section className="prose prose-neutral max-w-none">
          <ReadOnlyEditor
            content={post.content || []}
            className="text-base leading-7"
          />
        </section>
      </article>
    </main>
  );
}
