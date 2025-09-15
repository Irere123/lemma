import { Link, useNavigate } from "react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { format } from "date-fns";

import { prefetch } from "@/trpc/server";
import { trpc } from "@/trpc/server";
import { useTRPC } from "@/trpc/client";
import { ReadOnlyEditor } from "@/editor";
import type { Route } from "./+types/page";

export function meta() {
  return [
    { title: "Blog — Irere Emmanuel" },
    {
      name: "description",
      content:
        "Writing by Irere Emmanuel on edge runtimes, DX, and practical engineering.",
    },
  ] as const;
}

export async function loader({ params }: Route.LoaderArgs) {
  const { postId } = params;

  prefetch(trpc.documents.getDocumentById.queryOptions({ id: postId }));

  return { postId };
}

export default function PostDetails({ loaderData }: Route.ComponentProps) {
  const trpc = useTRPC();
  const navigate = useNavigate();
  const { data: post, error } = useSuspenseQuery(
    trpc.documents.getDocumentById.queryOptions({ id: loaderData.postId })
  );

  if (error || !post) {
    navigate("/posts");
    return null;
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
