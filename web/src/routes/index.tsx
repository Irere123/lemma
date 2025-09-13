import { createFileRoute } from "@tanstack/react-router";

import { ProfileHeader, Callout, Section } from "@/components/landing";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <ProfileHeader
        title="Irere Emmanuel"
        current="About"
        links={[
          { label: "About", to: "/" },
          { label: "Blog", to: "/posts" },
          { label: "Newsletter", to: "/newsletter" },
          { label: "GitHub", href: "https://github.com/irere123" },
        ]}
      />

      <section className="space-y-6">
        <p className="text-[15px] leading-7">
          I’m a software engineer based in Kigali, working on platform and
          product experiences with
          <span className="underline underline-offset-4"> TypeScript</span>,
          React, and edge runtimes. I enjoy building DX-focused systems and
          reliable infrastructure that feels simple.
        </p>

        <Callout tone="green">
          On nights & weekends, I’m exploring AI and Web services, using an
          opinionated stack: Typescript and Elixir. I’m also writing about
          practical engineering.
        </Callout>

        <Section title="Previously, I’ve worked with:">
          <ul className="list-disc pl-5 space-y-2 text-[15px] leading-7">
            <li>
              Platform engineering on CI/CD and observability for large-scale
              deployments
            </li>
            <li>Web performance and SSR at the edge</li>
            <li>Design systems, documentation, and developer tooling</li>
          </ul>
        </Section>
      </section>
    </main>
  );
}
