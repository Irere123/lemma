import { IconFilter2, IconClock, IconMail } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { format, isFuture } from "date-fns";

import { Button } from "@/components/ui/button";
import { useTRPC } from "@/trpc/client";
import { prefetch, trpc } from "@/trpc/server";

export const Route = createFileRoute("/_app/documents")({
  component: RouteComponent,
  loader: () => {
    prefetch(trpc.documents.getUserDocuments.queryOptions({}));
  },
});

function RouteComponent() {
  const trpc = useTRPC();

  const { data } = useQuery(trpc.documents.getUserDocuments.queryOptions({}));

  const documents = data?.documents || [];

  return (
    <div className="w-full max-w-3xl mx-auto space-y-4">
      <div className="flex flex-col gap-3">
        <h3 className="text-lg font-semibold">Documents</h3>
        <div className="flex justify-between">
          <Button type="button" variant={"outline"} onClick={async () => {}}>
            <IconFilter2 />
            Filter
          </Button>
        </div>
      </div>
      <div className="border border-border border-dashed py-3 px-4 rounded-md">
        {documents.map((document) => {
          const hasScheduledNewsletter =
            document.scheduledDate &&
            isFuture(new Date(document.scheduledDate));

          return (
            <div
              key={document.id}
              className="flex justify-between items-center py-4 border-b last:border-b-0"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Link
                    to={`/editor/$docId`}
                    params={{ docId: document.id }}
                    className="hover:underline"
                  >
                    <span className="font-medium">
                      {document.title ?? "Untitled"}
                    </span>
                  </Link>
                  {hasScheduledNewsletter && (
                    <div className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-full">
                      <IconMail className="w-3 h-3" />
                      <IconClock className="w-3 h-3" />
                      Scheduled
                    </div>
                  )}
                </div>
                {document.subtitle && (
                  <p className="text-sm text-gray-600 mt-1">
                    {document.subtitle}
                  </p>
                )}
                {hasScheduledNewsletter && (
                  <p className="text-xs text-purple-600 mt-1">
                    Newsletter scheduled for{" "}
                    {format(new Date(document.scheduledDate!), "PPp")}
                  </p>
                )}
              </div>
              <div className="flex items-center space-x-3">
                <span className="text-sm text-gray-500">
                  {format(document.createdAt!, "yyyy-MM-dd")}
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
                {document.status === "PUBLISHED" && (
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
          );
        })}
      </div>
    </div>
  );
}
