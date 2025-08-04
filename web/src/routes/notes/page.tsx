import { Link } from "react-router";

type Note = {
  id: string;
  title: string;
  snippet?: string;
  date?: string;
  tags?: string[];
};

export function meta() {
  return [
    { title: "Notes — Irere Emmanuel" },
    {
      name: "description",
      content:
        "Short, work-in-progress notes by Irere Emmanuel on engineering, DX, and the edge.",
    },
  ] as const;
}

export async function loader() {
  // TODO: Replace with real fetch to @brain/api when ready
  const notes: Note[] = [
    {
      id: "edge-routing-checklist",
      title: "Edge routing checklist",
      snippet:
        "Small reminders for React Router + Workers deployments: SSR fallbacks, headers, and caching.",
      date: "2025-08-04",
      tags: ["edge", "routing"],
    },
    {
      id: "yoopta-blocks",
      title: "Yoopta blocks I keep around",
      snippet:
        "Paragraph, Headings, Lists, Code, Image — and a few defaults I toggle on/off.",
      date: "2025-08-02",
      tags: ["yoopta", "content"],
    },
    {
      id: "vite-ssr-notes",
      title: "Vite SSR notes",
      snippet:
        "Quick pointers on Vite + Workers integration and environment APIs.",
      date: "2025-07-30",
      tags: ["vite", "workers"],
    },
  ];

  return { notes };
}

export default function NotesIndex({
  loaderData,
}: {
  loaderData: { notes: Note[] };
}) {
  const { notes } = loaderData;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-6">
        <div className="flex items-center gap-4">
          <img
            src="/favicon.ico"
            alt="Irere Emmanuel"
            className="h-8 w-8 rounded-full ring-1 ring-neutral-200"
          />
          <h1 className="text-2xl font-semibold tracking-tight">Notes</h1>
        </div>
        <nav className="mt-2 text-sm text-neutral-600 flex gap-6">
          <Link to="/" className="hover:underline underline-offset-4">
            About
          </Link>
          <Link to="/posts" className="hover:underline underline-offset-4">
            Blog
          </Link>
          <span className="underline underline-offset-4">Notes</span>
          <Link to="/newsletter" className="hover:underline underline-offset-4">
            Newsletter
          </Link>
          <a
            href="https://github.com/ireredev"
            target="_blank"
            rel="noreferrer"
            className="hover:underline underline-offset-4"
          >
            GitHub
          </a>
        </nav>
        <hr className="mt-4 border-neutral-200" />
      </header>

      <ul className="divide-y divide-neutral-200">
        {notes.map((n) => (
          <li key={n.id} className="py-4">
            <div className="grid grid-cols-[110px_1fr] gap-6">
              <div className="text-xs text-neutral-500 mt-1">
                {n.date
                  ? new Date(n.date).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })
                  : "-"}
              </div>
              <div>
                <h2 className="text-[16px] font-medium leading-6">{n.title}</h2>
                {n.snippet ? (
                  <p className="text-sm text-neutral-600 mt-1">{n.snippet}</p>
                ) : null}
                {n.tags && n.tags.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {n.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] text-neutral-700"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>

      <footer className="mt-8 text-sm text-neutral-600">
        Looking for long-form writing? Visit{" "}
        <Link
          to="/posts"
          className="underline underline-offset-4 hover:opacity-80"
        >
          the blog
        </Link>{" "}
        or{" "}
        <Link
          to="/newsletter"
          className="underline underline-offset-4 hover:opacity-80"
        >
          subscribe to the newsletter
        </Link>
        .
      </footer>
    </main>
  );
}
