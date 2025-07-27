import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "BrainOS" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

export function loader({ context }: Route.LoaderArgs) {
  return { message: context.cloudflare.env.VALUE_FROM_CLOUDFLARE };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return (
    <div>
      <p>Hello Brainos</p>
    </div>
  );
}
