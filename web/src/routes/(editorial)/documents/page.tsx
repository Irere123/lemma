import { Link } from "react-router";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";

import { HydrateClient, prefetch, trpc } from "@/trpc/server";
import { useTRPC } from "@/trpc/client";
import type { Route } from "../+types/layout";
import { Button } from "@/components/ui/button";
import { IconFilter2 } from "@tabler/icons-react";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Documents / Brain" }];
}

export async function loader() {
  prefetch(trpc.documents.getUserDocuments.queryOptions({}));
  return null;
}

export default function DocumentsPage() {
  const trpc = useTRPC();

  const { data } = useQuery(trpc.documents.getUserDocuments.queryOptions({}));

  return (
    <HydrateClient>
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
          {data?.map((document) => (
            <div
              key={document.id}
              className="flex justify-between items-center py-4"
            >
              <div className="flex-1">
                <Link to={`/editor/${document.id}`} className="hover:underline">
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
    </HydrateClient>
  );
}
