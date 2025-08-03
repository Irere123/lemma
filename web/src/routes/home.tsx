import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Irere Emmnauel" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

export default function Home() {
  return (
    <div className="max-w-2xl mx-auto py-8 px-6">
      <p>Header</p>
    </div>
  );
}
