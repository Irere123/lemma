import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";

import { getDefaultEditorValue } from "@/editor/utils/constants";
import { useTRPC } from "@/trpc/client";

export const Route = createFileRoute("/(editorial)/_editorial/documents")({
  component: DocumentsPage,
});

function DocumentsPage() {
  const trpc = useTRPC();
  const { isPending: upsertLoading, mutateAsync: upsertDocument } = useMutation(
    trpc.documents.upsertDocument.mutationOptions()
  );
  const { data, isLoading } = useQuery(
    trpc.documents.getUserDocuments.queryOptions({})
  );

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
            const resp = await upsertDocument({
              content: getDefaultEditorValue(),
            });

            if (resp) {
              navigate({ to: "/doc/$id", params: { id: resp.id } });
            }
          }}
        >
          Create new
        </button>
      </div>
      <div>
        {data?.map((document) => (
          <div
            key={document.id}
            className="flex justify-between items-center py-4"
          >
            <div className="flex-1">
              <Link
                to="/doc/$id"
                params={{ id: document.id }}
                className="hover:underline"
              >
                <span className="font-medium">
                  {document.title ?? "Untitled"}
                </span>
              </Link>
              {document.subtitle && (
                <p className="text-sm text-gray-600 mt-1">
                  {document.subtitle}
                </p>
              )}
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-sm text-gray-500">
                {format(document.createdAt!, "yyyy-MM-dd")}
              </span>
              <span
                className={`text-xs py-1 px-2 rounded-full ${
                  document.type === "ARTICLE"
                    ? "bg-blue-100 text-blue-800"
                    : document.type === "NEWSLETTER"
                      ? "bg-purple-100 text-purple-800"
                      : "bg-gray-100 text-gray-800"
                }`}
              >
                {document.type}
              </span>
              <span
                className={`text-xs py-1 px-2 rounded-full ${
                  document.status === "PUBLISHED"
                    ? "bg-green-100 text-green-800"
                    : "bg-yellow-100 text-yellow-800"
                }`}
              >
                {document.status}
              </span>
              {document.status === "PUBLISHED" &&
                document.type === "ARTICLE" && (
                  <a
                    href={`/posts/${document.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    View Live
                  </a>
                )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
