import { ProfileHeader, DateText, TagPill, ListItem } from "@/components/ui";

type Post = {
  slug: string;
  title: string;
  excerpt?: string;
  date?: string;
  tags?: string[];
};

export async function loader() {
  // TODO: Replace with real fetch to @brain/api
  const posts: Post[] = [
    {
      slug: "edge-ssr-react-router",
      title: "Edge-first SSR with React Router 7",
      excerpt:
        "Designing a minimal stack for blogs and docs using Workers, Vite, and React Router's data APIs.",
      date: "2025-08-03",
      tags: ["edge", "react-router", "workers"],
    },
    {
      slug: "content-and-editors",
      title: "Notes on content systems and editors",
      excerpt:
        "Thoughts on structured content, Yoopta blocks, and pragmatic authoring UX.",
      date: "2025-07-28",
      tags: ["dx", "content", "yoopta"],
    },
  ];

  return { posts };
}

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

export default function PostsIndex({
  loaderData,
}: {
  loaderData: { posts: Post[] };
}) {
  const { posts } = loaderData;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <ProfileHeader
        title="Blog"
        current="Blog"
        links={[
          { label: "About", to: "/" },
          { label: "Blog", to: "/posts" },
          { label: "Notes", to: "/notes" },
          { label: "Newsletter", to: "/newsletter" },
          { label: "GitHub", href: "https://github.com/ireredev" },
        ]}
      />

      <ul className="divide-y divide-neutral-200">
        {posts.map((p) => (
          <li key={p.slug} className="py-4">
            <ListItem to={`/posts/${p.slug}`} left={<DateText date={p.date} />}>
              <h2 className="text-[16px] font-medium leading-6 hover:underline">
                {p.title}
              </h2>
              {p.excerpt ? (
                <p className="text-sm text-neutral-600 mt-1">{p.excerpt}</p>
              ) : null}
              {p.tags && p.tags.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {p.tags.map((t) => (
                    <TagPill key={t}>{t}</TagPill>
                  ))}
                </div>
              ) : null}
            </ListItem>
          </li>
        ))}
      </ul>
    </main>
  );
}
