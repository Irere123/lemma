import type { Route } from "./+types/home";
import { ProfileHeader, Callout, Section } from "@/components/ui";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Irere Emmanuel — About" },
    {
      name: "description",
      content:
        "Software engineer building at the edge with Cloudflare Workers, React Router, and TypeScript.",
    },
  ];
}

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <ProfileHeader
        title="Irere Emmanuel"
        current="About"
        links={[
          { label: "About", to: "/" },
          { label: "Blog", to: "/posts" },
          { label: "Notes", to: "/notes" },
          { label: "Newsletter", to: "/newsletter" },
          { label: "GitHub", href: "https://github.com/ireredev" },
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
          On nights & weekends, I’m exploring editors and content systems,
          including an opinionated stack using React Router 7 + Cloudflare
          Workers. I’m also writing about practical engineering trade-offs.
        </Callout>

        <Section title="Previously, I’ve worked with:">
          <ul className="list-disc pl-5 space-y-2 text-[15px] leading-7">
            <li>
              Platform engineering on CI/CD and observability for large-scale
              deployments
            </li>
            <li>Web performance and SSR at the edge with Workers and Vite</li>
            <li>Design systems, documentation, and content tooling</li>
          </ul>
        </Section>
      </section>
    </main>
  );
}
