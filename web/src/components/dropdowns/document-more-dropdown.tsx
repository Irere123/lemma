import * as React from "react";
import { IconArrowUpRight, IconDots, IconTrash } from "@tabler/icons-react";

import { Button } from "../ui/button";
import { ConfirmDialog } from "../ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "../ui/dropdown-menu";
import { format } from "date-fns";
import { useDocumentStore } from "@/stores/document-store";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

interface Props {
  documentId: string;
}

export function DocumentMoreDropdown({ documentId }: Props) {
  const document = useDocumentStore((state) => state.documents[documentId]);
  const deleteDocument = useDocumentStore((state) => state.deleteDocument);
  const [isConfirmOpen, setIsConfirmOpen] = React.useState(false);
  const trpc = useTRPC();
  const deleteDocumentMutation = useMutation(
    trpc.documents.deleteDocument.mutationOptions()
  );

  const handleOpenConfirm = () => {
    setIsConfirmOpen(true);
  };

  const handleConfirmDelete = () => {
    deleteDocument(documentId);
    deleteDocumentMutation.mutate({ id: documentId });
    setIsConfirmOpen(false);
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <IconDots />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent sideOffset={10} align="end">
        <DropdownMenuItem
          onSelect={() => {
            window.open(`/posts/${document.id}`, "_blank");
          }}
        >
          <IconArrowUpRight />
          View Live
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={handleOpenConfirm}
          disabled={deleteDocumentMutation.isPending}
        >
          <IconTrash />
          Delete
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="flex items-center text-xs">
          <p className="text-gray-500">Last modified at</p>
          <p className="text-gray-700">
            {format(new Date(document.updatedAt!), "PPp")}
          </p>
        </DropdownMenuItem>
        <DropdownMenuItem className="flex items-center text-xs">
          <p className="text-gray-500">Created</p>
          <p className=" text-gray-700">
            {format(new Date(document.createdAt!), "PPp")}
          </p>
        </DropdownMenuItem>
      </DropdownMenuContent>
      <ConfirmDialog
        open={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        title="Delete document?"
        description="This will permanently remove the document. This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleConfirmDelete}
        confirmVariant="destructive"
      />
    </DropdownMenu>
  );
}
