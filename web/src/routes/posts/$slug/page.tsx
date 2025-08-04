import { Link, useParams } from "react-router";

type Post = {
  slug: string;
  title: string;
  content: string;
  date?: string;
};

const MOCK_POSTS: Post[] = [
  {
    slug: "introducing-brain",
    title: "Introducing Brain",
    content:
      "Welcome to Brain. This is a minimal article page demonstrating SSR-friendly routing with React Router 7 and a clean blog style.",
    date: "2025-08-01",
  },
  {
    slug: "building-with-workers",
    title: "Building with Cloudflare Workers",
    content:
      "Cloudflare Workers enable edge-first architectures. Pair with React Router data APIs for fast, reliable UX.",
    date: "2025-08-03",
  },
];

export async function loader({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const post = MOCK_POSTS.find((p) => p.slug === slug);

  if (!post) {
    throw new Response("Not Found", { status: 404 });
  }

  return { post };
}

export function meta({ data }: { data?: { post?: Post } }) {
  const post = data?.post;
  if (!post) return [{ title: "Article — Not found" } as const];

  return [
    { title: `${post.title} — Irere Emmanuel` },
    {
      name: "description",
      content: post.content.slice(0, 140),
    },
  ] as const;
}

export default function PostDetails({
  loaderData,
}: {
  loaderData: { post: Post };
}) {
  const { slug } = useParams();
  const { post } = loaderData;

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
            {post.title}
          </h1>
          {post.date ? (
            <time
              dateTime={post.date}
              className="text-xs text-neutral-500 mt-1 block"
            >
              {new Date(post.date).toLocaleDateString()}
            </time>
          ) : null}
        </header>

        <section className="prose prose-neutral max-w-none">
          <p>{post.content}</p>
        </section>

        <footer className="mt-10 border-t pt-6 text-sm text-neutral-500">
          <p>Slug: {slug}</p>
        </footer>
      </article>
    </main>
  );
}
