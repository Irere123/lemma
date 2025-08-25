import { Link, useNavigate } from "react-router";
import { format } from "date-fns";

import { trpc } from "@/trpc/client";
import type { Route } from "../+types/layout";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Documents" }];
}

export default function DocumentsPage() {
  const { isPending: upsertLoading, mutateAsync: upsertDocument } =
    trpc.documents.upsertDocument.useMutation();
  const { data, isLoading } = trpc.documents.getUserDocuments.useQuery();

  const navigate = useNavigate();

  if (isLoading) {
    return <div>loading...</div>;
  }

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="flex justify-between py-3">
        <h3>Documents</h3>
        <button
          disabled={upsertLoading}
          type="button"
          className="bg-amber-500 disabled:bg-amber-300 text-white py-2 px-4 rounded-xl"
          onClick={async () => {
            const resp = await upsertDocument({});

            if (resp) {
              navigate(`/editor/${resp.id}`);
            }
          }}
        >
          Create new
        </button>
      </div>
      <div>
        {data?.map((document) => (
          <div key={document.id} className="flex justify-between py-4">
            <Link to={`/editor/${document.id}`}>
              <span>{document.title ?? "Untitled"}</span>
            </Link>
            <div className="space-x-2">
              <span>{format(document.createdAt!, "yyyy-MM-dd")} </span>
              <span className="text-xs text-green-50 bg-green-600 py-1 px-3 rounded-full">
                {document.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
