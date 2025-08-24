import type { Route } from "../+types/layout";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Documents" }];
}

export default function DocumentsPage() {
  return (
    <div className="w-full max-w-3xl mx-auto">
      <div>
        <h3>Documents</h3>
        <button>Create new document</button>
      </div>
      <div></div>
    </div>
  );
}
