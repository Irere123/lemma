import { Link } from "react-router";

export function ProfileHeader({
  title,
  current,
  links,
  avatarSrc = "/images/irere.png",
  alt = "Irere Emmanuel",
}: {
  title: string;
  current?: string;
  links: { label: string; to?: string; href?: string }[];
  avatarSrc?: string;
  alt?: string;
}) {
  return (
    <header className="mb-6">
      <div className="flex flex-col justify-center gap-4">
        <img
          src={avatarSrc}
          alt={alt}
          className="h-12 w-12 rounded-full ring-1 ring-neutral-200"
        />
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      </div>
      <InlineNav links={links} current={current} />
      <hr className="mt-4 border-neutral-200" />
    </header>
  );
}

export function InlineNav({
  links,
  current,
}: {
  links: { label: string; to?: string; href?: string }[];
  current?: string;
}) {
  return (
    <nav className="mt-2 text-sm text-neutral-600 flex gap-6">
      {links.map((l) => {
        const isCurrent =
          current && l.label.toLowerCase() === current.toLowerCase();
        if (l.to) {
          return (
            <Link
              key={l.label}
              to={l.to}
              className={
                isCurrent
                  ? "underline underline-offset-4"
                  : "hover:underline underline-offset-4"
              }
            >
              {l.label}
            </Link>
          );
        }
        return (
          <a
            key={l.label}
            href={l.href}
            target="_blank"
            rel="noreferrer"
            className={
              isCurrent
                ? "underline underline-offset-4"
                : "hover:underline underline-offset-4"
            }
          >
            {l.label}
          </a>
        );
      })}
    </nav>
  );
}

export function Callout({
  tone = "green",
  children,
}: {
  tone?: "green" | "red" | "amber" | "blue";
  children: React.ReactNode;
}) {
  const toneClasses: Record<string, string> = {
    green: "border-green-200 bg-green-50/60",
    red: "border-red-200 bg-red-50",
    amber: "border-amber-200 bg-amber-50",
    blue: "border-sky-200 bg-sky-50",
  };
  return (
    <div
      className={`rounded-lg border p-4 text-[15px] leading-7 ${toneClasses[tone]}`}
    >
      {children}
    </div>
  );
}

export function Section({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      {title ? (
        <h2 className="text-[15px] font-medium text-neutral-900">{title}</h2>
      ) : null}
      {children}
    </section>
  );
}

export function DateText({ date }: { date?: string }) {
  return (
    <div className="text-xs text-neutral-500 mt-1">
      {date
        ? new Date(date).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })
        : "-"}
    </div>
  );
}

export function TagPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] text-neutral-700">
      {children}
    </span>
  );
}

export function ListDivider() {
  return <hr className="border-neutral-200" />;
}

export function ListItem({
  left,
  children,
  to,
  prefetch = "intent",
}: {
  left?: React.ReactNode; // e.g., date or icon
  children: React.ReactNode; // right content
  to?: string;
  prefetch?: "intent" | "render" | "none";
}) {
  const content = (
    <div className="grid grid-cols-[110px_1fr] gap-6">
      <div>{left}</div>
      <div>{children}</div>
    </div>
  );

  if (to) {
    return (
      <Link to={to} prefetch={prefetch} className="block">
        {content}
      </Link>
    );
  }

  return content;
}
