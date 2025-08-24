import { trpc } from "@/trpc/client";
import type { Route } from "../+types/layout";
import { useNavigate } from "react-router";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Documents" }];
}

export default function DocumentsPage() {
  const {
    data,
    isPending: upsertLoading,
    mutateAsync: upsertDocument,
  } = trpc.documents.upsertDocument.useMutation();
  const navigate = useNavigate();

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div>
        <h3>Documents</h3>
        <button
          disabled={upsertLoading}
          type="button"
          onClick={async () => {
            const resp = await upsertDocument({
              title: "hello",
              subtitle: "jjd",
            });

            if (resp) {
              navigate(`/editor/${resp.id}`);
            }
          }}
        >
          Create new document
        </button>
      </div>
      <div></div>
    </div>
  );
}
